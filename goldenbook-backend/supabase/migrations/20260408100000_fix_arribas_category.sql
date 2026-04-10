-- Fix Hotel Arribas: wrong place_type and missing "alojamento" category assignment.
-- It was classified as "restaurant" under "activities" + "gastronomy" instead of "hotel" under "alojamento".

-- 1. Fix place_type
UPDATE places
SET    place_type = 'hotel'
WHERE  slug = 'arribas-sintra-hotel-lisboa';

-- 2. Assign to alojamento (Hotels & Stays) — insert only if not already present
INSERT INTO place_categories (place_id, category_id, is_primary, sort_order)
SELECT p.id, c.id, true, 0
FROM   places p, categories c
WHERE  p.slug = 'arribas-sintra-hotel-lisboa'
  AND  c.slug = 'alojamento'
  AND  NOT EXISTS (
    SELECT 1 FROM place_categories pc
    WHERE pc.place_id = p.id AND pc.category_id = c.id
  );

-- 3. Demote old primary (activities) to non-primary
UPDATE place_categories
SET    is_primary = false
WHERE  place_id = (SELECT id FROM places WHERE slug = 'arribas-sintra-hotel-lisboa')
  AND  category_id != (SELECT id FROM categories WHERE slug = 'alojamento')
  AND  is_primary = true;
