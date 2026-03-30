-- Place visibility: controls where a place appears in the app.
-- Works alongside the existing scoring/fallback logic — manual assignments take priority.

CREATE TABLE place_visibility (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id        uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  surface         text NOT NULL CHECK (surface IN ('golden_picks', 'hidden_spots', 'category_feature', 'now_recommendation', 'concierge_boost')),
  visibility_type text NOT NULL DEFAULT 'editorial' CHECK (visibility_type IN ('editorial', 'sponsored')),
  priority        integer NOT NULL DEFAULT 0,
  starts_at       timestamptz,
  ends_at         timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_visibility_place   ON place_visibility (place_id);
CREATE INDEX idx_visibility_surface ON place_visibility (surface) WHERE is_active = true;
