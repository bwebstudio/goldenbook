-- Catalogue rotation: how long each place has gone unseen.
--
-- The 5 Aug audit found 106 of 346 published places had never been opened by
-- anyone. Not because they are worse, but because ranking is self-reinforcing:
-- whatever surfaced yesterday accumulates the signals that make it surface
-- again tomorrow, and the tail never gets a turn.
--
-- Discover already had a rotation, but it shuffled by day-of-year without
-- knowing what anyone had actually seen, so a place could sit at the bottom of
-- the pool for months and the shuffle would never rescue it.
--
-- This table is the missing input. It is a rollup, not a source of truth:
-- analytics_events remains authoritative and this is refreshed on an interval,
-- so scoring never has to scan the event table on the request path.

BEGIN;

CREATE TABLE IF NOT EXISTS place_exposure (
  place_id       uuid PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
  -- Last time a real user opened this place. NULL means never, which is the
  -- case the rotation boost cares about most.
  last_viewed_at timestamptz,
  views_30d      integer NOT NULL DEFAULT 0,
  refreshed_at   timestamptz NOT NULL DEFAULT now()
);

-- The scoring engines read "who has been unseen longest", so order by the
-- column they sort on. NULLs first: never-seen places are the front of the queue.
CREATE INDEX IF NOT EXISTS place_exposure_last_viewed_idx
  ON place_exposure (last_viewed_at NULLS FIRST);

-- Seed it once so rotation works from the first request after deploy, rather
-- than waiting for the first refresh tick.
INSERT INTO place_exposure (place_id, last_viewed_at, views_30d, refreshed_at)
SELECT p.id,
       (SELECT MAX(ae.created_at)
          FROM analytics_events ae
         WHERE ae.place_id = p.id
           AND ae.event_name IN ('place_view', 'place_open')
           AND NOT ae.is_internal),
       (SELECT COUNT(*)
          FROM analytics_events ae
         WHERE ae.place_id = p.id
           AND ae.event_name IN ('place_view', 'place_open')
           AND NOT ae.is_internal
           AND ae.created_at >= now() - interval '30 days'),
       now()
  FROM places p
ON CONFLICT (place_id) DO UPDATE SET
  last_viewed_at = EXCLUDED.last_viewed_at,
  views_30d      = EXCLUDED.views_30d,
  refreshed_at   = now();

COMMIT;
