-- ════════════════════════════════════════════════════════════════════════════
-- Migration: Auth system tables + centralized pricing_config
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. pricing_config ─────────────────────────────────────────────────────

CREATE TYPE product_type_enum AS ENUM ('now_slot', 'concierge', 'featured', 'subscription');

CREATE TABLE IF NOT EXISTS pricing_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city          text,
  product_type  product_type_enum NOT NULL,
  price         integer NOT NULL,           -- cents
  currency      text NOT NULL DEFAULT 'EUR',
  duration_days integer NOT NULL DEFAULT 30,
  max_slots     integer,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pricing_config_active ON pricing_config (is_active) WHERE is_active = true;
CREATE INDEX idx_pricing_config_product ON pricing_config (product_type);

-- Seed default pricing_config rows
INSERT INTO pricing_config (product_type, city, price, currency, duration_days, max_slots) VALUES
  ('now_slot',     'lisbon',  40000, 'EUR', 7,   5),
  ('now_slot',     'porto',   35000, 'EUR', 7,   5),
  ('now_slot',     'algarve', 30000, 'EUR', 7,   5),
  ('now_slot',     'madeira', 28000, 'EUR', 7,   5),
  ('concierge',    'lisbon',  55000, 'EUR', 30,  3),
  ('concierge',    'porto',   50000, 'EUR', 30,  3),
  ('concierge',    'algarve', 45000, 'EUR', 30,  3),
  ('concierge',    'madeira', 42000, 'EUR', 30,  3),
  ('featured',     'lisbon',  65000, 'EUR', 30,  10),
  ('featured',     'porto',   58000, 'EUR', 30,  10),
  ('featured',     'algarve', 50000, 'EUR', 30,  10),
  ('featured',     'madeira', 48000, 'EUR', 30,  10),
  ('subscription', NULL,      15000, 'EUR', 365, NULL),
  ('now_slot',     NULL,      40000, 'EUR', 7,   5),
  ('concierge',    NULL,      55000, 'EUR', 30,  3),
  ('featured',     NULL,      65000, 'EUR', 30,  10);

-- ─── 2. email_verification_tokens ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_evt_user ON email_verification_tokens (user_id);
CREATE INDEX idx_evt_expires ON email_verification_tokens (expires_at);

-- ─── 3. user_invites ───────────────────────────────────────────────────────

CREATE TYPE invite_role_enum AS ENUM ('editor', 'business');

CREATE TABLE IF NOT EXISTS user_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  role        invite_role_enum NOT NULL,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  created_by  uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_email ON user_invites (email);
CREATE INDEX idx_invites_expires ON user_invites (expires_at);

-- ─── 4. password_reset_tokens ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prt_user ON password_reset_tokens (user_id);
CREATE INDEX idx_prt_expires ON password_reset_tokens (expires_at);

-- ─── 5. Add email_verified column to users if not exists ───────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email_verified'
  ) THEN
    ALTER TABLE users ADD COLUMN email_verified boolean NOT NULL DEFAULT false;
  END IF;
END $$;
