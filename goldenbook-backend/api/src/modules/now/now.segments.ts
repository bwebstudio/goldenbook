// ─── User Segment System ─────────────────────────────────────────────────────
//
// Segments users based on onboarding interests and behavior.
// Segments influence scoring weights via segment-specific overrides.
//
// Segments: foodie, culture, luxury, nightlife, explorer
//
// Resolution:
//   1. Check user_segments table (explicit assignment)
//   2. Infer from onboarding interests (deterministic mapping)
//   3. Default: 'explorer' (neutral)

import { db } from '../../db/postgres'
import type { OnboardingProfile } from '../../shared/ranking/place.ranking'
import type { NowWeights } from './now.weights'

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserSegment = 'foodie' | 'culture' | 'luxury' | 'nightlife' | 'explorer'

export const VALID_SEGMENTS: UserSegment[] = ['foodie', 'culture', 'luxury', 'nightlife', 'explorer']

// ─── Interest → segment mapping ──────────────────────────────────────────────

const INTEREST_SEGMENT_MAP: Record<string, UserSegment> = {
  'fine-dining':  'foodie',
  'wine':         'foodie',
  'culture':      'culture',
  'hidden-gems':  'explorer',
  'hotels':       'luxury',
  'nature':       'explorer',
  'nightlife':    'nightlife',
  'wellness':     'luxury',
  'shopping':     'luxury',
  'history':      'culture',
}

// ─── Segment → weight adjustments ────────────────────────────────────────────
//
// These are PARTIAL overrides applied on top of base weights.
// They shift emphasis, not replace the entire configuration.

export const SEGMENT_WEIGHT_OVERRIDES: Record<UserSegment, Partial<NowWeights>> = {
  foodie: {
    moment:    0.25,  // boost: restaurants/cafes
    editorial: 0.18,  // quality matters more for food
    proximity: 0.25,  // slightly less distance-dependent
  },
  culture: {
    moment:    0.25,  // boost: indoor_culture, museums
    editorial: 0.20,  // editorial quality is paramount
    weather:   0.12,  // weather matters more (indoor vs outdoor)
  },
  luxury: {
    editorial: 0.22,  // quality/curation is key
    commercial: 0.08, // more receptive to premium places
    proximity: 0.25,  // willing to travel further
  },
  nightlife: {
    moment:    0.28,  // time-dependent (evening/night emphasis)
    time:      0.15,  // time of day is very important
    proximity: 0.22,  // closer is better for nightlife
  },
  explorer: {
    // Neutral — uses default weights
    // Slight bump to moment variety
    moment:    0.22,
    weather:   0.12,
  },
}

// ─── Segment resolution ──────────────────────────────────────────────────────

/**
 * Resolve a user's segment.
 *
 * Priority:
 *   1. Explicit assignment in user_segments table
 *   2. Inferred from onboarding interests
 *   3. Default: 'explorer'
 */
export async function resolveSegment(
  userId: string | null,
  profile?: OnboardingProfile,
): Promise<UserSegment> {
  // 1. Check DB for explicit segment
  if (userId) {
    try {
      const { rows } = await db.query<{ segment: string }>(`
        SELECT segment FROM user_segments WHERE user_id = $1
      `, [userId])
      if (rows.length > 0 && VALID_SEGMENTS.includes(rows[0].segment as UserSegment)) {
        return rows[0].segment as UserSegment
      }
    } catch {}
  }

  // 2. Infer from onboarding interests
  if (profile?.interests?.length) {
    const segmentVotes = new Map<UserSegment, number>()
    for (const interest of profile.interests) {
      const seg = INTEREST_SEGMENT_MAP[interest]
      if (seg) {
        segmentVotes.set(seg, (segmentVotes.get(seg) ?? 0) + 1)
      }
    }
    if (segmentVotes.size > 0) {
      // Return the segment with the most matching interests
      const sorted = [...segmentVotes.entries()].sort((a, b) => b[1] - a[1])
      return sorted[0][0]
    }
  }

  // 3. Default
  return 'explorer'
}

/**
 * Get segment-specific weight overrides, or null if the segment uses defaults.
 */
export function getSegmentWeightOverrides(segment: UserSegment): Partial<NowWeights> | null {
  const overrides = SEGMENT_WEIGHT_OVERRIDES[segment]
  if (!overrides || Object.keys(overrides).length === 0) return null
  return overrides
}

/**
 * Store/update a user's segment assignment.
 */
export async function setUserSegment(
  userId: string,
  segment: UserSegment,
  source: 'onboarding' | 'behavior' | 'manual' = 'manual',
  confidence = 0.8,
): Promise<void> {
  await db.query(`
    INSERT INTO user_segments (user_id, segment, source, confidence, updated_at)
    VALUES ($1, $2, $3, $4, now())
    ON CONFLICT (user_id) DO UPDATE SET
      segment = EXCLUDED.segment,
      source = EXCLUDED.source,
      confidence = EXCLUDED.confidence,
      updated_at = now()
  `, [userId, segment, source, confidence])
}