-- Migration: Set booking links for all places
-- Priority: website_url > google_maps_url (fallback) > null
-- Only reservable types (restaurant, cafe, bar, hotel, activity, venue) get a booking link.
-- Non-reservable types (shop, museum, landmark, beach, transport) get cleared.

-- 1. Reservable types WITH website → use website (primary reservation source)
UPDATE places
SET booking_url = website_url
WHERE place_type IN ('restaurant', 'cafe', 'bar', 'hotel', 'activity', 'venue')
  AND website_url IS NOT NULL
  AND website_url != '';

-- 2. Reservable types WITHOUT website but WITH Maps → fallback
UPDATE places
SET booking_url = google_maps_url
WHERE place_type IN ('restaurant', 'cafe', 'bar', 'hotel', 'activity', 'venue')
  AND (website_url IS NULL OR website_url = '')
  AND google_maps_url IS NOT NULL
  AND google_maps_url != '';

-- 3. Clear booking_url for non-reservable types
UPDATE places
SET booking_url = NULL
WHERE place_type IN ('shop', 'museum', 'landmark', 'beach', 'transport')
  OR place_type IS NULL;
