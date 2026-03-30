-- ============================================================================
-- Seed booking test data
-- Uses booking_url (exists in original schema). No migrations required.
-- ============================================================================

-- 1. Restaurant: Marlene Vieira → TheFork
UPDATE places SET
  booking_url = 'https://www.thefork.pt/restaurante/marlene-vieira-r790419'
WHERE slug = 'marlene-vieira-lisboa';

-- 2. Hotel: Arribas Sintra Hotel → Booking.com
UPDATE places SET
  booking_url = 'https://www.booking.com/hotel/pt/arribas.pt.html?aid=311090'
WHERE slug = 'arribas-sintra-hotel-lisboa';

-- 3. Hotel: Hotel dos Templários → Booking.com
UPDATE places SET
  booking_url = 'https://www.booking.com/hotel/pt/dos-templarios.pt.html?aid=311090'
WHERE slug = 'hotel-dos-templarios-lisboa';

-- 4. Non-reservable: Arouca Geopark → clear booking_url
UPDATE places SET
  booking_url = NULL
WHERE slug = 'arouca-geopark-porto';

-- If booking migrations are applied, also set explicit config:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'places' AND column_name = 'booking_enabled'
  ) THEN
    UPDATE places SET
      booking_enabled = true,
      booking_mode = 'affiliate_thefork'::booking_mode,
      reservation_relevant = true,
      reservation_source = 'manual'::reservation_source,
      reservation_last_reviewed_at = now()
    WHERE slug = 'marlene-vieira-lisboa';

    UPDATE places SET
      booking_enabled = true,
      booking_mode = 'affiliate_booking'::booking_mode,
      reservation_relevant = true,
      reservation_source = 'manual'::reservation_source,
      reservation_last_reviewed_at = now()
    WHERE slug = 'arribas-sintra-hotel-lisboa';

    UPDATE places SET
      booking_enabled = true,
      booking_mode = 'affiliate_booking'::booking_mode,
      reservation_relevant = true,
      reservation_source = 'manual'::reservation_source,
      reservation_last_reviewed_at = now()
    WHERE slug = 'hotel-dos-templarios-lisboa';

    UPDATE places SET
      booking_enabled = false,
      booking_mode = 'none'::booking_mode,
      reservation_relevant = false,
      reservation_source = 'manual'::reservation_source,
      reservation_last_reviewed_at = now()
    WHERE slug = 'arouca-geopark-porto';
  END IF;
END $$;

-- Verify
SELECT slug, booking_url FROM places
WHERE slug IN (
  'marlene-vieira-lisboa',
  'arribas-sintra-hotel-lisboa',
  'hotel-dos-templarios-lisboa',
  'arouca-geopark-porto'
);
