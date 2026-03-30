-- Evolve place_visibility to support the full placement inventory.
--
-- New surfaces: now (replaces now_recommendation), search_priority,
-- category_featured (replaces category_feature), concierge (replaces concierge_boost),
-- route_featured, route_sponsor, new_on_goldenbook.
--
-- New columns: placement_slot, scope_type, scope_id, source.

-- 1. Drop the CHECK constraint on surface so we can add new values
ALTER TABLE place_visibility DROP CONSTRAINT IF EXISTS place_visibility_surface_check;

-- 2. Add the new columns
ALTER TABLE place_visibility
  ADD COLUMN IF NOT EXISTS placement_slot text,
  ADD COLUMN IF NOT EXISTS scope_type     text,
  ADD COLUMN IF NOT EXISTS scope_id       text,
  ADD COLUMN IF NOT EXISTS source         text NOT NULL DEFAULT 'system';

-- 3. Migrate existing surface names to new canonical names
UPDATE place_visibility SET surface = 'now'               WHERE surface = 'now_recommendation';
UPDATE place_visibility SET surface = 'category_featured'  WHERE surface = 'category_feature';
UPDATE place_visibility SET surface = 'concierge'          WHERE surface = 'concierge_boost';

-- 4. Re-apply CHECK with full set of allowed surfaces
ALTER TABLE place_visibility ADD CONSTRAINT place_visibility_surface_check
  CHECK (surface IN (
    'golden_picks',
    'hidden_spots',
    'now',
    'search_priority',
    'category_featured',
    'concierge',
    'route_featured',
    'route_sponsor',
    'new_on_goldenbook'
  ));

-- 5. Source constraint
ALTER TABLE place_visibility ADD CONSTRAINT place_visibility_source_check
  CHECK (source IN ('sponsored', 'system', 'superadmin'));

-- 6. Scope type constraint (nullable — only used for category_featured, search_priority)
ALTER TABLE place_visibility ADD CONSTRAINT place_visibility_scope_type_check
  CHECK (scope_type IS NULL OR scope_type IN ('main_category', 'subcategory', 'search_vertical'));

-- 7. Placement slot constraint (nullable — only used for 'now')
ALTER TABLE place_visibility ADD CONSTRAINT place_visibility_slot_check
  CHECK (placement_slot IS NULL OR placement_slot IN ('morning', 'afternoon', 'dinner', 'night'));

-- 8. Index for scope-based lookups (category_featured, search_priority)
CREATE INDEX IF NOT EXISTS idx_visibility_scope
  ON place_visibility (surface, scope_type, scope_id)
  WHERE is_active = true;

-- 9. Index for slot-based lookups (now)
CREATE INDEX IF NOT EXISTS idx_visibility_slot
  ON place_visibility (surface, placement_slot)
  WHERE is_active = true;
