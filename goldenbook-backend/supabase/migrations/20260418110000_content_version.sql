-- Content version — global cache-invalidation signal.
--
-- Every editorial write bumps the single `global` row. Mobile polls
-- GET /api/v1/content/version on app foreground; if the value changed,
-- React Query invalidates editorial caches.
--
-- Phase 2 (optional) enables Supabase Realtime on this table so a push
-- replaces polling. Degrades gracefully to polling if the subscription drops.
--
-- Idempotent. Triggers are STATEMENT-level so a 100-row batch update bumps
-- the version once, not 100 times.

BEGIN;

CREATE TABLE IF NOT EXISTS content_version (
  scope       text PRIMARY KEY,
  version     bigint      NOT NULL DEFAULT 1,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO content_version (scope, version, updated_at)
  VALUES ('global', 1, now())
  ON CONFLICT (scope) DO NOTHING;

CREATE OR REPLACE FUNCTION bump_content_version() RETURNS TRIGGER AS $$
BEGIN
  UPDATE content_version
     SET version = version + 1,
         updated_at = now()
   WHERE scope = 'global';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ─── Attach to every editorial table ──────────────────────────────────────
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'places',
    'place_translations',
    'routes',
    'route_translations',
    'route_place_translations',
    'categories',
    'category_translations',
    'destinations',
    'destination_translations',
    'place_images',
    'media_assets'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I_bump_content_version ON %I',
                     tbl, tbl);
      EXECUTE format($f$
        CREATE TRIGGER %I_bump_content_version
        AFTER INSERT OR UPDATE OR DELETE ON %I
        FOR EACH STATEMENT EXECUTE FUNCTION bump_content_version()
      $f$, tbl, tbl);
    END IF;
  END LOOP;
END $$;

COMMIT;
