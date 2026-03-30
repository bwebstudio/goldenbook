import { db } from '../../db/postgres'
import { AppError } from '../../shared/errors/AppError'
import { getCampaignById, checkInventoryAvailable, getNextAvailableSlot, getActiveSlotsByPlace } from './campaigns.query'
import type { NextAvailable } from './campaigns.query'
import { DISCOVER_SECTIONS } from './campaigns.dto'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EligibilityResult {
  eligible: boolean
  reason: string | null
  campaign: {
    id: string
    name: string
    section: string
    section_group: string
    status: string
    available_inventory: number
  } | null
  next_available: NextAvailable | null
  alternatives: { section: string; available: boolean }[]
}

/**
 * Extended AppError that carries availability context for the frontend.
 */
export class CampaignValidationError extends AppError {
  constructor(
    message: string,
    code: string,
    public readonly next_available: NextAvailable | null,
    public readonly alternatives: { section: string; available: boolean }[],
  ) {
    super(409, message, code)
    this.name = 'CampaignValidationError'
  }
}

// ─── Validation (throws on failure with rich context) ───────────────────────

export async function validateCampaignCheckout(opts: {
  campaignId: string
  placeId: string
  position?: number | null
  date: string
  timeBucket?: string
}): Promise<void> {
  const campaign = await getCampaignById(opts.campaignId)

  // 1. Campaign exists and is active
  if (!campaign) {
    throw new AppError(404, 'Campaign not found', 'CAMPAIGN_NOT_FOUND')
  }
  if (campaign.status !== 'active') {
    const next = await getNextAvailableSlot(opts.campaignId).catch(() => null)
    const alts = await buildAlternatives(opts.placeId, campaign.section).catch(() => [])
    throw new CampaignValidationError(
      `Campaign is ${campaign.status}, not accepting purchases`,
      'CAMPAIGN_NOT_ACTIVE',
      next,
      alts,
    )
  }

  // 2. Campaign dates are valid
  if (new Date(campaign.end_date) <= new Date()) {
    const alts = await buildAlternatives(opts.placeId, campaign.section).catch(() => [])
    throw new CampaignValidationError('Campaign has ended', 'CAMPAIGN_ENDED', null, alts)
  }

  // 3. City match
  if (campaign.city_id) {
    const { rows } = await db.query<{ match: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM place_destinations pd
         WHERE pd.place_id = $1 AND pd.destination_id = $2
         UNION
         SELECT 1 FROM places p
         WHERE p.id = $1 AND p.destination_id = $2
       ) AS match`,
      [opts.placeId, campaign.city_id],
    )
    if (!rows[0]?.match) {
      const alts = await buildAlternatives(opts.placeId, campaign.section).catch(() => [])
      throw new CampaignValidationError(
        'Place is not in the same city as the campaign',
        'CITY_MISMATCH',
        null,
        alts,
      )
    }
  }

  // 4. Inventory available
  const available = await checkInventoryAvailable({
    campaign_id: opts.campaignId,
    position: opts.position,
    date: opts.date,
    time_bucket: opts.timeBucket,
  })
  if (!available) {
    const next = await getNextAvailableSlot(opts.campaignId).catch(() => null)
    const alts = await buildAlternatives(opts.placeId, campaign.section).catch(() => [])
    throw new CampaignValidationError(
      'No inventory available for the requested slot',
      'NO_AVAILABILITY',
      next,
      alts,
    )
  }

  // 5. No duplicate section
  const { rows: existingPurchase } = await db.query<{ id: string }>(
    `SELECT p.id FROM purchases p
     WHERE p.place_id = $1 AND p.section = $2
       AND p.status IN ('pending', 'paid', 'activated')
     LIMIT 1`,
    [opts.placeId, campaign.section],
  )
  if (existingPurchase.length > 0) {
    const next = await getNextAvailableSlot(opts.campaignId).catch(() => null)
    const alts = await buildAlternatives(opts.placeId, campaign.section).catch(() => [])
    throw new CampaignValidationError(
      `This place already has an active purchase in the "${campaign.section}" section`,
      'DUPLICATE_SECTION',
      next,
      alts,
    )
  }

  // 6. Discover exclusivity
  if (campaign.section_group === 'discover') {
    const activeSlots = await getActiveSlotsByPlace(opts.placeId)
    const discoverConflict = activeSlots.find(
      (s) => s.section_group === 'discover' && s.section !== campaign.section,
    )
    if (discoverConflict) {
      const alts = await buildAlternatives(opts.placeId, campaign.section).catch(() => [])
      throw new CampaignValidationError(
        `This place is already active in discover section "${discoverConflict.section}"`,
        'DISCOVER_CONFLICT',
        null,
        alts,
      )
    }
  }
}

// ─── Eligibility check (non-throwing) ───────────────────────────────────────

export async function checkPlaceEligibility(
  campaignId: string,
  placeId: string,
): Promise<EligibilityResult> {
  const campaign = await getCampaignById(campaignId).catch(() => null)

  if (!campaign) {
    return {
      eligible: false,
      reason: 'Campaign not found',
      campaign: null,
      next_available: null,
      alternatives: [],
    }
  }

  const campaignInfo = {
    id: campaign.id,
    name: campaign.name,
    section: campaign.section,
    section_group: campaign.section_group,
    status: campaign.status,
    available_inventory: campaign.available_inventory ?? 0,
  }

  const errors: string[] = []

  if (campaign.status !== 'active') errors.push('CAMPAIGN_NOT_ACTIVE')
  if (new Date(campaign.end_date) <= new Date()) errors.push('CAMPAIGN_ENDED')
  if ((campaign.available_inventory ?? 0) <= 0) errors.push('NO_AVAILABILITY')

  // City match
  if (campaign.city_id) {
    const { rows } = await db.query<{ match: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM place_destinations pd
         WHERE pd.place_id = $1 AND pd.destination_id = $2
         UNION
         SELECT 1 FROM places p
         WHERE p.id = $1 AND p.destination_id = $2
       ) AS match`,
      [placeId, campaign.city_id],
    ).catch(() => ({ rows: [{ match: false }] }))
    if (!rows[0]?.match) errors.push('CITY_MISMATCH')
  }

  // Duplicate section
  const { rows: existingPurchase } = await db.query<{ id: string }>(
    `SELECT id FROM purchases
     WHERE place_id = $1 AND section = $2 AND status IN ('pending', 'paid', 'activated')
     LIMIT 1`,
    [placeId, campaign.section],
  ).catch(() => ({ rows: [] as { id: string }[] }))
  if (existingPurchase.length > 0) errors.push('DUPLICATE_SECTION')

  // Discover exclusivity
  if (campaign.section_group === 'discover') {
    const activeSlots = await getActiveSlotsByPlace(placeId).catch(() => [])
    const conflict = activeSlots.find(
      (s) => s.section_group === 'discover' && s.section !== campaign.section,
    )
    if (conflict) errors.push('DISCOVER_CONFLICT')
  }

  const alternatives = await buildAlternatives(placeId, campaign.section)

  const nextAvailable = await getNextAvailableSlot(campaignId).catch(() => null)

  return {
    eligible: errors.length === 0,
    reason: errors.length > 0 ? errors[0] : null,
    campaign: campaignInfo,
    next_available: nextAvailable,
    alternatives,
  }
}

