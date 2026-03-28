// ─── Onboarding Personalization Scoring ───────────────────────────────────────
//
// Shared module used by discover and concierge to boost places that match
// a user's onboarding profile (interests + exploration style).
//
// Design:
//  - Interest match  → +3 per matched interest (one match per interest, first wins)
//  - Style match     → +2 (one match, first wins)
//  - Returns 0 if profile is absent or empty — fully backward-compatible
//  - Never throws — safe if tags/descriptions are null/undefined

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingProfile {
  /** Mobile interest IDs (e.g. 'fine-dining', 'wine', 'culture') */
  interests?: string[]
  /** Mobile exploration style ID (e.g. 'solo', 'couple', 'friends', 'family') */
  style?: string
}

export function hasProfile(profile?: OnboardingProfile): boolean {
  return !!(profile?.interests?.length || profile?.style)
}

// ─── Interest → text tag map ──────────────────────────────────────────────────
// Matched against place short_description + editorial_summary (lowercased).

const INTEREST_TAG_MAP: Record<string, string[]> = {
  'fine-dining': ['fine dining', 'fine-dining', 'tasting menu', 'gastronomy', 'gourmet', 'michelin', 'chef'],
  'wine':        ['wine', 'wine bar', 'wine-bar', 'natural wine', 'sommelier', 'vineyard', 'winery'],
  'culture':     ['museum', 'gallery', 'art', 'culture', 'exhibition', 'contemporary', 'heritage'],
  'hidden-gems': ['hidden', 'secret', 'local', 'neighbourhood', 'off-the-beaten', 'gem', 'undiscovered'],
  'hotels':      ['boutique hotel', 'design hotel', 'luxury stay', 'accommodation'],
  'nature':      ['beach', 'coast', 'nature', 'scenic', 'outdoor', 'garden', 'park'],
  'nightlife':   ['cocktail', 'nightlife', 'nightclub', 'late-night', 'after dark'],
  'wellness':    ['spa', 'wellness', 'retreat', 'massage', 'relaxation'],
  'shopping':    ['boutique', 'concept store', 'fashion', 'design store', 'shopping'],
  'history':     ['historic', 'heritage', 'monument', 'palace', 'castle', 'ancient'],
}

// ─── Interest → category slug map ────────────────────────────────────────────
// Matched against place category_slugs (for nowRecommendation which has no text).

const INTEREST_CATEGORY_MAP: Record<string, string[]> = {
  'fine-dining': ['fine-dining', 'restaurant', 'dinner', 'gastronomy', 'tasting'],
  'wine':        ['wine', 'wine-bar'],
  'culture':     ['museum', 'gallery', 'art', 'culture'],
  'hidden-gems': [],
  'hotels':      ['hotel', 'boutique-hotel', 'accommodation'],
  'nature':      ['beach', 'coast', 'nature', 'park', 'scenic'],
  'nightlife':   ['bar', 'cocktail', 'nightlife', 'nightclub'],
  'wellness':    ['spa', 'wellness', 'retreat'],
  'shopping':    ['shopping', 'boutique', 'shop', 'concept'],
  'history':     ['museum', 'heritage', 'monument', 'historic'],
}

// ─── Style → text tag map ─────────────────────────────────────────────────────

const STYLE_TAG_MAP: Record<string, string[]> = {
  'solo':    ['solo', 'quiet', 'independent', 'calm', 'peaceful'],
  'couple':  ['romantic', 'intimate', 'date night', 'couple', 'atmospheric', 'candlelit'],
  'friends': ['group', 'social', 'lively', 'vibrant', 'sharing'],
  'family':  ['family', 'children', 'spacious', 'casual', 'welcoming'],
}

// ─── Style → category slug map ────────────────────────────────────────────────

const STYLE_CATEGORY_MAP: Record<string, string[]> = {
  'solo':    ['cafe', 'coffee', 'museum', 'gallery'],
  'couple':  ['restaurant', 'fine-dining', 'wine-bar', 'sunset', 'rooftop'],
  'friends': ['bar', 'cocktail', 'tapas', 'social', 'restaurant'],
  'family':  ['restaurant', 'museum', 'activity', 'beach'],
}

