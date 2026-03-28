// ─── Concierge Types ──────────────────────────────────────────────────────────
// Mirrors backend concierge.dto.ts contracts exactly.

export type TimeOfDay = 'morning' | 'afternoon' | 'evening'

// ─── API shapes ───────────────────────────────────────────────────────────────

export interface ConciergeIntentDTO {
  id: string
  title: string
  subtitle: string
  icon: string
  label: string | null
}

export interface ConciergeRecommendationDTO {
  id: string
  slug: string
  name: string
  city: string
  neighborhood: string | null
  heroImage: { bucket: string | null; path: string | null }
  shortDescription: string | null
  badges: string[]
  category: string
}

export interface ConciergeBootstrapDTO {
  city: { slug: string; name: string }
  timeOfDay: TimeOfDay
  greeting: string
  intents: ConciergeIntentDTO[]
}

export interface ConciergeRecommendResponseDTO {
  city: { slug: string; name: string }
  timeOfDay: TimeOfDay
  resolvedIntent: { id: string; title: string }
  responseText: string
  recommendations: ConciergeRecommendationDTO[]
  fallbackIntents: { id: string; title: string }[]
}

// ─── Chat message model ───────────────────────────────────────────────────────

export type ConciergeMessageType =
  | 'concierge_text'
  | 'user_text'
  | 'intent_selection'
  | 'recommendation_response'

export interface ConciergeMessage {
  id: string
  type: ConciergeMessageType
  text?: string
  recommendations?: ConciergeRecommendationDTO[]
  fallbackIntents?: { id: string; title: string }[]
  timestamp: number
}

// ─── Screen state ─────────────────────────────────────────────────────────────

export interface ConciergeState {
  bootstrapData: ConciergeBootstrapDTO | null
  messages: ConciergeMessage[]
  loadingBootstrap: boolean
  loadingRecommendation: boolean
  inputValue: string
  error: string | null
}
