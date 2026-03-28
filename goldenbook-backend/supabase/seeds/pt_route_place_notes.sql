-- Portuguese (pt) translations for route_place curator notes
-- Locale: pt  (resolved via pt-PT → pt fallback)
-- Tone: premium, editorial, natural European Portuguese
-- Generated: 2026-03-21
--
-- Resolves IDs dynamically from route slugs + sort_order
-- so this seed is safe to re-run at any time.

INSERT INTO route_place_translations (route_id, place_id, locale, note)
SELECT
  rp.route_id,
  rp.place_id,
  'pt',
  CASE
    -- ── Ícones de Luxo de Lisboa (lisbon-luxury-icons) ──────────────────────
    WHEN r.slug = 'lisbon-luxury-icons' AND rp.sort_order = 0
      THEN 'Comece aqui — uma fragrância rara numa cidade que entende o refinamento.'
    WHEN r.slug = 'lisbon-luxury-icons' AND rp.sort_order = 1
      THEN 'A joalharia mais refinada da cidade, com uma herança que fala por si.'
    WHEN r.slug = 'lisbon-luxury-icons' AND rp.sort_order = 2
      THEN 'Moda de luxo, curada com a precisão que define o estilo de Lisboa.'

    -- ── Uma Tarde Tranquila em Lisboa (quiet-lisbon-afternoon) ───────────────
    WHEN r.slug = 'quiet-lisbon-afternoon' AND rp.sort_order = 0
      THEN 'Onde o fado encontrou a sua voz — comece onde se guarda a alma da cidade.'
    WHEN r.slug = 'quiet-lisbon-afternoon' AND rp.sort_order = 1
      THEN 'Décadas de design curado convergem num espaço íntimo e sem pressa.'
    WHEN r.slug = 'quiet-lisbon-afternoon' AND rp.sort_order = 2
      THEN 'Um artesanato duradouro, perfeitamente em casa numa cidade que valoriza o que perdura.'
  END AS note
FROM route_places rp
JOIN routes r ON r.id = rp.route_id
WHERE r.slug IN ('lisbon-luxury-icons', 'quiet-lisbon-afternoon')
ON CONFLICT (route_id, place_id, locale)
DO UPDATE SET note = EXCLUDED.note, updated_at = now();
