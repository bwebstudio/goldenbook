-- ════════════════════════════════════════════════════════════════════════════
-- Migration: Curated Routes system
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. curated_routes ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS curated_routes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_slug        TEXT NOT NULL,
  route_type       TEXT NOT NULL CHECK (route_type IN ('editorial', 'sponsored')),
  template_type    TEXT,  -- morning, lunch, evening, sunset, etc.
  sponsor_place_id UUID REFERENCES places(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  summary          TEXT,
  starts_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  purchase_id      UUID,  -- for linking to purchases
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_curated_routes_city_active
  ON curated_routes (city_slug, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_curated_routes_expires
  ON curated_routes (expires_at);

-- ─── 2. curated_route_stops ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS curated_route_stops (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id        UUID NOT NULL REFERENCES curated_routes(id) ON DELETE CASCADE,
  place_id        UUID NOT NULL REFERENCES places(id),
  stop_order      INT NOT NULL CHECK (stop_order >= 1 AND stop_order <= 3),
  editorial_note  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (route_id, stop_order)
);

-- ─── 3. Pricing config for curated_route ──────────────────────────────────
-- Conditionally insert if pricing_config table exists.
-- Price: 15000 cents (€150), duration: 15 days, max_slots: 2

-- Add curated_route to product_type_enum if it doesn't already exist.
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction, so we use a
-- top-level statement. The IF NOT EXISTS clause prevents errors on re-run.
ALTER TYPE product_type_enum ADD VALUE IF NOT EXISTS 'curated_route';

-- The INSERT must run in a separate transaction so the new enum value is
-- committed and visible.  Supabase migrations run each file as its own
-- transaction, but the ALTER TYPE above forces an implicit commit.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pricing_config'
  ) THEN
    INSERT INTO pricing_config (product_type, city, price, currency, duration_days, max_slots)
    VALUES
      ('curated_route', 'porto',    15000, 'EUR', 15, 2),
      ('curated_route', 'lisboa',   15000, 'EUR', 15, 2),
      ('curated_route', 'algarve',  15000, 'EUR', 15, 2),
      ('curated_route', 'madeira',  15000, 'EUR', 15, 2),
      ('curated_route', NULL,       15000, 'EUR', 15, 2)
    ON CONFLICT DO NOTHING;
  END IF;
END
$$;

-- ─── 4. Promotion inventory for curated_route ─────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'promotion_inventory'
  ) THEN
    INSERT INTO promotion_inventory (city, surface, max_slots, active_slots)
    VALUES
      ('porto',   'curated_route', 2, 0),
      ('lisboa',  'curated_route', 2, 0),
      ('algarve', 'curated_route', 2, 0),
      ('madeira', 'curated_route', 2, 0)
    ON CONFLICT (city, surface) DO NOTHING;
  END IF;
END
$$;
