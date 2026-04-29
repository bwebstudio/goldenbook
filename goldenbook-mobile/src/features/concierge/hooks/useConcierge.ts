import { useCallback, useReducer, useRef } from 'react'
import { useAppStore } from '@/store/appStore'
import { useOnboardingStore } from '@/store/onboardingStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useNetworkStore, selectIsOffline } from '@/store/networkStore'
import { useNowContextStore, type NowContextForConcierge } from '@/store/nowContextStore'
import { cacheKey, getCached, setCached } from '@/lib/cache'
import { conciergeApi } from '../api'
import type {
  ConciergeBootstrapDTO,
  ConciergeIntentDTO,
  ConciergeMessage,
  ConciergeRecommendResponseDTO,
  ConciergeState,
} from '../types'

// ─── Cached snapshot ─────────────────────────────────────────────────────────
// We persist a single rolling "last successful Concierge session" per
// (city, locale). Live recommendations are explicitly NOT replayed offline —
// the screen only rehydrates the bootstrap (greeting + intent cards) plus the
// last batch of recommendation responses so the user can re-read what they
// saw last time online. New intent taps offline fail loudly.

interface CachedConciergeSnapshot {
  bootstrap: ConciergeBootstrapDTO
  messages: ConciergeMessage[]
}

const CONCIERGE_CACHE_TTL = 1000 * 60 * 60 * 24 * 14 // 14 days

function buildConciergeCacheKey(city: string, locale: string): string {
  return cacheKey('concierge:bootstrap', city, locale)
}

// ─── State machine ────────────────────────────────────────────────────────────

type Action =
  | { type: 'BOOTSTRAP_START' }
  | { type: 'BOOTSTRAP_SUCCESS'; payload: ConciergeBootstrapDTO }
  | { type: 'BOOTSTRAP_FROM_CACHE'; payload: CachedConciergeSnapshot }
  | { type: 'BOOTSTRAP_OFFLINE_NO_CACHE'; message: string }
  | { type: 'BOOTSTRAP_ERROR'; payload: string }
  | { type: 'RECOMMEND_START'; userMessage: ConciergeMessage }
  | { type: 'RECOMMEND_SUCCESS'; payload: ConciergeRecommendResponseDTO }
  | { type: 'RECOMMEND_ERROR'; payload: string }
  | { type: 'SET_INPUT'; value: string }
  | { type: 'CLEAR_ERROR' }

const initial: ConciergeState = {
  bootstrapData: null,
  messages: [],
  loadingBootstrap: false,
  loadingRecommendation: false,
  inputValue: '',
  error: null,
  fromCache: false,
  offlineWithoutCache: false,
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}

