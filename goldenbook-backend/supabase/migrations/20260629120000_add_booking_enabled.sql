-- Booking enable/disable toggle for places.
--
-- The dashboard place editor has a "poder reservar" toggle, but the
-- `places.booking_enabled` column it was meant to write never existed in this
-- database (the wider booking migration was never applied). So the toggle was a
-- no-op and the app's reserve button was driven purely by `booking_url`.
--
-- This adds ONLY that one column so the toggle can disable the reserve button
-- per place. Default `true` preserves current behavior (places that already
-- show a reserve button keep showing it until an editor turns it off).
--
-- The rest of the booking system (booking_mode, reservation_*, suggestion_*)
-- is intentionally NOT added here — it stays gated behind its own column checks.
-- Idempotent.

BEGIN;

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS booking_enabled boolean NOT NULL DEFAULT true;

COMMIT;
