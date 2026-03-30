-- ============================================================================
-- Pricing System: pricing_plans + season_rules
-- ============================================================================

-- pricing_plans: stores all configurable prices (membership, placements, upgrades)
CREATE TABLE IF NOT EXISTS pricing_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_type  TEXT NOT NULL CHECK (pricing_type IN ('membership', 'placement', 'upgrade')),
  placement_type TEXT,                         -- e.g. golden_picks, now, search_priority, etc.
  city          TEXT,                           -- e.g. lisbon, algarve, madeira, porto (NULL = global)
  position      INT,                           -- for golden_picks #1-#5, NULL for others
  slot          TEXT,                           -- for now recommendation slots, NULL for others
  unit_label    TEXT NOT NULL DEFAULT '7 days', -- display unit: '7 days', '28 days', 'monthly', 'yearly'
  unit_days     INT NOT NULL DEFAULT 7,        -- numeric duration for computation
  base_price    NUMERIC(10,2) NOT NULL,        -- price in EUR (excl. VAT)
  currency      TEXT NOT NULL DEFAULT 'eur',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- season_rules: per-city season multipliers
CREATE TABLE IF NOT EXISTS season_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city          TEXT NOT NULL,
  season_name   TEXT NOT NULL,                 -- e.g. 'high', 'mid', 'low'
  month_from    INT NOT NULL CHECK (month_from BETWEEN 1 AND 12),
  month_to      INT NOT NULL CHECK (month_to BETWEEN 1 AND 12),
  multiplier    NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_pricing_plans_type ON pricing_plans (pricing_type, placement_type, city);
CREATE INDEX IF NOT EXISTS idx_pricing_plans_active ON pricing_plans (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_season_rules_city ON season_rules (city, is_active);
