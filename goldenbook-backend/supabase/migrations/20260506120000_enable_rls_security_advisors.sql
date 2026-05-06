-- Enable Row-Level Security on every public-schema table flagged by the
-- Supabase Security Advisor on 2026-05-03.
--
-- Architecture context: the only client of these tables is the Fastify
-- backend, which connects with the SUPABASE_SERVICE_ROLE_KEY. service_role
-- bypasses RLS unconditionally, so enabling RLS without policies is a
-- pure tightening — the backend keeps full read/write access while the
-- anon and authenticated roles (used by the mobile app and dashboard)
-- lose the unrestricted access they never relied on in code.
--
-- Direct usage from the mobile / dashboard clients was audited:
--   - mobile  → only `supabase.auth.*` + a Realtime channel on
--               `content_version` (handled below with explicit policies).
--   - dashboard → only `supabase.storage.*` (storage policies are managed
--               separately and unaffected by table RLS).
--
-- All statements are idempotent so re-running the migration is safe.

BEGIN;

-- ─── Lock down: backend-only tables ───────────────────────────────────────────
-- No policies. anon + authenticated roles get a hard "no rows" via PostgREST;
-- service_role keeps unrestricted access via bypass.

ALTER TABLE public.pending_refunds   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_queries    ENABLE ROW LEVEL SECURITY;

-- ─── content_version: keep Realtime working ──────────────────────────────────
-- The mobile client subscribes to UPDATE events on the single `scope='global'`
-- row to invalidate caches without waiting for the next foreground poll.
-- Realtime uses the anon role for unauthenticated subscriptions, so we need
-- an explicit SELECT policy or the channel goes silent.
--
-- The row contains only a monotonic version counter and a timestamp — no
-- editorial content — so reading it is not sensitive. We still scope the
-- policy to `scope='global'` so a future per-locality version row can be
-- gated separately if we ever add one.
--
-- The `IF NOT EXISTS` guard plus DROP-then-CREATE pattern keeps the
-- migration safe to re-run if a partial earlier attempt left policies behind.

ALTER TABLE public.content_version ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read global version" ON public.content_version;
CREATE POLICY "anon read global version"
  ON public.content_version
  FOR SELECT
  TO anon
  USING (scope = 'global');

DROP POLICY IF EXISTS "authenticated read global version" ON public.content_version;
CREATE POLICY "authenticated read global version"
  ON public.content_version
  FOR SELECT
  TO authenticated
  USING (scope = 'global');

COMMIT;
