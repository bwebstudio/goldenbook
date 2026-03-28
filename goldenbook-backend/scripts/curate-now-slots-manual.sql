-- ═══════════════════════════════════════════════════════════════════════════════
-- MANUAL CURATION — "For you, right now" — Lisboa
-- ═══════════════════════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor.
-- It has three parts:
--   PART A  — List all Lisboa places + their best image resolution (read-only)
--   PART B  — Find a place by name (search helper)
--   PART C  — Set the 4 curated slots  ← FILL IN YOUR CHOSEN SLUGS HERE
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── PART A: All Lisboa places with their best available image ─────────────────
-- Run this first to choose which 4 you want.
-- Sorted by: landscape images first, then highest width.

SELECT
  p.slug,
  COALESCE(pt.name, p.name)              AS name,
  MAX(ma.width)                          AS best_width,
  MAX(ma.height)                         AS best_height,
  CASE
    WHEN MAX(ma.width) IS NULL             THEN '⚠ no metadata'
    WHEN MAX(ma.width) >= MAX(ma.height)   THEN '✓ landscape'
    ELSE                                        '✗ portrait'
  END                                    AS orientation,
  COUNT(pi.id)                           AS image_count,
  STRING_AGG(DISTINCT c.slug, ', ')      AS categories,
  p.featured
FROM places p
JOIN destinations d ON d.id = p.destination_id AND d.slug = 'lisboa'
LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.locale = 'en'
LEFT JOIN place_images pi ON pi.place_id = p.id
  AND pi.image_role IN ('editorial', 'hero', 'cover')
LEFT JOIN media_assets ma ON ma.id = pi.asset_id
LEFT JOIN place_categories pc ON pc.place_id = p.id
LEFT JOIN categories c ON c.id = pc.category_id AND c.is_active = true
WHERE p.status = 'published'
GROUP BY p.id, p.slug, p.name, p.featured, pt.name
HAVING COUNT(pi.id) > 0
ORDER BY
  CASE WHEN MAX(ma.width) IS NULL THEN 1 ELSE 0 END,
  CASE WHEN MAX(ma.width) >= MAX(ma.height) THEN 0 ELSE 1 END,
  MAX(ma.width) DESC NULLS LAST;


-- ── PART B: Search a place by name (helper) ───────────────────────────────────
-- Uncomment and replace 'your search term' to find the exact slug for a place.

-- SELECT p.id, p.slug, COALESCE(pt.name, p.name) AS name
-- FROM places p
-- LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.locale = 'en'
-- WHERE (COALESCE(pt.name, p.name)) ILIKE '%your search term%'
-- ORDER BY name;


-- ── PART C: Set the 4 curated slots ──────────────────────────────────────────
-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ FILL IN the 4 slugs below (one per slot), then run this whole block.       │
-- │ sort_order  0 = morning  |  1 = afternoon  |  2 = evening  |  3 = night   │
-- └─────────────────────────────────────────────────────────────────────────────┘

DO $$
DECLARE
  v_collection_id uuid;
  v_destination_id uuid;

  -- ── EDIT THESE 4 SLUGS ──────────────────────────────────────────────────────
  slug_morning   text := 'REPLACE-WITH-SLUG';   -- shown at 05:00–11:59
  slug_afternoon text := 'REPLACE-WITH-SLUG';   -- shown at 12:00–16:59
  slug_evening   text := 'REPLACE-WITH-SLUG';   -- shown at 17:00–22:59
  slug_night     text := 'REPLACE-WITH-SLUG';   -- shown at 23:00–04:59
  -- ────────────────────────────────────────────────────────────────────────────

  v_morning_id   uuid;
  v_afternoon_id uuid;
  v_evening_id   uuid;
  v_night_id     uuid;
BEGIN
  -- Resolve destination
  SELECT id INTO v_destination_id FROM destinations WHERE slug = 'lisboa';
  IF v_destination_id IS NULL THEN
    RAISE EXCEPTION 'Destination "lisboa" not found';
  END IF;

  -- Resolve place IDs
  SELECT id INTO v_morning_id   FROM places WHERE slug = slug_morning;
  SELECT id INTO v_afternoon_id FROM places WHERE slug = slug_afternoon;
  SELECT id INTO v_evening_id   FROM places WHERE slug = slug_evening;
  SELECT id INTO v_night_id     FROM places WHERE slug = slug_night;

  IF v_morning_id   IS NULL THEN RAISE EXCEPTION 'Place not found: %', slug_morning;   END IF;
  IF v_afternoon_id IS NULL THEN RAISE EXCEPTION 'Place not found: %', slug_afternoon; END IF;
  IF v_evening_id   IS NULL THEN RAISE EXCEPTION 'Place not found: %', slug_evening;   END IF;
  IF v_night_id     IS NULL THEN RAISE EXCEPTION 'Place not found: %', slug_night;     END IF;

  -- Create or refresh the collection
  INSERT INTO editorial_collections
    (id, slug, title, collection_type, destination_id, is_active, created_at, updated_at)
  VALUES
    (gen_random_uuid(), 'lisboa-now-slots',
     'Lisboa — For You Right Now', 'custom',
     v_destination_id, true, now(), now())
  ON CONFLICT (slug) DO UPDATE
    SET is_active = true, updated_at = now()
  RETURNING id INTO v_collection_id;

  IF v_collection_id IS NULL THEN
    SELECT id INTO v_collection_id FROM editorial_collections WHERE slug = 'lisboa-now-slots';
  END IF;

  -- Replace all slot entries
  DELETE FROM editorial_collection_items WHERE collection_id = v_collection_id;

  INSERT INTO editorial_collection_items (id, collection_id, place_id, sort_order, created_at)
  VALUES
    (gen_random_uuid(), v_collection_id, v_morning_id,   0, now()),
    (gen_random_uuid(), v_collection_id, v_afternoon_id, 1, now()),
    (gen_random_uuid(), v_collection_id, v_evening_id,   2, now()),
    (gen_random_uuid(), v_collection_id, v_night_id,     3, now());

  RAISE NOTICE 'Done. Slots set:';
  RAISE NOTICE '  morning   (0): %', slug_morning;
  RAISE NOTICE '  afternoon (1): %', slug_afternoon;
  RAISE NOTICE '  evening   (2): %', slug_evening;
  RAISE NOTICE '  night     (3): %', slug_night;
END $$;


-- ── Verify the result ─────────────────────────────────────────────────────────

SELECT
  CASE eci.sort_order
    WHEN 0 THEN 'morning'
    WHEN 1 THEN 'afternoon'
    WHEN 2 THEN 'evening'
    WHEN 3 THEN 'night'
  END                              AS slot,
  p.slug,
  COALESCE(pt.name, p.name)        AS name,
  MAX(ma.width)                    AS img_width,
  MAX(ma.height)                   AS img_height
FROM editorial_collection_items eci
JOIN editorial_collections ec ON ec.id = eci.collection_id AND ec.slug = 'lisboa-now-slots'
JOIN places p ON p.id = eci.place_id
LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.locale = 'en'
LEFT JOIN place_images pi ON pi.place_id = p.id
LEFT JOIN media_assets ma ON ma.id = pi.asset_id
GROUP BY eci.sort_order, p.id, p.slug, p.name, pt.name
ORDER BY eci.sort_order;
