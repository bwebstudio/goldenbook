// ─── NOW Routes ──────────────────────────────────────────────────────────────
//
// GET  /concierge/now          — Returns exactly 1 contextual recommendation.
// POST /concierge/now/refresh  — "See another option" (same context, excludes previous).
// POST /concierge/now/dismiss  — "Not relevant" → returns Concierge-ready context.
// POST /concierge/now/click    — Track click on a NOW recommendation.
// GET  /concierge/now/metrics  — Performance metrics (admin).
//
// Features:
//   - Configurable weights (DB + segment + experiment overrides)
//   - Impression tracking (fire-and-forget)
//   - A/B experiments (deterministic variant assignment)
//   - User segment resolution
//   - Debug mode (?debug=true) for score breakdown visibility

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../../db/postgres'
import { resolveWeather } from './now.weather'
import { getNowCandidates } from './now.query'
// Shared scoring engine (replaces now.moments + now.scoring)
import {
  type NowTimeOfDay,
  type WeatherCondition,
  type ScoredCandidate,
  type ScoringContext,
  type ScoringWeights,
  getNowTimeOfDay,
  getTagLabel,
  rankCandidates,
  scoreCandidate,
  selectTopN,
  applyDiversityRules,
  buildTitle,
  buildSubtitle,
  buildExplanation,
  buildReasonTags,
  recordExposure,
  buildContextSummary,
} from '../shared-scoring'
import {
  getConciergeCity,
  getDefaultConciergeCity,
} from '../concierge/concierge.query'
import { getActiveVisibilityPlaceIdsByCity } from '../visibility/visibility.query'
import {
  type OnboardingProfile,
  parseInterests,
} from '../../shared/ranking/place.ranking'
import { normalizeLocale } from '../../shared/i18n/locale'

// New systems
import { resolveWeights } from './now.weights'
import { trackImpression, trackClick } from './now.tracking'
import { resolveExperiment } from './now.experiments'
import { resolveSegment, getSegmentWeightOverrides, type UserSegment } from './now.segments'
import { getNowPerformanceMetrics, getExperimentMetrics } from './now.metrics'
import { runAutoOptimization } from './now.optimization'

// ─── Session history for refresh (anti-repetition) ───────────────────────────

// ─── Business rule: exactly 3 options per time slot ─────────────────────────
// Slots are sold commercially — exceeding 3 breaks the business model.
const MAX_OPTIONS_PER_SLOT = 3

interface NowSession {
  shownPlaceIds: Set<string>
  /** Ordered list of place IDs shown in the current slot (max 3). Used for cycling. */
  slotHistory: string[]
  /** Current time-of-day slot these history entries belong to */
  slotTimeOfDay: NowTimeOfDay | null
  /** City these history entries belong to */
  slotCity: string | null
  lastContext: {
    timeOfDay: NowTimeOfDay
    weather?: WeatherCondition
    citySlug: string
  } | null
  updatedAt: number
}

const nowSessions = new Map<string, NowSession>()

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000
  for (const [key, session] of nowSessions) {
    if (session.updatedAt < cutoff) nowSessions.delete(key)
  }
  if (nowSessions.size > 500) {
    const sorted = [...nowSessions.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)
    for (let i = 0; i < sorted.length - 500; i++) nowSessions.delete(sorted[i][0])
  }
}, 600_000)

function getSession(sessionId: string): NowSession {
  let session = nowSessions.get(sessionId)
  if (!session) {
    session = {
      shownPlaceIds: new Set(),
      slotHistory: [],
      slotTimeOfDay: null,
      slotCity: null,
      lastContext: null,
      updatedAt: Date.now(),
    }
    nowSessions.set(sessionId, session)
  }
  session.updatedAt = Date.now()
  return session
}

/** Reset slot history when the time window or city changes */
function ensureSlotContext(session: NowSession, timeOfDay: NowTimeOfDay, citySlug: string): void {
  if (session.slotTimeOfDay !== timeOfDay || session.slotCity !== citySlug) {
    session.slotHistory = []
    session.shownPlaceIds.clear()
    session.slotTimeOfDay = timeOfDay
    session.slotCity = citySlug
  }
}

// ─── City-level place cooldown (6 hours) ─────────────────────────────────────
// Prevents the same place from appearing in NOW too frequently across all users.
// Uses now_impressions table for persistence across restarts and instances.

