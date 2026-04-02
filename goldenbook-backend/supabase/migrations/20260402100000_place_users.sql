-- Place-User linking: controls which users can access which places.
-- Replaces business_clients as the source of truth for place access.

CREATE TABLE IF NOT EXISTS place_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id   uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  role       text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'manager')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (place_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_place_users_user  ON place_users (user_id);
CREATE INDEX IF NOT EXISTS idx_place_users_place ON place_users (place_id);

-- Backfill from existing business_clients
INSERT INTO place_users (place_id, user_id, role, created_at)
SELECT DISTINCT bc.place_id, bc.user_id, 'owner', bc.created_at
FROM business_clients bc
WHERE bc.is_active = true
ON CONFLICT (place_id, user_id) DO NOTHING;
