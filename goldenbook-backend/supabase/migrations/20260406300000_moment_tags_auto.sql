-- Moment tags — time-aware recommendation tags derived from context_windows + category + price.
-- Used by NOW and Concierge to answer: "Where now?", "Sunset?", "Romantic dinner?"
-- Never overrides editorial tags.

ALTER TABLE places ADD COLUMN IF NOT EXISTS moment_tags_auto JSONB DEFAULT NULL;

COMMENT ON COLUMN places.moment_tags_auto IS 'Auto-generated moment tags for NOW/Concierge. Derived from windows + category + price. Read-only.';
