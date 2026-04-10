import { db } from '../../../db/postgres'

/**
 * Ensures pricing tables exist and have default data.
 * Called once at server startup. Safe to call multiple times — only seeds if empty.
 */
export async function bootstrapPricingData(): Promise<void> {
  try {
    // Check if the pricing_plans table exists
    const { rows: tableCheck } = await db.query(
      `SELECT EXISTS(
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'pricing_plans'
       ) AS exists`
    )
    if (!tableCheck[0]?.exists) {
      console.log('[pricing-bootstrap] Tables not found — creating...')
      await createTables()
    }

    // Check if data exists
    const { rows: countCheck } = await db.query(
      `SELECT COUNT(*)::int AS c FROM pricing_plans`
    )
    if ((countCheck[0]?.c ?? 0) === 0) {
      console.log('[pricing-bootstrap] No pricing data — seeding defaults...')
      await seedDefaults()
      console.log('[pricing-bootstrap] Default pricing data seeded successfully')
    } else {
      console.log(`[pricing-bootstrap] Found ${countCheck[0].c} pricing plans — skipping seed`)
    }
  } catch (err) {
    console.error('[pricing-bootstrap] Error during bootstrap:', err)
  }
}

async function createTables(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS pricing_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pricing_type TEXT NOT NULL CHECK (pricing_type IN ('membership', 'placement', 'upgrade')),
      placement_type TEXT,
      city TEXT,
      position INT,
      slot TEXT,
      unit_label TEXT NOT NULL DEFAULT '7 days',
      unit_days INT NOT NULL DEFAULT 7,
      base_price NUMERIC(10,2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'eur',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS season_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      city TEXT NOT NULL,
      season_name TEXT NOT NULL,
      month_from INT NOT NULL CHECK (month_from BETWEEN 1 AND 12),
      month_to INT NOT NULL CHECK (month_to BETWEEN 1 AND 12),
      multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS city_multipliers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      city TEXT NOT NULL UNIQUE,
      multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS promotions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
      label TEXT NOT NULL DEFAULT '',
      applies_to TEXT NOT NULL DEFAULT 'all'
        CHECK (applies_to IN ('all', 'placement', 'upgrade', 'membership')),
      valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
      valid_until TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)
}

async function seedDefaults(): Promise<void> {
  // City multipliers
  await db.query(`
    INSERT INTO city_multipliers (city, multiplier) VALUES
      ('lisbon', 1.00), ('algarve', 0.95), ('madeira', 0.90), ('porto', 0.80)
    ON CONFLICT (city) DO NOTHING
  `)

  // Membership
  await db.query(`
    INSERT INTO pricing_plans (pricing_type, unit_label, unit_days, base_price)
    VALUES ('membership', 'yearly', 365, 150.00)
  `)

  // Placements (Lisboa base prices)
  await db.query(`
    INSERT INTO pricing_plans (pricing_type, placement_type, position, unit_label, unit_days, base_price) VALUES
      ('placement', 'now',                NULL, '7 days',  7,  420.00),
      ('placement', 'golden_picks',       1,    '7 days',  7,  650.00),
      ('placement', 'golden_picks',       2,    '7 days',  7,  550.00),
      ('placement', 'golden_picks',       3,    '7 days',  7,  450.00),
      ('placement', 'golden_picks',       4,    '7 days',  7,  390.00),
      ('placement', 'golden_picks',       5,    '7 days',  7,  350.00),
      ('placement', 'search_priority',    NULL, '28 days', 28, 480.00),
      ('placement', 'category_featured',  NULL, '28 days', 28, 360.00),
      ('placement', 'hidden_gems',        NULL, '7 days',  7,  290.00),
      ('placement', 'concierge',          NULL, '7 days',  7,  320.00),
      ('placement', 'new_on_goldenbook',  NULL, '14 days', 14, 240.00),
      ('placement', 'route_featured_stop',NULL, '14 days', 14, 260.00),
      ('placement', 'route_sponsor',      NULL, '28 days', 28, 520.00),
      ('placement', 'curated_route',      NULL, '15 days', 15, 380.00)
  `)

  // Upgrades
  await db.query(`
    INSERT INTO pricing_plans (pricing_type, placement_type, unit_label, unit_days, base_price) VALUES
      ('upgrade', 'extra_images',         'monthly', 30, 50.00),
      ('upgrade', 'extended_description', 'monthly', 30, 35.00),
      ('upgrade', 'listing_premium_pack', 'monthly', 30, 75.00)
  `)

  // Season rules
  await db.query(`
    INSERT INTO season_rules (city, season_name, month_from, month_to, multiplier) VALUES
      ('lisbon', 'high', 5, 10, 1.10), ('lisbon', 'mid', 3, 4, 1.00),
      ('lisbon', 'mid', 11, 11, 1.00), ('lisbon', 'low', 12, 2, 0.90),
      ('porto', 'high', 5, 10, 1.10), ('porto', 'mid', 3, 4, 1.00),
      ('porto', 'mid', 11, 11, 1.00), ('porto', 'low', 12, 2, 0.90),
      ('algarve', 'high', 5, 9, 1.20), ('algarve', 'mid', 3, 4, 1.00),
      ('algarve', 'mid', 10, 10, 1.00), ('algarve', 'low', 11, 2, 0.85),
      ('madeira', 'high', 10, 4, 1.15), ('madeira', 'mid', 5, 5, 1.00),
      ('madeira', 'mid', 6, 6, 1.00), ('madeira', 'mid', 9, 9, 1.00),
      ('madeira', 'low', 7, 8, 0.95)
  `)

  // Launch promotion
  await db.query(`
    INSERT INTO promotions (name, discount_pct, label, applies_to, valid_from, valid_until, is_active)
    VALUES ('Launch Promotion', 50.00, 'Launch offer — 50% off', 'all', '2026-01-01', '2026-09-30T23:59:59Z', true)
  `)
}