const COOLDOWN_HOURS = 6

/**
 * Get place IDs that have been shown in NOW within the last 6 hours for a city.
 * Reads from now_impressions (persisted, survives restarts, works multi-instance).
 */
async function getCooldownPlaceIds(citySlug: string): Promise<Set<string>> {
  try {
    const { rows } = await db.query<{ place_id: string }>(
      `SELECT DISTINCT place_id::text FROM now_impressions
       WHERE city = lower($1) AND created_at > now() - ($2 || ' hours')::interval`,
      [citySlug, COOLDOWN_HOURS],
    )
    return new Set(rows.map((r) => r.place_id))
  } catch {
    // DB error → return empty set (don't block recommendations)
    return new Set()
  }
}

// recordPlaceCooldown is no longer needed — trackImpression already writes to now_impressions

// ─── Schemas ─────────────────────────────────────────────────────────────────

const nowQuerySchema = z.object({
  city:      z.string().min(1).optional(),
  locale:    z.string().min(2).max(5).default('en'),
  lat:       z.coerce.number().min(-90).max(90).optional(),
  lon:       z.coerce.number().min(-180).max(180).optional(),
  interests: z.string().optional(),
  style:     z.string().optional(),
  debug:     z.enum(['true', 'false', '1', '0']).optional(),
})

const refreshBodySchema = z.object({
  city:      z.string().min(1).optional(),
  locale:    z.string().min(2).max(5).default('en'),
  lat:       z.coerce.number().min(-90).max(90).optional(),
  lon:       z.coerce.number().min(-180).max(180).optional(),
  interests: z.array(z.string()).optional(),
  style:     z.string().optional(),
})

const dismissBodySchema = z.object({
  city:      z.string().min(1).optional(),
  locale:    z.string().min(2).max(5).default('en'),
  lat:       z.coerce.number().min(-90).max(90).optional(),
  lon:       z.coerce.number().min(-180).max(180).optional(),
  interests: z.array(z.string()).optional(),
  style:     z.string().optional(),
  limit:     z.coerce.number().int().min(1).max(5).default(3),
})

const clickBodySchema = z.object({
  place_id: z.string().uuid(),
  city:     z.string().optional(),
})

// ─── DTO ─────────────────────────────────────────────────────────────────────

interface NowRecommendationDTO {
  place: {
    id: string
    slug: string
    name: string
    city: string
    heroImage: { bucket: string | null; path: string | null }
    shortDescription: string | null
    category: string
    distance: number | null
  }
  isSponsored: boolean
  title: string       // max 60 chars — short contextual headline
  subtitle: string    // max 100 chars — editorial one-liner
  explanation: string // kept for backward compat
  context: {
    time_of_day: NowTimeOfDay
    current_time: string              // "15:17" — HH:MM in server timezone
    weather: WeatherCondition | null
    weather_icon: string | null       // "sun" | "cloud" | "rain" — normalized for icon lookup
    moment: string | null
    moment_label: string | null
    reason_tags: string[]
  }
  /** Debug info — only present when ?debug=true */
  _debug?: {
    weights_used: ScoringWeights
    score_breakdown: Record<string, unknown>
    total_score: number
    segment: string
    experiment_variant: string | null
    candidates_count: number
    time_window: NowTimeOfDay
    context_tags: string[]
    best_tag: string | null
  }
}

// ─── Weight resolution (combines all systems) ────────────────────────────────

