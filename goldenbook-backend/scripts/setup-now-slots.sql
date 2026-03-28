-- ─── Setup "For you, right now" curated slots — Lisboa ───────────────────────
-- Automatically selects the 4 Lisboa places with the HIGHEST resolution images
-- for each time-of-day slot and pins them in the 'lisboa-now-slots' collection.
--
-- Slot mapping: sort_order 0 = morning | 1 = afternoon | 2 = evening | 3 = night
--
-- Run in Supabase SQL Editor or with:
--   psql $DATABASE_URL -f scripts/setup-now-slots.sql
--
-- After running, restart the backend. The homepage will immediately show these
-- 4 places. To change them: update the sort_order rows in
-- editorial_collection_items for collection slug 'lisboa-now-slots'.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Show what we're about to select (diagnostic) ───────────────────────────
-- This part runs first so you can see the selections in the output.

WITH ranked AS (
  SELECT
    p.id,
    p.slug,
    COALESCE(pt.name, p.name)              AS name,
    STRING_AGG(DISTINCT c.slug, ', ')      AS categories,
    MAX(ma.width)                          AS max_width,
    MAX(ma.height)                         AS max_height,
    CASE WHEN MAX(ma.width) >= COALESCE(MAX(ma.height), 0)
         THEN 'landscape' ELSE 'portrait' END AS orientation,
    -- Which time slots this place fits
    CASE WHEN bool_or(c.slug IN ('sports','activities','beaches','culture'))
         THEN 'morning ' ELSE '' END ||
    CASE WHEN bool_or(c.slug IN ('gastronomy','shops','culture','events'))
         THEN 'afternoon ' ELSE '' END ||
    CASE WHEN bool_or(c.slug IN ('gastronomy','events','activities','culture'))
         THEN 'evening ' ELSE '' END ||
    CASE WHEN bool_or(c.slug IN ('gastronomy','events','activities'))
         THEN 'night' ELSE '' END           AS fits_slots
  FROM places p
  JOIN destinations d ON d.id = p.destination_id AND d.slug = 'lisboa'
  LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.locale = 'en'
  LEFT JOIN place_images pi ON pi.place_id = p.id
    AND pi.image_role IN ('editorial', 'hero', 'cover')
  LEFT JOIN media_assets ma ON ma.id = pi.asset_id
  LEFT JOIN place_categories pc ON pc.place_id = p.id
  LEFT JOIN categories c ON c.id = pc.category_id AND c.is_active = true
  WHERE p.status = 'published'
  GROUP BY p.id, p.slug, p.name, pt.name
  HAVING COUNT(pi.id) > 0
)
SELECT name, slug, max_width, max_height, orientation, fits_slots
FROM ranked
ORDER BY max_width DESC NULLS LAST
LIMIT 20;

-- ── 2. Create or refresh the editorial collection ─────────────────────────────