function reducer(state: ConciergeState, action: Action): ConciergeState {
  switch (action.type) {
    case 'BOOTSTRAP_START':
      return {
        ...state,
        loadingBootstrap: true,
        error: null,
        messages: [],
        bootstrapData: null,
        fromCache: false,
        offlineWithoutCache: false,
      }

    case 'BOOTSTRAP_SUCCESS': {
      const greeting: ConciergeMessage = {
        id: uid(),
        type: 'concierge_text',
        text: action.payload.greeting,
        timestamp: Date.now(),
      }
      return {
        ...state,
        loadingBootstrap: false,
        bootstrapData: action.payload,
        messages: [greeting],
        fromCache: false,
        offlineWithoutCache: false,
      }
    }

    case 'BOOTSTRAP_FROM_CACHE':
      return {
        ...state,
        loadingBootstrap: false,
        bootstrapData: action.payload.bootstrap,
        messages: action.payload.messages,
        fromCache: true,
        offlineWithoutCache: false,
        error: null,
      }

    case 'BOOTSTRAP_OFFLINE_NO_CACHE':
      return {
        ...state,
        loadingBootstrap: false,
        bootstrapData: null,
        messages: [],
        fromCache: false,
        offlineWithoutCache: true,
        // Don't surface a backend-flavored error string in this state — the
        // screen renders the offline empty state from the boolean alone.
        error: null,
      }

    case 'BOOTSTRAP_ERROR':
      return { ...state, loadingBootstrap: false, error: action.payload }

    case 'RECOMMEND_START':
      return {
        ...state,
        loadingRecommendation: true,
        error: null,
        messages: [...state.messages, action.userMessage],
      }

    case 'RECOMMEND_SUCCESS': {
      const msg: ConciergeMessage = {
        id: uid(),
        type: 'recommendation_response',
        text: action.payload.responseText,
        recommendations: action.payload.recommendations,
        fallbackIntents: action.payload.fallbackIntents,
        timestamp: Date.now(),
      }
      return {
        ...state,
        loadingRecommendation: false,
        messages: [...state.messages, msg],
      }
    }

    case 'RECOMMEND_ERROR':
      return { ...state, loadingRecommendation: false, error: action.payload }

    case 'SET_INPUT':
      return { ...state, inputValue: action.value }

    case 'CLEAR_ERROR':
      return { ...state, error: null }

    default:
      return state
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConcierge() {
  const [state, dispatch] = useReducer(reducer, initial)
  const city             = useAppStore((s) => s.selectedCity)
  const interests        = useOnboardingStore((s) => s.interests)
  const explorationStyle = useOnboardingStore((s) => s.explorationStyle)
  const locale           = useSettingsStore((s) => s.locale)
  const consumeNowContext = useNowContextStore((s) => s.consume)
  const nowContextConsumed = useRef(false)

  // Stable references passed into every API call
  const profile = {
    interests:  interests.length > 0 ? interests : undefined,
    style:      explorationStyle ?? undefined,
  } as const

  const fetchDefaultRecommendations = useCallback(async (bootstrapData: ConciergeBootstrapDTO) => {
    const defaultIntent = bootstrapData.intents[0]
    if (!defaultIntent) return

    try {
      const data = await conciergeApi.recommend({
        city: bootstrapData.city.slug ?? city,
        intent: defaultIntent.id,
        limit: 3,
        locale,
        interests: profile.interests,
        style: profile.style,
      })

      dispatch({ type: 'RECOMMEND_SUCCESS', payload: data })
    } catch (err) {
      if (__DEV__) console.warn('[Concierge] fetchDefaultRecommendations failed:', err)
      dispatch({ type: 'RECOMMEND_ERROR', payload: err instanceof Error ? err.message : 'Failed to load recommendations' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, locale, profile.interests, profile.style])

  const triggerNowRecommendations = useCallback(async (
    nowCtx: NowContextForConcierge,
    bootstrapData: ConciergeBootstrapDTO,
  ) => {
    if (__DEV__) {
      console.log('[Concierge] NOW context received', nowCtx)
      console.log('[Concierge] adjustment', nowCtx.adjustment ?? null)
      console.log('[Concierge] fetch triggered')
    }

    const label = nowCtx.moment_label ?? nowCtx.moment?.replace(/_/g, ' ') ?? 'NOW'

    dispatch({
      type: 'RECOMMEND_START',
      userMessage: { id: uid(), type: 'user_text', text: label, timestamp: Date.now() },
    })

    try {
      const recData = await conciergeApi.recommend({
        city: bootstrapData.city.slug ?? city,
        limit: 5,
        locale,
        interests: profile.interests,
        style: profile.style,
        now_context: {
          time_of_day: nowCtx.time_of_day,
          weather: nowCtx.weather,
          inferred_moment: nowCtx.moment,
          adjustment: nowCtx.adjustment,
        },
      })
      dispatch({ type: 'RECOMMEND_SUCCESS', payload: recData })
    } catch (recErr) {
      try {
        await fetchDefaultRecommendations(bootstrapData)
      } catch {
        dispatch({
          type: 'RECOMMEND_ERROR',
          payload: recErr instanceof Error ? recErr.message : 'Could not load recommendations.',
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, locale, profile.interests, profile.style, fetchDefaultRecommendations])

  // ── Bootstrap ────────────────────────────────────────────────────────────

  const loadBootstrap = useCallback(async () => {
    dispatch({ type: 'BOOTSTRAP_START' })

    const isOffline = selectIsOffline(useNetworkStore.getState())
    const key = buildConciergeCacheKey(city, locale)

    // Offline branch: skip the network call entirely. Either we have a
    // cached snapshot to render with the "saved recommendations" pill, or we
    // surface the premium offline empty state. We never attempt the request
    // because a 10s axios timeout on every Concierge mount while offline is
    // the worst of both worlds (slow + still failing).
    if (isOffline) {
      const cached = await getCached<CachedConciergeSnapshot>(key)
      if (cached?.data?.bootstrap) {
        dispatch({ type: 'BOOTSTRAP_FROM_CACHE', payload: cached.data })
        return
      }
      dispatch({ type: 'BOOTSTRAP_OFFLINE_NO_CACHE', message: 'offline' })
      return
    }

    try {
      const data = await conciergeApi.bootstrap(city, profile.interests, profile.style, locale)
      dispatch({ type: 'BOOTSTRAP_SUCCESS', payload: data })

      // Persist a fresh single-message snapshot so a later cold start while
      // offline can still render the greeting + intent pills.
      void setCached<CachedConciergeSnapshot>(
        key,
        {
          bootstrap: data,
          messages: [
            { id: uid(), type: 'concierge_text', text: data.greeting, timestamp: Date.now() },
          ],
        },
        CONCIERGE_CACHE_TTL,
      )

      // ── NOW → Concierge handoff: auto-trigger context-aware recommendation ──
      if (!nowContextConsumed.current) {
        const nowCtx = consumeNowContext()
        nowContextConsumed.current = true

        if (nowCtx?.source === 'now') {
          await triggerNowRecommendations(nowCtx, data)
        }
      }
    } catch (err) {
      // Network failure while NetInfo still thinks we're online (transient
      // wobble, DNS timeout, etc). Fall back to the cache if we have one
      // before surrendering to the error path — same UX as the offline
      // branch but reached via a different signal.
      const cached = await getCached<CachedConciergeSnapshot>(key)
      if (cached?.data?.bootstrap) {
        dispatch({ type: 'BOOTSTRAP_FROM_CACHE', payload: cached.data })
        return
      }
      dispatch({
        type: 'BOOTSTRAP_ERROR',
        payload: err instanceof Error ? err.message : 'Could not reach Concierge.',
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, locale, profile.interests, profile.style])

  const loadFromNowContext = useCallback(async () => {
    nowContextConsumed.current = false
    await loadBootstrap()
  }, [loadBootstrap])

  // ── Intent tap ───────────────────────────────────────────────────────────

  const handleIntentTap = useCallback(
    async (intent: ConciergeIntentDTO) => {
      if (state.loadingRecommendation) return

      dispatch({
        type: 'RECOMMEND_START',
        userMessage: { id: uid(), type: 'intent_selection', text: intent.title, timestamp: Date.now() },
      })

      // Live recommendations require a real network call — offline taps
      // would just spin the thinking indicator until timeout. Surface a
      // localized error message instead so the user knows why nothing
      // happened. The screen-level cached banner stays visible.
      if (selectIsOffline(useNetworkStore.getState())) {
        dispatch({
          type: 'RECOMMEND_ERROR',
          payload: 'offline',
        })
        return
      }

      try {
        const data = await conciergeApi.recommend({
          city:      state.bootstrapData?.city.slug ?? city,
          intent:    intent.id,
          limit:     3,
          locale,
          interests: profile.interests,
          style:     profile.style,
        })
        dispatch({ type: 'RECOMMEND_SUCCESS', payload: data })
      } catch (err) {
        dispatch({
          type: 'RECOMMEND_ERROR',
          payload: err instanceof Error ? err.message : 'Could not load recommendations.',
        })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.loadingRecommendation, state.bootstrapData, city, locale, profile.interests, profile.style],
  )

  // ── Send text query ──────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = state.inputValue.trim()
    if (!text || state.loadingRecommendation) return

    // Safe mode: keep input visible, but do not process free-text queries.
    dispatch({ type: 'SET_INPUT', value: '' })
  }, [state.inputValue, state.loadingRecommendation])

  // ── Fallback intent tap ──────────────────────────────────────────────────

  const handleFallbackTap = useCallback(
    (intent: { id: string; title: string }) =>
      handleIntentTap({ id: intent.id, title: intent.title, subtitle: '', icon: '', label: null }),
    [handleIntentTap],
  )

  return {
    state,
    loadBootstrap,
    loadFromNowContext,
    handleIntentTap,
    handleSend,
    handleFallbackTap,
    setInput: (v: string) => dispatch({ type: 'SET_INPUT', value: v }),
  }
}
