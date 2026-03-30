-- ============================================================================
-- Default Pricing Seed Data V2
-- Base prices = Lisboa. Other cities use city_multipliers.
-- All prices in EUR, excl. VAT. Editable later via Admin.
-- ============================================================================

-- Only seed if tables are empty (safe for re-runs)
-- ─── Clear for clean re-seed ───────────────────────────────────────────────
DELETE FROM pricing_plans;
DELETE FROM season_rules;
DELETE FROM city_multipliers;
DELETE FROM promotions;

-- ═══════════════════════════════════════════════════════════════════════════
-- CITY MULTIPLIERS
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO city_multipliers (city, multiplier) VALUES
  ('lisbon',  1.00),
  ('algarve', 0.95),
  ('madeira', 0.90),
  ('porto',   0.80);

-- ═══════════════════════════════════════════════════════════════════════════
-- MEMBERSHIP
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO pricing_plans (pricing_type, unit_label, unit_days, base_price) VALUES
  ('membership', 'yearly', 365, 150.00);

-- ═══════════════════════════════════════════════════════════════════════════
-- PLACEMENTS — Lisboa base prices only
-- ═══════════════════════════════════════════════════════════════════════════

-- Now Recommendation (7 days, 1 time slot)
INSERT INTO pricing_plans (pricing_type, placement_type, unit_label, unit_days, base_price) VALUES
  ('placement', 'now', '7 days', 7, 420.00);

-- Golden Picks #1–#5
INSERT INTO pricing_plans (pricing_type, placement_type, position, unit_label, unit_days, base_price) VALUES
  ('placement', 'golden_picks', 1, '7 days', 7, 650.00),
  ('placement', 'golden_picks', 2, '7 days', 7, 550.00),
  ('placement', 'golden_picks', 3, '7 days', 7, 450.00),
  ('placement', 'golden_picks', 4, '7 days', 7, 390.00),
  ('placement', 'golden_picks', 5, '7 days', 7, 350.00);

-- Search Priority (28 days, per vertical)
INSERT INTO pricing_plans (pricing_type, placement_type, unit_label, unit_days, base_price) VALUES
  ('placement', 'search_priority', '28 days', 28, 480.00);

-- Category Featured (28 days, per main category)
INSERT INTO pricing_plans (pricing_type, placement_type, unit_label, unit_days, base_price) VALUES
  ('placement', 'category_featured', '28 days', 28, 360.00);

-- Hidden Gems Near You (7 days)
INSERT INTO pricing_plans (pricing_type, placement_type, unit_label, unit_days, base_price) VALUES
  ('placement', 'hidden_gems', '7 days', 7, 290.00);

-- Concierge Recommendation (7 days)
INSERT INTO pricing_plans (pricing_type, placement_type, unit_label, unit_days, base_price) VALUES
  ('placement', 'concierge', '7 days', 7, 320.00);

-- New on Goldenbook (14 days)
INSERT INTO pricing_plans (pricing_type, placement_type, unit_label, unit_days, base_price) VALUES
  ('placement', 'new_on_goldenbook', '14 days', 14, 240.00);

-- Route Featured Stop (14 days)
INSERT INTO pricing_plans (pricing_type, placement_type, unit_label, unit_days, base_price) VALUES
  ('placement', 'route_featured_stop', '14 days', 14, 260.00);

-- Route Sponsor (28 days)
INSERT INTO pricing_plans (pricing_type, placement_type, unit_label, unit_days, base_price) VALUES
  ('placement', 'route_sponsor', '28 days', 28, 520.00);

-- ═══════════════════════════════════════════════════════════════════════════
-- LISTING UPGRADES — Lisboa base prices only
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO pricing_plans (pricing_type, placement_type, unit_label, unit_days, base_price) VALUES
  ('upgrade', 'extra_images',         'monthly', 30, 50.00),
  ('upgrade', 'extended_description', 'monthly', 30, 35.00),
  ('upgrade', 'listing_premium_pack', 'monthly', 30, 75.00);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEASON RULES (unchanged)
-- ═══════════════════════════════════════════════════════════════════════════

-- Lisbon
INSERT INTO season_rules (city, season_name, month_from, month_to, multiplier) VALUES
  ('lisbon', 'high', 5, 10, 1.10),
  ('lisbon', 'mid',  3,  4, 1.00),
  ('lisbon', 'mid', 11, 11, 1.00),
  ('lisbon', 'low', 12,  2, 0.90);

-- Porto
INSERT INTO season_rules (city, season_name, month_from, month_to, multiplier) VALUES
  ('porto', 'high', 5, 10, 1.10),
  ('porto', 'mid',  3,  4, 1.00),
  ('porto', 'mid', 11, 11, 1.00),
  ('porto', 'low', 12,  2, 0.90);

-- Algarve
INSERT INTO season_rules (city, season_name, month_from, month_to, multiplier) VALUES
  ('algarve', 'high', 5,  9, 1.20),
  ('algarve', 'mid',  3,  4, 1.00),
  ('algarve', 'mid', 10, 10, 1.00),
  ('algarve', 'low', 11,  2, 0.85);

-- Madeira
INSERT INTO season_rules (city, season_name, month_from, month_to, multiplier) VALUES
  ('madeira', 'high', 10, 4, 1.15),
  ('madeira', 'mid',   5, 5, 1.00),
  ('madeira', 'mid',   6, 6, 1.00),
  ('madeira', 'mid',   9, 9, 1.00),
  ('madeira', 'low',   7, 8, 0.95);

-- ═══════════════════════════════════════════════════════════════════════════
-- LAUNCH PROMOTION — 50% off until Sep 30, 2026
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO promotions (name, discount_pct, label, applies_to, valid_from, valid_until, is_active) VALUES
  ('Launch Promotion', 50.00, 'Launch offer — 50% off', 'all', '2026-01-01', '2026-09-30T23:59:59Z', true);
