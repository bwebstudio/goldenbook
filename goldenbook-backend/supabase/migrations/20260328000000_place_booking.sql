-- ============================================================================
-- Place Booking System
-- Adds booking/reservation fields to the places table.
-- ============================================================================

-- booking_mode enum: controls what CTA the app displays
CREATE TYPE booking_mode AS ENUM (
  'none',
  'affiliate_booking',
  'affiliate_thefork',
  'affiliate_viator',
  'affiliate_getyourguide',
  'direct_website',
  'contact_only'
);

-- reservation_source enum: tracks where the booking config came from
CREATE TYPE reservation_source AS ENUM (
  'manual',
  'ai_suggested',
  'imported'
);

ALTER TABLE places
  ADD COLUMN booking_enabled            boolean            NOT NULL DEFAULT false,
  ADD COLUMN booking_mode               booking_mode       NOT NULL DEFAULT 'none',
  ADD COLUMN booking_label              text,
  ADD COLUMN booking_notes              text,
  ADD COLUMN booking_priority           integer,
  ADD COLUMN reservation_relevant       boolean            NOT NULL DEFAULT false,
  ADD COLUMN reservation_confidence     numeric(3,2),
  ADD COLUMN reservation_last_reviewed_at timestamptz,
  ADD COLUMN reservation_source         reservation_source;

-- NOTE: booking_url already exists on places from the initial schema.
-- We keep it as-is — it now serves as the target URL for the active booking mode.

-- Index for quick filtering of bookable places
CREATE INDEX idx_places_booking_enabled ON places (booking_enabled) WHERE booking_enabled = true;

COMMENT ON COLUMN places.booking_enabled IS 'Whether this place should show a booking/reservation CTA';
COMMENT ON COLUMN places.booking_mode IS 'Which booking platform or method to use';
COMMENT ON COLUMN places.booking_url IS 'Target URL for the booking CTA (affiliate link or direct website)';
COMMENT ON COLUMN places.booking_label IS 'Optional custom label override for the booking CTA button';
COMMENT ON COLUMN places.booking_notes IS 'Internal editorial notes about booking setup';
COMMENT ON COLUMN places.booking_priority IS 'Display priority when multiple CTAs exist (future use)';
COMMENT ON COLUMN places.reservation_relevant IS 'Whether reservations make sense for this type of place';
COMMENT ON COLUMN places.reservation_confidence IS 'AI confidence score (0.00-1.00) for the suggested booking mode';
COMMENT ON COLUMN places.reservation_last_reviewed_at IS 'When a human last reviewed the booking configuration';
COMMENT ON COLUMN places.reservation_source IS 'Origin of the booking config: manual, ai_suggested, or imported';
