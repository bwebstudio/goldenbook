-- =========================================================
-- BRANDS
-- Represents a brand that can operate across multiple places
-- (e.g. "Loja das Meias" with branches in Lisboa and Cascais).
-- places.brand_id is nullable — single-location places need no brand.
-- =========================================================

create table brands (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nullable FK on places — zero impact on existing rows
alter table places
  add column brand_id uuid references brands(id) on delete set null;

create index idx_places_brand_id on places(brand_id);
