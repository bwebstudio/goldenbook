import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../../db/postgres'
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
  isOverExposed,
  recordExposures,
  type ScoringContext,
  type ScoredCandidate,
  type UnifiedCandidate,
} from '../shared-scoring'

// Backwards compat alias — helpers that used ScoredPlace now work with UnifiedCandidate
type ScoredPlace = UnifiedCandidate

// ─── Session pool for curated Concierge experience ──────────────────────────
//
// Instead of querying the full DB on every intent tap, the Concierge builds
// a session pool of ~20 candidates on first request. Subsequent intent changes
// rerank within this pool, keeping the experience curated and consistent.

const SESSION_POOL_SIZE = 20
const SESSION_POOL_TTL = 15 * 60 * 1000 // 15 minutes
const MAX_PLACES_PER_PILL = 6   // curated cap: max 6 unique places per intent
const RESULTS_PER_PAGE = 3      // show 3 at a time

interface PillState {
  /** All scored candidates for this pill (up to MAX_PLACES_PER_PILL) */
  candidates: UnifiedCandidate[]
  /** How many times this pill has been tapped */
  tapCount: number
}

interface ConciergeSession {
  placeIds: Set<string>
  intentIds: Set<string>
  lastHeroId: string | null
  lastIntentId: string | null
  pool: UnifiedCandidate[] | null
  poolCity: string | null
  poolBuiltAt: number
  heroHistory: Set<string>
  /** Per-pill state: scored candidates + tap counter, keyed by intent+adjustment */
  pills: Map<string, PillState>
}
const sessionHistory = new Map<string, ConciergeSession>()

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
  relax: ['relaxed_walk', 'quiet_wine_bar', 'gallery_afternoon', 'coffee_and_work', 'hidden_gems'],
  energy: ['cocktail_bars', 'sunset_drinks', 'late_night_jazz', 'after_dinner_drinks', 'hidden_gems'],
  treat: ['romantic_dinner', 'design_shopping', 'sunset_drinks', 'long_lunch', 'late_night_jazz'],
  romantic: ['romantic_dinner', 'quiet_wine_bar', 'sunset_drinks', 'hidden_gems'],
  culture: ['gallery_afternoon', 'relaxed_walk', 'hidden_gems', 'coffee_and_work'],
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
    const allIntents = getBootstrapIntents(timeOfDay, profile, weather, city.slug)

    // Filter bootstrap intents to only those with viable places in this city
    // Require at least one primary editorialIntent to be viable,
    // or fallback-viable with high priority (broad appeal intents)
    // Get place types actually available in this city
    const { rows: cityTypes } = await db.query<{ place_type: string; cnt: string }>(`
      SELECT p.place_type, COUNT(*)::text AS cnt
      FROM places p JOIN destinations d ON d.id = p.destination_id
      WHERE d.slug = lower($1) AND p.status = 'published' AND p.is_active = true
      GROUP BY p.place_type
    `, [city.slug])
    const availableTypes = new Map(cityTypes.map((r) => [r.place_type, parseInt(r.cnt, 10)]))

    const viable = await getViableIntents(city.slug, 2)
    const isViable = (i: typeof allIntents[0]) => {
      // Intent must have at least 2 places of matching type in this city
      const hasMatchingTypes = i.placeTypes.some((pt) => (availableTypes.get(pt) ?? 0) >= 2)
      if (!hasMatchingTypes) return false
      const hasEditorial = (i.editorialIntents ?? []).some((ei) => viable.has(ei))
      if (hasEditorial) return true
      const hasFallback = (i.fallbackIntents ?? []).some((fi) => viable.has(fi))
      return hasFallback && i.priority >= 6
    }

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
        'lunch':        'long_lunch',
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
    const session: ConciergeSession = sessionHistory.get(sessionKey) ?? {
      placeIds: new Set<string>(),
      intentIds: new Set<string>(),
      lastHeroId: null,
      lastIntentId: null,
      pool: null,
      poolCity: null,
      poolBuiltAt: 0,
      heroHistory: new Set<string>(),
      pills: new Map<string, PillState>(),
    }

    // Hero rotation: detect intent change
    const intentChanged = session.lastIntentId != null && session.lastIntentId !== resolvedIntent.id
    const previousHeroId = intentChanged ? session.lastHeroId : null

    const nowTimeOfDay = getNowTimeOfDay()
    const weatherResult = await resolveWeather(undefined, undefined, city.slug)
    const weather = weatherResult?.condition

    // ── Build or reuse session pool ─────────────────────────────────────
    const poolExpired = Date.now() - session.poolBuiltAt > SESSION_POOL_TTL
    const poolCityChanged = session.poolCity !== city.slug
    const needsPool = !session.pool || poolExpired || poolCityChanged

    let candidates: UnifiedCandidate[]

    if (needsPool) {
      // Build fresh pool: fetch a broad set of candidates across multiple intents
      const poolIntents = [resolvedIntent]

      // Add time-appropriate intents to broaden the pool
      const { INTENT_REGISTRY } = await import('./concierge.intents')
      const timeIntents = INTENT_REGISTRY
        .filter((i) => i.preferredTimeOfDay.includes(timeOfDay) && i.id !== resolvedIntent.id)
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 3)
      poolIntents.push(...timeIntents)

      // Fetch candidates from multiple intents and deduplicate
      const allCandidates: UnifiedCandidate[] = []
      const seenPoolIds = new Set<string>()
      for (const intent of poolIntents) {
        const batch = await getConciergeRecommendations(city.slug, intent, locale, SESSION_POOL_SIZE, nowTimeOfDay)
        for (const c of batch) {
          if (!seenPoolIds.has(c.id)) {
            seenPoolIds.add(c.id)
            allCandidates.push(c)
          }
        }
      }

      // Inject paid placements into the pool
      let boostIds: Set<string> = new Set()
      try {
        const ids = await getActiveVisibilityPlaceIdsByCity('concierge', city.slug, 20)
        boostIds = new Set(ids)
      } catch (err) {
        request.log.warn({ err, city: city.slug }, '[Concierge] Failed to load paid placements for pool')
      }

      if (boostIds.size > 0) {
        const missingPaidIds = [...boostIds].filter((id) => !seenPoolIds.has(id))
        if (missingPaidIds.length > 0) {
          const paidPlaces = await getPlacesByIds(missingPaidIds, locale, nowTimeOfDay)
          allCandidates.push(...paidPlaces)
        }
      }

      session.pool = allCandidates
      session.poolCity = city.slug
      session.poolBuiltAt = Date.now()
      // Clear cached pills — they contain candidates from the previous city
      session.pills.clear()
      session.placeIds.clear()
      session.heroHistory.clear()
      session.lastHeroId = null
      session.lastIntentId = null
      candidates = allCandidates
    } else {
      candidates = session.pool!
    }

    // ── Resolve adjustment emotion early (needed for pill key) ─────────
    const adjustmentEmotion = (now_context?.adjustment ?? detectedRefinement) as AdjustmentEmotion | null

    // ── Per-pill pagination: curated, finite, intentional ────────────────
    //
    // Each pill (intent+adjustment) gets max 6 unique places, shown 3 at a time.
    // Tap 1 → results 1-3, Tap 2 → results 4-6, Tap 3+ → cycle back to 1-3.
    //
    const pillKey = `${resolvedIntent.id}:${adjustmentEmotion ?? 'none'}`
    const existingPill = session.pills.get(pillKey)

    if (existingPill) {
      // Pill already scored — paginate within the cached candidates
      existingPill.tapCount++
      const page = ((existingPill.tapCount - 1) % 2) // 0 or 1 (two pages of 3)
      const start = page * RESULTS_PER_PAGE
      const pageResults = existingPill.candidates.slice(start, start + RESULTS_PER_PAGE)

      // If this page is empty (fewer than 6 candidates), cycle to page 0
      const results = pageResults.length > 0 ? pageResults : existingPill.candidates.slice(0, RESULTS_PER_PAGE)

      session.pills.set(pillKey, existingPill)
      sessionHistory.set(sessionKey, session)

      const recommendations = results.map((p) => toRecommendationDTO(p, resolvedIntent, locale))
      const responseText = recommendations.length > 0
        ? buildResponseText(resolvedIntent, city.name, timeOfDay, locale)
        : (locale.split('-')[0] === 'es' ? `Explora más opciones en ${city.name}.` : `Explore more in ${city.name}.`)

      const cachedPoolTypes = new Set((session.pool ?? []).map((c) => c.place_type))
      const fallbackIntents = getDynamicFallbackIntents(resolvedIntent.id, session.intentIds, timeOfDay, locale)
        .filter((fi) => {
          const intent = getIntentById(fi.id)
          if (!intent) return false
          return intent.placeTypes.some((pt) => cachedPoolTypes.has(pt))
        }).slice(0, 4)

      const resolvedIntentTitle = getIntentLabels(resolvedIntent.id, locale).title
      return reply.send({
        city, timeOfDay,
        resolvedIntent: { id: resolvedIntent.id, title: resolvedIntentTitle },
        responseText, recommendations, fallbackIntents,
      })
    }

    // ── First tap on this pill: score pool and cache top 6 ──────────────

    // Get paid placement IDs for scoring
    let boostIds: Set<string> = new Set()
    try {
      const ids = await getActiveVisibilityPlaceIdsByCity('concierge', city.slug, 20)
      boostIds = new Set(ids)
    } catch (err) {
      request.log.warn({ err, city: city.slug }, '[Concierge] Failed to load paid placements for scoring')
    }

    // ── Shared scoring context (same engine as NOW) ──────────────────
    const refinementAdj = adjustmentEmotion ? getRefinementTagAdjustments(adjustmentEmotion) : null

    const scoringCtx: ScoringContext = {
      timeOfDay: nowTimeOfDay,
      weather,
      paidPlaceIds: boostIds,
      excludeIds: new Set(),
      weights: {
        commercial: 0.15,
        context:    0.30,
        editorial:  0.15,
        quality:    0.25,
        proximity:  0.15,
      },
      surface: 'concierge',
      intentTags: [...resolvedIntent.tags, ...resolvedIntent.categorySlugs],
      userInterests: interests?.length ? interests : undefined,
      userStyle: style ?? undefined,
    }

    // ── STEP 1: Base Score (shared engine) ─────────────────────────────
    // ── STEP 2: Adjustments (Concierge-specific) ────────────────────────
    let scoredCandidates: ScoredCandidate[] = candidates
      .map((place) => {
        // STEP 1: base score from shared engine
        const result = scoreCandidate(place, scoringCtx)

        // STEP 2a: Intent match adjustment (+5 match, -10/-15 mismatch for wrong type)
        const intentMatch = resolvedIntent.placeTypes.includes(place.place_type)
        if (intentMatch) {
          result.totalScore += 5                    // intentMatchAdjustment: +5
        } else {
          // Wrong place type for this intent — penalize so correct types rank higher
          const intentTagSet = new Set([...resolvedIntent.tags, ...resolvedIntent.categorySlugs]
            .map(t => t.toLowerCase().replace(/[^a-z0-9]/g, '-')))
          const placeTags = place.context_tag_slugs ?? []
          const tagOverlap = placeTags.filter(t => intentTagSet.has(t)).length

          if (tagOverlap >= 2) {
            result.totalScore -= 5                  // wrong type but tags overlap
          } else if (tagOverlap === 1) {
            result.totalScore -= 10                 // wrong type, weak tag overlap
          } else {
            result.totalScore -= 15                 // wrong type, no tag overlap
          }
        }

        // STEP 2b: Anti-repetition penalty (-20)
        if (session.placeIds.has(place.id)) {
          result.totalScore -= 20                   // antiRepetitionPenalty
        }

        // STEP 2c: Hero history penalty (-18, paid exempt)
        if (!result.isSponsored && session.heroHistory.has(place.id)) {
          result.totalScore -= 18                   // heroHistoryPenalty
        }

        // STEP 2d: Hero rotation penalty (-12, paid exempt)
        if (previousHeroId && place.id === previousHeroId && !result.isSponsored) {
          result.totalScore -= 12                   // heroRotationPenalty
        }

        // STEP 2e: Frequency cap penalty (-20, paid exempt)
        if (!result.isSponsored && isOverExposed(sessionId, place.id)) {
          result.totalScore -= 20                   // frequencyCapPenalty
        }

        // STEP 2f: Refinement tag adjustments (+8 boost, -6 reduce)
        if (refinementAdj && place.context_tag_slugs?.length) {
          const placeTags = new Set(place.context_tag_slugs)
          for (const boostTag of refinementAdj.boost) {
            if (placeTags.has(boostTag)) result.totalScore += 8   // refinementBoost
          }
          for (const reduceTag of refinementAdj.reduce) {
            if (placeTags.has(reduceTag)) result.totalScore -= 6
          }
        }

        return result
      })
      .filter((r) => r.totalScore > 0)
      .sort((a, b) => b.totalScore - a.totalScore)

    // ── STEP 3: Diversity multiplier (applied LAST) ────────────────────
    // Same-category adjacent: ×0.85, same-tag adjacent: ×0.90
    // Paid placements are EXEMPT from diversity penalties
    scoredCandidates = applyDiversityRules(scoredCandidates)

    // Paid placement visibility floor: guarantee paid appears within top results.
    // High relevance (≥1 tag overlap OR score ≥ 20): inject at last visible position.
    // Low relevance but score > 0: still inject at last position (contractual guarantee).
    // Score ≤ 0: do not inject (fundamentally incompatible — filtered earlier).
    const topSponsored = scoredCandidates.find((r) => r.isSponsored)
    if (topSponsored && topSponsored.totalScore > 0) {
      const topSlice = scoredCandidates.slice(0, limit)
      if (!topSlice.some((r) => r.place.id === topSponsored.place.id)) {
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
      // Level 2+3 fallback: expand pool with related intent candidates
      const fetchLimit = SESSION_POOL_SIZE
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
            [...session.placeIds, ...combined.map((p) => p.id)],
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
        [...session.placeIds, ...existingIds],
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

    // ── Store pill state: top 6 candidates, show first 3 ──────────────
    const pillCandidates = scored.slice(0, MAX_PLACES_PER_PILL)
    session.pills.set(pillKey, { candidates: pillCandidates, tapCount: 1 })

    // First tap shows results 1-3
    scored = pillCandidates.slice(0, RESULTS_PER_PAGE)

    // ── Hero safeguard: sponsored placements must not occupy hero position ─
    // If the top result is sponsored, swap it with the first organic result
    // so the hero stays editorial. Sponsored still appears in card positions.
    // If ALL candidates are sponsored, heroId = null — no editorial hero exists.
    let heroId: string | null = null
    if (scored.length > 0 && boostIds.has(scored[0].id)) {
      const firstOrganic = scored.findIndex((p) => !boostIds.has(p.id))
      if (firstOrganic > 0) {
        // Swap sponsored out of hero position
        const tmp = scored[0]
        scored[0] = scored[firstOrganic]
        scored[firstOrganic] = tmp
        heroId = scored[0].id
      }
      // else: all candidates are sponsored → heroId stays null
    } else if (scored.length > 0) {
      heroId = scored[0].id
    }

    // Update session history + hero tracking
    for (const p of scored) session.placeIds.add(p.id)
    session.intentIds.add(resolvedIntent.id)
    session.lastHeroId = heroId
    if (heroId) session.heroHistory.add(heroId)
    session.lastIntentId = resolvedIntent.id
    sessionHistory.set(sessionKey, session)

    // Frequency capping: record exposures for cross-surface tracking
    recordExposures(sessionId, scored.map((p) => p.id))

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
      session.intentIds,
      timeOfDay,
      locale,
    )
    // Filter: only suggest intents that have matching candidates in the session pool.
    // A pill is useless if tapping it would show irrelevant place types.
    const poolTypes = new Set(candidates.map((c) => c.place_type))
    const fallbackIntents = allFallbackIntents.filter((fi) => {
      const intent = getIntentById(fi.id)
      if (!intent) return false
      // The intent must have at least one placeType present in the pool
      return intent.placeTypes.some((pt) => poolTypes.has(pt))
    }).slice(0, 4)

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
