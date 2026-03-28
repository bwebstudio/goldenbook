-- =========================================================
-- BACKFILL: auto-create brands for places that share a name
-- =========================================================
-- Strategy: group published places by normalised name
-- (lowercase + trim). Any group with 2+ members gets a brand.
-- Single-location places are left with brand_id = NULL.
--
-- HOW TO RUN:
--   1. Run the DRY-RUN block first to review what will be grouped.
--   2. Adjust exclusions if any false matches appear.
--   3. Run the BACKFILL block inside a transaction.
--
-- This script is idempotent: re-running it will not create
-- duplicate brands (ON CONFLICT DO NOTHING) and will only
-- update places that still have brand_id IS NULL.
-- =========================================================


-- ── STEP 0: DRY-RUN (review before committing) ───────────
/*
SELECT
  lower(trim(name))                          AS normalised_name,
  count(*)                                   AS place_count,
  array_agg(slug || ' (' || d.slug || ')'
            ORDER BY p.created_at)           AS places
FROM places p
JOIN destinations d ON d.id = p.destination_id
WHERE p.status = 'published'
GROUP BY lower(trim(name))
HAVING count(*) > 1
ORDER BY count(*) DESC;
*/


-- ── STEP 1: create brand records ─────────────────────────
--
-- Slug: lowercase name → replace any non-alphanumeric run with '-'
-- If a slug collision occurs (two different names map to the same
-- slug) the second INSERT is skipped; resolve manually afterwards.
--
INSERT INTO brands (slug, name)
SELECT
  regexp_replace(
    lower(trim(canonical_name)),
    '[^a-z0-9]+', '-', 'g'
  )                     AS slug,
  canonical_name        AS name
FROM (
  SELECT
    min(name) AS canonical_name        -- picks one spelling to use
  FROM places
  WHERE status = 'published'
  GROUP BY lower(trim(name))
  HAVING count(*) > 1
) grouped
ON CONFLICT (slug) DO NOTHING;


-- ── STEP 2: link places to their brand ───────────────────
--
-- Only touches rows where brand_id IS NULL so this is safe
-- to re-run after manual edits.
--
UPDATE places p
SET    brand_id = b.id
FROM   brands b
WHERE  lower(trim(p.name)) = lower(trim(b.name))
  AND  p.brand_id IS NULL;


-- ── STEP 3: verification ─────────────────────────────────
/*
-- Check brands created
SELECT b.name, count(p.id) AS place_count
FROM brands b
JOIN places p ON p.brand_id = b.id
GROUP BY b.name
ORDER BY count(p.id) DESC;

-- Check any places still without brand that share a name
SELECT lower(trim(name)) AS normalised_name, count(*)
FROM places
WHERE status = 'published'
  AND brand_id IS NULL
GROUP BY lower(trim(name))
HAVING count(*) > 1;
*/
