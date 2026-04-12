import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { useOnboardingStore } from '@/store/onboardingStore'
import { useSettingsStore } from '@/store/settingsStore'
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

  // ── Fetch initial recommendation ──────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(false)
      // Drop the previous result first so the image component sees an actual
      // URI change (and the section falls back to the loading state) instead
      // of holding the old image while the new fetch races in the background.
      setData(null)
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
    } catch (err) {
      console.error('[NOW] Error:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [city, locale, interestsKey, explorationStyle])

  useEffect(() => { load() }, [load])

  // ── Refresh ("See another option") ──���─────────────────────────────────────

  const refresh = useCallback(async () => {
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
    } catch (err) {
      console.error('[NOW] Refresh error:', err)
    } finally {
      setRefreshing(false)
    }
  }, [city, locale, interestsKey, explorationStyle])

  return { data, loading, refreshing, error, refresh, reload: load }
}
