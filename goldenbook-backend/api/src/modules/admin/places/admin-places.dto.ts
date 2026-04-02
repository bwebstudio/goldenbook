import { z } from 'zod'

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
  shortDescription: z.string().optional(),
  fullDescription:  z.string().optional(),
  goldenbookNote:   z.string().optional(),
  whyWeLoveIt:      z.string().optional(),
  insiderTip:       z.string().optional(),
  citySlug:         z.string().min(1, 'City is required'),
  citySlugs:        z.array(z.string().min(1)).optional(),
  addressLine:      z.string().optional(),
  websiteUrl:       urlOrEmpty,
  phone:            z.string().optional(),
  email:            emailOrEmpty,
  bookingUrl:       bookingOrEmpty,
  categorySlug:     z.string().min(1, 'Category is required'),
  subcategorySlug:  z.string().optional(),
  status:           z.enum(['draft', 'published', 'archived']).default('draft'),
  featured:         z.boolean().default(false),
  // Booking fields
  bookingEnabled:          z.boolean().default(false),
  bookingMode:             bookingModeEnum.default('none'),
  bookingLabel:            z.string().optional(),
  bookingNotes:            z.string().optional(),
  reservationRelevant:     z.boolean().default(false),
  reservationSource:       reservationSourceEnum.optional(),
})

const nowTimeWindowEnum = z.enum(['morning', 'midday', 'afternoon', 'evening', 'night'])

export const updatePlaceSchema = z.object({
  name:             z.string().min(2).optional(),
  slug:             z.string().regex(SLUG_RE).optional(),
  shortDescription: z.string().optional(),
  fullDescription:  z.string().optional(),
  goldenbookNote:   z.string().optional(),
  whyWeLoveIt:      z.string().optional(),
  insiderTip:       z.string().optional(),
  citySlug:         z.string().min(1).optional(),
  citySlugs:        z.array(z.string().min(1)).optional(),
  addressLine:      z.string().optional(),
  websiteUrl:       urlOrEmpty,
  phone:            z.string().optional(),
  email:            emailOrEmpty,
  bookingUrl:       bookingOrEmpty,
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
})

export type CreatePlaceInput = z.infer<typeof createPlaceSchema>
export type UpdatePlaceInput = z.infer<typeof updatePlaceSchema>

// ─── Response DTO ─────────────────────────────────────────────────────────────

export interface AdminPlaceResponseDTO {
  id:        string
  slug:      string
  name:      string
  status:    string
  featured:  boolean
  citySlug:  string
  citySlugs: string[]
}