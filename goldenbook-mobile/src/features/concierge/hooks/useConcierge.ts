import { useCallback, useReducer } from 'react'
import { useAppStore } from '@/store/appStore'
import { useOnboardingStore } from '@/store/onboardingStore'
import { useSettingsStore } from '@/store/settingsStore'
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

  // Stable references passed into every API call
  const profile = {
    interests:  interests.length > 0 ? interests : undefined,
    style:      explorationStyle ?? undefined,
  } as const

  // ── Bootstrap ────────────────────────────────────────────────────────────

  const loadBootstrap = useCallback(async () => {
    dispatch({ type: 'BOOTSTRAP_START' })
    try {
      const data = await conciergeApi.bootstrap(city, profile.interests, profile.style, locale)
      dispatch({ type: 'BOOTSTRAP_SUCCESS', payload: data })
    } catch (err) {
      dispatch({
        type: 'BOOTSTRAP_ERROR',
        payload: err instanceof Error ? err.message : 'Could not reach Concierge.',
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, locale, profile.interests, profile.style])

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

    dispatch({
      type: 'RECOMMEND_START',
      userMessage: { id: uid(), type: 'user_text', text, timestamp: Date.now() },
    })
    dispatch({ type: 'SET_INPUT', value: '' })

    try {
      const data = await conciergeApi.recommend({
        city:      state.bootstrapData?.city.slug ?? city,
        query:     text,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.inputValue, state.loadingRecommendation, state.bootstrapData, city, locale, profile.interests, profile.style])

  // ── Fallback intent tap ──────────────────────────────────────────────────

  const handleFallbackTap = useCallback(
    (intent: { id: string; title: string }) =>
      handleIntentTap({ id: intent.id, title: intent.title, subtitle: '', icon: '', label: null }),
    [handleIntentTap],
  )

  return {
    state,
    loadBootstrap,
    handleIntentTap,
    handleSend,
    handleFallbackTap,
    setInput: (v: string) => dispatch({ type: 'SET_INPUT', value: v }),
  }
}
