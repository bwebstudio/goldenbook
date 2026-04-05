import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getIntentById, getIntentLabels, type ConciergeIntent } from './concierge.intents'
import {
  toIntentDTO,
  toRecommendationDTO,
  type ConciergeBootstrapDTO,
  type ConciergeRecommendResponseDTO,
} from './concierge.dto'
import {
  getConciergeCity,
  getConciergeRecommendations,
  getDefaultConciergeCity,
  getFallbackPlaces,
  getPlacesByIds,
  getViableIntents,
} from './concierge.query'
import {
  buildGreeting,
  buildResponseText,
  getFallbackIntents,
  getDynamicFallbackIntents,
  getBootstrapIntents,
  getDefaultIntent,
  getTimeOfDay,
  resolveIntentFromQuery,
  detectRefinementFromText,
  getRefinementTagAdjustments,
} from './concierge.service'
import {
  type OnboardingProfile,
  parseInterests,
} from '../../shared/onboarding/onboarding.scoring'
import { getActiveVisibilityPlaceIdsByCity } from '../visibility/visibility.query'
import { resolveWeather } from '../now/now.weather'
import { normalizeLocale } from '../../shared/i18n/locale'
// Shared scoring engine (same as NOW)
import {
  scoreCandidate,
  applyDiversityRules,
  getNowTimeOfDay,
  type ScoringContext,
  type ScoredCandidate,
  type UnifiedCandidate,
} from '../shared-scoring'

// Backwards compat alias — helpers that used ScoredPlace now work with UnifiedCandidate
type ScoredPlace = UnifiedCandidate

// ─── Session history for anti-repetition ──────────────────────────────────────
const sessionHistory = new Map<string, { placeIds: Set<string>; intentIds: Set<string> }>()

// Cleanup stale sessions every 10 minutes
setInterval(() => {
  // Keep max 500 sessions — evict oldest
  if (sessionHistory.size > 500) {
    const keys = [...sessionHistory.keys()]
    for (let i = 0; i < keys.length - 500; i++) sessionHistory.delete(keys[i])
  }
}, 600_000)

// ─── Schema ───────────────────────────────────────────────────────────────────

const bootstrapQuerySchema = z.object({
  city:      z.string().min(1).optional(),
  locale:    z.string().min(2).max(5).default('en'),
  // Onboarding personalization — optional
  interests: z.string().optional(), // comma-separated interest IDs
  style:     z.string().optional(), // single exploration style ID
})

const recommendBodySchema = z.object({
  city:      z.string().min(1).optional(),
  intent:    z.string().min(1).optional(),
  query:     z.string().max(200).optional(),
  limit:     z.coerce.number().int().min(1).max(10).default(3),
  locale:    z.string().min(2).max(5).default('en'),
  // Onboarding personalization — optional
  interests: z.array(z.string()).optional(),
  style:     z.string().optional(),
  // NOW → Concierge handoff context (optional)
  now_context: z.object({
    time_of_day: z.string().optional(),
    weather:     z.string().optional(),
    inferred_moment: z.string().optional(),
    adjustment:  z.enum(['relax', 'energy', 'treat']).optional(),
  }).optional(),
})

type AdjustmentEmotion = 'relax' | 'energy' | 'treat' | 'romantic' | 'culture'

const EMOTION_INTENT_GROUPS: Record<AdjustmentEmotion, string[]> = {
  relax: ['quiet_wine_bar', 'gallery_afternoon', 'coffee_and_work', 'hidden_gems'],
  energy: ['cocktail_bars', 'sunset_drinks', 'late_night_jazz', 'after_dinner_drinks', 'hidden_gems'],
  treat: ['romantic_dinner', 'design_shopping', 'sunset_drinks', 'long_lunch', 'late_night_jazz'],
  romantic: ['romantic_dinner', 'quiet_wine_bar', 'sunset_drinks', 'hidden_gems'],
  culture: ['gallery_afternoon', 'hidden_gems', 'coffee_and_work'],
}

