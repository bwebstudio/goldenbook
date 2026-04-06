-- Google Places enrichment fields
-- These store objective data from Google Places API (New).
-- They supplement editorial data — never override it.

ALTER TABLE places ADD COLUMN IF NOT EXISTS google_place_id TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS google_rating NUMERIC(2,1);
ALTER TABLE places ADD COLUMN IF NOT EXISTS google_rating_count INTEGER;
ALTER TABLE places ADD COLUMN IF NOT EXISTS cuisine_types TEXT[];  -- e.g. {'portuguese','seafood'}
ALTER TABLE places ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT NULL;  -- 'enriched','review','failed'
ALTER TABLE places ADD COLUMN IF NOT EXISTS enrichment_confidence TEXT DEFAULT NULL;  -- 'high','medium','low'
ALTER TABLE places ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_places_google_place_id ON places (google_place_id) WHERE google_place_id IS NOT NULL;

COMMENT ON COLUMN places.google_rating IS 'Auxiliary signal only — not for editorial ranking. Use for hygiene checks.';
COMMENT ON COLUMN places.google_rating_count IS 'Number of Google reviews. Low weight in scoring.';
COMMENT ON COLUMN places.cuisine_types IS 'Normalized cuisine array from Google: portuguese, seafood, italian, etc.';
COMMENT ON COLUMN places.enrichment_confidence IS 'Match confidence: high, medium, low. Low = needs manual review.';
