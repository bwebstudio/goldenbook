-- Place analytics event tables for business portal metrics.
-- Tracks: views, website clicks, direction clicks.
-- Reservation clicks reuse existing booking_click_events table.

CREATE TABLE place_view_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id   uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id    uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_place_views_place   ON place_view_events (place_id, created_at);
CREATE INDEX idx_place_views_recent  ON place_view_events (created_at);

CREATE TABLE place_website_click_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id   uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id    uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_place_web_clicks_place ON place_website_click_events (place_id, created_at);

CREATE TABLE place_direction_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id   uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id    uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_place_directions_place ON place_direction_events (place_id, created_at);
