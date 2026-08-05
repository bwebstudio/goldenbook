// Tonight's plan: sequencing.
//
// Greedy and deterministic on purpose. A plan is a promise about a sequence,
// so every constraint below is checked against a real row, and when one cannot
// be satisfied we return a shorter plan or none at all. There is no branch in
// this file that invents a stop to fill a slot.
//
// What we deliberately do NOT promise:
//   - times. We hold no duration data, so "20:00 dinner" would be a guess.
//     Instead each stop must still be open by the time someone walking the
//     route could reach it, which opening_hours can actually answer.
//   - a table. We are not a booking system; the plan says where to go.

import {
  type PlanCandidate,
  metresBetween,
  minutesUntilClose,
} from './plan.query'
import { rotationBoost } from '../shared-scoring/exposure'

/** Longest walk we will put between two consecutive stops. ~15 min on foot. */
const MAX_LEG_METRES = 1200

/**
 * How long after now each stop needs to still be open, in minutes.
 *
 * Not a schedule, a floor. Someone leaving now reaches a second stop well
 * inside 75 minutes and a third inside 150, so a place that shuts before then
 * cannot honestly be in the sequence. Generous rather than tight: the cost of
 * excluding a place that would have worked is a shorter plan, and the cost of
 * including one that closes first is a user standing at a locked door.
 *
 * The first stop is 30, not 0. Zero would let us open an evening with
 * somewhere that shuts in five minutes, which is the fastest way to teach
 * someone that the plan cannot be trusted.
 */
const MIN_OPEN_MINUTES = [30, 75, 150]

const MAX_STOPS = 3
/** Below this a "plan" is just a recommendation with extra steps. */
const MIN_STOPS = 2

export interface PlanStop {
  placeId: string
  slug: string
  name: string
  shortDescription: string | null
  category: string | null
  heroImage: { bucket: string | null; path: string | null }
  /** Metres from the previous stop, or from the user for the first one. */
  legMetres: number
  /** Walking minutes for that leg at 80 m/min. Always at least 1. */
  legWalkMinutes: number
  /** "HH:MM" this stop stops serving today. Never null: it is a hard filter. */
  closesAt: string
}

export interface Plan {
  city: string
  stops: PlanStop[]
  /** Total walking metres across the whole sequence, user included. */
  totalMetres: number
  totalWalkMinutes: number
}

/** Walking minutes at 80 m/min, floored at 1 so a leg never reads "0 min". */
function walkMinutes(metres: number): number {
  return Math.max(1, Math.round(metres / 80))
}

/**
 * Ranking within the candidate pool.
 *
 * Kept separate from the NOW scoring engine on purpose. That engine answers
 * "what is the single best thing right now", weighted, A/B tested and tuned.
 * This answers "what makes a good stop in a sequence", where proximity matters
 * far more and the contextual signals matter far less, because the sequence
 * itself supplies the context. Reusing it would have meant either distorting
 * its weights or fighting them.
 */
function scoreStop(c: PlanCandidate, fromLat: number, fromLon: number): number {
  const metres = metresBetween(fromLat, fromLon, c.latitude, c.longitude)

  // Proximity dominates: a plan is only worth following if it is walkable.
  const proximity = Math.max(0, 100 - (metres / MAX_LEG_METRES) * 100)
  const popularity = Math.min(c.popularity_score ?? 0, 100)
  const editorial = Math.min(c.now_priority, 10) * 4

  return (
    proximity * 0.55 +
    popularity * 0.25 +
    editorial * 0.20 +
    // Same catalogue rotation the feeds use, so the tail gets a turn here too.
    rotationBoost(c.last_viewed_at)
  )
}

/**
 * Build the sequence.
 *
 * @param candidates places already filtered to "in this city, has coordinates,
 *                   open right now" by getPlanCandidates
 * @param userLat/userLon where the walk starts
 * @param tz           the city's timezone, for reading closing times
 */
export function buildPlan(
  candidates: PlanCandidate[],
  userLat: number,
  userLon: number,
  tz: string,
  cityName: string,
): Plan | null {
  const stops: PlanStop[] = []
  const usedIds = new Set<string>()
  const usedCategories = new Set<string>()

  let fromLat = userLat
  let fromLon = userLon

  for (let index = 0; index < MAX_STOPS; index++) {
    const needsOpenFor = MIN_OPEN_MINUTES[index]

    const eligible = candidates.filter((c) => {
      if (usedIds.has(c.id)) return false

      // Variety: three restaurants in a row is a list, not a plan. Falls back
      // to place_type when a place carries no category, so an uncategorised
      // row cannot slip past the rule by having nothing to compare.
      const cat = c.primary_category ?? c.place_type
      if (usedCategories.has(cat)) return false

      // Still open when someone walking this route would arrive.
      const closesIn = minutesUntilClose(c.closes_at_today, tz)
      if (closesIn == null || closesIn < needsOpenFor) return false

      // Walkable from the previous stop. The first stop is measured from the
      // user, so this also keeps the plan from starting across town.
      const metres = metresBetween(fromLat, fromLon, c.latitude, c.longitude)
      return metres <= MAX_LEG_METRES
    })

    if (eligible.length === 0) break

    const best = eligible.reduce((a, b) =>
      scoreStop(b, fromLat, fromLon) > scoreStop(a, fromLat, fromLon) ? b : a,
    )

    const legMetres = metresBetween(fromLat, fromLon, best.latitude, best.longitude)
    stops.push({
      placeId: best.id,
      slug: best.slug,
      name: best.name,
      shortDescription: best.short_description,
      category: best.primary_category,
      heroImage: { bucket: best.hero_bucket, path: best.hero_path },
      legMetres,
      legWalkMinutes: walkMinutes(legMetres),
      // Non-null by construction: closes_at_today is required by the filter
      // above, which is why the DTO can promise it.
      closesAt: best.closes_at_today as string,
    })

    usedIds.add(best.id)
    usedCategories.add(best.primary_category ?? best.place_type)
    fromLat = best.latitude
    fromLon = best.longitude
  }

  // A one-stop plan is a recommendation the Now card already makes better.
  // Returning null lets the client render nothing rather than something thin.
  if (stops.length < MIN_STOPS) return null

  const totalMetres = stops.reduce((sum, s) => sum + s.legMetres, 0)
  return {
    city: cityName,
    stops,
    totalMetres,
    totalWalkMinutes: stops.reduce((sum, s) => sum + s.legWalkMinutes, 0),
  }
}
