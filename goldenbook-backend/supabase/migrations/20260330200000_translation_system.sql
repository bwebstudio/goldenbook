-- Translation system: override flag + cache table.
--
-- place_translations gets a translation_override flag.
-- translation_cache stores DeepL results to avoid redundant API calls.

-- 1. Add override flag to place_translations
ALTER TABLE place_translations
  ADD COLUMN IF NOT EXISTS translation_override boolean NOT NULL DEFAULT false;

-- Also add full_description to place_translations (it was missing — only editorial_summary existed)
ALTER TABLE place_translations
  ADD COLUMN IF NOT EXISTS full_description text;

-- 2. Translation cache — global, not per-place
CREATE TABLE IF NOT EXISTS translation_cache (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_hash    text NOT NULL UNIQUE,
  source_text    text NOT NULL,
  source_lang    text NOT NULL DEFAULT 'PT',
  target_lang    text NOT NULL DEFAULT 'EN',
  translated_text text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_translation_cache_hash ON translation_cache (source_hash);