// ─── Scoring functions ────────────────────────────────────────────────────────

/**
 * Score free-text content (short_description + editorial_summary) against
 * a user profile. Used by editors_picks, hidden_spots, new_places re-ranking
 * and by concierge scoreConciergePlace.
 */
export function scoreTextForOnboarding(
  textContent: string,
  profile: OnboardingProfile,
): number {
  if (!hasProfile(profile)) return 0

  const text = textContent.toLowerCase()
  let score = 0

  for (const interest of (profile.interests ?? [])) {
    const tags = INTEREST_TAG_MAP[interest] ?? []
    for (const tag of tags) {
      if (text.includes(tag)) {
        score += 3
        break // one match per interest
      }
    }
  }

  if (profile.style) {
    const styleTags = STYLE_TAG_MAP[profile.style] ?? []
    for (const tag of styleTags) {
      if (text.includes(tag)) {
        score += 2
        break // one style match
      }
    }
  }

  return score
}

/**
 * Score category slugs against a user profile.
 * Used for nowRecommendation (which has category_slugs but not text content).
 */
export function scoreCategoriesForOnboarding(
  categorySlugs: string[],
  profile: OnboardingProfile,
): number {
  if (!hasProfile(profile)) return 0

  const slugs = categorySlugs.map((s) => s.toLowerCase())
  let score = 0

  for (const interest of (profile.interests ?? [])) {
    const cats = INTEREST_CATEGORY_MAP[interest] ?? []
    if (cats.some((cat) => slugs.some((s) => s.includes(cat)))) {
      score += 3
    }
  }

  if (profile.style) {
    const styleCats = STYLE_CATEGORY_MAP[profile.style] ?? []
    if (styleCats.some((cat) => slugs.some((s) => s.includes(cat)))) {
      score += 2
    }
  }

  return score
}

/**
 * Score a concierge intent against a user profile for bootstrap intent selection.
 * Higher = more aligned with the user's stated interests and style.
 * Used to bias the 3 bootstrap intents toward user taste.
 */
export function scoreIntentForProfile(
  intentTags: string[],
  intentKeywords: string[],
  profile: OnboardingProfile,
): number {
  if (!hasProfile(profile)) return 0

  const allTerms = [...intentTags, ...intentKeywords].map((t) => t.toLowerCase())
  let score = 0

  for (const interest of (profile.interests ?? [])) {
    const interestTags = INTEREST_TAG_MAP[interest] ?? []
    if (interestTags.some((it) => allTerms.some((t) => t.includes(it) || it.includes(t)))) {
      score += 3
    }
  }

  if (profile.style) {
    const styleTags = STYLE_TAG_MAP[profile.style] ?? []
    if (styleTags.some((st) => allTerms.some((t) => t.includes(st) || st.includes(t)))) {
      score += 2
    }
  }

  return score
}

// ─── Stable re-rank helper ────────────────────────────────────────────────────

export interface HasDescription {
  short_description: string | null
}

/**
 * Re-ranks a list of place cards by onboarding score.
 * Stable — preserves original order for equal scores.
 * Returns the same array unchanged if profile is empty.
 */
export function rerankByOnboarding<T extends HasDescription>(
  places: T[],
  profile: OnboardingProfile,
): T[] {
  if (!hasProfile(profile)) return places
  return [...places].sort((a, b) => {
    const scoreA = scoreTextForOnboarding(a.short_description ?? '', profile)
    const scoreB = scoreTextForOnboarding(b.short_description ?? '', profile)
    return scoreB - scoreA
  })
}

// ─── Query string helpers ─────────────────────────────────────────────────────

/** Parse a comma-separated interests string into an array. */
export function parseInterests(raw?: string): string[] | undefined {
  if (!raw) return undefined
  const parsed = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return parsed.length > 0 ? parsed : undefined
}
