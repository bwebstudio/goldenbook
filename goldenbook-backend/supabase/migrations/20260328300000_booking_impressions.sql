-- ============================================================================
-- Booking CTA impression events
-- Mirrors booking_click_events structure for funnel analytics (impressions → clicks → CTR)
-- ============================================================================

CREATE TABLE booking_impression_events (
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
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_impression_events_place    ON booking_impression_events (place_id);
CREATE INDEX idx_impression_events_provider ON booking_impression_events (provider);
CREATE INDEX idx_impression_events_created  ON booking_impression_events (created_at);

COMMENT ON TABLE booking_impression_events IS 'Tracks when a booking CTA is shown to a user';
