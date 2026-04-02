-- ─── NOW Editorial Tags & Context Fields ─────────────────────────────────────
--
-- Adds dashboard-configurable fields to places so NOW can be managed as a
-- hybrid editorial-commercial surface, not a pure geolocation module.
--
-- These fields let the team control which places appear in NOW, when,
-- and with what priority — independent of user location.

-- ─── 1. NOW participation fields on places ──────────────────────────────────

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS now_enabled          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS now_priority         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS now_featured         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS now_start_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS now_end_at           TIMESTAMPTZ;

COMMENT ON COLUMN places.now_enabled   IS 'Whether this place participates in the NOW recommendation surface.';
COMMENT ON COLUMN places.now_priority  IS 'Editorial/commercial priority for NOW ranking (0=default, higher=boosted).';
COMMENT ON COLUMN places.now_featured  IS 'Featured in NOW — gets priority boost during matching time windows.';
COMMENT ON COLUMN places.now_start_at  IS 'Start of NOW participation window (NULL=always eligible).';
COMMENT ON COLUMN places.now_end_at    IS 'End of NOW participation window (NULL=no expiry).';

-- Index for NOW candidate queries
CREATE INDEX IF NOT EXISTS idx_places_now_enabled
  ON places (now_enabled, now_priority DESC)
  WHERE now_enabled = true AND status = 'published' AND is_active = true;

-- ─── 2. NOW time windows (which time-of-day slots a place is relevant for) ──

CREATE TABLE IF NOT EXISTS place_now_time_windows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id    UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  time_window TEXT NOT NULL,  -- 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'
  priority    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (place_id, time_window)
);

CREATE INDEX IF NOT EXISTS idx_place_now_time_windows_lookup
  ON place_now_time_windows (time_window, priority DESC);

COMMENT ON TABLE place_now_time_windows IS 'Which time-of-day windows a place is eligible for in NOW. No rows = eligible for all windows (legacy behavior via moment system).';

-- ─── 3. NOW context tags ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS now_context_tags (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug  TEXT NOT NULL UNIQUE,
  name  TEXT NOT NULL,
  description TEXT
);

-- Seed standard context tags
INSERT INTO now_context_tags (slug, name, description) VALUES
  ('dinner',       'Dinner',            'Dinner spots'),
  ('cocktails',    'Cocktails',         'Cocktail bars and lounges'),
  ('romantic',     'Romantic',          'Romantic settings'),
  ('rainy-day',    'Rainy Day',         'Indoor options for rainy weather'),
  ('culture',      'Culture',           'Museums, galleries, cultural venues'),
  ('family',       'Family',            'Family-friendly places'),
  ('wellness',     'Wellness',          'Spas, wellness, relaxation'),
  ('shopping',     'Shopping',          'Boutiques and shopping'),
  ('sunday',       'Sunday',            'Sunday-appropriate spots'),
  ('late-night',   'Late Night',        'Late-night venues'),
  ('quick-stop',   'Quick Stop',        'Brief visits, coffee, quick bites'),
  ('brunch',       'Brunch',            'Brunch spots'),
  ('sunset',       'Sunset',            'Sunset viewing spots'),
  ('coffee',       'Coffee',            'Cafés and coffee houses'),
  ('local-secret', 'Local Secret',      'Known primarily to locals'),
  ('celebration',  'Celebration',       'Special occasion venues'),
  ('terrace',      'Terrace',           'Outdoor terrace seating'),
  ('wine',         'Wine',              'Wine bars and wine experiences'),
  ('live-music',   'Live Music',        'Venues with live music'),
  ('viewpoint',    'Viewpoint',         'Views and vistas')
ON CONFLICT (slug) DO NOTHING;

-- ─── 4. Place ↔ context tag association ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS place_now_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id    UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES now_context_tags(id) ON DELETE CASCADE,
  weight      REAL NOT NULL DEFAULT 1.0,  -- relative relevance of this tag for this place
  UNIQUE (place_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_place_now_tags_place
  ON place_now_tags (place_id);
CREATE INDEX IF NOT EXISTS idx_place_now_tags_tag
  ON place_now_tags (tag_id);

COMMENT ON TABLE place_now_tags IS 'Associates places with NOW context tags. Weight controls relative relevance (1.0=normal, 2.0=strong match).';

-- ─── 5. Update default scoring weights to reduce proximity dependency ────────
--
-- Old default: proximity=0.30, moment=0.20, time=0.10, weather=0.10, editorial=0.15, user=0.10, commercial=0.05
-- New default: proximity=0.10, moment=0.15, time=0.10, weather=0.08, editorial=0.22, user=0.10, commercial=0.05, now_tags=0.20
--
-- The 'now_tags' weight is new — it scores how well the place's context tags
-- match the current context (time + weather + editorial intent).

UPDATE scoring_weights
SET weights = '{
  "proximity":  0.10,
  "moment":     0.15,
  "time":       0.10,
  "weather":    0.08,
  "editorial":  0.22,
  "user":       0.10,
  "commercial": 0.05,
  "now_tags":   0.20
}'::jsonb,
    updated_at = now()
WHERE city IS NULL AND segment IS NULL AND is_active = true;
