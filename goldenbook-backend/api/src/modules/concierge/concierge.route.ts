import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../../db/postgres'
import { getIntentById, getIntentLabels } from './concierge.intents'
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
  getDynamicFallbackIntents,
  getBootstrapIntents,
  getDefaultIntent,
  getTimeOfDay,
  resolveIntentFromQuery,
  detectRefinementFromText,
  getRefinementTagAdjustments,
  ensureTimeValidIntent,
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
  poolCity: string | null
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
  locale:    z.string().min(2).max(5).default('pt'),
  // Onboarding personalization — optional
  interests: z.string().optional(), // comma-separated interest IDs
  style:     z.string().optional(), // single exploration style ID
})

const recommendBodySchema = z.object({
  city:      z.string().min(1).optional(),
  intent:    z.string().min(1).optional(),
  query:     z.string().max(200).optional(),
  limit:     z.coerce.number().int().min(1).max(10).default(3),
  locale:    z.string().min(2).max(5).default('pt'),
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

    // Resolve city FIRST so getTimeOfDay uses the destination's real timezone
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

    const timeOfDay = getTimeOfDay(city.slug)

    const profile: OnboardingProfile = {
      interests: parseInterests(rawInterests),
      style:     style ?? undefined,
    }

    // Resolve weather for context-aware intent selection
    const weatherResult = await resolveWeather(undefined, undefined, city.slug)
    const weather = weatherResult?.condition ?? null

    const greeting = buildGreeting(timeOfDay, city.name, locale)

    // ── Viability check: does this intent have enough places in this city? ─
    const { rows: cityTypes } = await db.query<{ place_type: string; cnt: string }>(`
      SELECT p.place_type, COUNT(*)::text AS cnt
      FROM places p JOIN destinations d ON d.id = p.destination_id
      WHERE d.slug = lower($1) AND p.status = 'published' AND p.is_active = true
      GROUP BY p.place_type
    `, [city.slug])
    const availableTypes = new Map(cityTypes.map((r) => [r.place_type, parseInt(r.cnt, 10)]))
    const viable = await getViableIntents(city.slug, 2)

    const isViable = (intentId: string): boolean => {
      const intent = getIntentById(intentId)
      if (!intent) return false
      const typeCount = intent.placeTypes.reduce((sum, pt) => sum + (availableTypes.get(pt) ?? 0), 0)
      if (typeCount < 3) return false
      const hasEditorial = (intent.editorialIntents ?? []).some((ei) => viable.has(ei))
      if (hasEditorial) return true
      const hasFallback = (intent.fallbackIntents ?? []).some((fi) => viable.has(fi))
      return hasFallback && intent.priority >= 6
    }

    // Bootstrap uses curated editorial matrix + viability filter
    const intents = getBootstrapIntents(timeOfDay, profile, weather, city.slug, isViable)

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

    // Resolve city FIRST so getTimeOfDay uses the destination's real timezone
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

    const timeOfDay = getTimeOfDay(city.slug)

    // ── Detect refinement from text queries ──────────────────────────────
    // "algo más relajado", "something quieter" etc. → adjusts tag weights
    let detectedRefinement: string | null = null
    if (query && !intentParam) {
      detectedRefinement = detectRefinementFromText(query)
    }

    // ── Intent resolution ────────────────────────────────────────────────
    // Order: resolve raw intent → enforce temporal eligibility → proceed
    // This ensures no absurd time-context combinations reach scoring.
    let resolvedIntent: ReturnType<typeof getIntentById> | undefined
    if (intentParam) {
      // Explicit intent from frontend pill tap — do NOT trust blindly
      const rawIntent = getIntentById(intentParam)
      resolvedIntent = rawIntent
        ? ensureTimeValidIntent(rawIntent, timeOfDay)
        : resolveIntentFromQuery(query ?? '', timeOfDay)  // already time-safe
    } else if (query) {
      // Free-text query — resolveIntentFromQuery is already time-safe
      resolvedIntent = resolveIntentFromQuery(query, timeOfDay)
    } else if (now_context?.inferred_moment) {
      // NOW → Concierge handoff: map moment to best-matching intent directly.
      // If an adjustment is provided, bias the intent toward that emotion.
      const tagToIntent: Record<string, string> = {
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

      const rawHandoffIntent = mappedIntentId
        ? getIntentById(mappedIntentId) ?? getDefaultIntent(timeOfDay)
        : getDefaultIntent(timeOfDay)
      // Enforce temporal eligibility on NOW handoff result
      resolvedIntent = ensureTimeValidIntent(rawHandoffIntent, timeOfDay)
    } else {
      resolvedIntent = getDefaultIntent(timeOfDay)
    }

    // Safety: always have a valid, time-appropriate intent
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
      poolCity: null,
      heroHistory: new Set<string>(),
      pills: new Map<string, PillState>(),
    }

    // Hero rotation: detect intent change
    const intentChanged = session.lastIntentId != null && session.lastIntentId !== resolvedIntent.id
    const previousHeroId = intentChanged ? session.lastHeroId : null

    const nowTimeOfDay = getNowTimeOfDay(new Date(), city.slug)
    const weatherResult = await resolveWeather(undefined, undefined, city.slug)
    const weather = weatherResult?.condition

    // ── City change detection: clear stale pill caches ───────────────
    if (session.poolCity !== city.slug) {
      session.pills.clear()
      session.placeIds.clear()
      session.heroHistory.clear()
      session.lastHeroId = null
      session.lastIntentId = null
      session.poolCity = city.slug
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
        : (locale.split('-')[0] === 'es' ? `Explora más opciones en ${city.name}.` : locale.split('-')[0] === 'pt' ? `Explore mais opções em ${city.name}.` : `Explore more in ${city.name}.`)

      const fallbackIntents = getDynamicFallbackIntents(resolvedIntent.id, session.intentIds, timeOfDay, locale)

      const resolvedIntentTitle = getIntentLabels(resolvedIntent.id, locale).title
      return reply.send({
        city, timeOfDay,
        resolvedIntent: { id: resolvedIntent.id, title: resolvedIntentTitle },
        responseText, recommendations, fallbackIntents,
      })
    }

    // ══════════════════════════════════════════════════════════════════════
    // First tap on this pill: per-intent fresh retrieval, score, cache top 6
    // ══════════════════════════════════════════════════════════════════════
    //
    // Instead of reusing a shared pool, each pill gets its own retrieval.
    // This ensures each pill has editorial identity — cocktail_bars never
    // scores from romantic_dinner candidates, and vice versa.

    // Get paid placement IDs for scoring
    let boostIds: Set<string> = new Set()
    try {
      const ids = await getActiveVisibilityPlaceIdsByCity('concierge', city.slug, 20)
      boostIds = new Set(ids)
    } catch (err) {
      request.log.warn({ err, city: city.slug }, '[Concierge] Failed to load paid placements for scoring')
    }

    // ── Fetch candidates specifically for this intent ────────────────
    // MAX_PLACES_PER_PILL * 3 = 18 candidates to score, then keep top 6
    const FETCH_LIMIT = MAX_PLACES_PER_PILL * 3
    let candidates = await getConciergeRecommendations(
      city.slug, resolvedIntent, locale, FETCH_LIMIT, nowTimeOfDay,
    )

    // Inject paid placements if they match the intent's place types
    const intentTypeSet = new Set(resolvedIntent.placeTypes)
    if (boostIds.size > 0) {
      const candidateIds = new Set(candidates.map((c) => c.id))
      const missingPaidIds = [...boostIds].filter((id) => !candidateIds.has(id))
      if (missingPaidIds.length > 0) {
        const paidPlaces = await getPlacesByIds(missingPaidIds, locale, nowTimeOfDay)
        // Only inject paid places whose type matches the intent
        candidates.push(...paidPlaces.filter((p) => intentTypeSet.has(p.place_type)))
      }
    }

    // Strict city filter: never show places from a different destination
    candidates = candidates.filter((p) => p.city_slug === city.slug)

    // If too few candidates from strict retrieval, try fallback places
    if (candidates.length < MAX_PLACES_PER_PILL) {
      const existingIds = candidates.map((c) => c.id)
      const fallbackPlaces = await getFallbackPlaces(
        city.slug, locale,
        [...session.placeIds, ...existingIds],
        FETCH_LIMIT,
        resolvedIntent.placeTypes,
      )
      // Only accept places whose type matches the intent AND are in the right city
      const typed = fallbackPlaces.filter((p) =>
        intentTypeSet.has(p.place_type) && p.city_slug === city.slug,
      )
      candidates = dedupePlaces([...candidates, ...typed])
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

    // ── Beautiful spots: scenic scoring constants ─────────────────────
    const isBeautifulSpots = resolvedIntent.id === 'beautiful_spots'
    const SCENIC_TAGS = new Set([
      'viewpoint', 'sunset', 'rooftop', 'terrace', 'culture', 'local-secret',
    ])
    const SCENIC_PLACE_TYPES = new Set(['landmark', 'museum', 'activity', 'beach', 'venue', 'hotel'])
    const DINING_TYPES = new Set(['restaurant', 'cafe', 'bar'])

    // ── STEP 1: Base Score (shared engine) ─────────────────────────────
    // ── STEP 2: Adjustments (Concierge-specific) ────────────────────────
    let scoredCandidates: ScoredCandidate[] = candidates
      .map((place: UnifiedCandidate) => {
        const result = scoreCandidate(place, scoringCtx)

        // STEP 2a: Intent match adjustment
        const intentMatch = resolvedIntent.placeTypes.includes(place.place_type)
        if (intentMatch) {
          result.totalScore += 5
        } else {
          const intentTagSet = new Set([...resolvedIntent.tags, ...resolvedIntent.categorySlugs]
            .map((t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '-')))
          const placeTags = place.context_tag_slugs ?? []
          const tagOverlap = placeTags.filter((t: string) => intentTagSet.has(t)).length
          result.totalScore -= tagOverlap >= 2 ? 5 : tagOverlap === 1 ? 10 : 15
        }

        // STEP 2b: Anti-repetition penalty (-40) — strengthened from -20 to
        // guarantee fresh rotation across pill taps within a session
        if (session.placeIds.has(place.id)) result.totalScore -= 40

        // STEP 2c: Hero history penalty (-30, paid exempt) — strengthened from -18
        if (!result.isSponsored && session.heroHistory.has(place.id)) result.totalScore -= 30

        // STEP 2d: Hero rotation penalty (-12, paid exempt)
        if (previousHeroId && place.id === previousHeroId && !result.isSponsored) result.totalScore -= 12

        // STEP 2e: Frequency cap penalty (-40, paid exempt) — strengthened from -20
        if (!result.isSponsored && isOverExposed(sessionId, place.id)) result.totalScore -= 40

        // STEP 2f: Refinement tag adjustments
        if (refinementAdj && place.context_tag_slugs?.length) {
          const placeTags = new Set(place.context_tag_slugs)
          for (const boostTag of refinementAdj.boost) {
            if (placeTags.has(boostTag)) result.totalScore += 8
          }
          for (const reduceTag of refinementAdj.reduce) {
            if (placeTags.has(reduceTag)) result.totalScore -= 6
          }
        }

        // STEP 2f-bis: Canonical context tag alignment
        // - Strong boost (+10) for each canonical tag from the intent that
        //   the place actually carries (post-audit, this is the deterministic
        //   signal — tags table > description text matching).
        // - Hard exclusion (-1000) if the place carries any canonicalExcludeTag.
        //   E.g. `beautiful_spots` excludes places tagged dinner/cocktails so
        //   restaurants and bars never leak in.
        if (resolvedIntent.canonicalTags?.length && place.context_tag_slugs?.length) {
          const placeTagSet = new Set(place.context_tag_slugs)
          let canonicalHits = 0
          for (const t of resolvedIntent.canonicalTags) {
            if (placeTagSet.has(t)) canonicalHits++
          }
          result.totalScore += canonicalHits * 10
        }
        if (resolvedIntent.canonicalExcludeTags?.length && place.context_tag_slugs?.length) {
          const placeTagSet = new Set(place.context_tag_slugs)
          for (const t of resolvedIntent.canonicalExcludeTags) {
            if (placeTagSet.has(t)) {
              result.totalScore -= 1000  // hard kill — dropped by `score > 0` filter
              break
            }
          }
        }

        // STEP 2g: Beautiful spots — scenic priority scoring
        if (isBeautifulSpots) {
          const placeTags = new Set(place.context_tag_slugs ?? [])
          const hasScenicTag = [...SCENIC_TAGS].some((t) => placeTags.has(t))
          const isScenicType = SCENIC_PLACE_TYPES.has(place.place_type)
          const isDining = DINING_TYPES.has(place.place_type)

          if (isScenicType) result.totalScore += 12
          if (hasScenicTag) result.totalScore += 8
          if (isDining && !hasScenicTag) result.totalScore -= 15
          else if (isDining && hasScenicTag) result.totalScore -= 3

          const text = [place.short_description, place.editorial_summary]
            .filter(Boolean).join(' ').toLowerCase()
          const scenicKeywords = ['view', 'vista', 'panoram', 'architect', 'garden', 'jardim', 'palace', 'palácio', 'heritage', 'scenic', 'tower', 'bridge', 'river', 'ocean', 'cliff', 'miradouro', 'terrace', 'rooftop', 'gallery', 'monument', 'church', 'castle', 'forest']
          result.totalScore += scenicKeywords.filter((kw) => text.includes(kw)).length * 3
        }

        return result
      })
      .filter((r: ScoredCandidate) => r.totalScore > 0)
      .sort((a: ScoredCandidate, b: ScoredCandidate) => b.totalScore - a.totalScore)

    // ── STEP 3: Diversity multiplier ──────────────────────────────────
    scoredCandidates = applyDiversityRules(scoredCandidates)

    // ── STEP 3b: Beautiful spots — hard restaurant cap ────────────────
    if (isBeautifulSpots) {
      const capped: ScoredCandidate[] = []
      let diningCount = 0
      for (const r of scoredCandidates) {
        if (DINING_TYPES.has(r.place.place_type)) {
          if (diningCount >= 1) continue
          diningCount++
        }
        capped.push(r)
      }
      scoredCandidates = capped
    }

    // ── Paid placement visibility floor ──────────────────────────────
    const topSponsored = scoredCandidates.find((r) => r.isSponsored)
    if (topSponsored && topSponsored.totalScore > 0) {
      const topSlice = scoredCandidates.slice(0, MAX_PLACES_PER_PILL)
      if (!topSlice.some((r) => r.place.id === topSponsored.place.id)) {
        scoredCandidates = [
          ...scoredCandidates.slice(0, MAX_PLACES_PER_PILL - 1).filter((r) =>
            r.place.id !== topSponsored.place.id),
          topSponsored,
          ...scoredCandidates.slice(MAX_PLACES_PER_PILL - 1).filter((r) =>
            r.place.id !== topSponsored.place.id),
        ]
      }
    }

    // ── Extract top 6 unique places for pill cache (PAGINATION FIX) ──
    // Previously this was sliced to `limit` (3) before caching, so page 2
    // was always empty. Now we store up to MAX_PLACES_PER_PILL (6) first,
    // then slice to RESULTS_PER_PAGE (3) for the response.
    const seenIds = new Set<string>()
    const allPillPlaces = scoredCandidates
      .filter((r) => {
        if (seenIds.has(r.place.id)) return false
        seenIds.add(r.place.id)
        return true
      })
      .slice(0, MAX_PLACES_PER_PILL)
      .map((r) => r.place)

    // Store pill state: up to 6 candidates
    session.pills.set(pillKey, { candidates: allPillPlaces, tapCount: 1 })

    // First tap shows results 1-3
    let scored = allPillPlaces.slice(0, RESULTS_PER_PAGE)

    // ── Hero safeguard: sponsored must not occupy hero position ───────
    let heroId: string | null = null
    if (scored.length > 0 && boostIds.has(scored[0].id)) {
      const firstOrganic = scored.findIndex((p) => !boostIds.has(p.id))
      if (firstOrganic > 0) {
        const tmp = scored[0]
        scored[0] = scored[firstOrganic]
        scored[firstOrganic] = tmp
        heroId = scored[0].id
      }
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

    // Frequency capping
    recordExposures(sessionId, scored.map((p) => p.id))

    const localeFamily = locale.split('-')[0]
    const recommendations = scored.map((p) => toRecommendationDTO(p, resolvedIntent, locale))

    // ── Response text ─────────────────────────────────────────────────
    let responseText: string
    if (recommendations.length > 0) {
      responseText = buildResponseText(resolvedIntent, city.name, timeOfDay, locale)
    } else {
      const todLabelPt: Record<string, string> = { morning: 'manhã', afternoon: 'tarde', evening: 'noite', late_evening: 'noite', deep_night: 'madrugada' }
      const todLabelEs: Record<string, string> = { morning: 'mañana', afternoon: 'tarde', evening: 'noche', late_evening: 'noche', deep_night: 'madrugada' }
      const todLabelEn: Record<string, string> = { morning: 'morning', afternoon: 'afternoon', evening: 'evening', late_evening: 'evening', deep_night: 'night' }
      const todLabel = localeFamily === 'pt'
        ? (todLabelPt[timeOfDay] ?? 'noite')
        : localeFamily === 'es'
          ? (todLabelEs[timeOfDay] ?? 'noche')
          : (todLabelEn[timeOfDay] ?? 'evening')
      responseText = localeFamily === 'pt'
        ? `Para esta ${todLabel} em ${city.name}, experimente explorar outras categorias.`
        : localeFamily === 'es'
          ? `Para esta ${todLabel} en ${city.name}, prueba explorar otras categorías.`
          : `For this ${todLabel} in ${city.name}, try exploring other categories.`
    }

    // ── Dynamic fallback intents (conflict-aware) ────────────────────
    const fallbackIntents = getDynamicFallbackIntents(
      resolvedIntent.id,
      session.intentIds,
      timeOfDay,
      locale,
    )

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
