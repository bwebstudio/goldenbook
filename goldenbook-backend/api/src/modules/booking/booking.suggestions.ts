// Reservation suggestion engine.
// Generates editorial suggestions for booking configuration.
// Suggestions are advisory — the active config remains the source of truth.

import type { BookingMode } from './booking.types'

// ─── Types ───────────────────────────────────────────────────────────────────

export type SuggestionReason =
  | 'subcategory_match'
  | 'category_match'
  | 'ambiguous_reservation'
  | 'possible_ticketing'
  | 'website_fallback'
  | 'contact_only_candidate'
  | 'non_reservable_category'
  | 'insufficient_data'
  | 'manual_data_exists'

export interface ReservationSuggestion {
  relevant: boolean
  suggestedMode: BookingMode
  suggestedLabel: string | null
  suggestedUrl: string | null
  confidence: number
  reason: SuggestionReason
  reasonDetail: string
  source: 'heuristic_v1'
}

// ─── Input ───────────────────────────────────────────────────────────────────

export interface SuggestionInput {
  id: string
  name: string
  category_slugs: string[]
  subcategory_slugs: string[]
  place_type: string | null
  website_url: string | null
  phone: string | null
  booking_url: string | null
  booking_enabled: boolean
  booking_mode: string
}

// ─── Subcategory heuristics ──────────────────────────────────────────────────

interface SubcategoryHint {
  mode: BookingMode
  relevant: boolean
  confidence: number
  reason?: SuggestionReason
}

const SUBCATEGORY_MAP: Record<string, SubcategoryHint> = {
  // Restaurants — high confidence
  'restaurants':       { mode: 'affiliate_thefork', relevant: true,  confidence: 0.90 },
  'fine-dining':       { mode: 'affiliate_thefork', relevant: true,  confidence: 0.95 },
  'casual-dining':     { mode: 'affiliate_thefork', relevant: true,  confidence: 0.85 },
  'seafood':           { mode: 'affiliate_thefork', relevant: true,  confidence: 0.85 },
  'traditional':       { mode: 'affiliate_thefork', relevant: true,  confidence: 0.85 },
  'international':     { mode: 'affiliate_thefork', relevant: true,  confidence: 0.80 },
  'vegetarian':        { mode: 'affiliate_thefork', relevant: true,  confidence: 0.80 },
  'brunch':            { mode: 'affiliate_thefork', relevant: true,  confidence: 0.75 },
  'tapas':             { mode: 'affiliate_thefork', relevant: true,  confidence: 0.80 },
  'tascas':            { mode: 'affiliate_thefork', relevant: true,  confidence: 0.75 },

  // Accommodation — high confidence
  'hotels':            { mode: 'affiliate_booking', relevant: true,  confidence: 0.95 },
  'boutique-hotels':   { mode: 'affiliate_booking', relevant: true,  confidence: 0.95 },
  'hostels':           { mode: 'affiliate_booking', relevant: true,  confidence: 0.90 },
  'guesthouses':       { mode: 'affiliate_booking', relevant: true,  confidence: 0.90 },
  'apartments':        { mode: 'affiliate_booking', relevant: true,  confidence: 0.85 },
  'pousadas':          { mode: 'affiliate_booking', relevant: true,  confidence: 0.90 },
  'bed-and-breakfast': { mode: 'affiliate_booking', relevant: true,  confidence: 0.90 },

  // Activities / experiences
  'tours':             { mode: 'affiliate_viator',  relevant: true,  confidence: 0.85 },
  'experiences':       { mode: 'affiliate_viator',  relevant: true,  confidence: 0.85 },
  'activities':        { mode: 'affiliate_viator',  relevant: true,  confidence: 0.80 },
  'boat-trips':        { mode: 'affiliate_viator',  relevant: true,  confidence: 0.85 },
  'wine-tasting':      { mode: 'affiliate_viator',  relevant: true,  confidence: 0.80 },
  'workshops':         { mode: 'direct_website',    relevant: true,  confidence: 0.70 },
  'classes':           { mode: 'direct_website',    relevant: true,  confidence: 0.70 },
  'guided-visits':     { mode: 'affiliate_viator',  relevant: true,  confidence: 0.80 },
  'cooking-classes':   { mode: 'direct_website',    relevant: true,  confidence: 0.75 },

  // Wellness / Spa
  'spas':              { mode: 'direct_website',    relevant: true,  confidence: 0.80 },
  'wellness':          { mode: 'direct_website',    relevant: true,  confidence: 0.75 },
  'hammams':           { mode: 'direct_website',    relevant: true,  confidence: 0.75 },

  // Ambiguous — bars/nightlife: relevant but low confidence to force editorial review
  'cafes':             { mode: 'none',              relevant: false, confidence: 0.70 },
  'bakeries':          { mode: 'none',              relevant: false, confidence: 0.80 },
  'bars':              { mode: 'direct_website',    relevant: true,  confidence: 0.40, reason: 'ambiguous_reservation' },
  'rooftop-bars':      { mode: 'direct_website',    relevant: true,  confidence: 0.45, reason: 'ambiguous_reservation' },
  'cocktail-bars':     { mode: 'direct_website',    relevant: true,  confidence: 0.40, reason: 'ambiguous_reservation' },
  'wine-bars':         { mode: 'direct_website',    relevant: true,  confidence: 0.45, reason: 'ambiguous_reservation' },
  'nightlife':         { mode: 'direct_website',    relevant: true,  confidence: 0.35, reason: 'ambiguous_reservation' },

  // Museums / monuments — possible ticketing, lower confidence for editorial review
  'museums':           { mode: 'none',              relevant: false, confidence: 0.60, reason: 'possible_ticketing' },
  'monuments':         { mode: 'none',              relevant: false, confidence: 0.55, reason: 'possible_ticketing' },

  // Not reservable — high confidence
  'beaches':           { mode: 'none',              relevant: false, confidence: 0.95 },
  'parks':             { mode: 'none',              relevant: false, confidence: 0.95 },
  'gardens':           { mode: 'none',              relevant: false, confidence: 0.95 },
  'viewpoints':        { mode: 'none',              relevant: false, confidence: 0.95 },
  'churches':          { mode: 'none',              relevant: false, confidence: 0.95 },
  'shops':             { mode: 'none',              relevant: false, confidence: 0.90 },
  'boutiques':         { mode: 'none',              relevant: false, confidence: 0.90 },
  'markets':           { mode: 'none',              relevant: false, confidence: 0.90 },
  'streets':           { mode: 'none',              relevant: false, confidence: 0.95 },
  'neighborhoods':     { mode: 'none',              relevant: false, confidence: 0.95 },
  'squares':           { mode: 'none',              relevant: false, confidence: 0.95 },
  'landmarks':         { mode: 'none',              relevant: false, confidence: 0.95 },
}

