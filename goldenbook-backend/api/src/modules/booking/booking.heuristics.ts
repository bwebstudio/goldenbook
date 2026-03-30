// Category/subcategory-based heuristics for suggesting booking mode.
// Used by the Smart Booking Router when no manual override exists.

import type { BookingMode } from './booking.types'

// Slug → suggested booking mode
// These are initial suggestions, not absolute rules.
const CATEGORY_HINTS: Record<string, BookingMode> = {
  // Subcategory-level (more specific, checked first)
  'restaurants':     'affiliate_thefork',
  'fine-dining':     'affiliate_thefork',
  'casual-dining':   'affiliate_thefork',
  'cafes':           'none',
  'bars':            'none',
  'bakeries':        'none',
  'hotels':          'affiliate_booking',
  'boutique-hotels': 'affiliate_booking',
  'hostels':         'affiliate_booking',
  'guesthouses':     'affiliate_booking',
  'apartments':      'affiliate_booking',
  'tours':           'affiliate_viator',
  'experiences':     'affiliate_viator',
  'activities':      'affiliate_viator',
  'spas':            'direct_website',
  'wellness':        'direct_website',
  'beaches':         'none',
  'parks':           'none',
  'gardens':         'none',
  'viewpoints':      'none',
  'monuments':       'none',
  'museums':         'none',
  'churches':        'none',
  'shops':           'none',
  'markets':         'none',
  'boutiques':       'none',
}

// Category-level (broader fallback)
const CATEGORY_BROAD_HINTS: Record<string, BookingMode> = {
  'eat-drink':       'affiliate_thefork',
  'eat-and-drink':   'affiliate_thefork',
  'stay':            'affiliate_booking',
  'sleep':           'affiliate_booking',
  'accommodation':   'affiliate_booking',
  'do':              'affiliate_viator',
  'experience':      'affiliate_viator',
  'see':             'none',
  'shop':            'none',
  'nature':          'none',
  'culture':         'none',
}

/**
 * Suggest a booking mode based on category/subcategory slugs.
 * Returns null if no heuristic matches.
 */
export function inferBookingMode(
  categorySlugs: string[],
  subcategorySlugs: string[],
): BookingMode | null {
  // First pass: find a reservable subcategory (mode !== 'none')
  for (const slug of subcategorySlugs) {
    const hint = CATEGORY_HINTS[slug]
    if (hint && hint !== 'none') return hint
  }

  // Second pass: check categories for a reservable mode
  for (const slug of categorySlugs) {
    const hint = CATEGORY_HINTS[slug] ?? CATEGORY_BROAD_HINTS[slug]
    if (hint && hint !== 'none') return hint
  }

  // Third pass: if any subcategory explicitly says 'none', return that
  for (const slug of subcategorySlugs) {
    const hint = CATEGORY_HINTS[slug]
    if (hint === 'none') return 'none'
  }

  return null
}

/**
 * Determine if a place type is typically reservation-relevant.
 */
export function inferReservationRelevant(
  categorySlugs: string[],
  subcategorySlugs: string[],
): boolean {
  const mode = inferBookingMode(categorySlugs, subcategorySlugs)
  return mode !== null && mode !== 'none'
}
