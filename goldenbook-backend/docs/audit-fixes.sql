-- ════════════════════════════════════════════════════════════
-- NOW + Concierge Stabilization SQL Patch
-- Generated: 2026-04-10T18:32:41.475Z
-- Places analyzed: 324
-- Places needing update: 324
--
-- Idempotent: safe to re-run. Tags are additive, time windows
-- are deterministically replaced from the final tag set.
-- ════════════════════════════════════════════════════════════

BEGIN;

-- ─── Step 1: Ensure canonical 24th tag exists ─────────────────
INSERT INTO now_context_tags (slug, name, description)
VALUES ('nature', 'Nature', 'Outdoor / scenic / nature places — viewpoints, gardens, beaches, parks')
ON CONFLICT (slug) DO NOTHING;

-- ─── Step 2: Per-place tag additions + window replacement ────
-- Tags: ADDITIVE only (we never delete editorial tags). Invalid
-- tags outside the canonical 24 are removed below.
-- Windows: REPLACED from the deterministic eligibility matrix.

-- A LAGOSTEIRA  [algarve]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'a-lagosteira-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'a-lagosteira-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'a-lagosteira-algarve';

-- ÀCOSTA BY OLIVIER  [algarve]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'acosta-by-olivier-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'acosta-by-olivier-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'acosta-by-olivier-algarve';

