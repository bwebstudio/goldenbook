import { db } from '../../db/postgres'

// ─── Row types ────────────────────────────────────────────────────────────────

export interface JourneyRow {
  id: string
  user_id: string
  route_slug: string
  status: 'active' | 'completed' | 'abandoned'
  started_at: Date
  completed_at: Date | null
  updated_at: Date
}

export interface JourneyStopRow {
  id: string
  journey_id: string
  place_external_id: string
  place_name: string
  sort_order: number
  status: 'upcoming' | 'active' | 'arrived' | 'completed' | 'skipped'
  updated_at: Date
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns the most recent active journey for a user + route combination.
 * Returns null if none exists.
 */
export async function getActiveJourney(
  userId: string,
  routeSlug: string,
): Promise<(JourneyRow & { stops: JourneyStopRow[] }) | null> {
  const { rows: journeys } = await db.query<JourneyRow>(
    `SELECT id, user_id, route_slug, status, started_at, completed_at, updated_at
     FROM user_route_journeys
     WHERE user_id = $1
       AND route_slug = $2
       AND status = 'active'
     ORDER BY started_at DESC
     LIMIT 1`,
    [userId, routeSlug],
  )

  const journey = journeys[0]
  if (!journey) return null

  const { rows: stops } = await db.query<JourneyStopRow>(
    `SELECT id, journey_id, place_external_id, place_name, sort_order, status, updated_at
     FROM user_route_journey_stops
     WHERE journey_id = $1
     ORDER BY sort_order ASC`,
    [journey.id],
  )

  return { ...journey, stops }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export interface StartJourneyInput {
  userId: string
  routeSlug: string
  places: Array<{
    externalId: string
    name: string
    sortOrder: number
  }>
}

/**
 * Creates a new journey and its stops.
 * Any previous active journey for the same (user, route) is abandoned first,
 * so there is always at most one active journey per user per route.
 */
export async function startJourney(input: StartJourneyInput): Promise<JourneyRow & { stops: JourneyStopRow[] }> {
  const client = await db.connect()

  try {
    await client.query('BEGIN')

    // Abandon any existing active journey for this route
    await client.query(
      `UPDATE user_route_journeys
       SET status = 'abandoned', updated_at = NOW()
       WHERE user_id = $1 AND route_slug = $2 AND status = 'active'`,
      [input.userId, input.routeSlug],
    )

    // Create the new journey
    const { rows: journeys } = await client.query<JourneyRow>(
      `INSERT INTO user_route_journeys (user_id, route_slug, status, started_at, updated_at)
       VALUES ($1, $2, 'active', NOW(), NOW())
       RETURNING *`,
      [input.userId, input.routeSlug],
    )
    const journey = journeys[0]

    // Insert stops
    const stops: JourneyStopRow[] = []
    for (const place of input.places) {
      const stopStatus = place.sortOrder === 0 ? 'active' : 'upcoming'
      const { rows } = await client.query<JourneyStopRow>(
        `INSERT INTO user_route_journey_stops
           (journey_id, place_external_id, place_name, sort_order, status, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [journey.id, place.externalId, place.name, place.sortOrder, stopStatus],
      )
      stops.push(rows[0])
    }

    await client.query('COMMIT')
    return { ...journey, stops }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Updates the status of a single stop within a journey.
 * Also bumps the parent journey's updated_at.
 */
export async function updateStopStatus(
  journeyId: string,
  userId: string,
  placeExternalId: string,
  status: JourneyStopRow['status'],
): Promise<JourneyStopRow | null> {
  const client = await db.connect()

  try {
    await client.query('BEGIN')

    // Verify journey belongs to user
    const { rows: journeys } = await client.query<JourneyRow>(
      `SELECT id FROM user_route_journeys WHERE id = $1 AND user_id = $2`,
      [journeyId, userId],
    )
    if (!journeys[0]) {
      await client.query('ROLLBACK')
      return null
    }

    const { rows: stops } = await client.query<JourneyStopRow>(
      `UPDATE user_route_journey_stops
       SET status = $1, updated_at = NOW()
       WHERE journey_id = $2 AND place_external_id = $3
       RETURNING *`,
      [status, journeyId, placeExternalId],
    )

    await client.query(
      `UPDATE user_route_journeys SET updated_at = NOW() WHERE id = $1`,
      [journeyId],
    )

    await client.query('COMMIT')
    return stops[0] ?? null
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Marks a journey as completed.
 * Verifies ownership before updating.
 */
export async function completeJourney(
  journeyId: string,
  userId: string,
): Promise<JourneyRow | null> {
  const { rows } = await db.query<JourneyRow>(
    `UPDATE user_route_journeys
     SET status = 'completed', completed_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'active'
     RETURNING *`,
    [journeyId, userId],
  )
  return rows[0] ?? null
}
