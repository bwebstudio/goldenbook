-- Analytics integrity fixes.
--
-- Three defects found in the 5 Aug 2026 audit, all of them silent:
--
--   1. `analytics_events.route_id` referenced `routes(id)`, a table with zero
--      rows. Curated routes live in `curated_routes`. Every route_start /
--      route_complete insert violated the FK and was swallowed by the
--      fire-and-forget `.catch()` in events.route.ts, so the app recorded
--      0 route events in 107 days.
--
--   2. Sessions were closed on the first blur and never reopened, so
--      `duration_sec` froze seconds after launch. Fixed in the API (the
--      start handler now clears `ended_at`); nothing to migrate here beyond
--      the internal-traffic flag below, which the corrected readers need.
--
--   3. Search logged every debounced prefix, twice, with a result count read
--      before the response arrived. `superseded` lets the API retire a prefix
--      row when the user keeps typing, so reports read one row per query the
--      user actually finished.
--
-- Plus `is_internal`, so QA and simulator traffic stops inflating the
-- baseline. Everything is additive; no data is deleted.

BEGIN;

-- ─── 1. Point route_id at the table that actually holds routes ────────────
ALTER TABLE analytics_events
  DROP CONSTRAINT IF EXISTS analytics_events_route_id_fkey;

ALTER TABLE analytics_events
  ADD CONSTRAINT analytics_events_route_id_fkey
  FOREIGN KEY (route_id) REFERENCES curated_routes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS analytics_events_route_event_idx
  ON analytics_events (route_id, event_name) WHERE route_id IS NOT NULL;

-- ─── 2. Internal-traffic flag ─────────────────────────────────────────────
-- Set from the `x-gb-internal` request header, which dev/TestFlight builds
-- send and store builds never do. Readers exclude these rows so the numbers
-- we present describe real users.

ALTER TABLE user_sessions    ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;
ALTER TABLE search_queries   ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS analytics_events_real_traffic_idx
  ON analytics_events (event_name, created_at DESC) WHERE NOT is_internal;
CREATE INDEX IF NOT EXISTS user_sessions_real_traffic_idx
  ON user_sessions (started_at DESC) WHERE NOT is_internal;

-- ─── 3. Supersede flag for refined search prefixes ────────────────────────
ALTER TABLE search_queries ADD COLUMN IF NOT EXISTS superseded boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS search_queries_live_idx
  ON search_queries (created_at DESC) WHERE NOT superseded AND NOT is_internal;

-- ─── 4. Backfill the historical QA traffic ────────────────────────────────
-- The unambiguous marker is a digits-only search ("111", "1111"): 4.432 of
-- the 11.069 recorded queries. No real user searches a guidebook for "1111".
-- We flag those rows and every row belonging to the same session, because a
-- session that typed "1111" is a test session end to end.

UPDATE search_queries
   SET is_internal = true
 WHERE query ~ '^[0-9[:space:]]+$';

UPDATE user_sessions s
   SET is_internal = true
 WHERE EXISTS (
   SELECT 1 FROM search_queries q
    WHERE q.session_id = s.session_id
      AND q.query ~ '^[0-9[:space:]]+$'
 );

UPDATE analytics_events ae
   SET is_internal = true
  FROM user_sessions s
 WHERE s.session_id = ae.session_id
   AND s.is_internal;

UPDATE search_queries q
   SET is_internal = true
  FROM user_sessions s
 WHERE s.session_id = q.session_id
   AND s.is_internal;

-- ─── 5. Retire the historical keystroke and duplicate rows ────────────────
-- Two mechanical defects produced most of the rows in this table. Both are
-- addressed by mechanism, not by pattern-matching particular strings, so the
-- cleanup stays defensible.
--
-- 5a. The double fire and the race. The tracking effect depended on the query
--     response object, so it ran once when the query changed (reading a result
--     count that had not arrived yet, hence 0) and again when the response
--     landed. The raw data shows it plainly:
--
--         17:14:26  "da"   result_count 0
--         17:14:26  "da"   result_count 10
--
--     For a given session and query text, the last row written is the one with
--     the settled count. Retire the earlier ones.

UPDATE search_queries q
   SET superseded = true
 WHERE NOT q.superseded
   AND EXISTS (
     SELECT 1 FROM search_queries later
      WHERE later.session_id = q.session_id
        AND later.id > q.id
        AND lower(trim(later.query)) = lower(trim(q.query))
        AND later.created_at <= q.created_at + interval '60 seconds'
   );

-- 5b. The keystroke chain. A query that is a strict prefix of a longer one
--     typed moments later in the same session is a step on the way to it,
--     not a search the user finished.

UPDATE search_queries q
   SET superseded = true
 WHERE NOT q.superseded
   AND EXISTS (
     SELECT 1 FROM search_queries later
      WHERE later.session_id = q.session_id
        AND later.id <> q.id
        AND later.created_at >= q.created_at
        AND later.created_at <= q.created_at + interval '2 minutes'
        AND length(trim(later.query)) > length(trim(q.query))
        AND lower(trim(later.query)) LIKE lower(trim(q.query)) || '%'
   );

-- 5c. Anything below the minimum the search API answers was never a real
--     search, only a keystroke that happened to be the last one typed.

UPDATE search_queries
   SET superseded = true
 WHERE NOT superseded
   AND length(trim(query)) < 3;

COMMIT;