async function resolveEffectiveWeights(
  sessionId: string,
  citySlug: string,
  segment: UserSegment,
): Promise<{ weights: ScoringWeights; experimentVariant: string | null }> {
  // 1. Check A/B experiment
  const experiment = await resolveExperiment(sessionId, citySlug)
  if (experiment?.weights) {
    return {
      weights: experiment.weights,
      experimentVariant: `${experiment.experimentId}:${experiment.variant}`,
    }
  }

  // 2. Resolve base weights (DB with city/segment overrides + auto-optimization delta)
  const base = await resolveWeights(citySlug, segment)

  // 3. Apply segment-specific overrides
  const segOverrides = getSegmentWeightOverrides(segment)
  if (segOverrides) {
    const merged = { ...base, ...segOverrides }
    // Re-normalize
    const sum = Object.values(merged).reduce((s, v) => s + v, 0)
    const weights = Object.fromEntries(
      Object.entries(merged).map(([k, v]) => [k, Math.round((v / sum) * 1000) / 1000]),
    ) as unknown as ScoringWeights
    return {
      weights,
      experimentVariant: experiment ? `${experiment.experimentId}:${experiment.variant}` : null,
    }
  }

  return {
    weights: base,
    experimentVariant: experiment ? `${experiment.experimentId}:${experiment.variant}` : null,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize weather condition to a simple icon name for the mobile client */
function weatherToIcon(weather: WeatherCondition | null | undefined): string | null {
  if (!weather) return null
  switch (weather) {
    case 'sunny': return 'sun'
    case 'hot':   return 'sun'
    case 'cloudy': return 'cloud'
    case 'cold':  return 'cloud'
    case 'rainy': return 'rain'
    default:      return null
  }
}

/** City slug → IANA timezone */
const CITY_TIMEZONES: Record<string, string> = {
  lisbon:    'Europe/Lisbon',
  lisboa:    'Europe/Lisbon',
  porto:     'Europe/Lisbon',
  algarve:   'Europe/Lisbon',
  madeira:   'Atlantic/Madeira',
  barcelona: 'Europe/Madrid',
  madrid:    'Europe/Madrid',
  paris:     'Europe/Paris',
  london:    'Europe/London',
  rome:      'Europe/Rome',
  milan:     'Europe/Rome',
  amsterdam: 'Europe/Amsterdam',
  berlin:    'Europe/Berlin',
}

/** Format current time as HH:MM in the city's local timezone */
function formatCurrentTime(citySlug?: string): string {
  const tz = (citySlug && CITY_TIMEZONES[citySlug]) || 'Europe/Lisbon'
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  }).formatToParts(now)
  const h = parts.find(p => p.type === 'hour')?.value ?? '00'
  const m = parts.find(p => p.type === 'minute')?.value ?? '00'
  return `${h}:${m}`
}

function buildNowDTO(
  result: ScoredCandidate,
  timeOfDay: NowTimeOfDay,
  weather: WeatherCondition | undefined,
  locale: string,
  citySlug?: string,
  cityName?: string,
): NowRecommendationDTO {
  const { place, bestTag, isSponsored } = result
  const city = cityName ?? place.city_name
  const explanation = buildExplanation(bestTag, timeOfDay, weather, place.distance_meters, locale)
  return {
    place: {
      id: place.id,
      slug: place.slug,
      name: place.name,
      city,
      heroImage: { bucket: place.hero_bucket, path: place.hero_path },
      shortDescription: place.short_description ?? place.editorial_summary ?? null,
      category: place.place_type,
      distance: place.distance_meters ? Math.round(place.distance_meters) : null,
    },
    isSponsored,
    title: buildTitle(bestTag, timeOfDay, city, locale),
    subtitle: buildSubtitle(bestTag, timeOfDay, locale),
    explanation,
    context: {
      time_of_day: timeOfDay,
      current_time: formatCurrentTime(citySlug),
      weather: weather ?? null,
      weather_icon: weatherToIcon(weather),
      // Backwards compat: 'moment' maps from bestTag, 'tag' is the new field
      moment: bestTag,
      moment_label: bestTag ? getTagLabel(bestTag, locale) : null,
      reason_tags: buildReasonTags(bestTag, timeOfDay, weather, place.distance_meters),
    },
  }
}

