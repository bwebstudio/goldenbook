-- ════════════════════════════════════════════════════════════════════════════
-- Migration: user_saved_routes — support curated routes
-- ════════════════════════════════════════════════════════════════════════════
--
-- The whole route system in the mobile app now serves rows from
-- `curated_routes`, not the legacy `routes` table. The discover endpoint and
-- the `/routes` list both call `getActiveCuratedRoutes`, and both return
-- `curated_routes.id` as the route id surfaced to the client.
--
-- However, `user_saved_routes.route_id` still had a foreign key to
-- `routes(id) ON DELETE CASCADE`. As a result, every "save route" request the
-- mobile app could possibly make hit a 23503 foreign key violation, and the
-- save silently failed. The user reported this as "guardar rutas no funciona".
--
-- This migration removes the legacy FK so that any UUID — curated or
-- legacy — can be saved. The application layer is responsible for resolving
-- the id at read time (see `getSavedRoutes` in `me.query.ts`, which now
-- LEFT JOINs curated_routes and routes and surfaces whichever exists).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop the FK constraint pointing at the legacy `routes` table.
--    The constraint name follows the standard `<table>_<column>_fkey`
--    convention; both forms are tried defensively in case an environment
--    ended up with an alternative name.
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'user_saved_routes'
    AND c.contype = 'f'
    AND pg_get_constraintdef(c.oid) ILIKE '%REFERENCES routes(id)%';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE user_saved_routes DROP CONSTRAINT %I', conname);
  END IF;
END $$;

-- 2. Tidy up: orphaned rows (from any past test/manual inserts that pointed
--    at neither table) would otherwise sit forever in the saved list as
--    invisible rows. Remove anything that no longer matches either source.
DELETE FROM user_saved_routes usr
WHERE NOT EXISTS (SELECT 1 FROM routes         r  WHERE r.id  = usr.route_id)
  AND NOT EXISTS (SELECT 1 FROM curated_routes cr WHERE cr.id = usr.route_id);

-- 3. Index the route_id column. We previously relied on the FK index;
--    after dropping the constraint Postgres no longer auto-maintains one.
CREATE INDEX IF NOT EXISTS idx_user_saved_routes_route_id_v2
  ON user_saved_routes (route_id);
