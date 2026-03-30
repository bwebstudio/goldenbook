-- ============================================================================
-- CAMPAIGNS V2 — Real Inventory, Section Groups, Priority
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ─── Section group enum ─────────────────────────────────────────────────────

CREATE TYPE section_group AS ENUM ('discover', 'intent', 'dynamic');

-- ─── Time bucket enum ───────────────────────────────────────────────────────

CREATE TYPE time_bucket AS ENUM ('morning', 'lunch', 'afternoon', 'evening', 'night');

-- ─── Inventory status enum ──────────────────────────────────────────────────

CREATE TYPE inventory_status AS ENUM ('available', 'sold');

-- ─── Drop old complex trigger ───────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_check_place_section_exclusivity ON campaign_slots;
DROP FUNCTION IF EXISTS check_place_section_exclusivity();

-- ─── Update campaign_section enum (remove route types) ──────────────────────
-- Routes are NOT part of campaigns per spec.
-- We cannot ALTER ENUM to remove values in PG, so we leave them but they
-- won't be used. New code validates against the allowed subset.

-- ─── Add new columns to campaigns ──────────────────────────────────────────

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS section_group section_group,
  ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 0;

-- Backfill section_group based on section
UPDATE campaigns SET section_group = 'discover'
  WHERE section IN ('golden_picks', 'now', 'hidden_gems', 'new_on_goldenbook')
    AND section_group IS NULL;

UPDATE campaigns SET section_group = 'intent'
  WHERE section IN ('search_priority', 'category_featured')
    AND section_group IS NULL;

UPDATE campaigns SET section_group = 'dynamic'
  WHERE section IN ('concierge')
    AND section_group IS NULL;

-- Make section_group NOT NULL after backfill
ALTER TABLE campaigns ALTER COLUMN section_group SET NOT NULL;

CREATE INDEX idx_campaigns_section_group ON campaigns (section_group);
CREATE INDEX idx_campaigns_priority ON campaigns (priority DESC);

-- ─── campaign_inventory — real inventory table ──────────────────────────────

CREATE TABLE campaign_inventory (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  position     INT NOT NULL CHECK (position > 0),
  date         DATE NOT NULL,
  time_bucket  time_bucket,              -- NULL = all_day
  status       inventory_status NOT NULL DEFAULT 'available',
  purchase_id  UUID REFERENCES purchases(id) ON DELETE SET NULL,
  place_id     UUID REFERENCES places(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- No duplicate position+date+time_bucket per campaign
  -- COALESCE handles NULL time_bucket for uniqueness
  CONSTRAINT uq_inventory_slot UNIQUE (campaign_id, position, date, time_bucket)
);

-- For queries: "what's available for this campaign on this date?"
CREATE INDEX idx_inventory_available
  ON campaign_inventory (campaign_id, date, status)
  WHERE status = 'available';

-- For queries: "what has this place bought?"
CREATE INDEX idx_inventory_place
  ON campaign_inventory (place_id)
  WHERE place_id IS NOT NULL;

-- For queries: "what did this purchase claim?"
CREATE INDEX idx_inventory_purchase
  ON campaign_inventory (purchase_id)
  WHERE purchase_id IS NOT NULL;

-- ─── Add inventory metadata to purchases ────────────────────────────────────

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS inventory_position INT,
  ADD COLUMN IF NOT EXISTS inventory_date DATE,
  ADD COLUMN IF NOT EXISTS inventory_time_bucket time_bucket;

-- ─── Update campaign_slots — add inventory_id link ──────────────────────────

ALTER TABLE campaign_slots
  ADD COLUMN IF NOT EXISTS inventory_id UUID REFERENCES campaign_inventory(id) ON DELETE SET NULL;

-- ─── Rewrite expiration function ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION expire_campaign_slots()
RETURNS void AS $$
BEGIN
  -- Expire campaigns past end_date
  UPDATE campaigns
  SET status = 'ended', updated_at = now()
  WHERE status = 'active'
    AND end_date < now();

  -- Expire slots where ends_at has passed (time-based, not status-based)
  UPDATE campaign_slots
  SET status = 'expired', updated_at = now()
  WHERE status IN ('active', 'reserved')
    AND ends_at < now();

  -- Expire purchases linked to ended campaigns
  UPDATE purchases
  SET status = 'expired', updated_at = now()
  WHERE status = 'activated'
    AND campaign_id IS NOT NULL
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- ─── Refund support: release inventory ──────────────────────────────────────

CREATE OR REPLACE FUNCTION release_campaign_inventory(p_purchase_id UUID)
RETURNS void AS $$
BEGIN
  -- Release inventory rows back to available
  UPDATE campaign_inventory
  SET status = 'available', purchase_id = NULL, place_id = NULL
  WHERE purchase_id = p_purchase_id
    AND status = 'sold';

  -- Cancel the campaign slot
  UPDATE campaign_slots
  SET status = 'cancelled', updated_at = now()
  WHERE purchase_id = p_purchase_id
    AND status IN ('active', 'reserved');
END;
$$ LANGUAGE plpgsql;

-- ─── updated_at trigger for campaign_inventory ──────────────────────────────
-- (campaign_inventory doesn't have updated_at — it's append-only with status updates)