async function buildAlternatives(
  placeId: string,
  currentSection: string,
): Promise<{ section: string; available: boolean }[]> {
  const { rows } = await db.query<{ section: string; available_count: string }>(
    `SELECT c.section,
            COUNT(*) FILTER (WHERE ci.status = 'available')::text AS available_count
     FROM campaigns c
     JOIN campaign_inventory ci ON ci.campaign_id = c.id
     WHERE c.status = 'active'
       AND c.end_date > now()
       AND c.section <> $1
       AND ci.date >= CURRENT_DATE
     GROUP BY c.section`,
    [currentSection],
  ).catch(() => ({ rows: [] as { section: string; available_count: string }[] }))

  const { rows: existingSections } = await db.query<{ section: string }>(
    `SELECT DISTINCT section FROM purchases
     WHERE place_id = $1 AND status IN ('pending', 'paid', 'activated') AND section IS NOT NULL`,
    [placeId],
  ).catch(() => ({ rows: [] as { section: string }[] }))
  const occupiedSections = new Set(existingSections.map((r) => r.section))

  const activeSlots = await getActiveSlotsByPlace(placeId).catch(() => [])
  const hasDiscoverSlot = activeSlots.some((s) => s.section_group === 'discover')

  return rows.map((r) => {
    const isDiscover = DISCOVER_SECTIONS.includes(r.section as typeof DISCOVER_SECTIONS[number])
    const blocked = occupiedSections.has(r.section) || (isDiscover && hasDiscoverSlot)
    return {
      section: r.section,
      available: !blocked && parseInt(r.available_count, 10) > 0,
    }
  })
}
