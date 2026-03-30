-- ============================================================================
-- PURCHASE HOLD SYSTEM — Temporary slot reservation during checkout
-- ============================================================================

-- Add hold expiration and start_date to purchases
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS placement_starts_at DATE;

-- Index for finding active holds
CREATE INDEX IF NOT EXISTS idx_purchases_hold
  ON purchases (hold_expires_at)
  WHERE status = 'pending' AND hold_expires_at IS NOT NULL;

-- Function to release expired holds
CREATE OR REPLACE FUNCTION release_expired_holds()
RETURNS int AS $$
DECLARE
  released int;
BEGIN
  UPDATE purchases
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending'
    AND hold_expires_at IS NOT NULL
    AND hold_expires_at < now();
  GET DIAGNOSTICS released = ROW_COUNT;
  RETURN released;
END;
$$ LANGUAGE plpgsql;
