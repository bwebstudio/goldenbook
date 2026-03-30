-- ============================================================================
-- Booking candidates: multiple reservation link options per place.
-- Replaces reliance on the raw booking_url column for reservation CTAs.
-- ============================================================================

CREATE TYPE candidate_provider AS ENUM (
  'booking', 'thefork', 'viator', 'getyourguide', 'website'
);

CREATE TYPE candidate_type AS ENUM (
  'exact_listing',
  'provider_search',
  'official_booking_page',
  'official_website'
);

CREATE TYPE candidate_validation_status AS ENUM (
  'pending', 'valid', 'invalid', 'unreachable', 'ambiguous'
);

CREATE TYPE candidate_source AS ENUM (
  'generated', 'verified_script', 'manual'
);

CREATE TABLE place_booking_candidates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id            uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  provider            candidate_provider NOT NULL,
  candidate_url       text NOT NULL,
  candidate_type      candidate_type NOT NULL DEFAULT 'provider_search',
  is_valid            boolean,
  validation_status   candidate_validation_status NOT NULL DEFAULT 'pending',
  validation_details  text,
  confidence          numeric(3,2) NOT NULL DEFAULT 0.50,
  source              candidate_source NOT NULL DEFAULT 'generated',
  discovered_at       timestamptz NOT NULL DEFAULT now(),
  last_checked_at     timestamptz,
  notes               text,
  is_active           boolean NOT NULL DEFAULT false,
  priority            integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidates_place    ON place_booking_candidates (place_id);
CREATE INDEX idx_candidates_active   ON place_booking_candidates (place_id) WHERE is_active = true;
CREATE INDEX idx_candidates_pending  ON place_booking_candidates (validation_status) WHERE validation_status = 'pending';

COMMENT ON TABLE place_booking_candidates IS 'Multiple reservation link candidates per place — one can be active at a time';
