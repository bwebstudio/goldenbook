create extension if not exists "pgcrypto";

-- =========================================================
-- CORE CATALOGS
-- =========================================================

create table countries (
  id uuid primary key default gen_random_uuid(),
  code varchar(2) not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  path text not null,
  mime_type text,
  width int,
  height int,
  size_bytes bigint,
  alt_text text,
  blurhash text,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

create table destinations (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id) on delete restrict,
  parent_destination_id uuid references destinations(id) on delete set null,
  slug text not null unique,
  destination_type text not null check (destination_type in ('country', 'region', 'city', 'island', 'area', 'neighborhood')),
  name text not null,
  featured boolean not null default false,
  hero_image_asset_id uuid references media_assets(id) on delete set null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_destinations_country_id on destinations(country_id);
create index idx_destinations_parent_id on destinations(parent_destination_id);
create index idx_destinations_type on destinations(destination_type);

create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  icon_name text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  slug text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, slug)
);

create index idx_subcategories_category_id on subcategories(category_id);

-- =========================================================
-- ADMIN / INTERNAL
-- =========================================================

create table admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  role text not null check (role in ('super_admin', 'editor', 'curator', 'translator', 'ops')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- PLACES (main public entity)
-- =========================================================

create table places (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid not null references destinations(id) on delete restrict,
  slug text not null unique,
  place_type text not null check (place_type in ('restaurant', 'cafe', 'bar', 'shop', 'hotel', 'beach', 'museum', 'activity', 'landmark', 'venue', 'transport', 'other')),
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  name text not null,
  short_description text,
  editorial_summary text,
  full_description text,
  address_line text,
  postal_code text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  phone text,
  email text,
  website_url text,
  instagram_url text,
  booking_url text,
  price_tier smallint check (price_tier between 1 and 4),
  featured boolean not null default false,
  trending boolean not null default false,
  is_temporarily_closed boolean not null default false,
  is_active boolean not null default true,
  published_at timestamptz,
  created_by uuid references admin_users(id) on delete set null,
  updated_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_places_destination_id on places(destination_id);
create index idx_places_status on places(status);
create index idx_places_featured on places(featured);
create index idx_places_trending on places(trending);
create index idx_places_place_type on places(place_type);

create table place_categories (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  category_id uuid not null references categories(id) on delete restrict,
  subcategory_id uuid references subcategories(id) on delete set null,
  is_primary boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create unique index uq_place_categories_unique_relation
  on place_categories (
    place_id,
    category_id,
    coalesce(subcategory_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index idx_place_categories_place_id on place_categories(place_id);
create index idx_place_categories_category_id on place_categories(category_id);
create index idx_place_categories_subcategory_id on place_categories(subcategory_id);

create table place_images (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  asset_id uuid not null references media_assets(id) on delete cascade,
  image_role text not null default 'gallery' check (image_role in ('cover', 'gallery', 'hero', 'thumbnail', 'editorial')),
  sort_order int not null default 0,
  caption text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_place_images_place_id on place_images(place_id);
create index idx_place_images_asset_id on place_images(asset_id);

create table opening_hours (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  slot_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_opening_hours_place_id on opening_hours(place_id);

-- =========================================================
-- TRANSLATIONS
-- =========================================================

create table destination_translations (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid not null references destinations(id) on delete cascade,
  locale text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (destination_id, locale)
);

create table category_translations (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  locale text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, locale)
);

create table subcategory_translations (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid not null references subcategories(id) on delete cascade,
  locale text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subcategory_id, locale)
);

create table place_translations (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  locale text not null,
  name text not null,
  short_description text,
  editorial_summary text,
  full_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, locale)
);

-- =========================================================
-- ROUTES (editorial feature)
-- =========================================================

create table routes (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid references destinations(id) on delete set null,
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  route_type text not null check (route_type in ('walking', 'day_plan', 'weekend', 'food_route', 'editor_pick', 'other')),
  title text not null,
  summary text,
  cover_asset_id uuid references media_assets(id) on delete set null,
  featured boolean not null default false,
  estimated_duration_minutes int,
  created_by uuid references admin_users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_routes_destination_id on routes(destination_id);
create index idx_routes_status on routes(status);

create table route_places (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  sort_order int not null default 0,
  note text,
  stay_minutes int,
  created_at timestamptz not null default now(),
  unique (route_id, place_id)
);

create index idx_route_places_route_id on route_places(route_id);
create index idx_route_places_place_id on route_places(place_id);

create table route_translations (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  locale text not null,
  title text not null,
  summary text,
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_id, locale)
);

-- =========================================================
-- APP USERS
-- =========================================================

create table users (
  id uuid primary key,
  username text unique,
  display_name text,
  avatar_asset_id uuid references media_assets(id) on delete set null,
  locale text,
  home_destination_id uuid references destinations(id) on delete set null,
  onboarding_completed boolean not null default false,
  preferences_jsonb jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_favorites (
  user_id uuid not null references users(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table user_bookmarks (
  user_id uuid not null references users(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table user_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  slug text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_list_places (
  list_id uuid not null references user_lists(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  primary key (list_id, place_id)
);

-- =========================================================
-- STATS + AUDIT
-- =========================================================

create table place_stats (
  place_id uuid primary key references places(id) on delete cascade,
  favorites_count int not null default 0,
  bookmarks_count int not null default 0,
  popularity_score numeric(10,2),
  last_computed_at timestamptz
);

create table audit_logs (
  id bigserial primary key,
  actor_admin_user_id uuid references admin_users(id) on delete set null,
  actor_user_id uuid references users(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table migration_logs (
  id bigserial primary key,
  entity_type text not null,
  source_id text,
  target_id uuid,
  status text not null,
  message text,
  payload jsonb,
  created_at timestamptz not null default now()
);