const ADJUSTMENT_SIGNAL_TAGS: Record<AdjustmentEmotion, string[]> = {
  relax: [
    'quiet',
    'calm',
    'slow',
    'slower',
    'tranquil',
    'intimate',
    'wine',
    'gallery',
    'art',
    'culture',
    'spa',
    'relax',
  ],
  energy: [
    'cocktail',
    'cocktails',
    'rooftop',
    'terrace',
    'view',
    'sunset',
    'nightlife',
    'music',
    'jazz',
    'live-music',
    'discover',
    'hidden',
  ],
  treat: [
    'romantic',
    'fine-dining',
    'luxury',
    'design',
    'boutique',
    'special',
    'elegant',
    'atmospheric',
    'refined',
    'golden-hour',
  ],
  romantic: [
    'romantic', 'intimate', 'date', 'couple', 'candlelit', 'wine', 'sunset',
    'fine-dining', 'atmospheric', 'elegant',
  ],
  culture: [
    'gallery', 'art', 'museum', 'culture', 'contemporary', 'exhibition',
    'design', 'architecture', 'heritage',
  ],
}

function getEmotionScoreForPlace(
  place: ScoredPlace,
  intent: ConciergeIntent,
  emotion: AdjustmentEmotion,
): number {
  const text = [place.short_description, place.editorial_summary]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const signalTags = ADJUSTMENT_SIGNAL_TAGS[emotion]
  let score = 0

  for (const tag of signalTags) {
    if (text.includes(tag)) score += 3
  }

  for (const tag of intent.tags) {
    if (signalTags.includes(tag)) score += 2
  }

  if (emotion === 'relax' && ['cafe', 'museum'].includes(place.place_type)) score += 2
  if (emotion === 'energy' && ['bar', 'venue'].includes(place.place_type)) score += 2
  if (emotion === 'treat' && ['restaurant', 'shop'].includes(place.place_type)) score += 2

  return score
}

function dedupePlaces(places: ScoredPlace[]): ScoredPlace[] {
  const seen = new Set<string>()
  const deduped: ScoredPlace[] = []

  for (const place of places) {
    if (seen.has(place.id)) continue
    seen.add(place.id)
    deduped.push(place)
  }

  return deduped
}

function mergeUniquePlaces(base: ScoredPlace[], extra: ScoredPlace[], limit: number): ScoredPlace[] {
  return dedupePlaces([...base, ...extra]).slice(0, limit)
}

function getEmotionIntentGroup(adjustment: AdjustmentEmotion, resolvedIntent: ConciergeIntent): ConciergeIntent[] {
  const ids = [resolvedIntent.id, ...EMOTION_INTENT_GROUPS[adjustment]]
  const seen = new Set<string>()
  const intents: ConciergeIntent[] = []

  for (const id of ids) {
    const intent = getIntentById(id)
    if (!intent || seen.has(intent.id)) continue
    seen.add(intent.id)
    intents.push(intent)
  }

  return intents
}

