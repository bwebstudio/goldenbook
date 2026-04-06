-- Ranking debug log for tuning recommendation quality.
-- Each recommendation request stores scoring breakdown for analysis.

CREATE TABLE IF NOT EXISTS ranking_debug (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  city_slug TEXT NOT NULL,
  time_of_day TEXT NOT NULL,        -- morning, midday, afternoon, evening, night
  time_window TEXT NOT NULL,          -- manhã, almoço, tarde, noite, madrugada
  intent TEXT,                       -- dinner, sunset, culture, etc.
  budget TEXT,                       -- €, €€, €€€, €€€€
  category_filter TEXT,              -- gastronomy, culture, etc.
  user_lat NUMERIC(9,6),
  user_lng NUMERIC(9,6),
  candidates_total INTEGER NOT NULL,
  candidates_after_filter INTEGER NOT NULL,
  results JSONB NOT NULL,            -- top N with scores
  scoring_breakdown JSONB,           -- per-place scoring details
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ranking_debug_city_time ON ranking_debug (city_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ranking_debug_intent ON ranking_debug (intent, created_at DESC);
