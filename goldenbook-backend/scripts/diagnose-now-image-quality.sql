-- ─── Diagnose "For you, right now" image quality — Lisboa ────────────────────
-- Shows every published Lisboa place with its best available image dimensions.
-- Sort by max_width DESC to find the highest-resolution candidates.
--
-- Run with:
--   psql $DATABASE_URL -f diagnose-now-image-quality.sql
-- Or paste directly in Supabase SQL Editor.

SELECT
  p.slug,
  COALESCE(pt.name, p.name)                          AS name,
  STRING_AGG(DISTINCT c.slug, ', ')                  AS categories,
  -- Best image dimensions
  MAX(ma.width)                                      AS max_width,
  MAX(ma.height)                                     AS max_height,
  -- Is it landscape?
  CASE WHEN MAX(ma.width) >= MAX(ma.height) THEN 'YES' ELSE 'NO' END AS landscape,
  -- Best image role available
  MIN(pi.image_role)                                 AS best_role,
  -- Count of images per place
  COUNT(pi.id)                                       AS image_count,
  p.featured

FROM places p
JOIN destinations d
       ON d.id = p.destination_id AND d.slug = 'lisboa'
LEFT JOIN place_translations pt
       ON pt.place_id = p.id AND pt.locale = 'en'
LEFT JOIN place_images pi
       ON pi.place_id = p.id
      AND pi.image_role IN ('editorial', 'hero', 'cover')
LEFT JOIN media_assets ma
       ON ma.id = pi.asset_id
LEFT JOIN place_categories pc
       ON pc.place_id = p.id
LEFT JOIN categories c
       ON c.id = pc.category_id AND c.is_active = true

WHERE p.status = 'published'

GROUP BY p.id, p.slug, p.name, p.featured, pt.name

-- Only show places that have at least one image
HAVING COUNT(pi.id) > 0

ORDER BY MAX(ma.width) DESC NULLS LAST, p.featured DESC

LIMIT 40;
