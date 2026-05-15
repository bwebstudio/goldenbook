-- Add 'pending_payment' to the subscription_status enum.
--
-- Used by clients created via the "Stripe link" admin flow: they exist in
-- the system (so they can log in) but are not yet active. Their listing
-- is gated and the dashboard shows them a single CTA: pay to activate.
-- When the Stripe webhook fires for their checkout they're promoted to
-- 'active' just like any other paying client.

ALTER TABLE business_clients
  DROP CONSTRAINT IF EXISTS business_clients_subscription_status_check;
ALTER TABLE business_clients
  ADD CONSTRAINT business_clients_subscription_status_check
  CHECK (subscription_status IS NULL OR subscription_status IN
    ('trial', 'active', 'past_due', 'cancelled', 'expired', 'lapsed',
     'retention_grace', 'pending_payment'));