async function resolveNow(
  cityParam: string | undefined,
  locale: string,
  lat: number | undefined,
  lon: number | undefined,
  excludeIds: Set<string>,
  weights: ScoringWeights,
  userInterests?: string[],
  userStyle?: string,
): Promise<{
  city: { slug: string; name: string }
  timeOfDay: NowTimeOfDay
  weather: WeatherCondition | undefined
  ranked: ScoredCandidate[]
}> {
  let city: { slug: string; name: string }
  if (cityParam) {
    city = (await getConciergeCity(cityParam, locale)) ?? (await getDefaultConciergeCity(locale))
  } else {
    city = await getDefaultConciergeCity(locale)
  }

  const timeOfDay = getNowTimeOfDay(new Date(), city.slug)

  // Weather resolution — works with or without coordinates (falls back to city-based)
  const weatherResult = await resolveWeather(lat, lon, city.slug)
  const weather = weatherResult?.condition

  let paidPlaceIds = new Set<string>()
  try {
    const ids = await getActiveVisibilityPlaceIdsByCity('now', city.slug, 20)
    paidPlaceIds = new Set(ids)
  } catch {}

  // Coordinates are OPTIONAL — NOW works without them
  const candidates = await getNowCandidates(city.slug, locale, 40, timeOfDay, lat, lon)

  // Merge city-level cooldown into exclude set (6-hour same-place prevention)
  const cooldownIds = await getCooldownPlaceIds(city.slug)
  const allExcludeIds = new Set([...excludeIds, ...cooldownIds])

  const ctx: ScoringContext = {
    timeOfDay, weather, paidPlaceIds, excludeIds: allExcludeIds, weights, surface: 'now',
    userInterests, userStyle,
  }

  // Score → diversity → select top 3
  let scored = rankCandidates(candidates, ctx)
  scored = applyDiversityRules(scored)
  let ranked = selectTopN(scored, 3)

  // Safety net: if cooldown excluded ALL candidates, retry without cooldown.
  if (ranked.length === 0 && cooldownIds.size > 0) {
    const retryCtx: ScoringContext = {
      timeOfDay, weather, paidPlaceIds, excludeIds, weights, surface: 'now',
      userInterests, userStyle,
    }
    let retryScored = rankCandidates(candidates, retryCtx)
    retryScored = applyDiversityRules(retryScored)
    ranked = selectTopN(retryScored, 3)
  }

  return { city, timeOfDay, weather, ranked }
}

/**
 * Score a specific place by ID from the candidate pool (no top-3 random selection).
 * Used for cycling — we know exactly which place we want.
 */
