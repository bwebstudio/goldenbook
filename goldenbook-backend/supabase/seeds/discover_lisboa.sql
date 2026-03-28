-- ============================================================
-- GOLDENBOOK — DISCOVER SEED — LISBOA
-- ============================================================
-- Schema: migrations/20260312160641 + 20260312175941
-- Target: populates Editorial Hero, Editor's Picks, Hidden Spots
--         and Golden Routes for the Lisboa Discover screen.
--
-- Run order:
--   PHASE 0 — Inspect  (run first, read-only)
--   PHASE 1 — Seed     (the DO $$ block)
--   PHASE 2 — Verify   (run after seeding to confirm)
-- ============================================================


-- ============================================================
-- PHASE 0 — INSPECT
-- Run these SELECT statements before executing the seed to
-- understand the current state of the database.
-- ============================================================

-- 0a. Confirm Lisboa destination exists
SELECT id, slug, name, destination_type, is_active
FROM   destinations
WHERE  slug = 'lisboa';

-- 0b. All Lisboa places — status, images, quality indicators
SELECT
  p.id,
  p.slug,
  p.name,
  p.status,
  p.place_type,
  p.featured,
  p.price_tier,
  COUNT(pi.id) AS image_count
FROM   places p
JOIN   destinations d ON d.id = p.destination_id AND d.slug = 'lisboa'
LEFT   JOIN place_images pi ON pi.place_id = p.id
GROUP  BY p.id, p.slug, p.name, p.status, p.place_type, p.featured, p.price_tier
ORDER  BY p.featured DESC, image_count DESC, p.name
LIMIT  40;

-- 0c. Current editorial collections (should be empty before first seed)
SELECT id, slug, title, collection_type, is_active, destination_id
FROM   editorial_collections
ORDER  BY collection_type, created_at;

-- 0d. Current Lisboa routes
SELECT r.id, r.slug, r.title, r.status, r.route_type, r.featured
FROM   routes r
JOIN   destinations d ON d.id = r.destination_id AND d.slug = 'lisboa';


-- ============================================================
-- PHASE 1 — SEED
-- Idempotent: safe to run multiple times (UPSERT / ON CONFLICT).
-- ============================================================

DO $$
DECLARE
  -- ── Destination ───────────────────────────────────────────
  v_dest_id        uuid;

  -- ── Named place lookups (NULL when not found) ────────────
  v_xerjoff_id     uuid;   -- Xerjoff (fragrance boutique)
  v_david_rosas_id uuid;   -- David Rosas (jeweller)
  v_fc_women_id    uuid;   -- Fashion Clinic Women
  v_fc_men_id      uuid;   -- Fashion Clinic Men
  v_embassy_id     uuid;   -- Embassy (fashion/lifestyle)
  v_amalia_id      uuid;   -- Fundação Amália Rodrigues
  v_elements_id    uuid;   -- Elements 75'80
  v_barbour_id     uuid;   -- Barbour

  -- ── Ordered fallback pool (best Lisboa places) ───────────
  v_pool           uuid[];

  -- ── Final 8 place slots across all sections ──────────────
  -- slot[1] → hero  + picks[1] + route1_stop1
  -- slot[2] → picks[2] + route1_stop2
  -- slot[3] → picks[3] + route1_stop3
  -- slot[4] → picks[4]
  -- slot[5] → hidden[1]
  -- slot[6] → hidden[2] + route2_stop1
  -- slot[7] → hidden[3] + route2_stop2
  -- slot[8] → hidden[4] + route2_stop3
  v_s              uuid[];

  -- ── Editorial collection IDs ──────────────────────────────
  v_hero_coll_id   uuid;
  v_picks_coll_id  uuid;
  v_hidden_coll_id uuid;
  v_routes_coll_id uuid;

  -- ── Route IDs ─────────────────────────────────────────────
  v_route1_id      uuid;
  v_route2_id      uuid;

  -- ── Cover assets for routes (pulled from place images) ───
  v_cover1_id      uuid;
  v_cover2_id      uuid;

  -- ── Helpers ───────────────────────────────────────────────
  i                int;
  v_pool_size      int;

