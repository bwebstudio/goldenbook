-- ==========================================================================
-- Fix booking data: classify reservationLink values correctly.
-- The original Firebase migration put ALL reservationLink values into
-- booking_url, including phone numbers and emails prefixed with https://.
-- ==========================================================================

-- Step 1: Clear booking_url that are actually emails disguised as URLs
-- Pattern: https://something@domain (no slash after the @domain part)
UPDATE places
SET booking_url = NULL, updated_at = now()
WHERE booking_url ~ '^https?://[^/]*@[^/]*$'
  AND booking_url NOT LIKE '%thefork%'
  AND booking_url NOT LIKE '%booking.com%'
  AND booking_url NOT LIKE '%zenchef%';

-- Step 2: Move phone-like booking_url to phone column (if phone is empty)
UPDATE places
SET phone = COALESCE(NULLIF(phone, ''), regexp_replace(booking_url, '^https?://', '')),
    booking_url = NULL,
    updated_at = now()
WHERE booking_url ~ '^https?://\s*[\(\+]?\d[\d\s\-\(\)\.]{5,}'
  AND booking_url NOT LIKE '%.%/%';

-- Step 3: Clear Google Maps URLs from booking_url
UPDATE places
SET booking_url = NULL, updated_at = now()
WHERE booking_url LIKE '%google.com/maps%'
   OR booking_url LIKE '%maps.google%';

-- Step 4 & 5: Enable booking fields if the columns exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'places' AND column_name = 'booking_enabled'
  ) THEN
    -- Enable booking for places with a real booking_url
    UPDATE places
    SET booking_enabled = true,
        booking_mode = 'direct_website'::booking_mode,
        reservation_relevant = true,
        updated_at = now()
    WHERE booking_url IS NOT NULL
      AND booking_url != ''
      AND booking_url LIKE 'http%'
      AND booking_enabled = false;

    -- Enable booking for places with an active manual candidate
    UPDATE places p
    SET booking_enabled = true,
        booking_mode = 'direct_website'::booking_mode,
        reservation_relevant = true,
        updated_at = now()
    FROM place_booking_candidates bc
    WHERE bc.place_id = p.id
      AND bc.is_active = true
      AND bc.candidate_url IS NOT NULL
      AND p.booking_enabled = false;
  END IF;
END $$;
