// Generates booking candidate URLs for a place based on its type.
// Does NOT verify URLs — that's done by the verify script.

import type { CandidateGenerationInput, CandidateProvider, CandidateType } from './candidates.types'

interface GeneratedCandidate {
  provider: CandidateProvider
  candidate_url: string
  candidate_type: CandidateType
  confidence: number
}

// Subcategory → which providers to try
const PROVIDER_RULES: Record<string, CandidateProvider[]> = {
  hotels:          ['booking'],
  restaurants:     ['thefork'],
  bars:            ['thefork'],
  cafes:           [],
  tours:           ['viator', 'getyourguide'],
  experiences:     ['viator', 'getyourguide'],
  health_wellness: [],
  nightlife:       [],
  wineries:        ['viator'],
}

const CATEGORY_PROVIDER_RULES: Record<string, CandidateProvider[]> = {
  activities: ['viator'],
  gastronomy: ['thefork'],
}

const NON_RESERVABLE = new Set([
  'parks', 'natural_reserves', 'viewpoints', 'gardens', 'waterfalls',
  'monuments', 'churches', 'historical_sites', 'museums', 'galleries',
  'local_shops', 'malls', 'fashion', 'jewellery', 'crafts', 'souvenirs',
  'traditional_shops', 'watches', 'decoration',
  'airport', 'car_rental', 'real_estate',
  'festivals', 'concerts', 'exhibitions', 'fairs', 'cultural_events',
])

// ─── Name normalization ──────────────────────────────────────────────────────
// DB names are often ALL CAPS. Normalize to title case for search URLs.

function toTitleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bDe\b/g, 'de')
    .replace(/\bDo\b/g, 'do')
    .replace(/\bDa\b/g, 'da')
    .replace(/\bDos\b/g, 'dos')
    .replace(/\bDas\b/g, 'das')
    .replace(/\bE\b/g, 'e')
}

// ─── URL builders ────────────────────────────────────────────────────────────

function buildBookingSearchUrl(name: string, city: string): string {
  const q = encodeURIComponent(`${toTitleCase(name)} ${city}`)
  return `https://www.booking.com/searchresults.html?ss=${q}&aid=311090`
}

function buildTheForkSearchUrl(name: string, city: string): string {
  const q = encodeURIComponent(toTitleCase(name))
  // TheFork Portugal uses thefork.pt
  return `https://www.thefork.pt/search/?q=${q}`
}

function buildViatorSearchUrl(name: string, city: string): string {
  const q = encodeURIComponent(`${toTitleCase(name)} ${city}`)
  return `https://www.viator.com/searchResults/all?text=${q}`
}

function buildGetYourGuideSearchUrl(name: string, city: string): string {
  const q = encodeURIComponent(`${toTitleCase(name)} ${city}`)
  return `https://www.getyourguide.com/s/?q=${q}`
}

const URL_BUILDERS: Record<CandidateProvider, (name: string, city: string) => string> = {
  booking: buildBookingSearchUrl,
  thefork: buildTheForkSearchUrl,
  viator: buildViatorSearchUrl,
  getyourguide: buildGetYourGuideSearchUrl,
  website: () => '',
}

// ─── Main discovery function ─────────────────────────────────────────────────

export function generateCandidatesForPlace(input: CandidateGenerationInput): GeneratedCandidate[] {
  const candidates: GeneratedCandidate[] = []
  const { name, city_name, website_url, subcategory_slugs, category_slugs } = input

  // Skip if ALL subcategories are non-reservable
  if (subcategory_slugs.length > 0 && subcategory_slugs.every(s => NON_RESERVABLE.has(s))) {
    // Still add website as fallback
    if (website_url && /^https?:\/\/[^\s@]+/i.test(website_url)) {
      candidates.push({ provider: 'website', candidate_url: website_url, candidate_type: 'official_website', confidence: 0.30 })
    }
    return candidates
  }

  // Determine providers from subcategories
  const providers = new Set<CandidateProvider>()
  for (const sub of subcategory_slugs) {
    const rules = PROVIDER_RULES[sub]
    if (rules) rules.forEach(p => providers.add(p))
  }
  // Category fallback
  if (providers.size === 0) {
    for (const cat of category_slugs) {
      const rules = CATEGORY_PROVIDER_RULES[cat]
      if (rules) rules.forEach(p => providers.add(p))
    }
  }

  // Generate provider search URLs
  for (const provider of providers) {
    const builder = URL_BUILDERS[provider]
    const url = builder(name, city_name)
    if (url) {
      candidates.push({ provider, candidate_url: url, candidate_type: 'provider_search', confidence: 0.40 })
    }
  }

  // Always add official website
  if (website_url && /^https?:\/\/[^\s@]+/i.test(website_url)) {
    candidates.push({ provider: 'website', candidate_url: website_url, candidate_type: 'official_website', confidence: 0.30 })
  }

  return candidates
}
