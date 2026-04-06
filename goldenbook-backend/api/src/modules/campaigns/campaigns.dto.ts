import { z } from 'zod'

// ─── Section definitions ────────────────────────────────────────────────────

export const CAMPAIGN_SECTIONS = [
  'golden_picks',
  'now',
  'hidden_gems',
  'category_featured',
  'search_priority',
  'concierge',
  'new_on_goldenbook',
] as const

export const SECTION_GROUPS = ['discover', 'intent', 'dynamic'] as const

export const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'ended'] as const

export const TIME_BUCKETS = ['morning', 'lunch', 'afternoon', 'evening', 'night', 'all_day'] as const

// Section → group mapping
// NOW is NOT a Discover product — it has its own surface rules (1 per place, time-window based)
export const SECTION_TO_GROUP: Record<string, (typeof SECTION_GROUPS)[number]> = {
  golden_picks: 'discover',
  now: 'intent',
  hidden_gems: 'discover',
  new_on_goldenbook: 'discover',
  search_priority: 'intent',
  category_featured: 'intent',
  concierge: 'dynamic',
}

// Discover sections are exclusive — a place can only be in ONE at a time
// NOW is NOT included — it is an independent surface
export const DISCOVER_SECTIONS = ['golden_picks', 'hidden_gems', 'new_on_goldenbook'] as const

// ─── Campaign schemas ───────────────────────────────────────────────────────

export const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  section: z.enum(CAMPAIGN_SECTIONS),
  city_id: z.string().uuid().nullish(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  status: z.enum(CAMPAIGN_STATUSES).default('draft'),
  slot_limit: z.number().int().min(1).max(1000),
  priority: z.number().int().default(0),
})

export const UpdateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  section: z.enum(CAMPAIGN_SECTIONS).optional(),
  city_id: z.string().uuid().nullable().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
  slot_limit: z.number().int().min(1).max(1000).optional(),
  priority: z.number().int().optional(),
})

// ─── Inventory schemas ──────────────────────────────────────────────────────

export const CreateInventorySchema = z.object({
  position: z.number().int().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_bucket: z.enum(TIME_BUCKETS).nullish(),
})

export const BulkCreateInventorySchema = z.object({
  positions: z.array(z.number().int().min(1)).min(1),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_buckets: z.array(z.enum(TIME_BUCKETS)).nullish(),
})

// ─── Checkout schema (campaign-based) ───────────────────────────────────────

export const CampaignCheckoutSchema = z.object({
  planId: z.string().uuid(),
  campaignId: z.string().uuid(),
  city: z.string().default('lisbon'),
  month: z.coerce.number().int().min(1).max(12).optional(),
  position: z.number().int().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_bucket: z.enum(TIME_BUCKETS).default('all_day'),
})

// ─── Availability query schema ──────────────────────────────────────────────

export const AvailabilityQuerySchema = z.object({
  place_id: z.string().uuid(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>
export type CampaignCheckoutInput = z.infer<typeof CampaignCheckoutSchema>