function sortPlacesByEmotionPriority(places: ScoredPlace[], emotion: AdjustmentEmotion): ScoredPlace[] {
  const signalTags = ADJUSTMENT_SIGNAL_TAGS[emotion]

  return [...places].sort((a, b) => {
    const scoreText = (place: ScoredPlace) =>
      [place.short_description, place.editorial_summary]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

    const scoreFor = (place: ScoredPlace) => {
      const text = scoreText(place)
      let score = 0
      for (const tag of signalTags) {
        if (text.includes(tag)) score += 3
      }
      if (emotion === 'relax' && ['cafe', 'museum'].includes(place.place_type)) score += 2
      if (emotion === 'energy' && ['bar', 'venue'].includes(place.place_type)) score += 2
      if (emotion === 'treat' && ['restaurant', 'shop'].includes(place.place_type)) score += 2
      return score
    }

    const delta = scoreFor(b) - scoreFor(a)

    if (delta !== 0) return delta
    if ((b.featured ? 1 : 0) !== (a.featured ? 1 : 0)) return (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
    return (b.popularity_score ?? 0) - (a.popularity_score ?? 0)
  })
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function conciergeRoutes(app: FastifyInstance) {
  // ── GET /concierge/bootstrap ─────────────────────────────────────────────────
  //
  // Returns everything needed for the initial Concierge screen render:
  //   - resolved city
  //   - time of day
  //   - greeting copy (deterministic, no AI)
  //   - 3 curated intent cards for this city + time of day

  app.get('/concierge/bootstrap', async (request, reply) => {
    const { city: cityParam, locale: rawLocale, interests: rawInterests, style } =
      bootstrapQuerySchema.parse(request.query)
    const locale = normalizeLocale(rawLocale)

    const timeOfDay = getTimeOfDay()

    // Resolve city: param → DB → first available city → dev fallback (Lisbon)
    let city: { slug: string; name: string }
    if (cityParam) {
      const resolved = await getConciergeCity(cityParam, locale)
      if (!resolved) {
        request.log.warn({ requestedCity: cityParam }, '[Concierge] City slug not found in destinations — falling back to default')
      }
      city = resolved ?? (await getDefaultConciergeCity(locale))
    } else {
      city = await getDefaultConciergeCity(locale)
    }

    const profile: OnboardingProfile = {
      interests: parseInterests(rawInterests),
      style:     style ?? undefined,
    }

    // Resolve weather for context-aware intent selection
    const weatherResult = await resolveWeather(undefined, undefined, city.slug)
    const weather = weatherResult?.condition ?? null

    const greeting = buildGreeting(timeOfDay, city.name, locale)
    const allIntents = getBootstrapIntents(timeOfDay, profile, weather)

    // Filter bootstrap intents to only those with viable places in this city
    const viable = await getViableIntents(city.slug, 2)
    const isViable = (i: typeof allIntents[0]) =>
      (i.editorialIntents ?? []).some((ei) => viable.has(ei))
      || (i.fallbackIntents ?? []).some((fi) => viable.has(fi))

    let intents = allIntents.filter(isViable).slice(0, 3)

    // If not enough, fill from ALL registry intents that are viable AND time-appropriate
    if (intents.length < 3) {
      const { INTENT_REGISTRY } = await import('./concierge.intents')
      // First pass: only intents that match the current time of day
      const timeFiltered = INTENT_REGISTRY
        .filter((i) =>
          !intents.find((x) => x.id === i.id)
          && isViable(i)
          && i.preferredTimeOfDay.includes(timeOfDay),
        )
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 3 - intents.length)
      intents = [...intents, ...timeFiltered]

      // Second pass: if STILL not enough, allow any viable intent (last resort)
      if (intents.length < 3) {
        const remaining = INTENT_REGISTRY
          .filter((i) => !intents.find((x) => x.id === i.id) && isViable(i))
          .sort((a, b) => b.priority - a.priority)
          .slice(0, 3 - intents.length)
        intents = [...intents, ...remaining]
      }
    }

    const response: ConciergeBootstrapDTO = {
      city,
      timeOfDay,
      greeting,
      intents: intents.map((i) => toIntentDTO(i, locale)),
    }

    return reply.send(response)
  })

  // ── POST /concierge/recommend ────────────────────────────────────────��───────
  //
  // Resolves a recommendation request from either:
  //   - explicit intent id (from intent card tap)
  //   - free-text query (typed by user → mapped deterministically to an intent)
  //
  // Backend owns all recommendation logic. Frontend receives ready-to-render data.

  app.post('/concierge/recommend', async (request, reply) => {
    const { city: cityParam, intent: intentParam, query, limit, locale: rawLocale, interests, style, now_context } =
      recommendBodySchema.parse(request.body)
    const locale = normalizeLocale(rawLocale)

    if (!intentParam && !query && !now_context) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'At least one of "intent", "query", or "now_context" must be provided.',
      })
    }

    const timeOfDay = getTimeOfDay()

    // Resolve city
    let city: { slug: string; name: string }
    if (cityParam) {
      const resolved = await getConciergeCity(cityParam, locale)
      if (!resolved) {
        request.log.warn({ requestedCity: cityParam }, '[Concierge] City slug not found in destinations — falling back to default')
      }
      city = resolved ?? (await getDefaultConciergeCity(locale))
    } else {
      city = await getDefaultConciergeCity(locale)
    }

    // ── Detect refinement from text queries ──────────────────────────────
    // "algo más relajado", "something quieter" etc. → adjusts tag weights
    let detectedRefinement: string | null = null
    if (query && !intentParam) {
      detectedRefinement = detectRefinementFromText(query)
    }

    // Resolve intent: explicit id → refinement → keyword resolution → NOW → default
    let resolvedIntent: ReturnType<typeof getIntentById> | undefined
    if (intentParam) {
      resolvedIntent = getIntentById(intentParam) ?? resolveIntentFromQuery(query ?? '', timeOfDay)
    } else if (query) {
      resolvedIntent = resolveIntentFromQuery(query, timeOfDay)
    } else if (now_context?.inferred_moment) {
      // NOW → Concierge handoff: map moment to best-matching intent directly.
      // If an adjustment is provided, bias the intent toward that emotion.
      // Map context tags (from NOW bestTag) to Concierge intents
      const tagToIntent: Record<string, string> = {
        // The 22 dashboard context tags → best-matching Concierge intent
        'brunch':       'coffee_and_work',
        'coffee':       'coffee_and_work',
        'quick-stop':   'coffee_and_work',
        'dinner':       'romantic_dinner',
        'fine-dining':  'romantic_dinner',
        'romantic':     'romantic_dinner',
        'cocktails':    'cocktail_bars',
        'late-night':   'after_dinner_drinks',
        'wine':         'quiet_wine_bar',
        'sunset':       'sunset_drinks',
        'rooftop':      'sunset_drinks',
        'terrace':      'sunset_drinks',
        'viewpoint':    'sunset_drinks',
        'live-music':   'late_night_jazz',
        'culture':      'gallery_afternoon',
        'shopping':     'design_shopping',
        'wellness':     'hidden_gems',
        'local-secret': 'hidden_gems',
        'family':       'long_lunch',
        'sunday':       'long_lunch',
        'celebration':  'cocktail_bars',
        'rainy-day':    'gallery_afternoon',
      }

      // Adjustment overrides: shift the intent based on emotion
      const adjustmentOverrides: Record<string, Record<string, string>> = {
        relax: {
          'cocktails':   'quiet_wine_bar',
          'dinner':      'quiet_wine_bar',
          'fine-dining': 'quiet_wine_bar',
          'late-night':  'quiet_wine_bar',
          'shopping':    'gallery_afternoon',
          'coffee':      'coffee_and_work',
          'live-music':  'gallery_afternoon',
          'celebration': 'quiet_wine_bar',
        },
        energy: {
          'coffee':      'hidden_gems',
          'wine':        'cocktail_bars',
          'dinner':      'cocktail_bars',
          'fine-dining': 'cocktail_bars',
          'culture':     'hidden_gems',
          'shopping':    'hidden_gems',
          'wellness':    'hidden_gems',
          'sunset':      'cocktail_bars',
        },
        treat: {
          'coffee':      'design_shopping',
          'dinner':      'romantic_dinner',
          'cocktails':   'sunset_drinks',
          'shopping':    'design_shopping',
          'sunset':      'sunset_drinks',
          'culture':     'gallery_afternoon',
          'late-night':  'late_night_jazz',
          'wine':        'romantic_dinner',
        },
        romantic: {
          'coffee':      'quiet_wine_bar',
          'dinner':      'romantic_dinner',
          'cocktails':   'quiet_wine_bar',
          'sunset':      'sunset_drinks',
          'shopping':    'hidden_gems',
          'culture':     'hidden_gems',
          'late-night':  'quiet_wine_bar',
        },
        culture: {
          'coffee':      'gallery_afternoon',
          'dinner':      'hidden_gems',
          'cocktails':   'hidden_gems',
          'shopping':    'gallery_afternoon',
          'sunset':      'hidden_gems',
          'late-night':  'gallery_afternoon',
        },
      }

      const adj = now_context.adjustment
      const overrideMap = adj ? adjustmentOverrides[adj] : null
      const overrideId = overrideMap?.[now_context.inferred_moment]
      const baseId = tagToIntent[now_context.inferred_moment]
      const mappedIntentId = overrideId ?? baseId

      resolvedIntent = mappedIntentId
        ? getIntentById(mappedIntentId) ?? getDefaultIntent(timeOfDay)
        : getDefaultIntent(timeOfDay)
    } else {
      resolvedIntent = getDefaultIntent(timeOfDay)
    }

    // Safety: always have a valid intent
    if (!resolvedIntent) {
      resolvedIntent = getDefaultIntent(timeOfDay)
    }

    const profile: OnboardingProfile = {
      interests: interests?.length ? interests : undefined,
      style:     style ?? undefined,
    }

    // ── Anti-repetition: track shown places per session ──────────────────
    const sessionId = (request.headers['x-session-id'] as string) ?? ''
    const sessionKey = `concierge:${sessionId}`
    const previouslyShown = sessionHistory.get(sessionKey) ?? { placeIds: new Set<string>(), intentIds: new Set<string>() }

    // Fetch candidate places from DB — fetch more than needed for scoring
    const fetchLimit = Math.max(limit * 3, 12)
    const nowTimeOfDay = getNowTimeOfDay()
    const weatherResult = await resolveWeather(undefined, undefined, city.slug)
    const weather = weatherResult?.condition

    const candidates = await getConciergeRecommendations(
      city.slug,
      resolvedIntent,
      locale,
      fetchLimit,
      nowTimeOfDay,
    )

    // Get paid Concierge placements — filtered by city + active campaign dates
    let boostIds: Set<string> = new Set()
    try {
      const ids = await getActiveVisibilityPlaceIdsByCity('concierge', city.slug, 20)
      boostIds = new Set(ids)
    } catch {}

    // ── Inject paid placements that may not match intent filter ──────────
    // Paid placements bypass intent-based SQL filtering (eligibility guarantee).
    // They get an intent mismatch penalty in scoring but remain in the pool.
    if (boostIds.size > 0) {
      const candidateIds = new Set(candidates.map((c) => c.id))
      const missingPaidIds = [...boostIds].filter((id) => !candidateIds.has(id))
      if (missingPaidIds.length > 0) {
        const paidPlaces = await getPlacesByIds(missingPaidIds, locale, nowTimeOfDay)
        candidates.push(...paidPlaces)
      }
    }

    // ── Shared scoring context (same engine as NOW) ──────────────────
    const adjustmentEmotion = (now_context?.adjustment ?? detectedRefinement) as AdjustmentEmotion | null
    const refinementAdj = adjustmentEmotion ? getRefinementTagAdjustments(adjustmentEmotion) : null

    const scoringCtx: ScoringContext = {
      timeOfDay: nowTimeOfDay,
      weather,
      paidPlaceIds: boostIds,
      excludeIds: new Set(),  // don't hard-exclude, use penalty instead
      weights: {
        commercial: 0.15,
        context:    0.30,
        editorial:  0.15,
        quality:    0.25,
        proximity:  0.15,
      },
      surface: 'concierge',
      intentTags: [...resolvedIntent.tags, ...resolvedIntent.categorySlugs],
    }

    // Score all candidates with the shared engine + Concierge-specific adjustments
    let scoredCandidates: ScoredCandidate[] = candidates
      .map((place) => {
        const result = scoreCandidate(place, scoringCtx)

        // Concierge-specific: intent compatibility scoring
        const intentMatch = resolvedIntent.placeTypes.includes(place.place_type)
        if (intentMatch) {
          result.totalScore += 5
        } else if (result.isSponsored) {
          // Paid placement doesn't match intent place_type.
          // Measure how contextually close it is using tag overlap.
          const intentTagSet = new Set([...resolvedIntent.tags, ...resolvedIntent.categorySlugs]
            .map(t => t.toLowerCase().replace(/[^a-z0-9]/g, '-')))
          const placeTags = place.context_tag_slugs ?? []
          const tagOverlap = placeTags.filter(t => intentTagSet.has(t)).length

          if (tagOverlap >= 2) {
            // Loosely related (e.g. wine bar for romantic dinner) — small penalty
            result.totalScore -= 5
          } else if (tagOverlap === 1) {
            // Weakly related — moderate penalty
            result.totalScore -= 12
          } else {
            // Strongly incompatible (e.g. late-night bar for family brunch) — heavy penalty
            result.totalScore -= 20
          }
        }

        // Anti-repetition penalty (soft, not hard exclude)
        if (previouslyShown.placeIds.has(place.id)) {
          result.totalScore -= 15
        }

        // Refinement tag adjustments (additive on top of shared scoring)
        if (refinementAdj && place.context_tag_slugs?.length) {
          const placeTags = new Set(place.context_tag_slugs)
          for (const boostTag of refinementAdj.boost) {
            if (placeTags.has(boostTag)) result.totalScore += 8
          }
          for (const reduceTag of refinementAdj.reduce) {
            if (placeTags.has(reduceTag)) result.totalScore -= 6
          }
        }

        return result
      })
      .filter((r) => r.totalScore > 0)
      .sort((a, b) => b.totalScore - a.totalScore)

    // Apply shared diversity rules (same as NOW)
    scoredCandidates = applyDiversityRules(scoredCandidates)

    // Paid placement visibility floor: guarantee paid appears within top results
    // Only inject if the paid placement has a reasonable score (not absurdly incompatible)
    const topSponsored = scoredCandidates.find((r) => r.isSponsored)
    if (topSponsored && topSponsored.totalScore > 5) {
      const topSlice = scoredCandidates.slice(0, limit)
      if (!topSlice.some((r) => r.place.id === topSponsored.place.id)) {
        // Paid placement fell outside visible results — inject at last position in top results
        scoredCandidates = [...scoredCandidates.slice(0, limit - 1).filter((r) =>
          r.place.id !== topSponsored.place.id,
        ), topSponsored, ...scoredCandidates.slice(limit - 1).filter((r) =>
          r.place.id !== topSponsored.place.id,
        )]
      }
    }

    // Extract places — deduplicate by place ID
    const seenIds = new Set<string>()
    let scored = scoredCandidates
      .filter((r) => {
        if (seenIds.has(r.place.id)) return false
        seenIds.add(r.place.id)
        return true
      })
      .slice(0, limit)
      .map((r) => r.place)
    let levelUsed = adjustmentEmotion ? 1 : 0

    if (adjustmentEmotion && scored.length < limit) {
      // Level 2+3 fallback: fetch from related intents using shared scoring
      const emotionIntents = getEmotionIntentGroup(adjustmentEmotion, resolvedIntent)
      const level2Buckets = await Promise.all(
        emotionIntents
          .filter((intent) => intent.id !== resolvedIntent.id)
          .map(async (intent) => {
            const candidatesForIntent = await getConciergeRecommendations(
              city.slug, intent, locale, fetchLimit, nowTimeOfDay,
            )
            const intentCtx: ScoringContext = {
              ...scoringCtx,
              intentTags: [...intent.tags, ...intent.categorySlugs],
            }
            return candidatesForIntent
              .map((place) => scoreCandidate(place, intentCtx))
              .filter((r) => r.totalScore > 0)
              .sort((a, b) => b.totalScore - a.totalScore)
              .map((r) => r.place)
          }),
      )

      const level2Matches = dedupePlaces(level2Buckets.flat())
      const combined = mergeUniquePlaces(scored, level2Matches, limit)

      if (combined.length >= limit) {
        scored = combined
        levelUsed = 2
      } else {
        const fallbackPlaceTypes = [...new Set(emotionIntents.flatMap((intent) => intent.placeTypes))]
        const level3Matches = sortPlacesByEmotionPriority(
          await getFallbackPlaces(
            city.slug, locale,
            [...previouslyShown.placeIds, ...combined.map((p) => p.id)],
            Math.max(limit * 2, 6),
            fallbackPlaceTypes,
          ),
          adjustmentEmotion,
        )

        scored = mergeUniquePlaces(combined, level3Matches, limit)
        levelUsed = 3
      }
    }

    // ── Smart fallback: if insufficient results, search related categories ──
    if (scored.length < limit) {
      const existingIds = scored.map((p) => p.id)
      const fallbackPlaces = await getFallbackPlaces(
        city.slug,
        locale,
        [...previouslyShown.placeIds, ...existingIds],
        Math.max(limit * 2, 6),
        adjustmentEmotion
          ? [...new Set(getEmotionIntentGroup(adjustmentEmotion, resolvedIntent).flatMap((intent) => intent.placeTypes))]
          : resolvedIntent.placeTypes,
      )
      const extra = adjustmentEmotion
        ? sortPlacesByEmotionPriority(fallbackPlaces, adjustmentEmotion)
        : fallbackPlaces
      scored = mergeUniquePlaces(scored, extra, limit)
    }

    request.log.info({
      level_used: levelUsed,
      results_count: scored.length,
      emotion_applied: adjustmentEmotion ?? null,
      resolved_intent: resolvedIntent.id,
    }, '[Concierge] adjustment fallback ladder')

    // Update session history
    for (const p of scored) previouslyShown.placeIds.add(p.id)
    previouslyShown.intentIds.add(resolvedIntent.id)
    sessionHistory.set(sessionKey, previouslyShown)

    const localeFamily = locale.split('-')[0]
    const recommendations = scored.map((p) => toRecommendationDTO(p, resolvedIntent, locale))

    // ── Response text: always contextual, never generic ────────────────
    let responseText: string
    if (recommendations.length > 0) {
      responseText = buildResponseText(resolvedIntent, city.name, timeOfDay, locale)
    } else {
      // Even with fallback empty — give time-based suggestion
      const todLabel = localeFamily === 'pt'
        ? (timeOfDay === 'morning' ? 'manhã' : timeOfDay === 'afternoon' ? 'tarde' : 'noite')
        : localeFamily === 'es'
          ? (timeOfDay === 'morning' ? 'mañana' : timeOfDay === 'afternoon' ? 'tarde' : 'noche')
          : timeOfDay
      responseText = localeFamily === 'pt'
        ? `Para esta ${todLabel} em ${city.name}, experimente explorar outras categorias.`
        : localeFamily === 'es'
          ? `Para esta ${todLabel} en ${city.name}, prueba explorar otras categorías.`
          : `For this ${todLabel} in ${city.name}, try exploring other categories.`
    }

    // ── Dynamic fallback intents: only suggest if viable in this city ──
    const viableIntents = await getViableIntents(city.slug, 2)
    const allFallbackIntents = getDynamicFallbackIntents(
      resolvedIntent.id,
      previouslyShown.intentIds,
      timeOfDay,
      locale,
    )
    // Filter: only suggest intents that have places with matching editorial intents in this city
    const fallbackIntents = allFallbackIntents.filter((fi) => {
      const intent = getIntentById(fi.id)
      if (!intent) return false
      // Check if any of the intent's editorial tags exist as viable in this city
      return (intent.editorialIntents ?? []).some((ei) => viableIntents.has(ei))
        || (intent.fallbackIntents ?? []).some((fi2) => viableIntents.has(fi2))
    }).slice(0, 2)

    const resolvedIntentTitle = getIntentLabels(resolvedIntent.id, locale).title

    const response: ConciergeRecommendResponseDTO = {
      city,
      timeOfDay,
      resolvedIntent: { id: resolvedIntent.id, title: resolvedIntentTitle },
      responseText,
      recommendations,
      fallbackIntents,
    }

    return reply.send(response)
  })
}
