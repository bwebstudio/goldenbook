-- ============================================================================
-- 1. Suggestion status + 2. Booking click tracking
-- ============================================================================

-- ─── Suggestion status ───────────────────────────────────────────────────────

CREATE TYPE suggestion_status AS ENUM ('pending', 'applied', 'dismissed');

ALTER TABLE places
  ADD COLUMN suggestion_status suggestion_status;

-- Backfill existing suggestions
UPDATE places SET suggestion_status = 'pending'
  WHERE suggestion_generated_at IS NOT NULL AND suggestion_dismissed = false;
UPDATE places SET suggestion_status = 'dismissed'
  WHERE suggestion_dismissed = true;

COMMENT ON COLUMN places.suggestion_status IS 'Editorial status: pending, applied, or dismissed';

-- ─── Booking click events ────────────────────────────────────────────────────

CREATE TYPE booking_provider AS ENUM (
  'booking', 'thefork', 'viator', 'getyourguide', 'website', 'contact'
);

CREATE TYPE click_device_type AS ENUM ('ios', 'android', 'web');

CREATE TABLE booking_click_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id        uuid NOT NULL REFERENCES places(id),
  provider        booking_provider NOT NULL,
  booking_mode    text NOT NULL,
  target_url      text,
  user_id         uuid REFERENCES users(id),
  session_id      text,
  device_type     click_device_type,
  locale          text,
  city            text,
  conversion_id   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_click_events_place    ON booking_click_events (place_id);
CREATE INDEX idx_click_events_provider ON booking_click_events (provider);
CREATE INDEX idx_click_events_created  ON booking_click_events (created_at);

COMMENT ON TABLE  booking_click_events          IS 'Tracks user clicks on booking CTAs for analytics';
COMMENT ON COLUMN booking_click_events.conversion_id IS 'Future: external conversion ID from affiliate platforms';
