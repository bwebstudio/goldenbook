-- Pending refunds: tracks auto-refunds that failed to execute via Stripe API.
-- A background job retries these every 5 minutes.

CREATE TABLE IF NOT EXISTS pending_refunds (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id           UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  payment_intent_id     TEXT NOT NULL,
  reason                TEXT NOT NULL DEFAULT 'inventory_conflict',
  attempts              INT NOT NULL DEFAULT 0,
  last_attempt_at       TIMESTAMPTZ,
  last_error            TEXT,
  resolved              BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_refunds_unresolved ON pending_refunds (resolved) WHERE resolved = false;
