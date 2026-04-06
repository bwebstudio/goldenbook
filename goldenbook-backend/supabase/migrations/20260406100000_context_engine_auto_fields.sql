-- Context & Classification Engine — auto-generated fields
-- These are computed from Google Places enrichment data and opening_hours.
-- They supplement editorial data — never override it.

ALTER TABLE places ADD COLUMN IF NOT EXISTS classification_auto JSONB DEFAULT NULL;
ALTER TABLE places ADD COLUMN IF NOT EXISTS context_windows_auto JSONB DEFAULT NULL;
ALTER TABLE places ADD COLUMN IF NOT EXISTS context_tags_auto JSONB DEFAULT NULL;

COMMENT ON COLUMN places.classification_auto IS 'Auto-generated: { type, category, subcategory } derived from Google primaryType. Read-only.';
COMMENT ON COLUMN places.context_windows_auto IS 'Auto-generated: ["almoço","noite",...] derived from opening_hours. Read-only.';
COMMENT ON COLUMN places.context_tags_auto IS 'Auto-generated: ["romantic","seafood",...] derived from price_tier, cuisine_types, location hints. Read-only.';

-- Index for quick lookups on auto-classification
CREATE INDEX IF NOT EXISTS idx_places_classification_auto ON places USING gin (classification_auto) WHERE classification_auto IS NOT NULL;
