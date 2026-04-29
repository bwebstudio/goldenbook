import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { useOnboardingStore } from '@/store/onboardingStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useNetworkStore, selectIsOffline } from '@/store/networkStore'
import { cacheKey, getCached, setCached } from '@/lib/cache'
import { api } from '@/api/endpoints'

// ─── Types (mirror backend NOW DTOs) ─────────────────────────────────────────

export type NowTimeOfDay = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'
export type NowWeather = 'sunny' | 'cloudy' | 'rainy' | 'hot' | 'cold'
export type NowEmotion = 'relax' | 'energy' | 'treat' | 'social' | 'romantic' | 'explore'

export interface NowContext {
  time_of_day: NowTimeOfDay
  current_time: string           // "15:17" — HH:MM from server
  weather: NowWeather | null
  weather_icon: string | null    // "sun" | "cloud" | "rain"
  moment: string | null
  moment_label: string | null
  reason_tags: string[]
}

export interface NowPlaceDTO {
  id: string
  slug: string
  name: string
  city: string
  heroImage: { bucket: string | null; path: string | null }
  shortDescription: string | null
  category: string
  cuisineType: string | null
  subcategory: string | null
  neighborhood: string | null
  distance: number | null
}

export interface NowRecommendationResponse {
  place: NowPlaceDTO | null
  isSponsored?: boolean
  title: string        // max 60 chars — short contextual headline
  subtitle: string     // max 100 chars — editorial one-liner
  explanation: string  // backward compat
  emotion?: NowEmotion | null
  context: NowContext
}

// ─── Cache ───────────────────────────────────────────────────────────────────
// We persist the latest successful NOW recommendation per (city, locale).
// "Live" recommendations are time-of-day sensitive, so a 24h TTL is the
// upper bound — past that, the cached explanation stops matching the user's
// current moment and we'd rather show the editorial fallback than a stale
// "sunny afternoon" pitch on a rainy night. The TTL is purely advisory:
// when offline the screen still renders stale entries because the
// alternative is an empty section.

const NOW_CACHE_TTL = 1000 * 60 * 60 * 24 // 24h

function buildNowCacheKey(city: string, locale: string): string {
  return cacheKey('now', city, locale)
}

// ─── Session ID ──────────────────────────────────────────────────────────────

let sessionId: string | null = null
function getSessionId(): string {
  if (!sessionId) {
    sessionId = `now-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
  return sessionId
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useNowRecommendation() {
  const city             = useAppStore((s) => s.selectedCity)
  const interests        = useOnboardingStore((s) => s.interests)
  const explorationStyle = useOnboardingStore((s) => s.explorationStyle)
  const locale           = useSettingsStore((s) => s.locale)

  // Stabilise the interests dependency: the underlying array reference can
  // change between renders even when the contents are identical (Zustand
  // re-creates the array on rehydration), which used to retrigger the
  // load effect mid-fetch and leave the NOW image stuck on a stale value.
  const interestsKey = interests.join(',')

  const [data, setData] = useState<NowRecommendationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  // True when `data` is being served from disk (offline cold start, or
  // network call failed and we fell back). Drives the "showing your last
  // saved recommendation" copy on the section header.
  const [fromCache, setFromCache] = useState(false)

  // ── Fetch initial recommendation ──────────────────────────────────────────

  const load = useCallback(async () => {
    const key = buildNowCacheKey(city, locale)
    const isOffline = selectIsOffline(useNetworkStore.getState())

    try {
      setLoading(true)
      setError(false)
      // Drop the previous result first so the image component sees an actual
      // URI change (and the section falls back to the loading state) instead
      // of holding the old image while the new fetch races in the background.
      setData(null)
      setFromCache(false)

      if (isOffline) {
        const cached = await getCached<NowRecommendationResponse>(key)
        if (cached?.data) {
          setData(cached.data)
          setFromCache(true)
        } else {
          // No cache + offline → editorial fallback path on the screen.
          // We mark `error: true` so the existing branching renders the
          // offline fallback card; `isOffline` is read separately by the
          // component so the copy is the friendly "connect to internet"
          // message rather than a failure one.
          setError(true)
        }
        return
      }

      const result = await api.nowRecommendation({
        city,
        locale,
        interests: interestsKey.length > 0 ? interestsKey : undefined,
        style: explorationStyle ?? undefined,
      })

      if (__DEV__) {
        console.log('[NOW] /concierge/now →', JSON.stringify({
          placeId: result.place?.id,
          placeName: result.place?.name,
          explanation: result.explanation,
          context: result.context,
        }, null, 2))
      }

      setData(result)
      setFromCache(false)
      // Only persist when the response actually contains a place. The
      // backend can return a context-only payload (no place) when the user
      // is far from coverage; cacheing that would just resurrect the empty
      // state on every cold start.
      if (result?.place) {
        void setCached(key, result, NOW_CACHE_TTL)
      }
    } catch (err) {
      console.error('[NOW] Error:', err)
      // Network call failed while NetInfo still thought we were online.
      // Fall back to the cache (same UX as the offline branch) before
      // surrendering to the error path.
      const cached = await getCached<NowRecommendationResponse>(key)
      if (cached?.data) {
        setData(cached.data)
        setFromCache(true)
        setError(false)
      } else {
        setError(true)
      }
    } finally {
      setLoading(false)
    }
  }, [city, locale, interestsKey, explorationStyle])

  useEffect(() => { load() }, [load])

  // ── Refresh ("See another option") ────────────────────────────────────────

  const refresh = useCallback(async () => {
    // The "See another option" tap is meaningless offline — the backend
    // generates a different rotation each call. Bail early so we don't
    // burn a 10s axios timeout while the spinner is on screen.
    if (selectIsOffline(useNetworkStore.getState())) return
    try {
      setRefreshing(true)
      const result = await api.nowRefresh({
        city,
        locale,
        interests: interestsKey.length > 0 ? interestsKey.split(',') : undefined,
        style: explorationStyle ?? undefined,
      })

      if (__DEV__) {
        console.log('[NOW] /concierge/now/refresh →', JSON.stringify({
          placeId: result.place?.id,
          placeName: result.place?.name,
          explanation: result.explanation,
        }, null, 2))
      }

      setData(result)
      setFromCache(false)
      if (result?.place) {
        void setCached(buildNowCacheKey(city, locale), result, NOW_CACHE_TTL)
      }
    } catch (err) {
      console.error('[NOW] Refresh error:', err)
    } finally {
      setRefreshing(false)
    }
  }, [city, locale, interestsKey, explorationStyle])

  return { data, loading, refreshing, error, fromCache, refresh, reload: load }
}