BEGIN
  v_s := ARRAY[NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL]::uuid[];

  -- ────────────────────────────────────────────────────────────
  -- 1. FIND LISBOA
  -- ────────────────────────────────────────────────────────────
  SELECT id INTO v_dest_id FROM destinations WHERE slug = 'lisboa';
  IF v_dest_id IS NULL THEN
    RAISE EXCEPTION '[Seed] Lisboa destination (slug=''lisboa'') not found. Aborting.';
  END IF;
  RAISE NOTICE '[Seed] Lisboa destination_id = %', v_dest_id;

  -- ────────────────────────────────────────────────────────────
  -- 2. LOOK UP NAMED PLACES (case-insensitive, tolerant)
  -- ────────────────────────────────────────────────────────────
  SELECT id INTO v_xerjoff_id
    FROM places
    WHERE destination_id = v_dest_id AND name ILIKE '%xerjoff%'
    LIMIT 1;

  SELECT id INTO v_david_rosas_id
    FROM places
    WHERE destination_id = v_dest_id AND name ILIKE '%david rosas%'
    LIMIT 1;

  SELECT id INTO v_fc_women_id
    FROM places
    WHERE destination_id = v_dest_id
      AND name ILIKE '%fashion clinic%'
      AND (
        name ILIKE '%women%' OR name ILIKE '%woman%'
        OR name ILIKE '%fem%'  OR name ILIKE '%mulher%'
        OR name ILIKE '%ladies%'
      )
    LIMIT 1;

  SELECT id INTO v_fc_men_id
    FROM places
    WHERE destination_id = v_dest_id
      AND name ILIKE '%fashion clinic%'
      AND id IS DISTINCT FROM v_fc_women_id
    LIMIT 1;

  -- If no gendered Fashion Clinic variant found, use any Fashion Clinic
  IF v_fc_women_id IS NULL AND v_fc_men_id IS NULL THEN
    SELECT id INTO v_fc_women_id
      FROM places
      WHERE destination_id = v_dest_id AND name ILIKE '%fashion clinic%'
      LIMIT 1;
  END IF;

  SELECT id INTO v_embassy_id
    FROM places
    WHERE destination_id = v_dest_id AND name ILIKE '%embassy%'
    LIMIT 1;

  SELECT id INTO v_amalia_id
    FROM places
    WHERE destination_id = v_dest_id
      AND (name ILIKE '%amália%' OR name ILIKE '%amalia%' OR slug ILIKE '%amalia%')
    LIMIT 1;

  SELECT id INTO v_elements_id
    FROM places
    WHERE destination_id = v_dest_id
      AND (name ILIKE '%elements%' OR slug ILIKE '%elements%')
    LIMIT 1;

  SELECT id INTO v_barbour_id
    FROM places
    WHERE destination_id = v_dest_id AND name ILIKE '%barbour%'
    LIMIT 1;

  RAISE NOTICE '[Seed] Named places found:';
  RAISE NOTICE '  xerjoff=%',      v_xerjoff_id;
  RAISE NOTICE '  david_rosas=%',  v_david_rosas_id;
  RAISE NOTICE '  fc_women=%',     v_fc_women_id;
  RAISE NOTICE '  fc_men=%',       v_fc_men_id;
  RAISE NOTICE '  embassy=%',      v_embassy_id;
  RAISE NOTICE '  amalia=%',       v_amalia_id;
  RAISE NOTICE '  elements=%',     v_elements_id;
  RAISE NOTICE '  barbour=%',      v_barbour_id;

  -- ────────────────────────────────────────────────────────────
  -- 3. FALLBACK POOL
  -- Best Lisboa places ordered by featured > image count > price_tier
  -- Published preferred; falls back to any status if pool is empty.
  -- ─────────────────────��──────────────────────────────────────
  SELECT array_agg(sub.id ORDER BY sub.featured DESC, sub.img_cnt DESC, sub.price_tier DESC NULLS LAST, sub.created_at ASC)
  INTO v_pool
  FROM (
    SELECT
      p.id, p.featured, p.created_at, p.price_tier,
      COUNT(pi.id) AS img_cnt
    FROM   places p
    LEFT   JOIN place_images pi ON pi.place_id = p.id
    WHERE  p.destination_id = v_dest_id
      AND  p.status = 'published'
    GROUP  BY p.id, p.featured, p.created_at, p.price_tier
    LIMIT  20
  ) sub;

  -- If no published places, try any status
  IF v_pool IS NULL OR array_length(v_pool, 1) = 0 THEN
    RAISE NOTICE '[Seed] No published places found — falling back to all statuses.';
    SELECT array_agg(id ORDER BY featured DESC, created_at ASC)
    INTO v_pool
    FROM places
    WHERE destination_id = v_dest_id
    LIMIT 20;
  END IF;

  IF v_pool IS NULL OR array_length(v_pool, 1) = 0 THEN
    RAISE EXCEPTION '[Seed] No places found in Lisboa at all. Cannot seed editorial content.';
  END IF;

  v_pool_size := array_length(v_pool, 1);
  RAISE NOTICE '[Seed] Fallback pool: % places', v_pool_size;

  -- ────────────────────────────────────────────────────────────
  -- 4. ASSIGN FINAL SLOTS
  --    Priority: named place → fallback pool position
  --    If pool is smaller than 8 entries, wrap around using modulo.
  -- ────────────────────────────────────────────────────────────
  v_s[1] := COALESCE(v_xerjoff_id,     v_pool[1]);
  v_s[2] := COALESCE(v_david_rosas_id, v_pool[least(2, v_pool_size)]);
  v_s[3] := COALESCE(v_fc_women_id,    v_pool[least(3, v_pool_size)]);
  v_s[4] := COALESCE(v_fc_men_id,      v_embassy_id, v_pool[least(4, v_pool_size)]);
  v_s[5] := COALESCE(v_embassy_id,     v_pool[least(5, v_pool_size)]);
  v_s[6] := COALESCE(v_amalia_id,      v_pool[least(6, v_pool_size)]);
  v_s[7] := COALESCE(v_elements_id,    v_pool[least(7, v_pool_size)]);
  v_s[8] := COALESCE(v_barbour_id,     v_pool[least(8, v_pool_size)]);

  -- Safety: ensure no slot is NULL (use pool[1] as last resort)
  FOR i IN 1..8 LOOP
    IF v_s[i] IS NULL THEN
      v_s[i] := v_pool[1];
      RAISE NOTICE '[Seed] Slot % is NULL — using pool[1] as fallback', i;
    END IF;
  END LOOP;

  RAISE NOTICE '[Seed] Slot assignments: %', v_s;

  -- ────────────────────────────────────────────────────────────
  -- 5. PUBLISH ASSIGNED PLACES
  -- The backend queries filter on places.status = 'published'.
  -- Ensure all 8 slots are published so they appear on Discover.
  -- (Does not touch archived places.)
  -- ────────────────────────────────────────────────────────────
  UPDATE places
  SET
    status       = 'published',
    published_at = COALESCE(published_at, now()),
    updated_at   = now()
  WHERE id = ANY(v_s)
    AND status != 'archived';

  RAISE NOTICE '[Seed] Ensured % places are published', array_length(v_s, 1);

  -- ────────────────────────────────────────────────────────────
  -- 6. EDITORIAL COLLECTIONS (UPSERT)
  --    NOTE: the editorial hero returns ec.title as the displayed
  --    text on the hero card — keep it editorial/inviting.
  -- ────────────────────────────────────────────────────────────

  -- Hero Candidates
  INSERT INTO editorial_collections
    (id, slug, title, collection_type, destination_id, is_active, created_at, updated_at)
  VALUES
    (gen_random_uuid(), 'hero-candidates-lisboa',
     'The Finest Addresses in Lisbon',
     'hero_candidates', v_dest_id, true, now(), now())
  ON CONFLICT (slug) DO UPDATE
    SET title          = EXCLUDED.title,
        destination_id = EXCLUDED.destination_id,
        is_active      = true,
        updated_at     = now()
  RETURNING id INTO v_hero_coll_id;

  IF v_hero_coll_id IS NULL THEN
    SELECT id INTO v_hero_coll_id
    FROM editorial_collections WHERE slug = 'hero-candidates-lisboa';
  END IF;

  -- Editor's Picks
  INSERT INTO editorial_collections
    (id, slug, title, collection_type, destination_id, is_active, created_at, updated_at)
  VALUES
    (gen_random_uuid(), 'editors-picks-lisboa',
     'Editor''s Picks — Lisboa',
     'editors_picks', v_dest_id, true, now(), now())
  ON CONFLICT (slug) DO UPDATE
    SET title          = EXCLUDED.title,
        destination_id = EXCLUDED.destination_id,
        is_active      = true,
        updated_at     = now()
  RETURNING id INTO v_picks_coll_id;

  IF v_picks_coll_id IS NULL THEN
    SELECT id INTO v_picks_coll_id
    FROM editorial_collections WHERE slug = 'editors-picks-lisboa';
  END IF;

  -- Hidden Spots
  INSERT INTO editorial_collections
    (id, slug, title, collection_type, destination_id, is_active, created_at, updated_at)
  VALUES
    (gen_random_uuid(), 'hidden-spots-lisboa',
     'Hidden Spots — Lisboa',
     'hidden_spots', v_dest_id, true, now(), now())
  ON CONFLICT (slug) DO UPDATE
    SET title          = EXCLUDED.title,
        destination_id = EXCLUDED.destination_id,
        is_active      = true,
        updated_at     = now()
  RETURNING id INTO v_hidden_coll_id;

  IF v_hidden_coll_id IS NULL THEN
    SELECT id INTO v_hidden_coll_id
    FROM editorial_collections WHERE slug = 'hidden-spots-lisboa';
  END IF;

  -- Golden Routes (custom — used as a curated list; getGoldenRoutes
  -- queries routes directly so this collection is supplementary)
  INSERT INTO editorial_collections
    (id, slug, title, collection_type, destination_id, is_active, created_at, updated_at)
  VALUES
    (gen_random_uuid(), 'golden-routes-lisboa',
     'Golden Routes — Lisboa',
     'custom', v_dest_id, true, now(), now())
  ON CONFLICT (slug) DO UPDATE
    SET title          = EXCLUDED.title,
        destination_id = EXCLUDED.destination_id,
        is_active      = true,
        updated_at     = now()
  RETURNING id INTO v_routes_coll_id;

  IF v_routes_coll_id IS NULL THEN
    SELECT id INTO v_routes_coll_id
    FROM editorial_collections WHERE slug = 'golden-routes-lisboa';
  END IF;

  RAISE NOTICE '[Seed] Collections: hero=%, picks=%, hidden=%, routes=%',
    v_hero_coll_id, v_picks_coll_id, v_hidden_coll_id, v_routes_coll_id;

  -- ────────────────────────────────────────────────────────────
  -- 7. EDITORIAL COLLECTION ITEMS
  --    Partial unique indexes:
  --      uq_editorial_collection_items_place  (collection_id, place_id) WHERE place_id IS NOT NULL
  --      uq_editorial_collection_items_route  (collection_id, route_id) WHERE route_id IS NOT NULL
  -- ────────────────────────────────────────────────────────────

  -- Hero (1 place: slot[1] = Xerjoff or best available)
  INSERT INTO editorial_collection_items (collection_id, place_id, sort_order, created_at)
  VALUES (v_hero_coll_id, v_s[1], 0, now())
  ON CONFLICT (collection_id, place_id) WHERE place_id IS NOT NULL DO NOTHING;

  -- Editor's Picks (4 places: slots 1–4)
  FOR i IN 1..4 LOOP
    INSERT INTO editorial_collection_items (collection_id, place_id, sort_order, created_at)
    VALUES (v_picks_coll_id, v_s[i], i - 1, now())
    ON CONFLICT (collection_id, place_id) WHERE place_id IS NOT NULL DO NOTHING;
  END LOOP;

  -- Hidden Spots (4 places: slots 5–8)
  FOR i IN 5..8 LOOP
    INSERT INTO editorial_collection_items (collection_id, place_id, sort_order, created_at)
    VALUES (v_hidden_coll_id, v_s[i], i - 5, now())
    ON CONFLICT (collection_id, place_id) WHERE place_id IS NOT NULL DO NOTHING;
  END LOOP;

  -- ────────────────────────────────────────────────────────────
  -- 8. COVER ASSETS FOR ROUTES
  --    Route 1 cover: from slot[1] (Xerjoff / best place)
  --    Route 2 cover: from slot[6] (Amália / cultural place)
  --    Preference: hero > cover > any image
  -- ────────────────────────────────────────────────────────────
  SELECT ma.id INTO v_cover1_id
  FROM   place_images pi
  JOIN   media_assets ma ON ma.id = pi.asset_id
  WHERE  pi.place_id = v_s[1]
    AND  pi.image_role IN ('hero', 'cover')
  ORDER  BY (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC
  LIMIT  1;

  IF v_cover1_id IS NULL THEN
    SELECT ma.id INTO v_cover1_id
    FROM   place_images pi
    JOIN   media_assets ma ON ma.id = pi.asset_id
    WHERE  pi.place_id = v_s[1]
    ORDER  BY pi.sort_order ASC
    LIMIT  1;
  END IF;

  SELECT ma.id INTO v_cover2_id
  FROM   place_images pi
  JOIN   media_assets ma ON ma.id = pi.asset_id
  WHERE  pi.place_id = v_s[6]
    AND  pi.image_role IN ('hero', 'cover')
  ORDER  BY (pi.image_role = 'hero') DESC, pi.is_primary DESC, pi.sort_order ASC
  LIMIT  1;

  IF v_cover2_id IS NULL THEN
    SELECT ma.id INTO v_cover2_id
    FROM   place_images pi
    JOIN   media_assets ma ON ma.id = pi.asset_id
    WHERE  pi.place_id = v_s[6]
    ORDER  BY pi.sort_order ASC
    LIMIT  1;
  END IF;

  RAISE NOTICE '[Seed] Route covers: route1_cover=%, route2_cover=%', v_cover1_id, v_cover2_id;

  -- ────────────────────────────────────────────────────────────
  -- 9. ROUTES (UPSERT)
  --    route_type CHECK: 'walking','day_plan','weekend','food_route','editor_pick','other'
  --    Column: estimated_duration_minutes (NOT estimated_minutes)
  --    routes.title is NOT NULL (fallback for getGoldenRoutes COALESCE)
  --    getGoldenRoutes queries routes directly — no collection link needed.
  -- ────────────────────────────────────────────────────────────

  -- Route 1: Lisbon Luxury Icons
  INSERT INTO routes
    (id, destination_id, slug, status, route_type, title, summary,
     cover_asset_id, featured, estimated_duration_minutes, published_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_dest_id,
     'lisbon-luxury-icons', 'published', 'editor_pick',
     'Lisbon Luxury Icons',
     'A curated journey through the finest luxury addresses in Lisbon.',
     v_cover1_id, true, 150, now(), now(), now())
  ON CONFLICT (slug) DO UPDATE
    SET destination_id             = EXCLUDED.destination_id,
        status                     = 'published',
        title                      = EXCLUDED.title,
        summary                    = EXCLUDED.summary,
        cover_asset_id             = COALESCE(EXCLUDED.cover_asset_id, routes.cover_asset_id),
        featured                   = true,
        estimated_duration_minutes = EXCLUDED.estimated_duration_minutes,
        published_at               = COALESCE(routes.published_at, now()),
        updated_at                 = now()
  RETURNING id INTO v_route1_id;

  IF v_route1_id IS NULL THEN
    SELECT id INTO v_route1_id FROM routes WHERE slug = 'lisbon-luxury-icons';
  END IF;

  -- Route 2: A Quiet Lisbon Afternoon
  INSERT INTO routes
    (id, destination_id, slug, status, route_type, title, summary,
     cover_asset_id, featured, estimated_duration_minutes, published_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_dest_id,
     'quiet-lisbon-afternoon', 'published', 'day_plan',
     'A Quiet Lisbon Afternoon',
     'Slow down and discover the cultural soul of Lisboa, one unhurried stop at a time.',
     v_cover2_id, true, 180, now(), now(), now())
  ON CONFLICT (slug) DO UPDATE
    SET destination_id             = EXCLUDED.destination_id,
        status                     = 'published',
        title                      = EXCLUDED.title,
        summary                    = EXCLUDED.summary,
        cover_asset_id             = COALESCE(EXCLUDED.cover_asset_id, routes.cover_asset_id),
        featured                   = true,
        estimated_duration_minutes = EXCLUDED.estimated_duration_minutes,
        published_at               = COALESCE(routes.published_at, now()),
        updated_at                 = now()
  RETURNING id INTO v_route2_id;

  IF v_route2_id IS NULL THEN
    SELECT id INTO v_route2_id FROM routes WHERE slug = 'quiet-lisbon-afternoon';
  END IF;

  RAISE NOTICE '[Seed] Routes: route1=%, route2=%', v_route1_id, v_route2_id;

  -- ────────────────────────────────────────────────────────────
  -- 10. ROUTE TRANSLATIONS (UPSERT)
  -- ────────────────────────────────────────────────────────────

  -- Route 1 — EN
  INSERT INTO route_translations (id, route_id, locale, title, summary, body, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_route1_id, 'en',
    'Lisbon Luxury Icons',
    'A curated journey through the finest luxury addresses in Lisbon.',
    'Some cities have a handful of luxury addresses. Lisbon has a constellation. '
    'This route threads together the most coveted boutiques and ateliers in the city — '
    'from rare fragrance houses to jewellers with decades of Portuguese craft behind them. '
    'Allow two and a half hours. Move slowly. '
    'This is not shopping — it is an education in taste.',
    now(), now()
  )
  ON CONFLICT (route_id, locale) DO UPDATE
    SET title      = EXCLUDED.title,
        summary    = EXCLUDED.summary,
        body       = EXCLUDED.body,
        updated_at = now();

  -- Route 1 — PT
  INSERT INTO route_translations (id, route_id, locale, title, summary, body, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_route1_id, 'pt',
    'Ícones de Luxo de Lisboa',
    'Uma jornada curada pelos endereços de luxo mais refinados de Lisboa.',
    'Algumas cidades têm alguns endereços de luxo. Lisboa tem uma constelação. '
    'Esta rota une as boutiques e ateliers mais cobiçados da cidade — '
    'desde casas de fragrâncias raras a joalheiros com décadas de artesanato português. '
    'Reserve duas horas e meia. Mova-se devagar. '
    'Isto não é compras — é uma educação no bom gosto.',
    now(), now()
  )
  ON CONFLICT (route_id, locale) DO UPDATE
    SET title      = EXCLUDED.title,
        summary    = EXCLUDED.summary,
        body       = EXCLUDED.body,
        updated_at = now();

  -- Route 2 — EN
  INSERT INTO route_translations (id, route_id, locale, title, summary, body, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_route2_id, 'en',
    'A Quiet Lisbon Afternoon',
    'Slow down and discover the cultural soul of Lisboa, one unhurried stop at a time.',
    'Not every afternoon in Lisbon should be rushed. '
    'This route is for the hours when the light turns golden and the city exhales. '
    'Begin at a foundation that keeps a legend''s memory alive, '
    'continue to a space where decades of design converge, '
    'and finish somewhere that feels exactly like the city you came to find. '
    'Three stops. Three hours. No agenda beyond presence.',
    now(), now()
  )
  ON CONFLICT (route_id, locale) DO UPDATE
    SET title      = EXCLUDED.title,
        summary    = EXCLUDED.summary,
        body       = EXCLUDED.body,
        updated_at = now();

  -- Route 2 — PT
  INSERT INTO route_translations (id, route_id, locale, title, summary, body, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_route2_id, 'pt',
    'Uma Tarde Tranquila em Lisboa',
    'Abrande e descubra a alma cultural de Lisboa, uma paragem sem pressa de cada vez.',
    'Nem todas as tardes em Lisboa devem ser apressadas. '
    'Esta rota é para as horas em que a luz fica dourada e a cidade respira fundo. '
    'Comece numa fundação que mantém viva a memória de uma lenda, '
    'continue para um espaço onde décadas de design convergem, '
    'e termine algures que parece exatamente com a cidade que veio encontrar. '
    'Três paragens. Três horas. Sem agenda além da presença.',
    now(), now()
  )
  ON CONFLICT (route_id, locale) DO UPDATE
    SET title      = EXCLUDED.title,
        summary    = EXCLUDED.summary,
        body       = EXCLUDED.body,
        updated_at = now();

  -- ────────────────────────────────────────────────────────────
  -- 11. ROUTE PLACES
  --    Route 1: slots 1, 2, 3 (luxury: Xerjoff / David Rosas / FC)
  --    Route 2: slots 6, 7, 8 (cultural: Amália / Elements / Barbour)
  --    UNIQUE constraint on (route_id, place_id) — use ON CONFLICT DO NOTHING.
  -- ────────────────────────────────────────────────────────────

  -- Route 1 stops
  INSERT INTO route_places (route_id, place_id, sort_order, note, stay_minutes, created_at)
  VALUES
    (v_route1_id, v_s[1], 0,
     'Begin here — rare fragrance in a city that understands refinement.',
     40, now()),
    (v_route1_id, v_s[2], 1,
     'The finest jewellery in the city, with a heritage that speaks for itself.',
     35, now()),
    (v_route1_id, v_s[3], 2,
     'Luxury fashion, curated with the precision that defines Lisbon style.',
     35, now())
  ON CONFLICT (route_id, place_id) DO NOTHING;

  -- Route 2 stops
  INSERT INTO route_places (route_id, place_id, sort_order, note, stay_minutes, created_at)
  VALUES
    (v_route2_id, v_s[6], 0,
     'Where fado found its voice — begin where the city''s soul is kept.',
     60, now()),
    (v_route2_id, v_s[7], 1,
     'Decades of curated design converge in one intimate, unhurried space.',
     50, now()),
    (v_route2_id, v_s[8], 2,
     'Enduring craft, perfectly at home in a city that values what lasts.',
     45, now())
  ON CONFLICT (route_id, place_id) DO NOTHING;

  -- ────────────────────────────────────────────────────────────
  -- 12. LINK ROUTES TO GOLDEN ROUTES COLLECTION
  --    getGoldenRoutes() queries routes directly and does NOT use
  --    editorial_collection_items. This link is supplementary —
  --    kept for future editorial tooling.
  -- ────────────────────────────────────────────────────────────
  INSERT INTO editorial_collection_items (collection_id, route_id, sort_order, created_at)
  VALUES
    (v_routes_coll_id, v_route1_id, 0, now()),
    (v_routes_coll_id, v_route2_id, 1, now())
  ON CONFLICT (collection_id, route_id) WHERE route_id IS NOT NULL DO NOTHING;

  -- ────────────────────────────────────────────────────────────
  -- DONE
  -- ────────────────────────────────────────────────────────────
  RAISE NOTICE '──────────────────────────────────────────────';
  RAISE NOTICE '[Seed] Goldenbook Lisboa Discover seed complete!';
  RAISE NOTICE '  hero_collection_id   = %', v_hero_coll_id;
  RAISE NOTICE '  picks_collection_id  = %', v_picks_coll_id;
  RAISE NOTICE '  hidden_collection_id = %', v_hidden_coll_id;
  RAISE NOTICE '  routes_collection_id = %', v_routes_coll_id;
  RAISE NOTICE '  route1_id (luxury)   = %', v_route1_id;
  RAISE NOTICE '  route2_id (cultural) = %', v_route2_id;
  RAISE NOTICE '──────────────────────────────────────────────';
END;
$$;


-- ============================================================
-- PHASE 2 — VERIFY
-- Run these after the seed to confirm everything is correct.
-- ============================================================

-- V1. Editorial collections created
SELECT
  id,
  slug,
  title,
  collection_type,
  is_active,
  destination_id
FROM editorial_collections
ORDER BY collection_type, created_at;

-- V2. Collection items with place / route details
SELECT
  ec.slug                   AS collection,
  ec.collection_type,
  eci.sort_order,
  p.name                    AS place_name,
  p.status                  AS place_status,
  p.place_type,
  (
    SELECT COUNT(*) FROM place_images pi WHERE pi.place_id = p.id
  )                         AS images,
  r.title                   AS route_title,
  r.status                  AS route_status
FROM   editorial_collection_items eci
JOIN   editorial_collections ec  ON ec.id  = eci.collection_id
LEFT   JOIN places p             ON p.id   = eci.place_id
LEFT   JOIN routes r             ON r.id   = eci.route_id
JOIN   destinations d            ON d.id   = ec.destination_id AND d.slug = 'lisboa'
ORDER  BY ec.collection_type, eci.sort_order;

-- V3. Routes summary
SELECT
  r.id,
  r.slug,
  r.title,
  r.status,
  r.route_type,
  r.featured,
  r.estimated_duration_minutes,
  r.cover_asset_id,
  COUNT(rp.place_id)::int AS places_count
FROM   routes r
JOIN   destinations d ON d.id = r.destination_id AND d.slug = 'lisboa'
LEFT   JOIN route_places rp ON rp.route_id = r.id
GROUP  BY r.id, r.slug, r.title, r.status, r.route_type, r.featured,
          r.estimated_duration_minutes, r.cover_asset_id;

-- V4. Route stops detail
SELECT
  r.slug            AS route,
  rp.sort_order,
  p.name            AS place,
  p.status          AS place_status,
  rp.stay_minutes,
  LEFT(rp.note, 60) AS note_preview
FROM   route_places rp
JOIN   routes r    ON r.id  = rp.route_id
JOIN   places p    ON p.id  = rp.place_id
JOIN   destinations d ON d.id = r.destination_id AND d.slug = 'lisboa'
ORDER  BY r.slug, rp.sort_order;

-- V5. Route translations
SELECT
  r.slug,
  rt.locale,
  rt.title,
  LEFT(rt.summary, 80) AS summary_preview,
  CASE WHEN rt.body IS NOT NULL THEN 'yes' ELSE 'no' END AS has_body
FROM   route_translations rt
JOIN   routes r       ON r.id = rt.route_id
JOIN   destinations d ON d.id = r.destination_id AND d.slug = 'lisboa'
ORDER  BY r.slug, rt.locale;

-- V6. Quick sanity — Discover sections are populated
-- (mirrors what the four backend functions return)
SELECT 'hero_candidates'        AS section, COUNT(*) AS items
  FROM editorial_collection_items eci
  JOIN editorial_collections ec ON ec.id = eci.collection_id
  JOIN destinations d ON d.id = ec.destination_id AND d.slug = 'lisboa'
  WHERE ec.collection_type = 'hero_candidates' AND ec.is_active = true
UNION ALL
SELECT 'editors_picks',         COUNT(*)
  FROM editorial_collection_items eci
  JOIN editorial_collections ec ON ec.id = eci.collection_id
  JOIN destinations d ON d.id = ec.destination_id AND d.slug = 'lisboa'
  WHERE ec.collection_type = 'editors_picks' AND ec.is_active = true
UNION ALL
SELECT 'hidden_spots',          COUNT(*)
  FROM editorial_collection_items eci
  JOIN editorial_collections ec ON ec.id = eci.collection_id
  JOIN destinations d ON d.id = ec.destination_id AND d.slug = 'lisboa'
  WHERE ec.collection_type = 'hidden_spots' AND ec.is_active = true
UNION ALL
SELECT 'golden_routes',         COUNT(*)
  FROM routes r
  JOIN destinations d ON d.id = r.destination_id AND d.slug = 'lisboa'
  WHERE r.status = 'published';

  select slug, status, route_type, featured
from routes
where slug in ('lisbon-luxury-icons', 'quiet-lisbon-afternoon');