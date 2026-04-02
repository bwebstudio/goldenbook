import { useCallback, useReducer, useRef } from 'react'
import { useAppStore } from '@/store/appStore'
import { useOnboardingStore } from '@/store/onboardingStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useNowContextStore, type NowContextForConcierge } from '@/store/nowContextStore'
import { conciergeApi } from '../api'
import type {
  ConciergeBootstrapDTO,
  ConciergeIntentDTO,
  ConciergeMessage,
  ConciergeRecommendResponseDTO,
  ConciergeState,
} from '../types'

// ─── State machine ────────────────────────────────────────────────────────────

type Action =
  | { type: 'BOOTSTRAP_START' }
  | { type: 'BOOTSTRAP_SUCCESS'; payload: ConciergeBootstrapDTO }
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
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}

function reducer(state: ConciergeState, action: Action): ConciergeState {
  switch (action.type) {
    case 'BOOTSTRAP_START':
      return { ...state, loadingBootstrap: true, error: null, messages: [], bootstrapData: null }

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
      }
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

    const data = await conciergeApi.recommend({
      city: bootstrapData.city.slug ?? city,
      intent: defaultIntent.id,
      limit: 3,
      locale,
      interests: profile.interests,
      style: profile.style,
    })

    dispatch({ type: 'RECOMMEND_SUCCESS', payload: data })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, locale, profile.interests, profile.style])

  const triggerNowRecommendations = useCallback(async (
    nowCtx: NowContextForConcierge,
    bootstrapData: ConciergeBootstrapDTO,
  ) => {
    console.log('[Concierge] NOW context received', nowCtx)
    console.log('[Concierge] adjustment', nowCtx.adjustment ?? null)
    console.log('[Concierge] fetch triggered')

    const label = nowCtx.moment_label ?? nowCtx.moment?.replace(/_/g, ' ') ?? 'NOW'

    dispatch({
      type: 'RECOMMEND_START',
      userMessage: { id: uid(), type: 'user_text', text: label, timestamp: Date.now() },
    })

    try {
      const recData = await conciergeApi.recommend({
        city: nowCtx.city ?? bootstrapData.city.slug ?? city,
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
    try {
      const data = await conciergeApi.bootstrap(city, profile.interests, profile.style, locale)
      dispatch({ type: 'BOOTSTRAP_SUCCESS', payload: data })

      // ── NOW → Concierge handoff: auto-trigger context-aware recommendation ──
      if (!nowContextConsumed.current) {
        const nowCtx = consumeNowContext()
        nowContextConsumed.current = true

        if (nowCtx?.source === 'now') {
          await triggerNowRecommendations(nowCtx, data)
        }
      }
    } catch (err) {
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
