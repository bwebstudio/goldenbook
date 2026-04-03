-- ─── Pricing Reduction & Listing Upgrade Adjustments ─────────────────────────
--
-- 1. Reduce all base prices by ~15%
-- 2. Ensure listing upgrades (extra_images, extended_description) are monthly
-- 3. Remove listing_premium_pack from active plans (already done in previous migration)
--
-- The 50% launch discount continues to apply on top of these new base prices.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. PLACEMENT BASE PRICE REDUCTIONS (~15% lower)
-- ═══════════════════════════════════════════════════════════════════════════════

-- NOW: 420 → 360
UPDATE pricing_plans SET base_price = 360.00, updated_at = now()
WHERE placement_type = 'now' AND pricing_type = 'placement' AND is_active = true;

-- Golden Picks #1-#5: ~15% reduction each
UPDATE pricing_plans SET base_price = 550.00, updated_at = now()
WHERE placement_type = 'golden_picks' AND position = 1 AND is_active = true;

UPDATE pricing_plans SET base_price = 470.00, updated_at = now()
WHERE placement_type = 'golden_picks' AND position = 2 AND is_active = true;

UPDATE pricing_plans SET base_price = 380.00, updated_at = now()
WHERE placement_type = 'golden_picks' AND position = 3 AND is_active = true;

UPDATE pricing_plans SET base_price = 330.00, updated_at = now()
WHERE placement_type = 'golden_picks' AND position = 4 AND is_active = true;

UPDATE pricing_plans SET base_price = 300.00, updated_at = now()
WHERE placement_type = 'golden_picks' AND position = 5 AND is_active = true;

-- Search Priority: 480 → 410
UPDATE pricing_plans SET base_price = 410.00, updated_at = now()
WHERE placement_type = 'search_priority' AND is_active = true;

-- Category Featured: 360 → 300
UPDATE pricing_plans SET base_price = 300.00, updated_at = now()
WHERE placement_type = 'category_featured' AND is_active = true;

-- Hidden Gems: 290 → 250
UPDATE pricing_plans SET base_price = 250.00, updated_at = now()
WHERE placement_type = 'hidden_gems' AND is_active = true;

-- Concierge: 320 → 270
UPDATE pricing_plans SET base_price = 270.00, updated_at = now()
WHERE placement_type = 'concierge' AND is_active = true;

-- New on Goldenbook: 240 → 200
UPDATE pricing_plans SET base_price = 200.00, updated_at = now()
WHERE placement_type = 'new_on_goldenbook' AND is_active = true;

-- Route Featured Stop: 260 → 220
UPDATE pricing_plans SET base_price = 220.00, updated_at = now()
WHERE placement_type = 'route_featured_stop' AND is_active = true;

-- Route Sponsor: 520 → 440
UPDATE pricing_plans SET base_price = 440.00, updated_at = now()
WHERE placement_type = 'route_sponsor' AND is_active = true;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. LISTING UPGRADES — Monthly recurring, reduced prices
-- ═══════════════════════════════════════════════════════════════════════════════

-- Extra Images: 50 → 42 / month
UPDATE pricing_plans
SET base_price = 42.00,
    unit_label = 'month',
    unit_days  = 30,
    updated_at = now()
WHERE placement_type = 'extra_images' AND is_active = true;

-- Extended Description: already set to 9/month in previous migration.
-- Ensure it's monthly and confirm price.
UPDATE pricing_plans
SET base_price = 9.00,
    unit_label = 'month',
    unit_days  = 30,
    updated_at = now()
WHERE placement_type = 'extended_description' AND is_active = true;
