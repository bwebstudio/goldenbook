-- ─── Temporal index for visibility overlap detection ─────────────────────────
--
-- Speeds up duplicate/overlap checks when creating new visibility placements.
-- Without this, overlap detection requires full table scans.

CREATE INDEX IF NOT EXISTS idx_visibility_temporal
ON place_visibility (place_id, surface, is_active)
INCLUDE (starts_at, ends_at, placement_slot)
WHERE is_active = true;

-- Combined index for city-level slot counting (used by inventory validation)
CREATE INDEX IF NOT EXISTS idx_visibility_city_surface
ON place_visibility (surface, is_active)
INCLUDE (place_id)
WHERE is_active = true;