// ─── Category-level fallback ─────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, SubcategoryHint> = {
  'eat-drink':     { mode: 'affiliate_thefork', relevant: true,  confidence: 0.60 },
  'eat-and-drink': { mode: 'affiliate_thefork', relevant: true,  confidence: 0.60 },
  'stay':          { mode: 'affiliate_booking', relevant: true,  confidence: 0.75 },
  'sleep':         { mode: 'affiliate_booking', relevant: true,  confidence: 0.75 },
  'accommodation': { mode: 'affiliate_booking', relevant: true,  confidence: 0.75 },
  'do':            { mode: 'affiliate_viator',  relevant: true,  confidence: 0.60 },
  'experience':    { mode: 'affiliate_viator',  relevant: true,  confidence: 0.60 },
  'see':           { mode: 'none',              relevant: false, confidence: 0.55 },
  'shop':          { mode: 'none',              relevant: false, confidence: 0.75 },
  'nature':        { mode: 'none',              relevant: false, confidence: 0.80 },
  'culture':       { mode: 'none',              relevant: false, confidence: 0.55 },
}

// ─── Default label mapping ───────────────────────────────────────────────────

const MODE_LABELS: Record<BookingMode, string> = {
  none:                     '',
  affiliate_booking:        'Book on Booking.com',
  affiliate_thefork:        'Reserve on TheFork',
  affiliate_viator:         'Check availability',
  affiliate_getyourguide:   'Check availability',
  direct_website:           'Reserve',
  contact_only:             'Contact to reserve',
}

// ─── Main suggestion function ────────────────────────────────────────────────

export function suggestReservationForPlace(input: SuggestionInput): ReservationSuggestion {
  const base: ReservationSuggestion = {
    relevant: false,
    suggestedMode: 'none',
    suggestedLabel: null,
    suggestedUrl: null,
    confidence: 0,
    reason: 'insufficient_data',
    reasonDetail: 'No category or subcategory data available',
    source: 'heuristic_v1',
  }

  // If the editor already manually configured booking, note that
  if (input.booking_enabled && input.booking_mode !== 'none') {
    return {
      ...base,
      relevant: true,
      suggestedMode: input.booking_mode as BookingMode,
      suggestedUrl: input.booking_url,
      confidence: 1.0,
      reason: 'manual_data_exists',
      reasonDetail: `Editor configured: ${input.booking_mode}`,
    }
  }

  // Try subcategory match first (highest specificity)
  for (const slug of input.subcategory_slugs) {
    const hint = SUBCATEGORY_MAP[slug]
    if (hint) return buildFromHint(hint, 'subcategory_match', `subcategory: ${slug}`, input)
  }

  // Try category match (broader)
  for (const slug of input.category_slugs) {
    const hint = SUBCATEGORY_MAP[slug] ?? CATEGORY_MAP[slug]
    if (hint) return buildFromHint(hint, 'category_match', `category: ${slug}`, input)
  }

  // No category match — insufficient data
  return base
}

// ─── Build suggestion from hint ──────────────────────────────────────────────
// Enforces the invariant: if relevant=false → mode=none, url=null, label=null

function buildFromHint(
  hint: SubcategoryHint,
  defaultReason: SuggestionReason,
  reasonDetail: string,
  input: SuggestionInput,
): ReservationSuggestion {
  const reason = hint.reason ?? defaultReason

  // INVARIANT: if not relevant, mode must be none and no url/label
  if (!hint.relevant) {
    return {
      relevant: false,
      suggestedMode: 'none',
      suggestedLabel: null,
      suggestedUrl: null,
      confidence: hint.confidence,
      reason,
      reasonDetail,
      source: 'heuristic_v1',
    }
  }

  // Relevant: resolve URL and label
  const url = resolveUrl(hint.mode, input)
  return {
    relevant: true,
    suggestedMode: hint.mode,
    suggestedLabel: MODE_LABELS[hint.mode] || null,
    suggestedUrl: url,
    confidence: hint.confidence,
    reason,
    reasonDetail,
    source: 'heuristic_v1',
  }
}

// ─── URL resolution ──────────────────────────────────────────────────────────

function resolveUrl(mode: BookingMode, input: SuggestionInput): string | null {
  if (mode === 'none' || mode === 'contact_only') return null
  return input.booking_url || input.website_url || null
}
