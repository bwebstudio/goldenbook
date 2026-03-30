-- ============================================================================
-- CAMPAIGNS & SLOTS SYSTEM
-- ============================================================================

-- Section enum for campaigns
CREATE TYPE campaign_section AS ENUM (
  'golden_picks',
  'now',
  'hidden_gems',
  'category_featured',
  'search_priority',
  'concierge',
  'new_on_goldenbook',
  'route_featured_stop',
  'route_sponsor'
);

-- Campaign status lifecycle
CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'ended');

-- Slot status lifecycle
CREATE TYPE campaign_slot_status AS ENUM ('reserved', 'active', 'expired', 'cancelled');

-- ─── campaigns ─────────────────────────────────────────────────────────────────

CREATE TABLE campaigns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  section     campaign_section NOT NULL,
  city_id     UUID REFERENCES destinations(id) ON DELETE SET NULL,
  start_date  TIMESTAMPTZ NOT NULL,
  end_date    TIMESTAMPTZ NOT NULL,
  status      campaign_status NOT NULL DEFAULT 'draft',
  slot_limit  INT NOT NULL CHECK (slot_limit > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT campaigns_dates_check CHECK (end_date > start_date)
);

CREATE INDEX idx_campaigns_status ON campaigns (status);
CREATE INDEX idx_campaigns_section ON campaigns (section);
CREATE INDEX idx_campaigns_city ON campaigns (city_id) WHERE city_id IS NOT NULL;
CREATE INDEX idx_campaigns_active_dates ON campaigns (start_date, end_date) WHERE status = 'active';

-- ─── campaign_slots ────────────────────────────────────────────────────────────

CREATE TABLE campaign_slots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  place_id     UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  purchase_id  UUID REFERENCES purchases(id) ON DELETE SET NULL,
  status       campaign_slot_status NOT NULL DEFAULT 'reserved',
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A place can only appear once per campaign
  CONSTRAINT uq_campaign_place UNIQUE (campaign_id, place_id)
);

CREATE INDEX idx_campaign_slots_campaign ON campaign_slots (campaign_id);
CREATE INDEX idx_campaign_slots_place ON campaign_slots (place_id);
CREATE INDEX idx_campaign_slots_status ON campaign_slots (status);
CREATE INDEX idx_campaign_slots_active ON campaign_slots (place_id, status, starts_at, ends_at)
  WHERE status IN ('reserved', 'active');

-- ─── Prevent a place from being active in multiple premium sections at once ───
-- Uses a partial unique index on (place_id, section) for active/reserved slots
-- joined via campaign_id. Since PG can't do this with a simple unique index
-- across two tables, we use an exclusion constraint on a materialized view
-- approach — or more practically, a trigger.

CREATE OR REPLACE FUNCTION check_place_section_exclusivity()
RETURNS TRIGGER AS $$
BEGIN
  -- Only enforce for active/reserved slots
  IF NEW.status NOT IN ('active', 'reserved') THEN
    RETURN NEW;
  END IF;

  -- Check if this place already has an active/reserved slot in a DIFFERENT section
  -- with overlapping dates
  IF EXISTS (
    SELECT 1
    FROM campaign_slots cs
    JOIN campaigns c ON c.id = cs.campaign_id
    JOIN campaigns new_c ON new_c.id = NEW.campaign_id
    WHERE cs.place_id = NEW.place_id
      AND cs.id IS DISTINCT FROM NEW.id
      AND cs.status IN ('active', 'reserved')
      AND c.section <> new_c.section
      AND cs.starts_at < NEW.ends_at
      AND cs.ends_at > NEW.starts_at
  ) THEN
    RAISE EXCEPTION 'Place % is already active in another premium section during this period',
      NEW.place_id
      USING ERRCODE = 'exclusion_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_place_section_exclusivity
  BEFORE INSERT OR UPDATE ON campaign_slots
  FOR EACH ROW
  EXECUTE FUNCTION check_place_section_exclusivity();

-- ─── Add campaign_id and section to purchases ─────────────────────────────────

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS section campaign_section;

CREATE INDEX idx_purchases_campaign ON purchases (campaign_id) WHERE campaign_id IS NOT NULL;

-- ─── Auto-expire campaigns past their end_date ────────────────────────────────
-- (Run via pg_cron or app-level scheduler)

CREATE OR REPLACE FUNCTION expire_ended_campaigns()
RETURNS void AS $$
BEGIN
  -- Mark campaigns as ended
  UPDATE campaigns
  SET status = 'ended', updated_at = now()
  WHERE status = 'active'
    AND end_date < now();

  -- Mark slots as expired
  UPDATE campaign_slots
  SET status = 'expired', updated_at = now()
  WHERE status IN ('active', 'reserved')
    AND ends_at < now();
END;
$$ LANGUAGE plpgsql;

-- ─── updated_at triggers ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_campaign_slots_updated_at
  BEFORE UPDATE ON campaign_slots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