async function scorePlaceById(
  placeId: string,
  cityParam: string | undefined,
  locale: string,
  lat: number | undefined,
  lon: number | undefined,
  weights: ScoringWeights,
): Promise<{ result: ScoredCandidate; weather: WeatherCondition | undefined; timeOfDay: NowTimeOfDay; city: { slug: string; name: string } } | null> {
  let city: { slug: string; name: string }
  if (cityParam) {
    city = (await getConciergeCity(cityParam, locale)) ?? (await getDefaultConciergeCity(locale))
  } else {
    city = await getDefaultConciergeCity(locale)
  }

  const timeOfDay = getNowTimeOfDay(new Date(), city.slug)
  const weatherResult = await resolveWeather(lat, lon, city.slug)
  const weather = weatherResult?.condition

  let paidPlaceIds = new Set<string>()
  try {
    const ids = await getActiveVisibilityPlaceIdsByCity('now', city.slug, 20)
    paidPlaceIds = new Set(ids)
  } catch {}

  const candidates = await getNowCandidates(city.slug, locale, 40, timeOfDay, lat, lon)
  const target = candidates.find((c) => c.id === placeId)
  if (!target) return null

  const ctx: ScoringContext = {
    timeOfDay, weather, paidPlaceIds, excludeIds: new Set(), weights, surface: 'now',
  }
  const result = scoreCandidate(target, ctx)

  return { result, weather, timeOfDay, city }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function nowRoutes(app: FastifyInstance) {

  // ── GET /concierge/now ─────────────────────────────────────────────────────

  app.get('/concierge/now', async (request, reply) => {
    const { city: cityParam, locale: rawLocale, lat, lon, interests: rawInterests, style, debug } =
      nowQuerySchema.parse(request.query)
    const locale = normalizeLocale(rawLocale)

    const isDebug = debug === 'true' || debug === '1'

    const profile: OnboardingProfile = {
      interests: parseInterests(rawInterests),
      style: style ?? undefined,
    }

    const sessionId = (request.headers['x-session-id'] as string) ?? 'anonymous'
    const userId = (request.headers['x-user-id'] as string) ?? null
    const session = getSession(`now:${sessionId}`)

    // Resolve user segment
    const segment = await resolveSegment(userId, profile)

    // Resolve city first (needed for experiment lookup)
    let city: { slug: string; name: string }
    if (cityParam) {
      const resolved = await getConciergeCity(cityParam, locale)
      if (!resolved) {
        request.log.warn({ requestedCity: cityParam }, '[NOW] City slug not found in destinations — falling back to default')
      }
      city = resolved ?? (await getDefaultConciergeCity(locale))
    } else {
      city = await getDefaultConciergeCity(locale)
    }

    // Resolve effective weights (DB + segment + experiment)
    const { weights, experimentVariant } = await resolveEffectiveWeights(
      sessionId, city.slug, segment,
    )

    const timeOfDay = getNowTimeOfDay(new Date(), city.slug)

    // Reset slot history if time window or city changed
    ensureSlotContext(session, timeOfDay, city.slug)

    const { weather, ranked } = await resolveNow(
      cityParam, locale, lat, lon, session.shownPlaceIds, weights,
      profile.interests, profile.style,
    )

    session.lastContext = { timeOfDay, weather, citySlug: city.slug }

    if (ranked.length === 0) {
      // ── Diagnostic logging: why are there zero candidates? ──
      const diagCandidates = await getNowCandidates(city.slug, locale, 40, timeOfDay, lat, lon)
      const cooldownIds = await getCooldownPlaceIds(city.slug)
      const placeTypeCounts: Record<string, number> = {}
      for (const c of diagCandidates) {
        placeTypeCounts[c.place_type] = (placeTypeCounts[c.place_type] ?? 0) + 1
      }
      const taggedCandidates = diagCandidates.filter((c) => c.context_tag_slugs.length > 0)
      request.log.warn({
        resolvedCity: city.slug,
        requestedCity: cityParam,
        timeOfDay,
        totalCandidates: diagCandidates.length,
        placeTypeCounts,
        withContextTags: taggedCandidates.length,
        cooldownExcluded: cooldownIds.size,
        sessionExcluded: session.shownPlaceIds.size,
      }, '[NOW] Zero ranked candidates — diagnostic breakdown')

      const localeFamily = locale.split('-')[0]
      return reply.send({
        place: null,
        explanation: localeFamily === 'pt'
          ? 'Ainda não temos sugestões para este momento. Explore o Concierge!'
          : localeFamily === 'es'
            ? 'Aún no tenemos sugerencias para este momento. Prueba el Concierge.'
            : 'No suggestions for this moment yet. Try the Concierge!',
        context: {
          time_of_day: timeOfDay,
          current_time: formatCurrentTime(city.slug),
          weather: weather ?? null,
          weather_icon: weatherToIcon(weather),
          moment: null,
          moment_label: null,
          reason_tags: [],
        },
      })
    }

    const top = ranked[0]
    session.shownPlaceIds.add(top.place.id)
    if (!session.slotHistory.includes(top.place.id)) {
      session.slotHistory.push(top.place.id)
    }

    // Track impression (fire-and-forget)
    trackImpression({
      sessionId,
      userId,
      placeId: top.place.id,
      city: city.slug,
      context: {
        time_of_day: timeOfDay,
        weather: weather ?? null,
        moment: top.bestTag,
        segment,
        experiment_variant: experimentVariant,
      },
      weightsUsed: weights,
    })

    // Frequency capping: record exposure
    recordExposure(sessionId, top.place.id)

    const dto = buildNowDTO(top, timeOfDay, weather, locale, city.slug, city.name)

    // Attach debug info if requested
    if (isDebug) {
      dto._debug = {
        weights_used: weights,
        score_breakdown: top.breakdown as unknown as Record<string, unknown>,
        total_score: Math.round(top.totalScore * 100) / 100,
        segment,
        experiment_variant: experimentVariant,
        candidates_count: ranked.length,
        time_window: timeOfDay,
        context_tags: top.place.context_tag_slugs,
        best_tag: top.bestTag,
      }
    }

    return reply.send(dto)
  })

  // ── POST /concierge/now/refresh ────────────────────────────────────────────

  app.post('/concierge/now/refresh', async (request, reply) => {
    const { city: cityParam, locale: rawLocale, lat, lon, interests, style } =
      refreshBodySchema.parse(request.body)
    const locale = normalizeLocale(rawLocale)

    const profile: OnboardingProfile = {
      interests: interests?.length ? interests : undefined,
      style: style ?? undefined,
    }

    const sessionId = (request.headers['x-session-id'] as string) ?? 'anonymous'
    const userId = (request.headers['x-user-id'] as string) ?? null
    const session = getSession(`now:${sessionId}`)

    const segment = await resolveSegment(userId, profile)

    let city: { slug: string; name: string }
    if (cityParam) {
      city = (await getConciergeCity(cityParam, locale)) ?? (await getDefaultConciergeCity(locale))
    } else {
      city = await getDefaultConciergeCity(locale)
    }

    const timeOfDay = getNowTimeOfDay(new Date(), city.slug)

    // Reset slot history if time window or city changed
    ensureSlotContext(session, timeOfDay, city.slug)

    const { weights, experimentVariant } = await resolveEffectiveWeights(
      sessionId, city.slug, segment,
    )

    // ── If we already have MAX_OPTIONS_PER_SLOT in history, cycle through them ──
    if (session.slotHistory.length >= MAX_OPTIONS_PER_SLOT) {
      const lastShownId = [...session.shownPlaceIds].pop()
      const lastIndex = lastShownId ? session.slotHistory.indexOf(lastShownId) : -1
      const nextIndex = (lastIndex + 1) % session.slotHistory.length
      const nextPlaceId = session.slotHistory[nextIndex]

      // Score the specific place directly (no random top-3 selection)
      const scored = await scorePlaceById(nextPlaceId, cityParam, locale, lat, lon, weights)

      if (scored) {
        session.shownPlaceIds.clear()
        session.shownPlaceIds.add(nextPlaceId)

        trackImpression({
          sessionId, userId, placeId: nextPlaceId, city: city.slug,
          context: { time_of_day: timeOfDay, weather: scored.weather ?? null, moment: scored.result.bestTag, segment, experiment_variant: experimentVariant },
          weightsUsed: weights,
        })

        return reply.send(buildNowDTO(scored.result, timeOfDay, scored.weather, locale, city.slug, city.name))
      }
      // Place no longer valid (time window changed, unpublished, etc.) — fall through
    }

    // ── Normal flow: show next unseen option (up to MAX_OPTIONS_PER_SLOT) ──
    const { weather, ranked } = await resolveNow(
      cityParam, locale, lat, lon, session.shownPlaceIds, weights,
      profile.interests, profile.style,
    )

    session.lastContext = { timeOfDay, weather, citySlug: city.slug }

    if (ranked.length === 0) {
      // All candidates exhausted but haven't filled 3 slots — cycle what we have
      if (session.slotHistory.length > 0) {
        const lastShownId = [...session.shownPlaceIds].pop()
        const lastIndex = lastShownId ? session.slotHistory.indexOf(lastShownId) : -1
        const nextIndex = (lastIndex + 1) % session.slotHistory.length
        const nextPlaceId = session.slotHistory[nextIndex]

        const scored = await scorePlaceById(nextPlaceId, cityParam, locale, lat, lon, weights)

        if (scored) {
          session.shownPlaceIds.clear()
          session.shownPlaceIds.add(nextPlaceId)

          trackImpression({
            sessionId, userId, placeId: nextPlaceId, city: city.slug,
            context: { time_of_day: timeOfDay, weather: scored.weather ?? null, moment: scored.result.bestTag, segment, experiment_variant: experimentVariant },
            weightsUsed: weights,
          })

          return reply.send(buildNowDTO(scored.result, timeOfDay, scored.weather, locale, city.slug, city.name))
        }
      }

      // Truly no candidates at all
      const localeFamily = locale.split('-')[0]
      return reply.send({
        place: null,
        explanation: localeFamily === 'pt'
          ? 'Sem mais opções por agora. Experimente o Concierge!'
          : localeFamily === 'es'
            ? 'No hay más opciones por ahora. Prueba el Concierge.'
            : 'No more options right now. Try the Concierge!',
        context: {
          time_of_day: timeOfDay,
          current_time: formatCurrentTime(city.slug),
          weather: weather ?? null,
          weather_icon: weatherToIcon(weather),
          moment: null,
          moment_label: null,
          reason_tags: [],
        },
      })
    }

    const top = ranked[0]
    session.shownPlaceIds.add(top.place.id)
    if (!session.slotHistory.includes(top.place.id)) {
      session.slotHistory.push(top.place.id)
    }

    trackImpression({
      sessionId, userId, placeId: top.place.id, city: city.slug,
      context: { time_of_day: timeOfDay, weather: weather ?? null, moment: top.bestTag, segment, experiment_variant: experimentVariant },
      weightsUsed: weights,
    })

    return reply.send(buildNowDTO(top, timeOfDay, weather, locale, city.slug, city.name))
  })

  // ── POST /concierge/now/dismiss ───────────────────────────────────────��────

  app.post('/concierge/now/dismiss', async (request, reply) => {
    const { city: cityParam, locale: rawLocale, lat, lon, interests, style, limit } =
      dismissBodySchema.parse(request.body)
    const locale = normalizeLocale(rawLocale)

    const profile: OnboardingProfile = {
      interests: interests?.length ? interests : undefined,
      style: style ?? undefined,
    }

    const sessionId = (request.headers['x-session-id'] as string) ?? 'anonymous'
    const userId = (request.headers['x-user-id'] as string) ?? null
    const session = getSession(`now:${sessionId}`)
    const segment = await resolveSegment(userId, profile)

    let city: { slug: string; name: string }
    if (cityParam) {
      city = (await getConciergeCity(cityParam, locale)) ?? (await getDefaultConciergeCity(locale))
    } else {
      city = await getDefaultConciergeCity(locale)
    }

    const { weights } = await resolveEffectiveWeights(sessionId, city.slug, segment)

    const { timeOfDay, weather, ranked } = await resolveNow(
      cityParam, locale, lat, lon, session.shownPlaceIds, weights,
      profile.interests, profile.style,
    )

    const alternatives = ranked.slice(0, limit)
    const inferredMoment = alternatives.length > 0 ? alternatives[0].bestTag : null

    // Track concierge opened from NOW (fire-and-forget)
    trackImpression({
      sessionId,
      userId,
      placeId: alternatives[0]?.place.id ?? 'none',
      city: city.slug,
      context: {
        time_of_day: timeOfDay,
        weather: weather ?? null,
        moment: inferredMoment,
        segment,
        experiment_variant: null,
      },
      weightsUsed: null,
    })

    return reply.send({
      city,
      source: 'now' as const,
      context: {
        time_of_day: timeOfDay,
        weather: weather ?? null,
        weather_icon: weatherToIcon(weather),
        moment: inferredMoment,
        moment_label: inferredMoment ? getTagLabel(inferredMoment, locale) : null,
      },
      context_summary: buildContextSummary(inferredMoment, timeOfDay, locale),
      recommendations: alternatives.map((r) => ({
        id: r.place.id,
        slug: r.place.slug,
        name: r.place.name,
        city: r.place.city_name,
        heroImage: { bucket: r.place.hero_bucket, path: r.place.hero_path },
        shortDescription: r.place.short_description ?? r.place.editorial_summary ?? null,
        category: r.place.place_type,
        distance: r.place.distance_meters ? Math.round(r.place.distance_meters) : null,
      })),
    })
  })

  // ── POST /concierge/now/click ───────────────────────────────────────��──────
  //
  // Track a click on a NOW recommendation. Called by the mobile client.

  app.post('/concierge/now/click', async (request, reply) => {
    const { place_id, city } = clickBodySchema.parse(request.body)
    const sessionId = (request.headers['x-session-id'] as string) ?? null
    const userId = (request.headers['x-user-id'] as string) ?? null

    await trackClick({ sessionId, userId, placeId: place_id, city: city ?? null })

    return reply.status(204).send()
  })

  // ── GET /concierge/now/metrics ─────────────────────────────────────────────
  //
  // Admin endpoint for NOW performance metrics.

  app.get('/concierge/now/metrics', async (request, reply) => {
    const schema = z.object({
      city: z.string().optional(),
      days: z.coerce.number().int().min(1).max(90).default(7),
      experiment_id: z.string().uuid().optional(),
    })
    const { city, days, experiment_id } = schema.parse(request.query)

    if (experiment_id) {
      const metrics = await getExperimentMetrics(experiment_id, days)
      return reply.send(metrics ?? { error: 'Experiment not found' })
    }

    const metrics = await getNowPerformanceMetrics(city, days)
    return reply.send(metrics)
  })

  // ── POST /concierge/now/optimize ───────────────────────────────────────────
  //
  // Manually trigger auto-optimization. In production, run via cron.

  app.post('/concierge/now/optimize', async (request, reply) => {
    const schema = z.object({
      city: z.string().optional(),
      days: z.coerce.number().int().min(1).max(30).default(7),
    })
    const { city, days } = schema.parse(request.body)

    const delta = await runAutoOptimization(city, days)

    if (!delta) {
      return reply.send({ status: 'no_change', reason: 'Insufficient data or no adjustment needed' })
    }

    return reply.send({ status: 'adjusted', delta })
  })
}
