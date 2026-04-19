-- Expand place_translations.source CHECK to include 'manual_fix'.
-- 'manual_fix' marks rows corrected by apply-translation-cleanup.ts so the
-- editorial team can filter / audit post-hoc without touching updated_at.
-- Idempotent.

BEGIN;

ALTER TABLE place_translations DROP CONSTRAINT IF EXISTS place_translations_source_check;

ALTER TABLE place_translations
  ADD CONSTRAINT place_translations_source_check
  CHECK (source IN ('manual','manual_fix','deepl','import'));

COMMIT;