-- ADEGA DO CANTOR  [algarve]
-- current: [∅]  →  final: [wine, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'adega-do-cantor-algarve'
  AND t.slug = ANY(ARRAY['wine', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'adega-do-cantor-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['afternoon', 'evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'adega-do-cantor-algarve';

-- AL QUIMIA  [algarve]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'al-quimia-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'al-quimia-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'al-quimia-algarve';

-- AL SUD  [algarve]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'al-sud-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'al-sud-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'al-sud-algarve';

-- Algar Seco  [algarve]
-- current: [viewpoint]  →  final: [viewpoint, nature]
-- issues: ONLY_ONE_TAG
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'algar-seco-algarve'
  AND t.slug = ANY(ARRAY['nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'algar-seco-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'deep_night'])
FROM places WHERE slug = 'algar-seco-algarve';

-- AMARA RESTAURANT  [algarve]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'amara-restaurant-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'amara-restaurant-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'amara-restaurant-algarve';

-- AMENDOEIRA GOLF RESORT  [algarve]
-- current: [∅]  →  final: [wellness, romantic, family]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'amendoeira-golf-resort-algarve'
  AND t.slug = ANY(ARRAY['wellness', 'romantic', 'family'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'amendoeira-golf-resort-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'evening'])
FROM places WHERE slug = 'amendoeira-golf-resort-algarve';

-- ATLÂNTICO  [algarve]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'atlantico-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'atlantico-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'atlantico-algarve';

-- AWAY SPA  [algarve]
-- current: [∅]  →  final: [local-secret, wellness]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'away-spa-algarve'
  AND t.slug = ANY(ARRAY['local-secret', 'wellness'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'away-spa-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning'])
FROM places WHERE slug = 'away-spa-algarve';

-- Benagil Cave  [algarve]
-- current: [culture, local-secret]  →  final: [culture, local-secret, nature, viewpoint]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'benagil-cave-algarve'
  AND t.slug = ANY(ARRAY['nature', 'viewpoint'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'benagil-cave-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'benagil-cave-algarve';

-- Cacela Velha  [algarve]
-- current: [culture, local-secret, viewpoint]  →  final: [culture, local-secret, viewpoint]
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'cacela-velha-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'cacela-velha-algarve';

-- CAFETERIA  [algarve]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'cafeteria-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'cafeteria-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'cafeteria-algarve';

-- CHURRASQUEIRA ORIQ  [algarve]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'churrasqueira-oriq-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'churrasqueira-oriq-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'churrasqueira-oriq-algarve';

-- CVA – Comissão Vitivinícola do Algarve  [algarve]
-- current: [culture, local-secret, wine]  →  final: [culture, local-secret, wine, family]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'cva-comissao-vitivinicola-do-algarve-algarve'
  AND t.slug = ANY(ARRAY['family'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'cva-comissao-vitivinicola-do-algarve-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'cva-comissao-vitivinicola-do-algarve-algarve';

-- DAVID ROSAS  [algarve]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'david-rosas-algarve'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'david-rosas-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'david-rosas-algarve';

-- ECOSUNCHARTERS  [algarve]
-- current: [∅]  →  final: [local-secret, culture, family]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'ecosuncharters-algarve'
  AND t.slug = ANY(ARRAY['local-secret', 'culture', 'family'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'ecosuncharters-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'ecosuncharters-algarve';

-- FORUM ALGARVE  [algarve]
-- current: [∅]  →  final: [shopping, family]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'forum-algarve-algarve'
  AND t.slug = ANY(ARRAY['shopping', 'family'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'forum-algarve-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'afternoon'])
FROM places WHERE slug = 'forum-algarve-algarve';

-- HILTON VILAMOURA  [algarve]
-- current: [∅]  →  final: [lunch, dinner, wellness, romantic]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'hilton-vilamoura-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner', 'wellness', 'romantic'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'hilton-vilamoura-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'hilton-vilamoura-algarve';

-- INTERFORMA  [algarve]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'interforma-algarve'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'interforma-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'interforma-algarve';

-- IRISH PUB VILAMOURA  [algarve]
-- current: [∅]  →  final: [cocktails, wine]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'irish-pub-vilamoura-algarve'
  AND t.slug = ANY(ARRAY['cocktails', 'wine'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'irish-pub-vilamoura-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['afternoon', 'evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'irish-pub-vilamoura-algarve';

-- LA CIGALE  [algarve]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'la-cigale-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'la-cigale-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'la-cigale-algarve';

-- LÁ FRAGATA  [algarve]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'la-fragata-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'la-fragata-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'la-fragata-algarve';

-- LIGHTHOUSE CARVOEIRO  [algarve]
-- current: [∅]  →  final: [lunch, dinner, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'lighthouse-carvoeiro-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'lighthouse-carvoeiro-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'lighthouse-carvoeiro-algarve';

-- MARINA COM NOÉLIA  [algarve]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'marina-com-noelia-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'marina-com-noelia-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'marina-com-noelia-algarve';

-- Miradouro da Praia da Marinha  [algarve]
-- current: [sunset, viewpoint]  →  final: [sunset, viewpoint, nature]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'miradouro-da-praia-da-marinha-algarve'
  AND t.slug = ANY(ARRAY['nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'miradouro-da-praia-da-marinha-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'deep_night'])
FROM places WHERE slug = 'miradouro-da-praia-da-marinha-algarve';

-- NATALIYA ROSO PROPERTIES  [algarve]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'nataliya-roso-properties-algarve'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'nataliya-roso-properties-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'nataliya-roso-properties-algarve';

-- O MARINHEIRO  [algarve]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'o-marinheiro-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'o-marinheiro-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'o-marinheiro-algarve';

-- OLD NAVY  [algarve]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'old-navy-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'old-navy-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'old-navy-algarve';

-- OLIVE  [algarve]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'olive-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'olive-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'olive-algarve';

-- PARRILLA NATURAL  [algarve]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'parrilla-natural-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'parrilla-natural-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'parrilla-natural-algarve';

-- Passadiços da Praia da Falésia  [algarve]
-- current: [viewpoint]  →  final: [viewpoint, nature]
-- issues: ONLY_ONE_TAG
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'passadicos-da-praia-da-falesia-algarve'
  AND t.slug = ANY(ARRAY['nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'passadicos-da-praia-da-falesia-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'deep_night'])
FROM places WHERE slug = 'passadicos-da-praia-da-falesia-algarve';

-- Passadiços de Alvor  [algarve]
-- current: [local-secret, viewpoint]  →  final: [local-secret, viewpoint, nature]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'passadicos-de-alvor-algarve'
  AND t.slug = ANY(ARRAY['nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'passadicos-de-alvor-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'deep_night'])
FROM places WHERE slug = 'passadicos-de-alvor-algarve';

-- PAULO MIRANDA JOALHEIRO  [algarve]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'paulo-miranda-joalheiro-algarve'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'paulo-miranda-joalheiro-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'paulo-miranda-joalheiro-algarve';

-- PINETREES RIDING CENTRE  [algarve]
-- current: [∅]  →  final: [local-secret, wellness, family]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'pinetrees-riding-centre-algarve'
  AND t.slug = ANY(ARRAY['local-secret', 'wellness', 'family'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'pinetrees-riding-centre-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning'])
FROM places WHERE slug = 'pinetrees-riding-centre-algarve';

-- Ponta da Piedade  [algarve]
-- current: [sunset, viewpoint]  →  final: [sunset, viewpoint, nature]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'ponta-da-piedade-algarve'
  AND t.slug = ANY(ARRAY['nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'ponta-da-piedade-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'deep_night'])
FROM places WHERE slug = 'ponta-da-piedade-algarve';

-- Praia da Marinha  [algarve]
-- current: [sunset, viewpoint]  →  final: [sunset, viewpoint, nature]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'marinha-beach-algarve'
  AND t.slug = ANY(ARRAY['nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'marinha-beach-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'deep_night'])
FROM places WHERE slug = 'marinha-beach-algarve';

-- Praia do Camilo  [algarve]
-- current: [viewpoint]  →  final: [viewpoint, nature, sunset]
-- issues: ONLY_ONE_TAG
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'praia-do-camilo-algarve'
  AND t.slug = ANY(ARRAY['nature', 'sunset'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'praia-do-camilo-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'deep_night'])
FROM places WHERE slug = 'praia-do-camilo-algarve';

-- Praia do Carvalho  [algarve]
-- current: [local-secret, viewpoint]  →  final: [local-secret, viewpoint, nature, sunset]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'praia-do-carvalho-algarve'
  AND t.slug = ANY(ARRAY['nature', 'sunset'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'praia-do-carvalho-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'deep_night'])
FROM places WHERE slug = 'praia-do-carvalho-algarve';

-- PRIMAVERA RISTORANTE TRATTORIA  [algarve]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'primavera-ristorante-trattoria-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'primavera-ristorante-trattoria-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'primavera-ristorante-trattoria-algarve';

-- PRIVATY LUXURY COLLECTION  [algarve]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'privaty-luxury-collection-algarve'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'privaty-luxury-collection-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'privaty-luxury-collection-algarve';

-- QUINTA DE FARO  [algarve]
-- current: [∅]  →  final: [shopping, wine, nature]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'quinta-de-faro-algarve'
  AND t.slug = ANY(ARRAY['shopping', 'wine', 'nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'quinta-de-faro-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'quinta-de-faro-algarve';

-- QUINTA DOS SENTIDOS  [algarve]
-- current: [∅]  →  final: [wine, local-secret, nature]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'quinta-dos-sentidos-algarve'
  AND t.slug = ANY(ARRAY['wine', 'local-secret', 'nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'quinta-dos-sentidos-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'quinta-dos-sentidos-algarve';

-- SAND CITY  [algarve]
-- current: [∅]  →  final: [nature, family, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'sand-city-algarve'
  AND t.slug = ANY(ARRAY['nature', 'family', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'sand-city-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'sand-city-algarve';

-- SENSORIAL SPA  [algarve]
-- current: [∅]  →  final: [local-secret, wellness]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'sensorial-spa-algarve'
  AND t.slug = ANY(ARRAY['local-secret', 'wellness'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'sensorial-spa-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning'])
FROM places WHERE slug = 'sensorial-spa-algarve';

-- SEVEN SPA VILAMOURA  [algarve]
-- current: [∅]  →  final: [local-secret, wellness]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'seven-spa-vilamoura-algarve'
  AND t.slug = ANY(ARRAY['local-secret', 'wellness'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'seven-spa-vilamoura-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning'])
FROM places WHERE slug = 'seven-spa-vilamoura-algarve';

-- UDDO  [algarve]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'uddo-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'uddo-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'uddo-algarve';

-- VALE DA LAPA VILLAGE RESORT  [algarve]
-- current: [∅]  →  final: [wellness, romantic]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'vale-da-lapa-village-resort-algarve'
  AND t.slug = ANY(ARRAY['wellness', 'romantic'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'vale-da-lapa-village-resort-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'evening'])
FROM places WHERE slug = 'vale-da-lapa-village-resort-algarve';

-- VILA VITA COLLECTION  [algarve]
-- current: [∅]  →  final: [wellness, romantic]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'vila-vita-collection-algarve'
  AND t.slug = ANY(ARRAY['wellness', 'romantic'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'vila-vita-collection-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'evening'])
FROM places WHERE slug = 'vila-vita-collection-algarve';

-- WELL VALE DO LOBO RESTAURANTE & BEACH CLUB  [algarve]
-- current: [∅]  →  final: [lunch, dinner, wellness, romantic]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'well-vale-do-lobo-restaurante-beach-club-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner', 'wellness', 'romantic'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'well-vale-do-lobo-restaurante-beach-club-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'well-vale-do-lobo-restaurante-beach-club-algarve';

-- WILLIE’S  [algarve]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'willies-algarve'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'willies-algarve');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'willies-algarve';

-- 5 OCEANOS  [lisboa]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = '5-oceanos-lisboa'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = '5-oceanos-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = '5-oceanos-lisboa';

-- ADEGA DO CONVENTO  [lisboa]
-- current: [∅]  →  final: [lunch, dinner, wine]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'adega-do-convento-lisboa'
  AND t.slug = ANY(ARRAY['lunch', 'dinner', 'wine'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'adega-do-convento-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'afternoon', 'evening', 'late_evening'])
FROM places WHERE slug = 'adega-do-convento-lisboa';

-- ALEXANDRA MATIAS  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'alexandra-matias-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'alexandra-matias-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'alexandra-matias-lisboa';

-- ARMAZENS DO CHIADO  [lisboa]
-- current: [∅]  →  final: [shopping, family]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'armazens-do-chiado-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'family'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'armazens-do-chiado-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'afternoon'])
FROM places WHERE slug = 'armazens-do-chiado-lisboa';

-- Arneiro 1969  [lisboa]
-- current: [culture, local-secret, shopping]  →  final: [culture, local-secret, shopping]
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'arneiro-1969-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'arneiro-1969-lisboa';

-- ARRIBAS SINTRA HOTEL  [lisboa]
-- current: [∅]  →  final: [cocktails, wine, wellness, romantic]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'arribas-sintra-hotel-lisboa'
  AND t.slug = ANY(ARRAY['cocktails', 'wine', 'wellness', 'romantic'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'arribas-sintra-hotel-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['afternoon', 'evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'arribas-sintra-hotel-lisboa';

-- BAIRRO DO AVILLEZ  [lisboa]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'bairro-do-avillez'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'bairro-do-avillez');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'bairro-do-avillez';

-- BARBOUR  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'barbour-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'barbour-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'barbour-lisboa';

-- BE WE CONCEPT  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'be-we-concept'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'be-we-concept');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'be-we-concept';

-- BETTINA CORALLO  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'bettina-corallo-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'bettina-corallo-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'bettina-corallo-lisboa';

-- BICO CULTURA DO VINHO  [lisboa]
-- current: [∅]  →  final: [cocktails, wine]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'bico-cultura-do-vinho-lisboa'
  AND t.slug = ANY(ARRAY['cocktails', 'wine'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'bico-cultura-do-vinho-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['afternoon', 'evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'bico-cultura-do-vinho-lisboa';

-- Calouste Gulbenkian Museum  [lisboa]
-- current: [culture, viewpoint]  →  final: [culture, viewpoint]
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'calouste-gulbenkian-museum-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'calouste-gulbenkian-museum-lisboa';

-- CASA DA GUIA  [lisboa]
-- current: [∅]  →  final: [cocktails, wine, shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'casa-da-guia-lisboa'
  AND t.slug = ANY(ARRAY['cocktails', 'wine', 'shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'casa-da-guia-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'afternoon'])
FROM places WHERE slug = 'casa-da-guia-lisboa';

-- CENTRO COMERCIAL COLOMBO  [lisboa]
-- current: [∅]  →  final: [shopping, family]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'centro-comercial-colombo-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'family'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'centro-comercial-colombo-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'afternoon'])
FROM places WHERE slug = 'centro-comercial-colombo-lisboa';

-- CENTRO VASCO DA GAMA  [lisboa]
-- current: [∅]  →  final: [shopping, family, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'centro-vasco-da-gama'
  AND t.slug = ANY(ARRAY['shopping', 'family', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'centro-vasco-da-gama');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'afternoon'])
FROM places WHERE slug = 'centro-vasco-da-gama';

-- CONFEITARIA NACIONAL  [lisboa]
-- current: [∅]  →  final: [coffee, brunch]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'confeitaria-nacional'
  AND t.slug = ANY(ARRAY['coffee', 'brunch'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'confeitaria-nacional');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'confeitaria-nacional';

-- CONSERVEIRA DE LISBOA  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'conserveira-de-lisboa-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'conserveira-de-lisboa-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'conserveira-de-lisboa-lisboa';

-- DAVID ROSAS  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'david-rosas-liberdade-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'david-rosas-liberdade-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'david-rosas-liberdade-lisboa';

-- DAVID ROSAS  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'david-rosas-el-corte-ingles-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'david-rosas-el-corte-ingles-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'david-rosas-el-corte-ingles-lisboa';

-- EL CORTE INGLÉS  [lisboa]
-- current: [∅]  →  final: [lunch, dinner, shopping, family]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'el-corte-ingles'
  AND t.slug = ANY(ARRAY['lunch', 'dinner', 'shopping', 'family'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'el-corte-ingles');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'afternoon'])
FROM places WHERE slug = 'el-corte-ingles';

-- ELEMENTS 75’80 LISBOA  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'elements-7580-lisboa-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'elements-7580-lisboa-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'elements-7580-lisboa-lisboa';

-- ELEVADOR RESTAURANTE  [lisboa]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'elevador-restaurante-lisboa'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'elevador-restaurante-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'elevador-restaurante-lisboa';

-- EMBASSY  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'embassy'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'embassy');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'embassy';

-- ESTRELA DO MAR  [lisboa]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'estrela-do-mar-lisboa'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'estrela-do-mar-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'estrela-do-mar-lisboa';

-- FASHION CLINIC MEN  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'fashion-clinic-men-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'fashion-clinic-men-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'fashion-clinic-men-lisboa';

-- FASHION CLINIC WOMEN  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'fashion-clinic-women-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'fashion-clinic-women-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'fashion-clinic-women-lisboa';

-- FEDERICO  [lisboa]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'federico-lisboa'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'federico-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'federico-lisboa';

-- FUNDAÇÃO AMÁLIA RODRIGUES  [lisboa]
-- current: [∅]  →  final: [culture, rainy-day, celebration, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'fundacao-amalia-rodrigues-lisboa'
  AND t.slug = ANY(ARRAY['culture', 'rainy-day', 'celebration', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'fundacao-amalia-rodrigues-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'fundacao-amalia-rodrigues-lisboa';

-- GRANADO  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'granado-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'granado-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'granado-lisboa';

-- HOTEL DOS TEMPLÁRIOS  [lisboa]
-- current: [∅]  →  final: [wellness, romantic]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'hotel-dos-templarios-lisboa'
  AND t.slug = ANY(ARRAY['wellness', 'romantic'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'hotel-dos-templarios-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'evening'])
FROM places WHERE slug = 'hotel-dos-templarios-lisboa';

-- Jardim da Estrela  [lisboa]
-- current: [family, romantic]  →  final: [family, romantic, nature]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'jardim-da-estrela-lisboa'
  AND t.slug = ANY(ARRAY['nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'jardim-da-estrela-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening'])
FROM places WHERE slug = 'jardim-da-estrela-lisboa';

-- Jardim do Torel  [lisboa]
-- current: [culture, viewpoint]  →  final: [culture, viewpoint, local-secret]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'jardim-do-torel-lisboa'
  AND t.slug = ANY(ARRAY['local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'jardim-do-torel-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'jardim-do-torel-lisboa';

-- JOALHARIA FERREIRA MARQUES  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'joalharia-ferreira-marques'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'joalharia-ferreira-marques');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'joalharia-ferreira-marques';

-- KARATER – TASTE OF GEORGIA  [lisboa]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'karater-taste-of-georgia'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'karater-taste-of-georgia');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'karater-taste-of-georgia';

-- LISBOA À NOITE  [lisboa]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'lisboa-a-noite-lisboa'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'lisboa-a-noite-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'lisboa-a-noite-lisboa';

-- LOJA DAS MEIAS  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'loja-das-meias-lisboa-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'loja-das-meias-lisboa-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'loja-das-meias-lisboa-lisboa';

-- LOJA DAS MEIAS  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'loja-das-meias-cascais-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'loja-das-meias-cascais-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'loja-das-meias-cascais-lisboa';

-- LX Factory  [lisboa]
-- current: [coffee, culture, shopping]  →  final: [coffee, culture, shopping]
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'lx-factory-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'lx-factory-lisboa';

-- MACHADO JOALHEIRO  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'machado-joalheiro-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'machado-joalheiro-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'machado-joalheiro-lisboa';

-- MAR DO INFERNO RESTAURANTE  [lisboa]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'mar-do-inferno-restaurante-lisboa'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'mar-do-inferno-restaurante-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'mar-do-inferno-restaurante-lisboa';

-- MARLENE VIEIRA  [lisboa]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'marlene-vieira-lisboa'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'marlene-vieira-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'marlene-vieira-lisboa';

-- Miradouro da Senhora do Monte  [lisboa]
-- current: [sunset, viewpoint]  →  final: [sunset, viewpoint, nature]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'miradouro-da-senhora-do-monte-lisboa'
  AND t.slug = ANY(ARRAY['nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'miradouro-da-senhora-do-monte-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'deep_night'])
FROM places WHERE slug = 'miradouro-da-senhora-do-monte-lisboa';

-- Miradouro de Santa Catarina  [lisboa]
-- current: [local-secret, sunset, viewpoint]  →  final: [local-secret, sunset, viewpoint, culture]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'miradouro-de-santa-catarina-lisboa'
  AND t.slug = ANY(ARRAY['culture'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'miradouro-de-santa-catarina-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'miradouro-de-santa-catarina-lisboa';

-- MUNICÍPIO DE ALMADA  [lisboa]
-- current: [∅]  →  final: [culture, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'municipio-de-almada-lisboa'
  AND t.slug = ANY(ARRAY['culture', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'municipio-de-almada-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'municipio-de-almada-lisboa';

-- MUNICÍPIO DE SINTRA  [lisboa]
-- current: [∅]  →  final: [culture, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'municipio-de-sintra-lisboa'
  AND t.slug = ANY(ARRAY['culture', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'municipio-de-sintra-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'municipio-de-sintra-lisboa';

-- N.50 STORE  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'n50-store-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'n50-store-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'n50-store-lisboa';

-- NAMEZA RESTAURANTE  [lisboa]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'nameza-restaurante-lisboa'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'nameza-restaurante-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'nameza-restaurante-lisboa';

-- NICOLAU CASCAIS  [lisboa]
-- current: [∅]  →  final: [coffee, brunch]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'nicolau-cascais-lisboa'
  AND t.slug = ANY(ARRAY['coffee', 'brunch'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'nicolau-cascais-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'nicolau-cascais-lisboa';

-- ÓPTICA JOMIL  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'optica-jomil-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'optica-jomil-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'optica-jomil-lisboa';

-- PALÁCIO BIESTER  [lisboa]
-- current: [∅]  →  final: [culture, rainy-day]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'palacio-biester'
  AND t.slug = ANY(ARRAY['culture', 'rainy-day'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'palacio-biester');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'palacio-biester';

-- Palácio Chiado  [lisboa]
-- current: [culture, romantic]  →  final: [culture, romantic]
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'palacio-chiado-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'palacio-chiado-lisboa';

-- PALÁCIO ESTORIL HOTEL, GOLF & WELLNESS  [lisboa]
-- current: [cocktails, fine-dining, romantic]  →  final: [cocktails, fine-dining, romantic, wellness]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'palacio-estoril-hotel-golf-wellness-lisboa'
  AND t.slug = ANY(ARRAY['wellness'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'palacio-estoril-hotel-golf-wellness-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'palacio-estoril-hotel-golf-wellness-lisboa';

-- PATEK PHILIPPE  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'patek-philippe'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'patek-philippe');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'patek-philippe';

-- POMELLATO  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'pomellato-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'pomellato-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'pomellato-lisboa';

-- PORTO SANTA MARIA  [lisboa]
-- current: [∅]  →  final: [wine, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'porto-santa-maria-lisboa'
  AND t.slug = ANY(ARRAY['wine', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'porto-santa-maria-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['afternoon', 'evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'porto-santa-maria-lisboa';

-- Praia da Ursa  [lisboa]
-- current: [local-secret, sunset, viewpoint]  →  final: [local-secret, sunset, viewpoint, nature]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'praia-da-ursa-lisboa'
  AND t.slug = ANY(ARRAY['nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'praia-da-ursa-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'deep_night'])
FROM places WHERE slug = 'praia-da-ursa-lisboa';

-- Praia do Guincho  [lisboa]
-- current: [sunset, viewpoint]  →  final: [sunset, viewpoint, nature]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'praia-do-guincho-lisboa'
  AND t.slug = ANY(ARRAY['nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'praia-do-guincho-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'deep_night'])
FROM places WHERE slug = 'praia-do-guincho-lisboa';

-- REFUSE  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'refuse-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'refuse-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'refuse-lisboa';

-- RESTAURANTE 88  [lisboa]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'restaurante-88'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'restaurante-88');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'restaurante-88';

-- ROBERTO COIN  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'roberto-coin-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'roberto-coin-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'roberto-coin-lisboa';

-- ROMARIA DE BACO  [lisboa]
-- current: [∅]  →  final: [wine, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'romaria-de-baco-lisboa'
  AND t.slug = ANY(ARRAY['wine', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'romaria-de-baco-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['afternoon', 'evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'romaria-de-baco-lisboa';

-- SÁLA  [lisboa]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'sala-lisboa'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'sala-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'sala-lisboa';

-- TACHO REAL  [lisboa]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'tacho-real-lisboa'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'tacho-real-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'tacho-real-lisboa';

-- TUDOR  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'tudor-lisboa-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'tudor-lisboa-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'tudor-lisboa-lisboa';

-- WORLD TRG  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'world-trg'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'world-trg');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'world-trg';

-- XERJOFF  – Boutique Lisboa  [lisboa]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'xerjoff-boutique-lisboa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'xerjoff-boutique-lisboa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'xerjoff-boutique-lisboa';

-- 1811 BISTRÔ RESTAURANTE  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = '1811-bistro-restaurante-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = '1811-bistro-restaurante-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = '1811-bistro-restaurante-madeira';

-- ADEGA DO POMAR  [madeira]
-- current: [∅]  →  final: [lunch, dinner, wine]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'adega-do-pomar-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner', 'wine'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'adega-do-pomar-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'afternoon', 'evening', 'late_evening'])
FROM places WHERE slug = 'adega-do-pomar-madeira';

-- AS VIDES  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'as-vides-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'as-vides-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'as-vides-madeira';

-- AS VISTAS RESTAURANT  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'as-vistas-restaurant-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'as-vistas-restaurant-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'as-vistas-restaurant-madeira';

-- ATLANTIC RESTAURANTE  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'atlantic-restaurante-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'atlantic-restaurante-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'atlantic-restaurante-madeira';

-- BLANDY’S WINE LODGE  [madeira]
-- current: [∅]  →  final: [wine, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'blandys-wine-lodge-madeira'
  AND t.slug = ANY(ARRAY['wine', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'blandys-wine-lodge-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['afternoon', 'evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'blandys-wine-lodge-madeira';

-- BRASA – FIRE & COCKTAILS  [madeira]
-- current: [∅]  →  final: [cocktails, wine]
-- issues: NO_TAGS; RESTAURANT_NO_MEAL_TAG
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'brasa-fire-cocktails-madeira'
  AND t.slug = ANY(ARRAY['cocktails', 'wine'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'brasa-fire-cocktails-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'brasa-fire-cocktails-madeira';

-- BRILHIVITRINE  [madeira]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'brilhivitrine-madeira'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'brilhivitrine-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'brilhivitrine-madeira';

-- Cabo Girão  [madeira]
-- current: [viewpoint]  →  final: [viewpoint, nature]
-- issues: ONLY_ONE_TAG
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'cabo-girao-madeira'
  AND t.slug = ANY(ARRAY['nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'cabo-girao-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'deep_night'])
FROM places WHERE slug = 'cabo-girao-madeira';

-- CABRIOLET EXPERIENCES  [madeira]
-- current: [∅]  →  final: [viewpoint, nature, sunset, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'cabriolet-experiences-madeira'
  AND t.slug = ANY(ARRAY['viewpoint', 'nature', 'sunset', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'cabriolet-experiences-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'deep_night'])
FROM places WHERE slug = 'cabriolet-experiences-madeira';

-- CAFÉ DO TEATRO  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'cafe-do-teatro-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'cafe-do-teatro-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'cafe-do-teatro-madeira';

-- CASAL DA PENHA RESTAURANTE  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'casal-da-penha-restaurante-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'casal-da-penha-restaurante-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'casal-da-penha-restaurante-madeira';

-- CASTANHEIRO BOUTIQUE HOTEL  [madeira]
-- current: [∅]  →  final: [wellness, romantic]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'castanheiro-boutique-hotel-madeira'
  AND t.slug = ANY(ARRAY['wellness', 'romantic'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'castanheiro-boutique-hotel-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'evening'])
FROM places WHERE slug = 'castanheiro-boutique-hotel-madeira';

-- COACHELLA RESTAURANT  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'coachella-restaurant-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'coachella-restaurant-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'coachella-restaurant-madeira';

-- CONVENTO DAS VINHAS  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'convento-das-vinhas-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'convento-das-vinhas-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'convento-das-vinhas-madeira';

-- DAVID ROSAS  [madeira]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'david-rosas-madeira'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'david-rosas-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'david-rosas-madeira';

-- Dermalaser  [madeira]
-- current: [wellness]  →  final: [wellness, local-secret, culture, family]
-- issues: ONLY_ONE_TAG
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'dermalaser-madeira'
  AND t.slug = ANY(ARRAY['local-secret', 'culture', 'family'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'dermalaser-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'dermalaser-madeira';

-- DESARMA RESTAURANTE  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'desarma-restaurante-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'desarma-restaurante-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'desarma-restaurante-madeira';

-- ENGENHOS DO NORTE  [madeira]
-- current: [∅]  →  final: [local-secret, culture, family]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'engenhos-do-norte-madeira'
  AND t.slug = ANY(ARRAY['local-secret', 'culture', 'family'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'engenhos-do-norte-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'engenhos-do-norte-madeira';

-- ENSEADA FOOD AND DRINKS  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'enseada-food-and-drinks-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'enseada-food-and-drinks-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'enseada-food-and-drinks-madeira';

-- FÁBRICA DO RIBEIRO SÊCO  [madeira]
-- current: [∅]  →  final: [shopping, quick-stop, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'fabrica-do-ribeiro-seco-madeira'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'fabrica-do-ribeiro-seco-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'fabrica-do-ribeiro-seco-madeira';

-- FÁBRICA STO ANTÓNIO  [madeira]
-- current: [∅]  →  final: [shopping, quick-stop, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'fabrica-sto-antonio-madeira'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'fabrica-sto-antonio-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'fabrica-sto-antonio-madeira';

-- Fanal Forest  [madeira]
-- current: [local-secret]  →  final: [local-secret, nature, viewpoint]
-- issues: ONLY_ONE_TAG
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'fanal-forest-madeira'
  AND t.slug = ANY(ARRAY['nature', 'viewpoint'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'fanal-forest-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'deep_night'])
FROM places WHERE slug = 'fanal-forest-madeira';

-- Forest Food  [madeira]
-- current: [family, local-secret, lunch, terrace]  →  final: [family, local-secret, lunch, terrace]
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'forest-food-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'afternoon'])
FROM places WHERE slug = 'forest-food-madeira';

-- FRENTE MAR FUNCHAL – BARREIRINHA  [madeira]
-- current: [∅]  →  final: [local-secret, nature]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'frente-mar-funchal-barreirinha-madeira'
  AND t.slug = ANY(ARRAY['local-secret', 'nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'frente-mar-funchal-barreirinha-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'frente-mar-funchal-barreirinha-madeira';

-- FRENTE MAR FUNCHAL – DOCA DO CAVACAS  [madeira]
-- current: [∅]  →  final: [local-secret, nature]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'frente-mar-funchal-doca-do-cavacas-madeira'
  AND t.slug = ANY(ARRAY['local-secret', 'nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'frente-mar-funchal-doca-do-cavacas-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'frente-mar-funchal-doca-do-cavacas-madeira';

-- FRENTE MAR FUNCHAL – LIDO  [madeira]
-- current: [∅]  →  final: [local-secret, nature]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'frente-mar-funchal-lido-madeira'
  AND t.slug = ANY(ARRAY['local-secret', 'nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'frente-mar-funchal-lido-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'frente-mar-funchal-lido-madeira';

-- FRENTE MAR FUNCHAL – PONTA GORDA  [madeira]
-- current: [∅]  →  final: [local-secret, nature]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'frente-mar-funchal-ponta-gorda-madeira'
  AND t.slug = ANY(ARRAY['local-secret', 'nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'frente-mar-funchal-ponta-gorda-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'frente-mar-funchal-ponta-gorda-madeira';

-- GREEN DEVIL SAFARI  [madeira]
-- current: [∅]  →  final: [nature, sunset, local-secret, wellness]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'green-devil-safari-madeira'
  AND t.slug = ANY(ARRAY['nature', 'sunset', 'local-secret', 'wellness'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'green-devil-safari-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening'])
FROM places WHERE slug = 'green-devil-safari-madeira';

-- HENRIQUES & HENRIQUES  [madeira]
-- current: [∅]  →  final: [wine, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'henriques-henriques-madeira'
  AND t.slug = ANY(ARRAY['wine', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'henriques-henriques-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['afternoon', 'evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'henriques-henriques-madeira';

-- JACARANDÁ- CHAFARIZ  [madeira]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'jacaranda-chafariz-madeira'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'jacaranda-chafariz-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'jacaranda-chafariz-madeira';

-- JUSTINO’S MADEIRA WINES  [madeira]
-- current: [∅]  →  final: [wine, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'justinos-madeira-wines-madeira'
  AND t.slug = ANY(ARRAY['wine', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'justinos-madeira-wines-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['afternoon', 'evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'justinos-madeira-wines-madeira';

-- LÁ AO FUNDO RESTAURANTE  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'la-ao-fundo-restaurante-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'la-ao-fundo-restaurante-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'la-ao-fundo-restaurante-madeira';

-- LOJA DO CHÁ MADEIRA  [madeira]
-- current: [∅]  →  final: [coffee, brunch]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'loja-do-cha-madeira-madeira'
  AND t.slug = ANY(ARRAY['coffee', 'brunch'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'loja-do-cha-madeira-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'loja-do-cha-madeira-madeira';

-- LOJA DO CHÁ MADEIRA – PLAZA MADEIRA  [madeira]
-- current: [∅]  →  final: [coffee, brunch]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'loja-do-cha-madeira-plaza-madeira-madeira'
  AND t.slug = ANY(ARRAY['coffee', 'brunch'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'loja-do-cha-madeira-plaza-madeira-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'loja-do-cha-madeira-plaza-madeira-madeira';

-- LOJA DOS VINHOS  [madeira]
-- current: [∅]  →  final: [wine, local-secret, shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'loja-dos-vinhos-madeira'
  AND t.slug = ANY(ARRAY['wine', 'local-secret', 'shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'loja-dos-vinhos-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'loja-dos-vinhos-madeira';

-- LUME PIZZERIA NAPOLETANA  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'lume-pizzeria-napoletana-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'lume-pizzeria-napoletana-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'lume-pizzeria-napoletana-madeira';

-- MADEIRA EXQUISITE – FOOD ON FOOT TOURS  [madeira]
-- current: [∅]  →  final: [local-secret, culture]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'madeira-exquisite-food-on-foot-tours-madeira'
  AND t.slug = ANY(ARRAY['local-secret', 'culture'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'madeira-exquisite-food-on-foot-tours-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'madeira-exquisite-food-on-foot-tours-madeira';

-- MADEIRA LEGACY  [madeira]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'madeira-legacy-madeira'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'madeira-legacy-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'madeira-legacy-madeira';

-- MADEIRA RADICAL  [madeira]
-- current: [∅]  →  final: [local-secret, nature]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'madeira-radical-madeira'
  AND t.slug = ANY(ARRAY['local-secret', 'nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'madeira-radical-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'madeira-radical-madeira';

-- MAKAN MADEIRA  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'makan-madeira-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'makan-madeira-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'makan-madeira-madeira';

-- MELIÁ MADEIRA MARE  [madeira]
-- current: [∅]  →  final: [wellness, romantic]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'melia-madeira-mare-madeira'
  AND t.slug = ANY(ARRAY['wellness', 'romantic'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'melia-madeira-mare-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'evening'])
FROM places WHERE slug = 'melia-madeira-mare-madeira';

-- Miradouro da Ponta do Rosto  [madeira]
-- current: [viewpoint]  →  final: [viewpoint, nature, sunset]
-- issues: ONLY_ONE_TAG
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'miradouro-da-ponta-do-rosto-madeira'
  AND t.slug = ANY(ARRAY['nature', 'sunset'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'miradouro-da-ponta-do-rosto-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'deep_night'])
FROM places WHERE slug = 'miradouro-da-ponta-do-rosto-madeira';

-- Miradouro do Guindaste  [madeira]
-- current: [viewpoint]  →  final: [viewpoint, nature, sunset]
-- issues: ONLY_ONE_TAG
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'miradouro-do-guindaste-madeira'
  AND t.slug = ANY(ARRAY['nature', 'sunset'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'miradouro-do-guindaste-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'deep_night'])
FROM places WHERE slug = 'miradouro-do-guindaste-madeira';

-- MONTE PALACE MADEIRA  [madeira]
-- current: [culture, viewpoint]  →  final: [culture, viewpoint, nature, family]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'monte-palace-madeira-madeira'
  AND t.slug = ANY(ARRAY['nature', 'family'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'monte-palace-madeira-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'monte-palace-madeira-madeira';

-- MUNICÍPIO DA CALHETA  [madeira]
-- current: [∅]  →  final: [culture, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'municipio-da-calheta-madeira'
  AND t.slug = ANY(ARRAY['culture', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'municipio-da-calheta-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'municipio-da-calheta-madeira';

-- MUNICÍPIO DE CÂMARA DE LOBOS  [madeira]
-- current: [∅]  →  final: [culture, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'municipio-de-camara-de-lobos-madeira'
  AND t.slug = ANY(ARRAY['culture', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'municipio-de-camara-de-lobos-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'municipio-de-camara-de-lobos-madeira';

-- MUNICÍPIO DE PORTO MONIZ  [madeira]
-- current: [∅]  →  final: [culture, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'municipio-de-porto-moniz-madeira'
  AND t.slug = ANY(ARRAY['culture', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'municipio-de-porto-moniz-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'municipio-de-porto-moniz-madeira';

-- MUNICÍPIO DE SANTA CRUZ  [madeira]
-- current: [∅]  →  final: [culture, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'municipio-de-santa-cruz-madeira'
  AND t.slug = ANY(ARRAY['culture', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'municipio-de-santa-cruz-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'municipio-de-santa-cruz-madeira';

-- MUNICÍPIO DO FUNCHAL  [madeira]
-- current: [∅]  →  final: [culture, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'municipio-do-funchal-madeira'
  AND t.slug = ANY(ARRAY['culture', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'municipio-do-funchal-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'municipio-do-funchal-madeira';

-- ÓPTICA DA SÉ  [madeira]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'optica-da-se-madeira'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'optica-da-se-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'optica-da-se-madeira';

-- ORQUESTRA CLÁSSICA DA MADEIRA  [madeira]
-- current: [∅]  →  final: [culture, celebration]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'orquestra-classica-da-madeira-madeira'
  AND t.slug = ANY(ARRAY['culture', 'celebration'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'orquestra-classica-da-madeira-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'orquestra-classica-da-madeira-madeira';

-- PALM SPOT RESTAURANT  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'palm-spot-restaurant-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'palm-spot-restaurant-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'palm-spot-restaurant-madeira';

-- PÂTISSERIE FRANÇAISE – NOVOS SABORES  [madeira]
-- current: [∅]  →  final: [coffee, brunch]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'patisserie-francaise-novos-sabores-madeira'
  AND t.slug = ANY(ARRAY['coffee', 'brunch'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'patisserie-francaise-novos-sabores-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'patisserie-francaise-novos-sabores-madeira';

-- PEIXARIA NA AVENIDA  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'peixaria-na-avenida-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'peixaria-na-avenida-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'peixaria-na-avenida-madeira';

-- PEIXARIA NO MERCADO  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'peixaria-no-mercado-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'peixaria-no-mercado-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'peixaria-no-mercado-madeira';

-- PEREIRA D’ OLIVEIRA(VINHOS)  [madeira]
-- current: [∅]  →  final: [wine, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'pereira-d-oliveiravinhos-madeira'
  AND t.slug = ANY(ARRAY['wine', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'pereira-d-oliveiravinhos-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['afternoon', 'evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'pereira-d-oliveiravinhos-madeira';

-- Pico dos Barcelos viewpoint  [madeira]
-- current: [sunset, viewpoint]  →  final: [sunset, viewpoint, culture]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'pico-dos-barcelos-viewpoint-madeira'
  AND t.slug = ANY(ARRAY['culture'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'pico-dos-barcelos-viewpoint-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'pico-dos-barcelos-viewpoint-madeira';

-- PONCHA DA IMPERATRIZ – WINE & FOOD  [madeira]
-- current: [∅]  →  final: [lunch, dinner, wine]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'poncha-da-imperatriz-wine-food-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner', 'wine'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'poncha-da-imperatriz-wine-food-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'afternoon', 'evening', 'late_evening'])
FROM places WHERE slug = 'poncha-da-imperatriz-wine-food-madeira';

-- Ponta de São Lourenço  [madeira]
-- current: [viewpoint]  →  final: [viewpoint, nature]
-- issues: ONLY_ONE_TAG
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'ponta-de-sao-lourenco-madeira'
  AND t.slug = ANY(ARRAY['nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'ponta-de-sao-lourenco-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'deep_night'])
FROM places WHERE slug = 'ponta-de-sao-lourenco-madeira';

-- PORTALIANO  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'portaliano-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'portaliano-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'portaliano-madeira';

-- PORTO SANTO LINE  [madeira]
-- current: [∅]  →  final: [local-secret, nature]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'porto-santo-line-madeira'
  AND t.slug = ANY(ARRAY['local-secret', 'nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'porto-santo-line-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'porto-santo-line-madeira';

-- Praia de Porto Santo  [madeira]
-- current: [viewpoint]  →  final: [viewpoint, nature, sunset]
-- issues: ONLY_ONE_TAG
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'praia-de-porto-santo-madeira'
  AND t.slug = ANY(ARRAY['nature', 'sunset'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'praia-de-porto-santo-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'deep_night'])
FROM places WHERE slug = 'praia-de-porto-santo-madeira';

-- Praia do Seixal  [madeira]
-- current: [local-secret, viewpoint]  →  final: [local-secret, viewpoint, nature, sunset]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'praia-do-seixal-madeira'
  AND t.slug = ANY(ARRAY['nature', 'sunset'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'praia-do-seixal-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'deep_night'])
FROM places WHERE slug = 'praia-do-seixal-madeira';

-- PRIMA CAJU  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'prima-caju-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'prima-caju-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'prima-caju-madeira';

-- QUINTA DA MOSCADINHA  [madeira]
-- current: [∅]  →  final: [wine, local-secret, nature]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'quinta-da-moscadinha-madeira'
  AND t.slug = ANY(ARRAY['wine', 'local-secret', 'nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'quinta-da-moscadinha-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'quinta-da-moscadinha-madeira';

-- Quinta Magnólia  [madeira]
-- current: [culture, family, viewpoint]  →  final: [culture, family, viewpoint, wine]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'quinta-magnolia-madeira'
  AND t.slug = ANY(ARRAY['wine'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'quinta-magnolia-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'quinta-magnolia-madeira';

-- RESTAURANTE DOS COMBATENTES  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'restaurante-dos-combatentes-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'restaurante-dos-combatentes-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'restaurante-dos-combatentes-madeira';

-- RESTAURANTE PVP – PÃO VINHO E PETISCOS  [madeira]
-- current: [∅]  →  final: [lunch, dinner, wine]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'restaurante-pvp-pao-vinho-e-petiscos-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner', 'wine'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'restaurante-pvp-pao-vinho-e-petiscos-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'afternoon', 'evening', 'late_evening'])
FROM places WHERE slug = 'restaurante-pvp-pao-vinho-e-petiscos-madeira';

-- ROLEX  [madeira]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'rolex-madeira'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'rolex-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'rolex-madeira';

-- Seapleasure  [madeira]
-- current: [family, local-secret]  →  final: [family, local-secret, culture]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'seapleasure-madeira'
  AND t.slug = ANY(ARRAY['culture'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'seapleasure-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'seapleasure-madeira';

-- SENSE OF MADEIRA  [madeira]
-- current: [∅]  →  final: [shopping, quick-stop, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'sense-of-madeira-madeira'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'sense-of-madeira-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'sense-of-madeira-madeira';

-- SIDRA – QUINTA DA MOSCADINHA  [madeira]
-- current: [∅]  →  final: [wine, local-secret, nature]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'sidra-quinta-da-moscadinha-madeira'
  AND t.slug = ANY(ARRAY['wine', 'local-secret', 'nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'sidra-quinta-da-moscadinha-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'sidra-quinta-da-moscadinha-madeira';

-- SOL POENTE RESTAURANTE  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'sol-poente-restaurante-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'sol-poente-restaurante-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'sol-poente-restaurante-madeira';

-- SUN SPOT CAFÉ  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'sun-spot-cafe-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'sun-spot-cafe-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'sun-spot-cafe-madeira';

-- TAJ MAHAL INDIAN RESTAURANT  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'taj-mahal-indian-restaurant-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'taj-mahal-indian-restaurant-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'taj-mahal-indian-restaurant-madeira';

-- TELEFÉRICO DO JARDIM BOTÂNICO  [madeira]
-- current: [culture, family, viewpoint]  →  final: [culture, family, viewpoint, local-secret]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'teleferico-do-jardim-botanico-madeira'
  AND t.slug = ANY(ARRAY['local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'teleferico-do-jardim-botanico-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'teleferico-do-jardim-botanico-madeira';

-- TIPOGRAFIA – RESTAURANTE MEDITERRÂNEO  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'tipografia-restaurante-mediterraneo-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'tipografia-restaurante-mediterraneo-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'tipografia-restaurante-mediterraneo-madeira';

-- UNIVERSO DE MEMÓRIAS JOÃO CARLOS ABREU  [madeira]
-- current: [∅]  →  final: [culture, rainy-day, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'universo-de-memorias-joao-carlos-abreu-madeira'
  AND t.slug = ANY(ARRAY['culture', 'rainy-day', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'universo-de-memorias-joao-carlos-abreu-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'universo-de-memorias-joao-carlos-abreu-madeira';

-- VARILUX ESSILOR  [madeira]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'varilux-essilor-madeira'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'varilux-essilor-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'varilux-essilor-madeira';

-- VICTORIA RESTAURANTE  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'victoria-restaurante-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'victoria-restaurante-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'victoria-restaurante-madeira';

-- VILA DA CARNE RESTAURANTE  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'vila-da-carne-restaurante-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'vila-da-carne-restaurante-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'vila-da-carne-restaurante-madeira';

-- VILA DO PEIXE RESTAURANTE  [madeira]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'vila-do-peixe-restaurante-madeira'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'vila-do-peixe-restaurante-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'vila-do-peixe-restaurante-madeira';

-- VMT-MADEIRA  [madeira]
-- current: [∅]  →  final: [nature, sunset]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'vmtmadeira-madeira'
  AND t.slug = ANY(ARRAY['nature', 'sunset'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'vmtmadeira-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening'])
FROM places WHERE slug = 'vmtmadeira-madeira';

-- Winetours  [madeira]
-- current: [culture, local-secret, wine]  →  final: [culture, local-secret, wine, family]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'winetours-madeira'
  AND t.slug = ANY(ARRAY['family'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'winetours-madeira');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'winetours-madeira';

-- A COZINHA POR ANTÓNIO LOUREIRO  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'a-cozinha-por-antonio-loureiro-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'a-cozinha-por-antonio-loureiro-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'a-cozinha-por-antonio-loureiro-porto';

-- A MARISQUEIRA DE MATOSINHOS  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'a-marisqueira-de-matosinhos-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'a-marisqueira-de-matosinhos-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'a-marisqueira-de-matosinhos-porto';

-- ACQUA RESTAURANT HOTEL GA PALACE  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'acqua-restaurant-hotel-ga-palace-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'acqua-restaurant-hotel-ga-palace-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'acqua-restaurant-hotel-ga-palace-porto';

-- ADEGA SÃO NICOLAU  [porto]
-- current: [∅]  →  final: [lunch, dinner, wine]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'adega-sao-nicolau-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner', 'wine'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'adega-sao-nicolau-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'afternoon', 'evening', 'late_evening'])
FROM places WHERE slug = 'adega-sao-nicolau-porto';

-- ALCINO  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'alcino-cardosas-store-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'alcino-cardosas-store-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'alcino-cardosas-store-porto';

-- ALCINO  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'alcino-flores-store-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'alcino-flores-store-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'alcino-flores-store-porto';

-- ALCINO  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'alcino-workshop-store-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'alcino-workshop-store-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'alcino-workshop-store-porto';

-- ALMADA TERRACE  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'almada-terrace-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'almada-terrace-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'almada-terrace-porto';

-- AROUCA GEOPARK  [porto]
-- current: [∅]  →  final: [nature, sunset, culture, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'arouca-geopark-porto'
  AND t.slug = ANY(ARRAY['nature', 'sunset', 'culture', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'arouca-geopark-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'arouca-geopark-porto';

-- ARQUINHO DO CASTELO  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'arquinho-do-castelo-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'arquinho-do-castelo-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'arquinho-do-castelo-porto';

-- ASIA CONNECTION  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'asia-connection-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'asia-connection-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'asia-connection-porto';

-- ATREVO  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'atrevo-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'atrevo-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'atrevo-porto';

-- BARBOUR  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'barbour-loios-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'barbour-loios-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'barbour-loios-porto';

-- BARBOUR  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'barbour-norteshopping-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'barbour-norteshopping-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'barbour-norteshopping-porto';

-- BIERHAUS  [porto]
-- current: [∅]  →  final: [cocktails, wine]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'bierhaus-porto'
  AND t.slug = ANY(ARRAY['cocktails', 'wine'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'bierhaus-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['afternoon', 'evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'bierhaus-porto';

-- CAMINHOS CRUZADOS  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'caminhos-cruzados-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'caminhos-cruzados-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'caminhos-cruzados-porto';

-- CASA DA MÚSICA  [porto]
-- current: [culture]  →  final: [culture, celebration]
-- issues: ONLY_ONE_TAG
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'casa-da-musica-porto'
  AND t.slug = ANY(ARRAY['celebration'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'casa-da-musica-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'casa-da-musica-porto';

-- CASA DE CHÁ DA BOA NOVA  [porto]
-- current: [∅]  →  final: [lunch, dinner, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'casa-de-cha-da-boa-nova-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'casa-de-cha-da-boa-nova-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'casa-de-cha-da-boa-nova-porto';

-- CASA DO LIVRO  [porto]
-- current: [∅]  →  final: [cocktails, wine, late-night]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'casa-do-livro-porto'
  AND t.slug = ANY(ARRAY['cocktails', 'wine', 'late-night'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'casa-do-livro-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'casa-do-livro-porto';

-- CASA VEGETARIANA  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'a-casa-vegetariana'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'a-casa-vegetariana');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'a-casa-vegetariana';

-- CASARÃO DO CASTELO  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'casarao-do-castelo-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'casarao-do-castelo-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'casarao-do-castelo-porto';

-- COQUINE  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'coquine-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'coquine-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'coquine-porto';

-- CULTO AO BACALHAU  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'culto-ao-bacalhau-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'culto-ao-bacalhau-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'culto-ao-bacalhau-porto';

-- DAVID ROSAS  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'david-rosas-boavista-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'david-rosas-boavista-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'david-rosas-boavista-porto';

-- DAVID ROSAS  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'david-rosas-aliados-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'david-rosas-aliados-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'david-rosas-aliados-porto';

-- DAVID ROSAS  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'david-rosas-norteshopping-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'david-rosas-norteshopping-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'david-rosas-norteshopping-porto';

-- DIVANY & DIVANI PORTO  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'divany-divani-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'divany-divani-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'divany-divani-porto';

-- DIVINO RESTAURANT & LOUNGE  [porto]
-- current: [∅]  →  final: [lunch, dinner, cocktails, wine]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'divino-restaurant-lounge-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner', 'cocktails', 'wine'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'divino-restaurant-lounge-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'afternoon', 'evening', 'late_evening'])
FROM places WHERE slug = 'divino-restaurant-lounge-porto';

-- DONA MARIA RESTAURANTE  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'dona-maria-restaurante-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'dona-maria-restaurante-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'dona-maria-restaurante-porto';

-- DOP RESTAURANT  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'dop-restaurant-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'dop-restaurant-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'dop-restaurant-porto';

-- ELEMENTS 75’80 MATOSINHOS  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'elements-7580-matosinhos-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'elements-7580-matosinhos-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'elements-7580-matosinhos-porto';

-- ELEMENTS 75’80 PORTO  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'elements-7580-porto-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'elements-7580-porto-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'elements-7580-porto-porto';

-- ELEMENTS 75’80 SEDE/HEADQUARTERS  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'elements-7580-sedeheadquarters-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'elements-7580-sedeheadquarters-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'elements-7580-sedeheadquarters-porto';

-- ESCAMA  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'escama-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'escama-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'escama-porto';

-- ESCONDIDINHO RESTAURANTE  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'escondidinho-restaurante-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'escondidinho-restaurante-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'escondidinho-restaurante-porto';

-- FADO NO PORTO  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'fado-no-porto-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'fado-no-porto-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'fado-no-porto-porto';

-- FÉ WINE & CLUB  [porto]
-- current: [∅]  →  final: [cocktails, wine, late-night]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'fe-wine-club-porto'
  AND t.slug = ANY(ARRAY['cocktails', 'wine', 'late-night'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'fe-wine-club-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'fe-wine-club-porto';

-- FEDERICA  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'federica-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'federica-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'federica-porto';

-- Foz do Douro Promenade  [porto]
-- current: [sunset, viewpoint]  →  final: [sunset, viewpoint, nature]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'foz-do-douro-promenade-porto'
  AND t.slug = ANY(ARRAY['nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'foz-do-douro-promenade-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'deep_night'])
FROM places WHERE slug = 'foz-do-douro-promenade-porto';

-- FRED PERRY  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'fred-perry-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'fred-perry-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'fred-perry-porto';

-- FUNDAÇÃO DE SERRALVES  [porto]
-- current: [culture, viewpoint]  →  final: [culture, viewpoint, rainy-day, celebration]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'fundacao-de-serralves-porto'
  AND t.slug = ANY(ARRAY['rainy-day', 'celebration'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'fundacao-de-serralves-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'fundacao-de-serralves-porto';

-- GALERIA FERNANDO SANTOS  [porto]
-- current: [∅]  →  final: [culture, rainy-day, celebration]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'galeria-fernando-santos-porto'
  AND t.slug = ANY(ARRAY['culture', 'rainy-day', 'celebration'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'galeria-fernando-santos-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'galeria-fernando-santos-porto';

-- HABITAT TERRA E FOGO  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'habitat-terra-e-fogo-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'habitat-terra-e-fogo-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'habitat-terra-e-fogo-porto';

-- HERDADE 1980  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'herdade-1980-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'herdade-1980-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'herdade-1980-porto';

-- HOOL  [porto]
-- current: [∅]  →  final: [lunch, dinner, wellness, romantic]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'hool-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner', 'wellness', 'romantic'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'hool-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'hool-porto';

-- Imobiliária KA  [porto]
-- current: [local-secret]  →  final: [local-secret, shopping]
-- issues: ONLY_ONE_TAG
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'imobiliaria-ka-porto'
  AND t.slug = ANY(ARRAY['shopping'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'imobiliaria-ka-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'afternoon'])
FROM places WHERE slug = 'imobiliaria-ka-porto';

-- INÊS BARBOSA  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'ines-barbosa'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'ines-barbosa');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'ines-barbosa';

-- INFINITY HAUS – Real Estate & Design  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'infinity-haus-real-estate-design-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'infinity-haus-real-estate-design-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'infinity-haus-real-estate-design-porto';

-- JANGAL GASTRO BAR  [porto]
-- current: [∅]  →  final: [cocktails, wine]
-- issues: NO_TAGS; RESTAURANT_NO_MEAL_TAG
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'jangal-gastro-bar'
  AND t.slug = ANY(ARRAY['cocktails', 'wine'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'jangal-gastro-bar');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'jangal-gastro-bar';

-- Jardim do Morro  [porto]
-- current: [sunset, viewpoint]  →  final: [sunset, viewpoint, culture, local-secret]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'jardim-do-morro-porto'
  AND t.slug = ANY(ARRAY['culture', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'jardim-do-morro-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'jardim-do-morro-porto';

-- Jardins do Palácio de Cristal  [porto]
-- current: [sunset, viewpoint]  →  final: [sunset, viewpoint, culture]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'jardins-do-palacio-de-cristal-porto'
  AND t.slug = ANY(ARRAY['culture'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'jardins-do-palacio-de-cristal-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'jardins-do-palacio-de-cristal-porto';

-- JUST  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'just-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'just-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'just-porto';

-- L'ÉGOÏST  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'legoist-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'legoist-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'legoist-porto';

-- LAPA LAPA  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'lapa-lapa-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'lapa-lapa-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'lapa-lapa-porto';

-- LIDER RESTAURANTE BAR  [porto]
-- current: [∅]  →  final: [lunch, dinner, cocktails, wine]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'lider-restaurante-bar-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner', 'cocktails', 'wine'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'lider-restaurante-bar-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'afternoon', 'evening', 'late_evening'])
FROM places WHERE slug = 'lider-restaurante-bar-porto';

-- Livraria Lello  [porto]
-- current: [culture]  →  final: [culture, shopping, quick-stop]
-- issues: ONLY_ONE_TAG
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'livraria-lello-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'livraria-lello-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'livraria-lello-porto';

-- LOJA DAS TÁBUAS  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'loja-das-tabuas-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'loja-das-tabuas-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'loja-das-tabuas-porto';

-- MACHADO JOALHEIRO  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'machado-joalheiro-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'machado-joalheiro-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'machado-joalheiro-porto';

-- MÃE  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'mae-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'mae-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'mae-porto';

-- MARCOLINO  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'marcolino-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'marcolino-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'marcolino-porto';

-- MARISCAR  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'mariscar-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'mariscar-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'mariscar-porto';

-- MERCADO BOM SUCESSO  [porto]
-- current: [∅]  →  final: [lunch, dinner, shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'mercado-do-bom-sucesso-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner', 'shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'mercado-do-bom-sucesso-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'afternoon'])
FROM places WHERE slug = 'mercado-do-bom-sucesso-porto';

-- Miradouro das Virtudes  [porto]
-- current: [local-secret, sunset, viewpoint]  →  final: [local-secret, sunset, viewpoint, nature]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'miradouro-das-virtudes-porto'
  AND t.slug = ANY(ARRAY['nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'miradouro-das-virtudes-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'deep_night'])
FROM places WHERE slug = 'miradouro-das-virtudes-porto';

-- MONTBLANC  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'montblanc-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'montblanc-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'montblanc-porto';

-- MUD – FACTORY UNDER DESIGN  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'mud-factory-under-design-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'mud-factory-under-design-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'mud-factory-under-design-porto';

-- MUNICÍPIO DE AVEIRO  [porto]
-- current: [∅]  →  final: [culture, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'municipio-de-aveiro-porto'
  AND t.slug = ANY(ARRAY['culture', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'municipio-de-aveiro-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'municipio-de-aveiro-porto';

-- MUNICÍPIO DE BARCELOS  [porto]
-- current: [∅]  →  final: [culture, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'municipio-de-barcelos-porto'
  AND t.slug = ANY(ARRAY['culture', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'municipio-de-barcelos-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'municipio-de-barcelos-porto';

-- MUNICÍPIO DE GONDOMAR  [porto]
-- current: [∅]  →  final: [culture, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'municipio-de-gondomar-porto'
  AND t.slug = ANY(ARRAY['culture', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'municipio-de-gondomar-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'municipio-de-gondomar-porto';

-- MUNICÍPIO DE GUIMARÃES  [porto]
-- current: [∅]  →  final: [culture, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'municipio-de-guimaraes-porto'
  AND t.slug = ANY(ARRAY['culture', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'municipio-de-guimaraes-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'municipio-de-guimaraes-porto';

-- MUNICÍPIO DE MATOSINHOS  [porto]
-- current: [∅]  →  final: [culture, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'municipio-de-matosinhos-porto'
  AND t.slug = ANY(ARRAY['culture', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'municipio-de-matosinhos-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'municipio-de-matosinhos-porto';

-- MUNICÍPIO DE SANTA MARIA DA FEIRA  [porto]
-- current: [∅]  →  final: [culture, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'municipio-de-santa-maria-da-feira-porto'
  AND t.slug = ANY(ARRAY['culture', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'municipio-de-santa-maria-da-feira-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'municipio-de-santa-maria-da-feira-porto';

-- MUNICÍPIO DE VILA DO CONDE  [porto]
-- current: [∅]  →  final: [culture, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'municipio-de-vila-do-conde-porto'
  AND t.slug = ANY(ARRAY['culture', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'municipio-de-vila-do-conde-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'municipio-de-vila-do-conde-porto';

-- MUNICÍPIO DE VILA NOVA DE GAIA  [porto]
-- current: [∅]  →  final: [culture, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'municipio-de-vila-nova-de-gaia-porto'
  AND t.slug = ANY(ARRAY['culture', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'municipio-de-vila-nova-de-gaia-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'municipio-de-vila-nova-de-gaia-porto';

-- NORMA  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'norma-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'norma-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'norma-porto';

-- NORTESHOPPING  [porto]
-- current: [∅]  →  final: [shopping, family]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'norteshopping-porto'
  AND t.slug = ANY(ARRAY['shopping', 'family'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'norteshopping-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'afternoon'])
FROM places WHERE slug = 'norteshopping-porto';

-- NOVO CASARÃO DO CASTELO  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'novo-casarao-do-castelo-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'novo-casarao-do-castelo-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'novo-casarao-do-castelo-porto';

-- O GAVETO RESTAURANTE  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'o-gaveto-restaurante-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'o-gaveto-restaurante-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'o-gaveto-restaurante-porto';

-- PALÁCIO DA BOLSA  [porto]
-- current: [∅]  →  final: [culture, local-secret, celebration]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'palacio-da-bolsa-porto'
  AND t.slug = ANY(ARRAY['culture', 'local-secret', 'celebration'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'palacio-da-bolsa-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'palacio-da-bolsa-porto';

-- PALATIAL RESTAURANT  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'palatial'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'palatial');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'palatial';

-- PALATIAL RESTAURANT & SUITES  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'palatial-restaurant-suites'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'palatial-restaurant-suites');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'palatial-restaurant-suites';

-- PANAMAR  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'panamar-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'panamar-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'panamar-porto';

-- Passeio das Virtudes  [porto]
-- current: [local-secret, sunset, viewpoint]  →  final: [local-secret, sunset, viewpoint, culture]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'passeio-das-virtudes-porto'
  AND t.slug = ANY(ARRAY['culture'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'passeio-das-virtudes-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'passeio-das-virtudes-porto';

-- PASSEIO DOS CLÉRIGOS  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'passeio-dos-clerigos-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'passeio-dos-clerigos-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'passeio-dos-clerigos-porto';

-- PEDRO LEMOS  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'pedro-lemos'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'pedro-lemos');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'pedro-lemos';

-- PEIXE NO MERCADO  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'peixe-no-mercado'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'peixe-no-mercado');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'peixe-no-mercado';

-- PIRES JOALHEIROS  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'pires-joalheiros-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'pires-joalheiros-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'pires-joalheiros-porto';

-- POMELLATO  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'pomellato-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'pomellato-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'pomellato-porto';

-- PORTOVELLA – LODGES & BUNGALOWS  [porto]
-- current: [∅]  →  final: [wellness, romantic]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'portovella-lodges-bungalows-porto'
  AND t.slug = ANY(ARRAY['wellness', 'romantic'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'portovella-lodges-bungalows-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'evening'])
FROM places WHERE slug = 'portovella-lodges-bungalows-porto';

-- PRAÇA BOAVISTA  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'praca-boavista-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'praca-boavista-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'praca-boavista-porto';

-- Praia da Luz  [porto]
-- current: [sunset, viewpoint]  →  final: [sunset, viewpoint, lunch, dinner]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'praia-da-luz-restaurante-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'praia-da-luz-restaurante-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'afternoon', 'evening'])
FROM places WHERE slug = 'praia-da-luz-restaurante-porto';

-- Praia do Senhor da Pedra  [porto]
-- current: [sunset, viewpoint]  →  final: [sunset, viewpoint, nature]
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'praia-do-senhor-da-pedra-porto'
  AND t.slug = ANY(ARRAY['nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'praia-do-senhor-da-pedra-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'deep_night'])
FROM places WHERE slug = 'praia-do-senhor-da-pedra-porto';

-- PRÉGAR  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'pregar-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'pregar-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'pregar-porto';

-- PROJETO VIMOC  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'projeto-vimoc-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'projeto-vimoc-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'projeto-vimoc-porto';

-- QUINTA DA ROÊDA  [porto]
-- current: [∅]  →  final: [wine, local-secret, nature]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'quinta-da-roeda-porto'
  AND t.slug = ANY(ARRAY['wine', 'local-secret', 'nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'quinta-da-roeda-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'quinta-da-roeda-porto';

-- QUINTA DO PANASCAL  [porto]
-- current: [∅]  →  final: [wellness, romantic, wine, nature]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'quinta-do-panascal'
  AND t.slug = ANY(ARRAY['wellness', 'romantic', 'wine', 'nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'quinta-do-panascal');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon', 'evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'quinta-do-panascal';

-- QUINTÃS FARM HOUSES  [porto]
-- current: [∅]  →  final: [local-secret, nature]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'quintas-farm-houses-porto'
  AND t.slug = ANY(ARRAY['local-secret', 'nature'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'quintas-farm-houses-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'quintas-farm-houses-porto';

-- REITORIA  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'reitoria-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'reitoria-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'reitoria-porto';

-- RESTAURANTE ANTIQVVM  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'restaurante-antiqvvm-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'restaurante-antiqvvm-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'restaurante-antiqvvm-porto';

-- RESTAURANTE DOC  [porto]
-- current: [∅]  →  final: [lunch, dinner, local-secret]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'restaurante-doc-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner', 'local-secret'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'restaurante-doc-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'restaurante-doc-porto';

-- RESTAURANTE EMOTIVO  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'restaurante-emotivo-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'restaurante-emotivo-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'restaurante-emotivo-porto';

-- RESTAURANTE PANORÂMICO DO HOTEL ELEVADOR  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'restaurante-panoramico-do-hotel-elevador-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'restaurante-panoramico-do-hotel-elevador-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'restaurante-panoramico-do-hotel-elevador-porto';

-- RESTAURANTE TERREIRO  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'restaurante-terreiro-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'restaurante-terreiro-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'restaurante-terreiro-porto';

-- ROLEX  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'rolex-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'rolex-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'rolex-porto';

-- SANTO PIZZARIA & STEAKHOUSE  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'santo-pizzaria-steakhouse'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'santo-pizzaria-steakhouse');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'santo-pizzaria-steakhouse';

-- SOLAR MOINHO DE VENTO  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'solar-moinho-de-vento-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'solar-moinho-de-vento-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'solar-moinho-de-vento-porto';

-- TABERNA RIO  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'taberna-rio-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'taberna-rio-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'taberna-rio-porto';

-- TERRA NOVA  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'terra-nova-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'terra-nova-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'terra-nova-porto';

-- THE  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'the-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'the-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'the-porto';

-- THE GASTRONOMIC RESTAURANT  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'the-gastronomic-restaurant-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'the-gastronomic-restaurant-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'the-gastronomic-restaurant-porto';

-- THE GIN HOUSE  [porto]
-- current: [∅]  →  final: [cocktails, wine, late-night]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'the-gin-house-porto'
  AND t.slug = ANY(ARRAY['cocktails', 'wine', 'late-night'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'the-gin-house-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'the-gin-house-porto';

-- THE MANOR HOUSE CELEIRÓS  [porto]
-- current: [∅]  →  final: [wellness, romantic]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'the-manor-house-celeiros'
  AND t.slug = ANY(ARRAY['wellness', 'romantic'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'the-manor-house-celeiros');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'evening'])
FROM places WHERE slug = 'the-manor-house-celeiros';

-- THE ROYAL COCKTAIL CLUB  [porto]
-- current: [∅]  →  final: [cocktails, wine, late-night]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'the-royal-cocktail-club-porto'
  AND t.slug = ANY(ARRAY['cocktails', 'wine', 'late-night'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'the-royal-cocktail-club-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'the-royal-cocktail-club-porto';

-- THE VINTAGE HOUSE  [porto]
-- current: [∅]  →  final: [wellness, romantic]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'the-vintage-house-porto'
  AND t.slug = ANY(ARRAY['wellness', 'romantic'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'the-vintage-house-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'evening'])
FROM places WHERE slug = 'the-vintage-house-porto';

-- THE YEATMAN WINE SPA  [porto]
-- current: [∅]  →  final: [local-secret, wellness, wine]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'the-yeatman-wine-spa-porto'
  AND t.slug = ANY(ARRAY['local-secret', 'wellness', 'wine'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'the-yeatman-wine-spa-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'afternoon', 'evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'the-yeatman-wine-spa-porto';

-- TUDOR  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'tudor-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'tudor-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'tudor-porto';

-- UVA BY CALÉM  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'uva-by-calem-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'uva-by-calem-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'uva-by-calem-porto';

-- VERMUTERIA GASTRO BAR  [porto]
-- current: [∅]  →  final: [local-secret, cocktails, wine]
-- issues: NO_TAGS; RESTAURANT_NO_MEAL_TAG
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'vermuteria-gastro-bar-porto'
  AND t.slug = ANY(ARRAY['local-secret', 'cocktails', 'wine'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'vermuteria-gastro-bar-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['evening', 'late_evening', 'deep_night'])
FROM places WHERE slug = 'vermuteria-gastro-bar-porto';

-- VIDAGO PALACE  [porto]
-- current: [∅]  →  final: [wellness, romantic]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'vidago-palace-porto'
  AND t.slug = ANY(ARRAY['wellness', 'romantic'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'vidago-palace-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'evening'])
FROM places WHERE slug = 'vidago-palace-porto';

-- VINHA RESTAURANT  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'vinha-restaurant-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'vinha-restaurant-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'vinha-restaurant-porto';

-- WISH RESTAURANT & SUSHI  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'wish-restaurant-sushi-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'wish-restaurant-sushi-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'wish-restaurant-sushi-porto';

-- ZAPATA BY CHAKALL  [porto]
-- current: [∅]  →  final: [lunch, dinner]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'zapata-by-chakall-porto'
  AND t.slug = ANY(ARRAY['lunch', 'dinner'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'zapata-by-chakall-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['midday', 'evening'])
FROM places WHERE slug = 'zapata-by-chakall-porto';

-- ZOAH STORE  [porto]
-- current: [∅]  →  final: [shopping, quick-stop]
-- issues: NO_TAGS
INSERT INTO place_now_tags (place_id, tag_id)
SELECT p.id, t.id
FROM places p, now_context_tags t
WHERE p.slug = 'zoah-store-porto'
  AND t.slug = ANY(ARRAY['shopping', 'quick-stop'])
ON CONFLICT (place_id, tag_id) DO NOTHING;
DELETE FROM place_now_time_windows
WHERE place_id = (SELECT id FROM places WHERE slug = 'zoah-store-porto');
INSERT INTO place_now_time_windows (place_id, time_window)
SELECT id, unnest(ARRAY['morning', 'midday', 'afternoon'])
FROM places WHERE slug = 'zoah-store-porto';

-- ════════════════════════════════════════════════════════════
-- Total UPDATEs in this patch: 324
-- ════════════════════════════════════════════════════════════

COMMIT;