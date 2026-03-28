-- =========================================================
-- PRODUCT CONTRACT V1
-- Goldenbook 2026
-- =========================================================

-- -----------------------------------------
-- Place detail editorial fields
-- -----------------------------------------
alter table place_translations
add column if not exists goldenbook_note text,
add column if not exists why_we_love_it text,
add column if not exists insider_tip text;

-- -----------------------------------------
-- Saved routes
-- -----------------------------------------
create table if not exists user_saved_routes (
  user_id uuid not null references users(id) on delete cascade,
  route_id uuid not null references routes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, route_id)
);

create index if not exists idx_user_saved_routes_user_id
  on user_saved_routes(user_id);

create index if not exists idx_user_saved_routes_route_id
  on user_saved_routes(route_id);

-- -----------------------------------------
-- Recently viewed places
-- -----------------------------------------
create table if not exists user_recently_viewed_places (
  user_id uuid not null references users(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create index if not exists idx_user_recently_viewed_places_user_id
  on user_recently_viewed_places(user_id);

create index if not exists idx_user_recently_viewed_places_place_id
  on user_recently_viewed_places(place_id);

create index if not exists idx_user_recently_viewed_places_viewed_at
  on user_recently_viewed_places(viewed_at desc);

-- -----------------------------------------
-- Editorial collections for Discover blocks
-- -----------------------------------------
create table if not exists editorial_collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  collection_type text not null check (
    collection_type in (
      'editors_picks',
      'hidden_spots',
      'new_on_goldenbook',
      'discover_block',
      'hero_candidates',
      'custom'
    )
  ),
  destination_id uuid references destinations(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_editorial_collections_destination_id
  on editorial_collections(destination_id);

create index if not exists idx_editorial_collections_type
  on editorial_collections(collection_type);

create table if not exists editorial_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references editorial_collections(id) on delete cascade,
  place_id uuid references places(id) on delete cascade,
  route_id uuid references routes(id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint chk_editorial_collection_items_target
    check (
      (place_id is not null and route_id is null)
      or
      (place_id is null and route_id is not null)
    )
);

create index if not exists idx_editorial_collection_items_collection_id
  on editorial_collection_items(collection_id);

create index if not exists idx_editorial_collection_items_place_id
  on editorial_collection_items(place_id);

create index if not exists idx_editorial_collection_items_route_id
  on editorial_collection_items(route_id);

create unique index if not exists uq_editorial_collection_items_place
  on editorial_collection_items(collection_id, place_id)
  where place_id is not null;

create unique index if not exists uq_editorial_collection_items_route
  on editorial_collection_items(collection_id, route_id)
  where route_id is not null;