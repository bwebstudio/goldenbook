-- Translation metadata v2
--
-- Goal: make every (place_id, locale) row in place_translations a first-class,
-- editable record, with clear provenance. Legacy `translation_override` is
-- preserved and kept in sync with the new `is_override` column so existing
-- reads/writes keep working until callers are migrated.
--
-- Also adds `places.original_locale` so the SQL fallback chain can fall back
-- to the creator's source text when neither the requested locale nor English
-- has content.
--
-- All changes are additive and idempotent. Safe to re-run.

BEGIN;

-- ─── place_translations: new provenance columns ───────────────────────────
ALTER TABLE place_translations
  ADD COLUMN IF NOT EXISTS source           text,
  ADD COLUMN IF NOT EXISTS is_override      boolean,
  ADD COLUMN IF NOT EXISTS translated_from  text,
  ADD COLUMN IF NOT EXISTS updated_by       uuid;

-- Defaults + constraints (applied after ADD so existing rows survive).
UPDATE place_translations SET source = 'manual'   WHERE source IS NULL;
UPDATE place_translations SET is_override = COALESCE(translation_override, false)
  WHERE is_override IS NULL;

ALTER TABLE place_translations
  ALTER COLUMN source      SET DEFAULT 'manual',
  ALTER COLUMN source      SET NOT NULL,
  ALTER COLUMN is_override SET DEFAULT false,
  ALTER COLUMN is_override SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE place_translations
    ADD CONSTRAINT place_translations_source_check
    CHECK (source IN ('manual','deepl','import'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Bidirectional sync between legacy translation_override and is_override ─
-- Lets old code continue writing translation_override while new code uses
-- is_override. Remove once all writers are migrated.
CREATE OR REPLACE FUNCTION place_translations_sync_override()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_override IS NULL AND NEW.translation_override IS NOT NULL THEN
      NEW.is_override := NEW.translation_override;
    ELSIF NEW.translation_override IS NULL AND NEW.is_override IS NOT NULL THEN
      NEW.translation_override := NEW.is_override;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: whichever one the caller actually changed wins.
  IF NEW.is_override IS DISTINCT FROM OLD.is_override THEN
    NEW.translation_override := NEW.is_override;
  ELSIF NEW.translation_override IS DISTINCT FROM OLD.translation_override THEN
    NEW.is_override := NEW.translation_override;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS place_translations_sync_override ON place_translations;
CREATE TRIGGER place_translations_sync_override
  BEFORE INSERT OR UPDATE ON place_translations
  FOR EACH ROW EXECUTE FUNCTION place_translations_sync_override();

-- ─── updated_at bump on UPDATE ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS place_translations_touch_updated_at ON place_translations;
CREATE TRIGGER place_translations_touch_updated_at
  BEFORE UPDATE ON place_translations
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ─── places.original_locale (4th fallback tier) ───────────────────────────
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS original_locale text;

UPDATE places SET original_locale = 'pt' WHERE original_locale IS NULL;

ALTER TABLE places
  ALTER COLUMN original_locale SET DEFAULT 'pt',
  ALTER COLUMN original_locale SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE places
    ADD CONSTRAINT places_original_locale_check
    CHECK (original_locale IN ('en','es','pt'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Indexes for fast per-locale lookups ──────────────────────────────────
-- place_translations already has UNIQUE (place_id, locale) from the initial
-- schema; no additional index needed for the fallback JOINs.

COMMIT;
