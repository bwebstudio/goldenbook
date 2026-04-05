// ─── Frequency Capping ───────────────────────────────────────────────────────
//
// Prevents overexposure of the same place across all surfaces in a session.
//
// Rule: max 2 exposures per place per session across all surfaces combined.
// This includes Discover, NOW, Concierge, Category, Search.
//
// Paid placements are exempt — contractual visibility must be respected.

const MAX_EXPOSURES_PER_PLACE = 2

interface FrequencySession {
  /** place_id → exposure count */
  exposures: Map<string, number>
  updatedAt: number
}

const frequencySessions = new Map<string, FrequencySession>()

// Cleanup stale sessions every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000
  for (const [key, session] of frequencySessions) {
    if (session.updatedAt < cutoff) frequencySessions.delete(key)
  }
  if (frequencySessions.size > 1000) {
    const sorted = [...frequencySessions.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)
    for (let i = 0; i < sorted.length - 1000; i++) frequencySessions.delete(sorted[i][0])
  }
}, 600_000)

function getFrequencySession(sessionId: string): FrequencySession {
  let session = frequencySessions.get(sessionId)
  if (!session) {
    session = { exposures: new Map(), updatedAt: Date.now() }
    frequencySessions.set(sessionId, session)
  }
  session.updatedAt = Date.now()
  return session
}

/**
 * Check if a place has exceeded the frequency cap for this session.
 * Paid placements are exempt.
 */
export function isOverExposed(sessionId: string, placeId: string): boolean {
  const session = getFrequencySession(sessionId)
  const count = session.exposures.get(placeId) ?? 0
  return count >= MAX_EXPOSURES_PER_PLACE
}

/**
 * Record an exposure of a place in a session.
 * Call this when a place is returned in any API response.
 */
export function recordExposure(sessionId: string, placeId: string): void {
  const session = getFrequencySession(sessionId)
  const current = session.exposures.get(placeId) ?? 0
  session.exposures.set(placeId, current + 1)
}

/**
 * Record multiple exposures at once (e.g. after a Concierge response with 3 results).
 */
export function recordExposures(sessionId: string, placeIds: string[]): void {
  for (const id of placeIds) {
    recordExposure(sessionId, id)
  }
}

/**
 * Get current exposure count for a place in a session.
 */
export function getExposureCount(sessionId: string, placeId: string): number {
  const session = getFrequencySession(sessionId)
  return session.exposures.get(placeId) ?? 0
}
