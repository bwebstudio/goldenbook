-- Business Portal: clients + placement requests
--
-- business_clients links a Supabase auth user to a place they manage.
-- placement_requests stores requests from clients, reviewed by superadmin.

-- 1. Business clients table
CREATE TABLE business_clients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,          -- Supabase auth user id
  place_id     uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  contact_name text,
  contact_email text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, place_id)
);

CREATE INDEX idx_business_clients_user ON business_clients (user_id) WHERE is_active = true;
CREATE INDEX idx_business_clients_place ON business_clients (place_id);

-- 2. Placement requests table
CREATE TABLE placement_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id        uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  client_id       uuid NOT NULL REFERENCES business_clients(id) ON DELETE CASCADE,
  placement_type  text NOT NULL CHECK (placement_type IN (
    'golden_picks', 'now', 'hidden_gems', 'category_featured',
    'search_priority', 'new_on_goldenbook', 'routes', 'concierge'
  )),
  city_id         text,                -- destination slug
  slot            text CHECK (slot IS NULL OR slot IN ('morning', 'afternoon', 'dinner', 'night')),
  scope_type      text CHECK (scope_type IS NULL OR scope_type IN ('main_category', 'subcategory', 'search_vertical')),
  scope_id        text,                -- category slug when applicable
  route_id        uuid,                -- for route placements
  duration_days   integer NOT NULL DEFAULT 30,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'expired')),
  admin_notes     text,                -- superadmin can leave notes on review
  visibility_id   uuid REFERENCES place_visibility(id) ON DELETE SET NULL, -- link to created placement
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_placement_requests_place ON placement_requests (place_id);
CREATE INDEX idx_placement_requests_client ON placement_requests (client_id);
CREATE INDEX idx_placement_requests_status ON placement_requests (status) WHERE status IN ('pending', 'active');
