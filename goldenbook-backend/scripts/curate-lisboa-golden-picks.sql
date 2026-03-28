-- ─── Lisboa Golden Picks Curation ────────────────────────────────────────────
-- Removes Marlene Vieira and Confeitaria Nacional from the Lisboa editors_picks
-- collection. Keeps the 3 strongest editorial picks:
--   1. FUNDAÇÃO AMÁLIA RODRIGUES  (culture / activities)
--   2. PALÁCIO BIESTER            (culture)
--   3. SÁLA                       (gastronomy)
--
-- Run against Supabase DB with: psql $DATABASE_URL -f curate-lisboa-golden-picks.sql

BEGIN;

-- Identify the Lisboa editors_picks collection
WITH lisboa_picks AS (
  SELECT ec.id AS collection_id
  FROM   editorial_collections ec
  JOIN   destinations d ON d.id = ec.destination_id
  WHERE  d.slug = 'lisboa'
    AND  ec.collection_type = 'editors_picks'
    AND  ec.is_active = true
  LIMIT  1
)
DELETE FROM editorial_collection_items eci
USING lisboa_picks lp
WHERE eci.collection_id = lp.collection_id
  AND eci.place_id IN (
    SELECT p.id
    FROM   places p
    WHERE  LOWER(p.name) IN ('marlene vieira', 'confeitaria nacional')
       OR  p.slug        IN ('marlene-vieira', 'confeitaria-nacional')
  );

-- Confirm remaining picks
SELECT eci.sort_order, p.name, p.slug
FROM   editorial_collection_items eci
JOIN   places p ON p.id = eci.place_id
JOIN   editorial_collections ec ON ec.id = eci.collection_id
JOIN   destinations d ON d.id = ec.destination_id
WHERE  d.slug = 'lisboa'
  AND  ec.collection_type = 'editors_picks'
ORDER  BY eci.sort_order;

COMMIT;
