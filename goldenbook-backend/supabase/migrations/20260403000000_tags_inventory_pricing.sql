-- ─── 1. New context tags: rooftop + fine_dining ─────────────────────────────

INSERT INTO now_context_tags (slug, name, description) VALUES
  ('rooftop',     'Rooftop',      'Rooftop venues with views'),
  ('fine-dining', 'Fine Dining',  'Upscale dining experiences')
ON CONFLICT (slug) DO NOTHING;

-- ─── 2. Promotion inventory table ───────────────────────────────────────────
--
-- Tracks real slot capacity per city per surface.
-- Prevents overselling and enables future checkout automation.

CREATE TABLE IF NOT EXISTS promotion_inventory (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city          TEXT NOT NULL,
  surface       TEXT NOT NULL,       -- golden_picks, hidden_gems, now, concierge, etc.
  max_slots     INTEGER NOT NULL DEFAULT 1,
  active_slots  INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (city, surface)
);

COMMENT ON TABLE promotion_inventory IS 'Real slot inventory per city per surface. active_slots is updated when purchases are confirmed/expired.';

-- Seed initial inventory for Lisboa
INSERT INTO promotion_inventory (city, surface, max_slots, active_slots) VALUES
  ('lisboa', 'golden_picks',       5, 0),
  ('lisboa', 'hidden_gems',        1, 0),
  ('lisboa', 'now',                3, 0),
  ('lisboa', 'concierge',          1, 0),
  ('lisboa', 'search_priority',    3, 0),
  ('lisboa', 'category_featured',  3, 0),
  ('lisboa', 'new_on_goldenbook',  2, 0),
  ('porto',  'golden_picks',       5, 0),
  ('porto',  'hidden_gems',        1, 0),
  ('porto',  'now',                3, 0),
  ('porto',  'concierge',          1, 0)
ON CONFLICT (city, surface) DO NOTHING;

-- ─── 3. Remove listing_premium_pack from pricing_plans ──────────────────────
-- Every place already gets a detail page, so this package adds no value.

UPDATE pricing_plans
SET is_active = false, updated_at = now()
WHERE placement_type = 'listing_premium_pack';

-- ─── 4. Update extended_description pricing ─────────────────────────────────
-- New model: €9/month. Free tier = 250 chars, premium = 600 chars.

UPDATE pricing_plans
SET base_price = 9.00,
    unit_label = 'month',
    unit_days = 30,
    updated_at = now()
WHERE placement_type = 'extended_description'
  AND is_active = true;

-- ─── 5. Update scoring_weights: editorial → base_quality ────────────────────

UPDATE scoring_weights
SET weights = jsonb_set(
  weights - 'editorial',
  '{base_quality}',
  COALESCE(weights->'editorial', '0.22'::jsonb)
),
    updated_at = now()
WHERE weights ? 'editorial';
