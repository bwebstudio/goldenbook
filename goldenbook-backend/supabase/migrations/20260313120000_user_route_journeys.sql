-- =========================================================
-- USER ROUTE JOURNEYS
-- Goldenbook 2026
--
-- Tracks user progress through active Golden Routes.
-- Designed to be auth-system agnostic at the app layer:
--   - route_slug is a text identifier (not a FK) so it works
--     whether routes live in Postgres or in the mobile static config.
--   - place_external_id is the external/Firebase place ID.
--
-- When the mobile app fully migrates to Supabase Auth and the
-- Postgres `routes` / `places` tables, add FK columns alongside
-- these text columns and backfill them.
-- =========================================================

-- -----------------------------------------
-- user_route_journeys
-- One record per user-initiated route session.
-- Multiple records per (user, route_slug) are allowed so we
-- preserve history. Queries fetch the latest active one.
-- -----------------------------------------
create table if not exists user_route_journeys (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references users(id) on delete cascade,
  route_slug   text        not null,
  status       text        not null default 'active'
                           check (status in ('active', 'completed', 'abandoned')),
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  updated_at   timestamptz not null default now()
);

create index if not exists idx_user_route_journeys_user_id
  on user_route_journeys(user_id);

create index if not exists idx_user_route_journeys_route_slug
  on user_route_journeys(route_slug);

create index if not exists idx_user_route_journeys_status
  on user_route_journeys(status);

-- Composite: fastest lookup for "get my active journey for route X"
create index if not exists idx_user_route_journeys_user_route_status
  on user_route_journeys(user_id, route_slug, status);

-- -----------------------------------------
-- user_route_journey_stops
-- One row per (journey, place).
-- place_external_id holds the Firebase/external place identifier
-- until the app fully migrates to Postgres place UUIDs.
-- -----------------------------------------
create table if not exists user_route_journey_stops (
  id                uuid        primary key default gen_random_uuid(),
  journey_id        uuid        not null references user_route_journeys(id) on delete cascade,
  place_external_id text        not null,
  place_name        text        not null,
  sort_order        integer     not null default 0,
  status            text        not null default 'upcoming'
                                check (status in ('upcoming', 'active', 'arrived', 'completed', 'skipped')),
  updated_at        timestamptz not null default now(),

  unique (journey_id, place_external_id)
);

create index if not exists idx_user_route_journey_stops_journey_id
  on user_route_journey_stops(journey_id);

create index if not exists idx_user_route_journey_stops_status
  on user_route_journey_stops(status);