-- Ensure the collection exists
INSERT INTO editorial_collections (id, slug, title, collection_type, destination_id, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'lisboa-now-slots',
  'Lisboa — For You Right Now (curated slots)',
  'custom',
  d.id,
  true,
  now(),
  now()
FROM destinations d WHERE d.slug = 'lisboa'
ON CONFLICT (slug) DO UPDATE SET is_active = true, updated_at = now();

-- Remove old slot entries so we can replace them cleanly
DELETE FROM editorial_collection_items
WHERE collection_id = (SELECT id FROM editorial_collections WHERE slug = 'lisboa-now-slots');

-- ── 3. Auto-select best place per slot by image resolution ────────────────────

-- Helper: best place per category group, ordered by max image width DESC
-- Ties broken by featured flag, then slug for determinism.

-- Morning (sort_order = 0): sports / activities / beaches / culture
INSERT INTO editorial_collection_items (id, collection_id, place_id, sort_order, created_at)
SELECT
  gen_random_uuid(),
  ec.id,
  best.place_id,
  0,
  now()
FROM editorial_collections ec,
LATERAL (
  SELECT p.id AS place_id
  FROM places p
  JOIN destinations d ON d.id = p.destination_id AND d.slug = 'lisboa'
  JOIN place_categories pc ON pc.place_id = p.id
  JOIN categories c ON c.id = pc.category_id
    AND c.slug IN ('sports', 'activities', 'beaches', 'culture')
    AND c.is_active = true
  LEFT JOIN place_images pi ON pi.place_id = p.id
    AND pi.image_role IN ('editorial', 'hero', 'cover')
  LEFT JOIN media_assets ma ON ma.id = pi.asset_id
  WHERE p.status = 'published'
  GROUP BY p.id, p.featured
  ORDER BY MAX(ma.width) DESC NULLS LAST, p.featured DESC, p.slug ASC
  LIMIT 1
) best
WHERE ec.slug = 'lisboa-now-slots';

-- Afternoon (sort_order = 1): gastronomy / shops / culture / events
INSERT INTO editorial_collection_items (id, collection_id, place_id, sort_order, created_at)
SELECT
  gen_random_uuid(),
  ec.id,
  best.place_id,
  1,
  now()
FROM editorial_collections ec,
LATERAL (
  SELECT p.id AS place_id
  FROM places p
  JOIN destinations d ON d.id = p.destination_id AND d.slug = 'lisboa'
  JOIN place_categories pc ON pc.place_id = p.id
  JOIN categories c ON c.id = pc.category_id
    AND c.slug IN ('gastronomy', 'shops', 'culture', 'events')
    AND c.is_active = true
  LEFT JOIN place_images pi ON pi.place_id = p.id
    AND pi.image_role IN ('editorial', 'hero', 'cover')
  LEFT JOIN media_assets ma ON ma.id = pi.asset_id
  WHERE p.status = 'published'
    -- Must differ from morning pick
    AND p.id NOT IN (
      SELECT eci2.place_id FROM editorial_collection_items eci2
      WHERE eci2.collection_id = ec.id AND eci2.sort_order = 0
    )
  GROUP BY p.id, p.featured
  ORDER BY MAX(ma.width) DESC NULLS LAST, p.featured DESC, p.slug ASC
  LIMIT 1
) best
WHERE ec.slug = 'lisboa-now-slots';

-- Evening (sort_order = 2): gastronomy / events / activities / culture
INSERT INTO editorial_collection_items (id, collection_id, place_id, sort_order, created_at)
SELECT
  gen_random_uuid(),
  ec.id,
  best.place_id,
  2,
  now()
FROM editorial_collections ec,
LATERAL (
  SELECT p.id AS place_id
  FROM places p
  JOIN destinations d ON d.id = p.destination_id AND d.slug = 'lisboa'
  JOIN place_categories pc ON pc.place_id = p.id
  JOIN categories c ON c.id = pc.category_id
    AND c.slug IN ('gastronomy', 'events', 'activities', 'culture')
    AND c.is_active = true
  LEFT JOIN place_images pi ON pi.place_id = p.id
    AND pi.image_role IN ('editorial', 'hero', 'cover')
  LEFT JOIN media_assets ma ON ma.id = pi.asset_id
  WHERE p.status = 'published'
    AND p.id NOT IN (
      SELECT eci2.place_id FROM editorial_collection_items eci2
      WHERE eci2.collection_id = ec.id AND eci2.sort_order IN (0, 1)
    )
  GROUP BY p.id, p.featured
  ORDER BY MAX(ma.width) DESC NULLS LAST, p.featured DESC, p.slug ASC
  LIMIT 1
) best
WHERE ec.slug = 'lisboa-now-slots';

-- Night (sort_order = 3): gastronomy / events / activities
INSERT INTO editorial_collection_items (id, collection_id, place_id, sort_order, created_at)
SELECT
  gen_random_uuid(),
  ec.id,
  best.place_id,
  3,
  now()
FROM editorial_collections ec,
LATERAL (
  SELECT p.id AS place_id
  FROM places p
  JOIN destinations d ON d.id = p.destination_id AND d.slug = 'lisboa'
  JOIN place_categories pc ON pc.place_id = p.id
  JOIN categories c ON c.id = pc.category_id
    AND c.slug IN ('gastronomy', 'events', 'activities')
    AND c.is_active = true
  LEFT JOIN place_images pi ON pi.place_id = p.id
    AND pi.image_role IN ('editorial', 'hero', 'cover')
  LEFT JOIN media_assets ma ON ma.id = pi.asset_id
  WHERE p.status = 'published'
    AND p.id NOT IN (
      SELECT eci2.place_id FROM editorial_collection_items eci2
      WHERE eci2.collection_id = ec.id AND eci2.sort_order IN (0, 1, 2)
    )
  GROUP BY p.id, p.featured
  ORDER BY MAX(ma.width) DESC NULLS LAST, p.featured DESC, p.slug ASC
  LIMIT 1
) best
WHERE ec.slug = 'lisboa-now-slots';

-- ── 4. Confirm the final selection ────────────────────────────────────────────

SELECT
  eci.sort_order,
  CASE eci.sort_order WHEN 0 THEN 'morning' WHEN 1 THEN 'afternoon'
                       WHEN 2 THEN 'evening' WHEN 3 THEN 'night' END AS slot,
  p.slug,
  COALESCE(pt.name, p.name) AS name,
  MAX(ma.width)  AS img_width,
  MAX(ma.height) AS img_height
FROM editorial_collection_items eci
JOIN editorial_collections ec ON ec.id = eci.collection_id AND ec.slug = 'lisboa-now-slots'
JOIN places p ON p.id = eci.place_id
LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.locale = 'en'
LEFT JOIN place_images pi ON pi.place_id = p.id
LEFT JOIN media_assets ma ON ma.id = pi.asset_id
GROUP BY eci.sort_order, p.id, p.slug, p.name, pt.name
ORDER BY eci.sort_order;

COMMIT;
