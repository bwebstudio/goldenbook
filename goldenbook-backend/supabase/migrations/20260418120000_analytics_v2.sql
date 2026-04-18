-- Analytics v2 — unified user-interaction event pipeline.
--
-- Replaces the fragmented per-event tables with a single analytics_events
-- table plus a sessions table for DAU/session-duration metrics.
--
-- The legacy tables (place_view_events, place_website_click_events,
-- place_direction_events, booking_click_events, booking_impression_events,
-- place_analytics_events) are left in place — new writes go to
-- analytics_events; readers can be migrated one at a time.

BEGIN;

-- ─── Canonical enum of tracked events ─────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE analytics_event_name AS ENUM (
    'app_session_start','app_session_end',
    'place_view','place_open','map_open',
    'website_click','booking_click',
    'favorite_add','favorite_remove',
    'search_query','search_result_click',
    'now_used','concierge_used',
    'route_start','route_complete'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── user_sessions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sessions (
  session_id    text PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  duration_sec  integer GENERATED ALWAYS AS
    (CASE WHEN ended_at IS NULL THEN NULL
          ELSE EXTRACT(EPOCH FROM (ended_at - started_at))::int END) STORED,
  locale        text,
  city          text,
  app_version   text,
  device_type   text,
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_sessions_user_started_idx
  ON user_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS user_sessions_started_at_idx
  ON user_sessions (started_at);
CREATE INDEX IF NOT EXISTS user_sessions_last_seen_idx
  ON user_sessions (last_seen_at) WHERE ended_at IS NULL;

-- ─── analytics_events ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events (
  id           bigserial PRIMARY KEY,
  event_name   analytics_event_name NOT NULL,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id   text REFERENCES user_sessions(session_id) ON DELETE SET NULL,
  place_id     uuid REFERENCES places(id) ON DELETE SET NULL,
  route_id     uuid REFERENCES routes(id) ON DELETE SET NULL,
  category     text,
  city         text,
  locale       text,
  device       text,
  app_version  text,
  source       text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_event_created_idx
  ON analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_place_event_idx
  ON analytics_events (place_id, event_name) WHERE place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS analytics_events_user_created_idx
  ON analytics_events (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
  ON analytics_events (created_at);

-- ─── search_queries ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS search_queries (
  id            bigserial PRIMARY KEY,
  user_id       uuid,
  session_id    text,
  query         text NOT NULL,
  result_count  integer NOT NULL DEFAULT 0,
  city          text,
  locale        text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS search_queries_created_idx
  ON search_queries (created_at);
CREATE INDEX IF NOT EXISTS search_queries_fts_idx
  ON search_queries USING GIN (to_tsvector('simple', query));

COMMIT;
