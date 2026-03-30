-- ============================================================================
-- Stripe Fulfillment: webhook events, purchases, memberships
-- ============================================================================

-- 1. Processed Stripe events — idempotency guard
CREATE TABLE IF NOT EXISTS stripe_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type      TEXT NOT NULL,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload_summary JSONB                              -- optional: key metadata for debugging
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_stripe_id ON stripe_events (stripe_event_id);

-- 2. Purchases — tracks every paid item (placements + upgrades)
CREATE TABLE IF NOT EXISTS purchases (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_client_id          UUID NOT NULL REFERENCES business_clients(id) ON DELETE CASCADE,
  place_id                    UUID REFERENCES places(id) ON DELETE SET NULL,
  pricing_plan_id             UUID REFERENCES pricing_plans(id) ON DELETE SET NULL,
  plan_type                   TEXT NOT NULL,          -- 'membership' | 'placement' | 'upgrade'
  placement_type              TEXT,                   -- e.g. golden_picks, now, etc.
  city                        TEXT,
  position                    INT,
  slot                        TEXT,
  unit_days                   INT NOT NULL,
  base_price                  NUMERIC(10,2) NOT NULL,
  season_multiplier           NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  final_price                 NUMERIC(10,2) NOT NULL,
  currency                    TEXT NOT NULL DEFAULT 'eur',
  month                       INT,                   -- month the purchase was priced for
  -- Stripe references
  stripe_checkout_session_id  TEXT,
  stripe_payment_intent_id    TEXT,
  stripe_customer_id          TEXT,
  -- Fulfillment
  status                      TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'paid', 'activated', 'expired', 'failed', 'refunded')),
  visibility_id               UUID REFERENCES place_visibility(id) ON DELETE SET NULL,
  activated_at                TIMESTAMPTZ,
  expires_at                  TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchases_client ON purchases (business_client_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases (status) WHERE status IN ('pending', 'paid', 'activated');
CREATE INDEX IF NOT EXISTS idx_purchases_stripe_session ON purchases (stripe_checkout_session_id);

-- 3. Memberships — one active membership per business client
CREATE TABLE IF NOT EXISTS memberships (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_client_id          UUID NOT NULL REFERENCES business_clients(id) ON DELETE CASCADE,
  pricing_plan_id             UUID REFERENCES pricing_plans(id) ON DELETE SET NULL,
  status                      TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  price_paid                  NUMERIC(10,2) NOT NULL,
  currency                    TEXT NOT NULL DEFAULT 'eur',
  -- Stripe references
  stripe_checkout_session_id  TEXT,
  stripe_subscription_id      TEXT,
  stripe_customer_id          TEXT,
  stripe_payment_intent_id    TEXT,
  -- Dates
  starts_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at                  TIMESTAMPTZ NOT NULL,
  cancelled_at                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memberships_client ON memberships (business_client_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships (status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_memberships_stripe_sub ON memberships (stripe_subscription_id);

-- 4. Add stripe_customer_id to business_clients for persistent Stripe customer linkage
ALTER TABLE business_clients
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
