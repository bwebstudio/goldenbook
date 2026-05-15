-- Subscription / trial model for business_clients
--
-- Adds a first-class subscription state on each business client so the
-- dashboard can show clear lifecycle status (trial / active / lapsed) and
-- the mobile app can later gate visibility on it (phase 4).
--
-- Two date columns drive everything:
--   - trial_ends_at: when the free 6-month grace runs out
--   - paid_until:    end of the most recent paid period (synced from
--                    memberships.expires_at by the Stripe webhook)
-- subscription_status is derived but stored for fast filtering.
--
-- Backfill rules (one-shot, at migration time):
--   1. Clients with an active membership today → status='active',
--      paid_until = memberships.expires_at + 6 months (Founders Bonus).
--   2. Everyone else → status='trial', trial 6 months from now.
--   3. The Founders Bonus is recorded on a one-off audit row so it never
--      gets re-applied if this migration is replayed.

-- ── 1. Columns ──────────────────────────────────────────────────────────────
ALTER TABLE business_clients
  ADD COLUMN IF NOT EXISTS subscription_status  text,
  ADD COLUMN IF NOT EXISTS trial_started_at     timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at        timestamptz,
  ADD COLUMN IF NOT EXISTS paid_until           timestamptz,
  ADD COLUMN IF NOT EXISTS founders_bonus_at    timestamptz;

-- Allowed values. NULL is allowed only during the brief window before the
-- backfill below; after this migration runs every row has a status.
ALTER TABLE business_clients
  DROP CONSTRAINT IF EXISTS business_clients_subscription_status_check;
ALTER TABLE business_clients
  ADD CONSTRAINT business_clients_subscription_status_check
  CHECK (subscription_status IS NULL OR subscription_status IN
    ('trial', 'active', 'past_due', 'cancelled', 'expired', 'lapsed'));

CREATE INDEX IF NOT EXISTS idx_business_clients_subscription_status
  ON business_clients (subscription_status);
CREATE INDEX IF NOT EXISTS idx_business_clients_trial_ends
  ON business_clients (trial_ends_at) WHERE subscription_status = 'trial';
CREATE INDEX IF NOT EXISTS idx_business_clients_paid_until
  ON business_clients (paid_until) WHERE subscription_status = 'active';

-- ── 2. Backfill ─────────────────────────────────────────────────────────────

-- 2a. Active members get Founders Bonus (+6 months) on top of their existing
--     expiry. Tracked via founders_bonus_at so this is idempotent.
WITH active_memberships AS (
  SELECT DISTINCT ON (m.business_client_id)
         m.business_client_id, m.expires_at
    FROM memberships m
   WHERE m.status = 'active'
   ORDER BY m.business_client_id, m.expires_at DESC
)
UPDATE business_clients bc
   SET subscription_status = 'active',
       paid_until          = am.expires_at + interval '6 months',
       founders_bonus_at   = now()
  FROM active_memberships am
 WHERE bc.id = am.business_client_id
   AND bc.founders_bonus_at IS NULL;

-- 2b. Everyone else (no active membership) gets a fresh 6-month trial
--     starting now. is_active=false rows are skipped so deactivated clients
--     don't get resurrected by the migration.
UPDATE business_clients
   SET subscription_status = 'trial',
       trial_started_at    = now(),
       trial_ends_at       = now() + interval '6 months'
 WHERE subscription_status IS NULL
   AND is_active = true;

-- 2c. Deactivated clients without status get marked lapsed for completeness.
UPDATE business_clients
   SET subscription_status = 'lapsed'
 WHERE subscription_status IS NULL
   AND is_active = false;
