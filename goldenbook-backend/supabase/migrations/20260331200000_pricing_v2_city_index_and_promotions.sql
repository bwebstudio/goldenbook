-- ============================================================================
-- Pricing V2: city index multipliers + promotions
-- ============================================================================

-- 1. City multipliers — one row per city, editable by superadmin
CREATE TABLE IF NOT EXISTS city_multipliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city        TEXT NOT NULL UNIQUE,
  multiplier  NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Promotions — configurable discounts (e.g. launch promo)
CREATE TABLE IF NOT EXISTS promotions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  discount_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,      -- e.g. 50.00 = 50% off
  label           TEXT NOT NULL DEFAULT '',               -- shown to users, e.g. "Launch offer — 50% off"
  applies_to      TEXT NOT NULL DEFAULT 'all'             -- 'all', 'placement', 'upgrade', 'membership'
                  CHECK (applies_to IN ('all', 'placement', 'upgrade', 'membership')),
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until     TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Migrate pricing_plans: remove per-city rows, keep only Lisboa base prices.
--    Drop the city column meaning — base_price now always means Lisboa base.
--    We keep the city column for backward compat but it becomes NULL for base prices.
--    Actually, let's take a simpler approach: just clear and re-seed.
--    The seed script will handle inserting correct data.

-- Remove old per-city duplicates — keep only lisbon rows (or city IS NULL for membership)
DELETE FROM pricing_plans WHERE city IS NOT NULL AND city != 'lisbon';

-- Set city to NULL on remaining plans (base_price = Lisboa price, city is resolved at runtime)
UPDATE pricing_plans SET city = NULL, updated_at = now() WHERE city = 'lisbon';
