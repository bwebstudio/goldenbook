-- Subscription lifecycle paths + retention grace.
--
-- Splits clients into two paths based on how they came in:
--   - trial_first: started on a 6-month free trial. When trial expires, they
--                  must pay to stay visible — no retention grace.
--   - paid_first:  paid the annual subscription up front, no trial. When their
--                  year ends without renewal, they get an automatic 6-month
--                  retention grace as a thank-you for paying from day one.
--                  Retention grace is one-shot — once used they can't get it
--                  again by lapsing and re-subscribing.
--
-- Lifecycle state machine (transitioned lazily on /business/me reads):
--
--   trial → trial_ends_at < now()
--     → lapsed
--
--   active → paid_until < now() AND lifecycle_path='paid_first' AND NOT retention_grace_used
--     → retention_grace (retention_grace_ends_at = paid_until + 6 months,
--                        retention_grace_used = true)
--
--   active → paid_until < now() (any other case)
--     → lapsed
--
--   retention_grace → retention_grace_ends_at < now()
--     → lapsed

-- ── 1. New columns ──────────────────────────────────────────────────────────
ALTER TABLE business_clients
  ADD COLUMN IF NOT EXISTS lifecycle_path           text,
  ADD COLUMN IF NOT EXISTS retention_grace_ends_at  timestamptz,
  ADD COLUMN IF NOT EXISTS retention_grace_used     boolean NOT NULL DEFAULT false;

-- ── 2. Expand status enum to include retention_grace ────────────────────────
ALTER TABLE business_clients
  DROP CONSTRAINT IF EXISTS business_clients_subscription_status_check;
ALTER TABLE business_clients
  ADD CONSTRAINT business_clients_subscription_status_check
  CHECK (subscription_status IS NULL OR subscription_status IN
    ('trial', 'active', 'past_due', 'cancelled', 'expired', 'lapsed', 'retention_grace'));

-- ── 3. Lifecycle path enum check ────────────────────────────────────────────
ALTER TABLE business_clients
  DROP CONSTRAINT IF EXISTS business_clients_lifecycle_path_check;
ALTER TABLE business_clients
  ADD CONSTRAINT business_clients_lifecycle_path_check
  CHECK (lifecycle_path IS NULL OR lifecycle_path IN ('trial_first', 'paid_first'));

-- ── 4. Backfill lifecycle_path ──────────────────────────────────────────────
-- founders_bonus_at marks clients who were already on a paid membership at the
-- previous migration's time. Those are paid_first by definition. Everyone
-- else came in through trial (or will, via the new default).
UPDATE business_clients
   SET lifecycle_path = 'paid_first'
 WHERE lifecycle_path IS NULL
   AND founders_bonus_at IS NOT NULL;

UPDATE business_clients
   SET lifecycle_path = 'trial_first'
 WHERE lifecycle_path IS NULL;

-- ── 5. Index for the retention grace expiry sweep ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_business_clients_retention_grace
  ON business_clients (retention_grace_ends_at)
  WHERE subscription_status = 'retention_grace';
