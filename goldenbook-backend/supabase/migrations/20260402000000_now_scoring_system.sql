-- ─── NOW Scoring System ──────────────────────────────────────────────────────
--
-- Tables for configurable scoring weights, impression/click tracking,
-- A/B experiments, user segments, and auto-optimization.

-- ─── 1. Configurable Scoring Weights ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scoring_weights (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city        TEXT,                          -- NULL = global default
  segment     TEXT,                          -- NULL = all segments
  weights     JSONB NOT NULL,               -- { proximity, moment, time, weather, editorial, user, commercial }
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup: city-specific → segment-specific → global
CREATE INDEX IF NOT EXISTS idx_scoring_weights_lookup
  ON scoring_weights (city, segment)
  WHERE is_active = true;

COMMENT ON TABLE scoring_weights IS 'Configurable NOW scoring weights. NULL city = global default. NULL segment = all users.';

-- ─── 2. Weight Adjustments (auto-optimization deltas) ────────────────────────

CREATE TABLE IF NOT EXISTS scoring_weight_adjustments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city           TEXT,                       -- NULL = global
  segment        TEXT,                       -- NULL = all segments
  delta_weights  JSONB NOT NULL,            -- { proximity: +0.02, moment: -0.01, ... }
  reason         TEXT,                       -- 'auto_ctr_optimization' | 'manual'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scoring_adj_lookup
  ON scoring_weight_adjustments (city, segment, created_at DESC);

COMMENT ON TABLE scoring_weight_adjustments IS 'Incremental weight adjustments from auto-optimization. Final weights = base + latest delta.';

-- ─── 3. NOW Impression Tracking ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS now_impressions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  TEXT,
  user_id     UUID,                         -- nullable for anonymous users
  place_id    UUID NOT NULL,
  city        TEXT NOT NULL,
  context     JSONB NOT NULL DEFAULT '{}',  -- { time_of_day, weather, moment, segment, experiment_variant }
  weights_used JSONB,                       -- snapshot of weights at impression time
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_now_impressions_place
  ON now_impressions (place_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_now_impressions_city_time
  ON now_impressions (city, created_at DESC);

-- ─── 4. NOW Click Tracking ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS now_clicks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  TEXT,
  user_id     UUID,
  place_id    UUID NOT NULL,
  city        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_now_clicks_place
  ON now_clicks (place_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_now_clicks_city_time
  ON now_clicks (city, created_at DESC);

-- ─── 5. A/B Experiments ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ab_experiments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  city        TEXT,                          -- NULL = all cities
  variant_a   JSONB NOT NULL DEFAULT '{}',  -- weights for variant A (or empty = default)
  variant_b   JSONB NOT NULL,               -- weights for variant B
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at     TIMESTAMPTZ                   -- optional end date
);

CREATE INDEX IF NOT EXISTS idx_ab_experiments_active
  ON ab_experiments (city, is_active)
  WHERE is_active = true;

COMMENT ON TABLE ab_experiments IS 'A/B experiments for NOW scoring weights. Deterministic assignment via hash(session_id).';

-- ─── 6. User Segments ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_segments (
  user_id     UUID PRIMARY KEY,
  segment     TEXT NOT NULL,                -- 'foodie' | 'culture' | 'luxury' | 'nightlife' | 'explorer'
  confidence  REAL NOT NULL DEFAULT 0.5,    -- 0-1 confidence score
  source      TEXT NOT NULL DEFAULT 'onboarding', -- 'onboarding' | 'behavior' | 'manual'
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_segments_segment
  ON user_segments (segment);

COMMENT ON TABLE user_segments IS 'User segment classification for personalized NOW scoring.';

-- ─── 7. Segment Weight Overrides ─────────────────────────────────────────────
-- (uses scoring_weights table with segment column — no extra table needed)

-- Insert global default weights
INSERT INTO scoring_weights (city, segment, weights)
VALUES (
  NULL, NULL,
  '{"proximity": 0.30, "moment": 0.20, "time": 0.10, "weather": 0.10, "editorial": 0.15, "user": 0.10, "commercial": 0.05}'::jsonb
)
ON CONFLICT DO NOTHING;