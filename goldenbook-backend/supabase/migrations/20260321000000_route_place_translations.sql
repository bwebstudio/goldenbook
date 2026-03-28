-- Route-place note translations
-- Allows editorial curator notes (route_places.note) to be localized per locale.
-- Composite PK on (route_id, place_id, locale) mirrors the route_places natural key.

CREATE TABLE IF NOT EXISTS route_place_translations (
  route_id   uuid        NOT NULL REFERENCES routes(id)  ON DELETE CASCADE,
  place_id   uuid        NOT NULL REFERENCES places(id)  ON DELETE CASCADE,
  locale     text        NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (route_id, place_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_route_place_translations_route_place
  ON route_place_translations (route_id, place_id);
