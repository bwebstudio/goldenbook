-- ============================================================================
-- Multi-city places: place_destinations join table
-- A place can now be linked to multiple destinations (cities).
-- places.destination_id is kept as the "primary" city for backward compat.
-- ============================================================================

CREATE TABLE IF NOT EXISTS place_destinations (
  place_id        UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  destination_id  UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, destination_id)
);

CREATE INDEX IF NOT EXISTS idx_place_destinations_place ON place_destinations (place_id);
CREATE INDEX IF NOT EXISTS idx_place_destinations_dest  ON place_destinations (destination_id);

-- Backfill: copy every existing places.destination_id into the join table
INSERT INTO place_destinations (place_id, destination_id)
SELECT id, destination_id FROM places WHERE destination_id IS NOT NULL
ON CONFLICT DO NOTHING;
