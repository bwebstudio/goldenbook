-- ─── Security Hardening — Phase 1 ────────────────────────────────────────
--
-- Date: 2026-04-10
-- Author: ops audit
--
-- Resolves Supabase Security Advisor findings related to:
--   1. SECURITY DEFINER views (7 unused views in public)
--   2. Mutable search_path on user-defined functions (5 functions)
--   3. Excessive function EXECUTE grants to anon/PUBLIC
--
-- Verification (done before this migration):
--   - 0 references to these views in backend, mobile, dashboard, sql, scripts
--   - 0 functions, triggers, or RLS policies depend on them
--   - The 5 functions are all owned by postgres; backend connects as postgres
--   - The only backend caller (release_expired_holds in pricing.route.ts)
--     uses the postgres pool, which retains EXECUTE as the function owner
--   - set_updated_at is used by 2 triggers (campaigns, campaign_slots) which
--     execute automatically and do not require EXECUTE grants for anon/PUBLIC
--
-- Out of scope (NOT touched by this migration):
--   - btree_gist extension and its 188 functions (Postgres builtin)
--   - RLS policies (existing posture preserved)
--   - Auth settings (must be configured manually in Supabase dashboard)
--   - Schema migrations of any extension
--
-- Idempotent: this migration can be re-run safely. All statements use
-- IF EXISTS or are inherently idempotent (REVOKE/GRANT).
-- ─────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════
-- 1. DROP UNUSED VIEWS
-- ═════════════════════════════════════════════════════════════════════════
--
-- These 7 views were created by an earlier schema iteration and are now
-- dead code. None of them are referenced anywhere in the codebase. They
-- still exist in the DB and trip the Security Advisor's "SECURITY DEFINER
-- view" check.
--
-- Drop order respects the inter-view dependency chain (no CASCADE, so any
-- unexpected dependency will surface as an error rather than silently
-- propagating).
--
-- Inter-view dependencies (from information_schema.view_table_usage):
--   discover_hero_candidates_view  reads from  places_discover_view
--   discover_new_places_view       reads from  places_discover_view
--   places_search_view             reads from  place_category_labels_view
--                                              + places_card_view
--   discover_editorial_places_view reads from  (no other view in this set)
--
-- Drop order — consumers BEFORE the views they read from:
--   1) discover_editorial_places_view  (standalone)
--   2) discover_hero_candidates_view, discover_new_places_view  (consume places_discover_view)
--   3) places_search_view              (consumes place_category_labels_view + places_card_view)
--   4) places_discover_view, place_category_labels_view, places_card_view  (now have no consumers)
--

-- 1.1 — Standalone (reads only from base tables)
DROP VIEW IF EXISTS public.discover_editorial_places_view;

-- 1.2 — Consumers of places_discover_view
DROP VIEW IF EXISTS public.discover_hero_candidates_view;
DROP VIEW IF EXISTS public.discover_new_places_view;

-- 1.3 — Consumer of place_category_labels_view + places_card_view
DROP VIEW IF EXISTS public.places_search_view;

-- 1.4 — Root views (now have zero consumers in this set)
DROP VIEW IF EXISTS public.places_discover_view;
DROP VIEW IF EXISTS public.place_category_labels_view;
DROP VIEW IF EXISTS public.places_card_view;


-- ═════════════════════════════════════════════════════════════════════════
-- 2. FIX MUTABLE search_path ON USER-DEFINED FUNCTIONS
-- ═════════════════════════════════════════════════════════════════════════
--
-- All 5 user-defined functions in public reference tables without schema
-- qualification (e.g. UPDATE campaigns SET ...). Without an explicit
-- search_path, an attacker could potentially shadow public.campaigns by
-- creating a malicious schema earlier in their search_path and tricking a
-- privileged caller into executing the wrong table.
--
-- Setting search_path = public, pg_catalog locks the lookup order so the
-- function always resolves names against public first, then pg_catalog.
-- This is the standard hardening for plpgsql functions that don't fully
-- schema-qualify their references.
--
-- Note: ALTER FUNCTION ... SET search_path is idempotent.

ALTER FUNCTION public.expire_campaign_slots()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.expire_ended_campaigns()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.release_campaign_inventory(uuid)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.release_expired_holds()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.set_updated_at()
  SET search_path = public, pg_catalog;


-- ═════════════════════════════════════════════════════════════════════════
-- 3. REVOKE EXCESSIVE EXECUTE GRANTS
-- ═════════════════════════════════════════════════════════════════════════
--
-- All 5 functions currently grant EXECUTE to PUBLIC, anon, authenticated,
-- and service_role. Of these:
--   - PUBLIC, anon, authenticated should NOT be able to call these.
--     They are billing/inventory primitives and a trigger function.
--   - postgres (the owner) retains EXECUTE automatically.
--   - service_role retains EXECUTE for symmetry with Supabase patterns
--     (cron jobs, edge functions).
--
-- The backend connects as `postgres` and is the only legitimate caller of
-- these functions. Verified callers:
--   - release_expired_holds()  → 2 call sites in pricing.route.ts (postgres pool)
--   - set_updated_at()         → 2 triggers on campaigns, campaign_slots
--   - expire_*, release_*      → no caller in code (likely cron-only)
--
-- Triggers run as the table owner and do not need EXECUTE grants for the
-- calling user, so revoking from anon/authenticated does not break the
-- existing campaigns/campaign_slots updated_at triggers.

-- 3.1 — Revoke from PUBLIC (the catch-all default grant)
REVOKE EXECUTE ON FUNCTION public.expire_campaign_slots()          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_ended_campaigns()         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_campaign_inventory(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_expired_holds()          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                 FROM PUBLIC;

-- 3.2 — Revoke from anon (Supabase unauthenticated role)
REVOKE EXECUTE ON FUNCTION public.expire_campaign_slots()          FROM anon;
REVOKE EXECUTE ON FUNCTION public.expire_ended_campaigns()         FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_campaign_inventory(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_expired_holds()          FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                 FROM anon;

-- 3.3 — Revoke from authenticated (Supabase signed-in user role)
REVOKE EXECUTE ON FUNCTION public.expire_campaign_slots()          FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_ended_campaigns()         FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.release_campaign_inventory(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.release_expired_holds()          FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                 FROM authenticated;

-- 3.4 — Re-grant EXECUTE to service_role (idempotent; preserves Supabase patterns)
GRANT EXECUTE ON FUNCTION public.expire_campaign_slots()          TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_ended_campaigns()         TO service_role;
GRANT EXECUTE ON FUNCTION public.release_campaign_inventory(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_expired_holds()          TO service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at()                 TO service_role;
