import type { JourneyRow, JourneyStopRow } from './journeys.query'

// ─── Output types (frontend-facing) ──────────────────────────────────────────

export interface JourneyStopDTO {
  id: string
  placeExternalId: string
  placeName: string
  sortOrder: number
  status: 'upcoming' | 'active' | 'arrived' | 'completed' | 'skipped'
  updatedAt: string
}

export interface JourneyDTO {
  id: string
  routeSlug: string
  status: 'active' | 'completed' | 'abandoned'
  startedAt: string
  completedAt: string | null
  updatedAt: string
  stops: JourneyStopDTO[]
}

// ─── Transformers ─────────────────────────────────────────────────────────────

export function toJourneyStopDTO(row: JourneyStopRow): JourneyStopDTO {
  return {
    id: row.id,
    placeExternalId: row.place_external_id,
    placeName: row.place_name,
    sortOrder: row.sort_order,
    status: row.status,
    updatedAt: row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : String(row.updated_at),
  }
}

export function toJourneyDTO(
  row: JourneyRow & { stops: JourneyStopRow[] },
): JourneyDTO {
  return {
    id: row.id,
    routeSlug: row.route_slug,
    status: row.status,
    startedAt: row.started_at instanceof Date
      ? row.started_at.toISOString()
      : String(row.started_at),
    completedAt: row.completed_at
      ? (row.completed_at instanceof Date
          ? row.completed_at.toISOString()
          : String(row.completed_at))
      : null,
    updatedAt: row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : String(row.updated_at),
    stops: row.stops.map(toJourneyStopDTO),
  }
}
