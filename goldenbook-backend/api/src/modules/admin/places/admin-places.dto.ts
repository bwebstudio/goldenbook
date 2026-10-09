import { z } from 'zod'
import { openingHoursSchema } from './opening-hours'

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const urlOrEmpty = z
  .string()
  .refine((v) => v === '' || /^https?:\/\/.+/i.test(v), {
    message: 'Must be a valid URL starting with http:// or https://',
  })
  .optional()

const emailOrEmpty = z
  .string()
  .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: 'Must be a valid email address',
  })
  .optional()

const bookingOrEmpty = z
  .string()
  .refine(
    (v) =>
      v === '' ||
      /^https?:\/\/.+/i.test(v) ||
      /^\+?[\d\s\-().]{6,}$/.test(v),
    { message: 'Must be a valid URL or phone number' },
  )
  .optional()

const bookingModeEnum = z.enum([
  'none',
  'affiliate_booking',
  'affiliate_thefork',
  'affiliate_viator',
  'affiliate_getyourguide',
  'direct_website',
  'contact_only',
])

const reservationSourceEnum = z.enum(['manual', 'ai_suggested', 'imported'])

export const createPlaceSchema = z.object({
  name:             z.string().min(2, 'Name must be at least 2 characters'),
  slug:             z
    .string()
    .min(1, 'Slug is required')
    .regex(SLUG_RE, 'Slug must be lowercase letters, numbers, and hyphens only'),
  shortDescription: z.string().max(600, 'Description cannot exceed 600 characters').optional(),
  fullDescription:  z.string().optional(),
  goldenbookNote:   z.string().optional(),
  insiderTip:       z.string().optional(),
  // Locale of the editorial fields above. PT is canonical going forward —
  // the manual dashboard form always submits PT. Google / external imports
  // submit 'en' and the backend translates EN → PT before persisting the
  // canonical row. ES is always auto-translated from PT after.
  // Optional + defaulted at the call-site so existing callers (seed
  // scripts, etc.) keep compiling without a forced .sourceLocale.
  sourceLocale:     z.enum(['pt', 'en']).optional(),
  citySlug:         z.string().min(1, 'City is required'),
  citySlugs:        z.array(z.string().min(1)).optional(),
  addressLine:      z.string().optional(),
  websiteUrl:       urlOrEmpty,
  phone:            z.string().optional(),
  email:            emailOrEmpty,
  bookingUrl:       bookingOrEmpty,
  categorySlug:     z.string().min(1, 'Category is required'),
  subcategorySlug:  z.string().optional(),
  placeType:        z.enum(['restaurant', 'bar', 'cafe', 'hotel', 'shop', 'museum', 'landmark', 'activity', 'beach', 'venue', 'transport', 'other']).default('other'),
  status:           z.enum(['draft', 'published', 'archived']).default('draft'),
  featured:         z.boolean().default(false),
  // Google enrichment (set by Place Generator)
  googlePlaceId:    z.string().optional(),
  googleMapsUrl:    urlOrEmpty,
  googleRating:     z.number().optional(),
  googleRatingCount: z.number().int().optional(),
  latitude:         z.number().optional(),
  longitude:        z.number().optional(),
  priceTier:        z.number().int().min(1).max(4).optional(),
  // Booking fields
  bookingEnabled:          z.boolean().default(false),
  bookingMode:             bookingModeEnum.default('none'),
  bookingLabel:            z.string().optional(),
  bookingNotes:            z.string().optional(),
  reservationRelevant:     z.boolean().default(false),
  reservationSource:       reservationSourceEnum.optional(),
  // Weekly opening hours (see opening-hours.ts). Omitted = no rows written.
  openingHours:            openingHoursSchema.optional(),
})

// ─── NOW time windows ───────────────────────────────────────────────────────
//
// The canonical vocabulary is the one `getNowTimeOfDay()` emits at runtime
// (modules/shared-scoring/context-tags.ts) and that the NOW candidate query
// matches rows against (`tw.time_window = $timeWindow`). It has SIX values:
//
//   morning 06-11 | midday 11-15 | afternoon 15-18
//   evening 18-22 | late_evening 22-02 | deep_night 02-06
//
// This enum previously listed only five and swapped the last two for a
// phantom 'night'. Two consequences, both seen in production:
//
//   1. Seed scripts write `late_evening` / `deep_night` straight into
//      place_now_time_windows (the column is plain TEXT, no CHECK). The
//      dashboard reads those values back, echoes them on save, and the
//      request was rejected with "nowTimeWindows.4: Invalid enum value …
//      received 'late_evening'" — making every field on those places
//      unsaveable, not just the time windows.
//   2. 'night' is never produced by `getNowTimeOfDay()`, so any row the
//      dashboard did manage to write with it matched nothing at runtime and
//      silently excluded the place from NOW between 22:00 and 06:00.
//
// 'night' stays accepted so an older dashboard build can't start failing
// mid-deploy, but it is normalised to `late_evening` before it reaches the
// database (see `normalizeNowTimeWindows`) so no dead value is ever stored.
export const NOW_TIME_WINDOWS = [
  'morning',
  'midday',
  'afternoon',
  'evening',
  'late_evening',
  'deep_night',
] as const

export type NowTimeWindow = typeof NOW_TIME_WINDOWS[number]

/** Legacy alias → canonical value. 22:00-06:00 maps onto `late_evening`. */
const LEGACY_TIME_WINDOW_ALIASES: Record<string, NowTimeWindow> = {
  night: 'late_evening',
}

const nowTimeWindowEnum = z.enum([
  ...NOW_TIME_WINDOWS,
  ...(Object.keys(LEGACY_TIME_WINDOW_ALIASES) as [string, ...string[]]),
] as unknown as [NowTimeWindow, ...NowTimeWindow[]])

/**
 * Map legacy aliases onto canonical values and drop duplicates, preserving
 * first-seen order. Applied on every write so `place_now_time_windows` only
 * ever holds values the NOW query can match.
 */
export function normalizeNowTimeWindows(windows: readonly string[]): NowTimeWindow[] {
  const seen = new Set<string>()
  const out: NowTimeWindow[] = []
  for (const w of windows) {
    const canonical = LEGACY_TIME_WINDOW_ALIASES[w] ?? (w as NowTimeWindow)
    if (!NOW_TIME_WINDOWS.includes(canonical)) continue
    if (seen.has(canonical)) continue
    seen.add(canonical)
    out.push(canonical)
  }
  return out
}

export const updatePlaceSchema = z.object({
  name:             z.string().min(2).optional(),
  slug:             z.string().regex(SLUG_RE).optional(),
  shortDescription: z.string().max(600, 'Description cannot exceed 600 characters').optional(),
  fullDescription:  z.string().optional(),
  goldenbookNote:   z.string().optional(),
  insiderTip:       z.string().optional(),
  citySlug:         z.string().min(1).optional(),
  citySlugs:        z.array(z.string().min(1)).optional(),
  addressLine:      z.string().optional(),
  websiteUrl:       urlOrEmpty,
  phone:            z.string().optional(),
  email:            emailOrEmpty,
  bookingUrl:       bookingOrEmpty,
  placeType:        z.enum(['restaurant', 'bar', 'cafe', 'hotel', 'shop', 'museum', 'landmark', 'activity', 'beach', 'venue', 'other']).optional(),
  categorySlug:     z.string().min(1).optional(),
  subcategorySlug:  z.string().optional(),
  status:           z.enum(['draft', 'published', 'archived']).optional(),
  featured:         z.boolean().optional(),
  // Booking fields
  bookingEnabled:          z.boolean().optional(),
  bookingMode:             bookingModeEnum.optional(),
  bookingLabel:            z.string().optional(),
  bookingNotes:            z.string().optional(),
  reservationRelevant:     z.boolean().optional(),
  reservationSource:       reservationSourceEnum.optional(),
  // NOW visibility fields
  nowEnabled:              z.boolean().optional(),
  nowPriority:             z.number().int().min(0).max(10).optional(),
  nowFeatured:             z.boolean().optional(),
  nowStartAt:              z.string().datetime({ offset: true }).nullable().optional(),
  nowEndAt:                z.string().datetime({ offset: true }).nullable().optional(),
  nowTagSlugs:             z.array(z.string().min(1)).optional(),
  nowTimeWindows:          z.array(nowTimeWindowEnum).optional(),
  // Weekly opening hours. Omitted = leave the stored hours untouched;
  // an array replaces the whole week; [] clears it (hours unknown).
  openingHours:            openingHoursSchema.optional(),
})

export type CreatePlaceInput = z.infer<typeof createPlaceSchema>
export type UpdatePlaceInput = z.infer<typeof updatePlaceSchema>

// ─── Response DTO ─────────────────────────────────────────────────────────────

/**
 * What happened to EN/ES after a save that changed the Portuguese editorial
 * fields. `skippedLocked` are locales flagged translation_override = true
 * (manual translations), which auto-translation never touches; `failed` are
 * locales DeepL could not translate this time.
 */
export interface AutoTranslationOutcome {
  updated:       Array<'en' | 'es'>
  skippedLocked: Array<'en' | 'es'>
  failed:        Array<'en' | 'es'>
}

export interface AdminPlaceResponseDTO {
  id:        string
  slug:      string
  name:      string
  status:    string
  featured:  boolean
  citySlug:  string
  citySlugs: string[]
  /** Present on PUT when a PT editorial field was part of the save. */
  autoTranslation?: AutoTranslationOutcome
}