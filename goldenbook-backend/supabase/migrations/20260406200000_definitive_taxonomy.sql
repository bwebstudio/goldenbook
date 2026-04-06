-- ═══════════════════════════════════════════════════════════════════════════
-- Definitive Goldenbook Taxonomy
-- 7 categories, ~30 subcategories, 3 locales (pt, en, es)
--
-- Strategy:
--   1. Rename/update existing categories where possible (gastronomy, culture, hotels, transport)
--   2. Merge activities + sports + events into experiences
--   3. Rename beaches → natureza-outdoor
--   4. Rename shops → retail
--   5. Add new subcategories (wine-bars, pastelarias, mercados, etc.)
--   6. Migrate place_categories that reference old categories
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. RENAME EXISTING CATEGORIES ────────────────────────────────────────

-- gastronomy stays as-is (slug remains 'gastronomy')
-- Just update sort_order
UPDATE categories SET sort_order = 1 WHERE slug = 'gastronomy';

-- culture stays (slug remains 'culture')
UPDATE categories SET sort_order = 2 WHERE slug = 'culture';

-- beaches → natureza-outdoor
UPDATE categories SET slug = 'natureza-outdoor', sort_order = 3 WHERE slug = 'beaches';

-- experiences stays (slug remains 'experiences')
UPDATE categories SET sort_order = 4 WHERE slug = 'experiences';

-- hotels → alojamento
UPDATE categories SET slug = 'alojamento', sort_order = 5 WHERE slug = 'hotels';

-- shops → retail
UPDATE categories SET slug = 'retail', sort_order = 6 WHERE slug = 'shops';

-- transport → mobilidade
UPDATE categories SET slug = 'mobilidade', sort_order = 7 WHERE slug = 'transport';

-- ─── 2. MERGE activities, sports, events → experiences ────────────────────

-- Move all place_categories from activities → experiences
UPDATE place_categories SET category_id = (SELECT id FROM categories WHERE slug = 'experiences')
WHERE category_id = (SELECT id FROM categories WHERE slug = 'activities');

-- Move subcategories from activities → experiences
UPDATE subcategories SET category_id = (SELECT id FROM categories WHERE slug = 'experiences')
WHERE category_id = (SELECT id FROM categories WHERE slug = 'activities');

-- Move all place_categories from sports → experiences
UPDATE place_categories SET category_id = (SELECT id FROM categories WHERE slug = 'experiences')
WHERE category_id = (SELECT id FROM categories WHERE slug = 'sports');

-- Move subcategories from sports → experiences
UPDATE subcategories SET category_id = (SELECT id FROM categories WHERE slug = 'experiences')
WHERE category_id = (SELECT id FROM categories WHERE slug = 'sports');

-- Move all place_categories from events → experiences
UPDATE place_categories SET category_id = (SELECT id FROM categories WHERE slug = 'experiences')
WHERE category_id = (SELECT id FROM categories WHERE slug = 'events');

-- Move subcategories from events → experiences
UPDATE subcategories SET category_id = (SELECT id FROM categories WHERE slug = 'experiences')
WHERE category_id = (SELECT id FROM categories WHERE slug = 'events');

-- Deactivate merged categories
UPDATE categories SET is_active = false WHERE slug IN ('activities', 'sports', 'events');

-- ─── 3. UPDATE CATEGORY TRANSLATIONS ─────────────────────────────────────

-- gastronomy (unchanged display names)
UPDATE category_translations SET name = 'Gastronomia' WHERE category_id = (SELECT id FROM categories WHERE slug = 'gastronomy') AND locale = 'pt';
UPDATE category_translations SET name = 'Food & Drinks' WHERE category_id = (SELECT id FROM categories WHERE slug = 'gastronomy') AND locale = 'en';
UPDATE category_translations SET name = 'Gastronomía' WHERE category_id = (SELECT id FROM categories WHERE slug = 'gastronomy') AND locale = 'es';

-- culture (unchanged)
UPDATE category_translations SET name = 'Cultura' WHERE category_id = (SELECT id FROM categories WHERE slug = 'culture') AND locale = 'pt';
UPDATE category_translations SET name = 'Culture' WHERE category_id = (SELECT id FROM categories WHERE slug = 'culture') AND locale = 'en';
UPDATE category_translations SET name = 'Cultura' WHERE category_id = (SELECT id FROM categories WHERE slug = 'culture') AND locale = 'es';

-- natureza-outdoor
UPDATE category_translations SET name = 'Natureza & Ar Livre' WHERE category_id = (SELECT id FROM categories WHERE slug = 'natureza-outdoor') AND locale = 'pt';
UPDATE category_translations SET name = 'Nature & Outdoors' WHERE category_id = (SELECT id FROM categories WHERE slug = 'natureza-outdoor') AND locale = 'en';
UPDATE category_translations SET name = 'Naturaleza & Aire Libre' WHERE category_id = (SELECT id FROM categories WHERE slug = 'natureza-outdoor') AND locale = 'es';

-- experiences
UPDATE category_translations SET name = 'Experiências' WHERE category_id = (SELECT id FROM categories WHERE slug = 'experiences') AND locale = 'pt';
UPDATE category_translations SET name = 'Experiences' WHERE category_id = (SELECT id FROM categories WHERE slug = 'experiences') AND locale = 'en';
UPDATE category_translations SET name = 'Experiencias' WHERE category_id = (SELECT id FROM categories WHERE slug = 'experiences') AND locale = 'es';

-- alojamento
UPDATE category_translations SET name = 'Alojamento' WHERE category_id = (SELECT id FROM categories WHERE slug = 'alojamento') AND locale = 'pt';
UPDATE category_translations SET name = 'Hotels & Stays' WHERE category_id = (SELECT id FROM categories WHERE slug = 'alojamento') AND locale = 'en';
UPDATE category_translations SET name = 'Alojamiento' WHERE category_id = (SELECT id FROM categories WHERE slug = 'alojamento') AND locale = 'es';

-- retail
UPDATE category_translations SET name = 'Compras' WHERE category_id = (SELECT id FROM categories WHERE slug = 'retail') AND locale = 'pt';
UPDATE category_translations SET name = 'Shopping' WHERE category_id = (SELECT id FROM categories WHERE slug = 'retail') AND locale = 'en';
UPDATE category_translations SET name = 'Compras' WHERE category_id = (SELECT id FROM categories WHERE slug = 'retail') AND locale = 'es';

-- mobilidade
UPDATE category_translations SET name = 'Mobilidade' WHERE category_id = (SELECT id FROM categories WHERE slug = 'mobilidade') AND locale = 'pt';
UPDATE category_translations SET name = 'Transport' WHERE category_id = (SELECT id FROM categories WHERE slug = 'mobilidade') AND locale = 'en';
UPDATE category_translations SET name = 'Movilidad' WHERE category_id = (SELECT id FROM categories WHERE slug = 'mobilidade') AND locale = 'es';

-- ─── 4. NORMALIZE EXISTING SUBCATEGORIES ─────────────────────────────────

-- Rename existing subcategories to definitive slugs where needed

-- gastronomy subs
UPDATE subcategories SET slug = 'restaurantes' WHERE slug = 'restaurants' AND category_id = (SELECT id FROM categories WHERE slug = 'gastronomy');
UPDATE subcategories SET slug = 'cafes' WHERE slug = 'cafes' AND category_id = (SELECT id FROM categories WHERE slug = 'gastronomy');
UPDATE subcategories SET slug = 'bares' WHERE slug = 'bars' AND category_id = (SELECT id FROM categories WHERE slug = 'gastronomy');
UPDATE subcategories SET slug = 'adegas' WHERE slug = 'wineries' AND category_id = (SELECT id FROM categories WHERE slug = 'gastronomy');
UPDATE subcategories SET slug = 'comida-tipica' WHERE slug = 'traditional_food' AND category_id = (SELECT id FROM categories WHERE slug = 'gastronomy');

-- culture subs
UPDATE subcategories SET slug = 'museus' WHERE slug = 'museums' AND category_id = (SELECT id FROM categories WHERE slug = 'culture');
UPDATE subcategories SET slug = 'monumentos' WHERE slug = 'monuments' AND category_id = (SELECT id FROM categories WHERE slug = 'culture');
UPDATE subcategories SET slug = 'galerias' WHERE slug = 'galleries' AND category_id = (SELECT id FROM categories WHERE slug = 'culture');
UPDATE subcategories SET slug = 'igrejas' WHERE slug = 'churches' AND category_id = (SELECT id FROM categories WHERE slug = 'culture');
UPDATE subcategories SET slug = 'sitios-historicos' WHERE slug = 'historical_sites' AND category_id = (SELECT id FROM categories WHERE slug = 'culture');

-- natureza-outdoor subs
UPDATE subcategories SET slug = 'praias' WHERE slug = 'natural_reserves' AND category_id = (SELECT id FROM categories WHERE slug = 'natureza-outdoor');
-- Wait — natural_reserves should stay. Let me rename properly:
UPDATE subcategories SET slug = 'parques' WHERE slug = 'parks' AND category_id = (SELECT id FROM categories WHERE slug = 'natureza-outdoor');
UPDATE subcategories SET slug = 'jardins' WHERE slug = 'gardens' AND category_id = (SELECT id FROM categories WHERE slug = 'natureza-outdoor');
UPDATE subcategories SET slug = 'miradouros' WHERE slug = 'viewpoints' AND category_id = (SELECT id FROM categories WHERE slug = 'natureza-outdoor');
UPDATE subcategories SET slug = 'reservas' WHERE slug = 'natural_reserves' AND category_id = (SELECT id FROM categories WHERE slug = 'natureza-outdoor');
UPDATE subcategories SET slug = 'cascatas' WHERE slug = 'waterfalls' AND category_id = (SELECT id FROM categories WHERE slug = 'natureza-outdoor');

-- experiences subs (from merged activities + sports + events + experiences)
UPDATE subcategories SET slug = 'bem-estar' WHERE slug = 'health_wellness' AND category_id = (SELECT id FROM categories WHERE slug = 'experiences');
UPDATE subcategories SET slug = 'vida-noturna' WHERE slug = 'nightlife' AND category_id = (SELECT id FROM categories WHERE slug = 'experiences');
UPDATE subcategories SET slug = 'experiencias-unicas' WHERE slug = 'experiences' AND category_id = (SELECT id FROM categories WHERE slug = 'experiences');
UPDATE subcategories SET slug = 'desporto-golf' WHERE slug = 'golf' AND category_id = (SELECT id FROM categories WHERE slug = 'experiences');
UPDATE subcategories SET slug = 'desporto-caminhadas' WHERE slug = 'hiking' AND category_id = (SELECT id FROM categories WHERE slug = 'experiences');
UPDATE subcategories SET slug = 'desporto-equitacao' WHERE slug = 'horse_riding' AND category_id = (SELECT id FROM categories WHERE slug = 'experiences');
UPDATE subcategories SET slug = 'desporto-aquatico' WHERE slug = 'water_sports' AND category_id = (SELECT id FROM categories WHERE slug = 'experiences');
UPDATE subcategories SET slug = 'concertos' WHERE slug = 'concerts' AND category_id = (SELECT id FROM categories WHERE slug = 'experiences');
UPDATE subcategories SET slug = 'eventos-culturais' WHERE slug = 'cultural_events' AND category_id = (SELECT id FROM categories WHERE slug = 'experiences');
UPDATE subcategories SET slug = 'exposicoes' WHERE slug = 'exhibitions' AND category_id = (SELECT id FROM categories WHERE slug = 'experiences');
UPDATE subcategories SET slug = 'feiras' WHERE slug = 'fairs' AND category_id = (SELECT id FROM categories WHERE slug = 'experiences');
UPDATE subcategories SET slug = 'festivais' WHERE slug = 'festivals' AND category_id = (SELECT id FROM categories WHERE slug = 'experiences');

-- alojamento subs
UPDATE subcategories SET slug = 'hoteis' WHERE slug = 'hotels' AND category_id = (SELECT id FROM categories WHERE slug = 'alojamento');

-- retail subs
UPDATE subcategories SET slug = 'moda' WHERE slug = 'fashion' AND category_id = (SELECT id FROM categories WHERE slug = 'retail');
UPDATE subcategories SET slug = 'joalharia' WHERE slug = 'jewellery' AND category_id = (SELECT id FROM categories WHERE slug = 'retail');
UPDATE subcategories SET slug = 'lojas-locais' WHERE slug = 'local_shops' AND category_id = (SELECT id FROM categories WHERE slug = 'retail');
UPDATE subcategories SET slug = 'centros-comerciais' WHERE slug = 'malls' AND category_id = (SELECT id FROM categories WHERE slug = 'retail');
UPDATE subcategories SET slug = 'decoracao' WHERE slug = 'decoration' AND category_id = (SELECT id FROM categories WHERE slug = 'retail');
UPDATE subcategories SET slug = 'imobiliario' WHERE slug = 'real_estate' AND category_id = (SELECT id FROM categories WHERE slug = 'retail');
UPDATE subcategories SET slug = 'lembracas' WHERE slug = 'souvenirs' AND category_id = (SELECT id FROM categories WHERE slug = 'retail');
UPDATE subcategories SET slug = 'lojas-tradicionais' WHERE slug = 'traditional_shops' AND category_id = (SELECT id FROM categories WHERE slug = 'retail');
UPDATE subcategories SET slug = 'relojoaria' WHERE slug = 'watches' AND category_id = (SELECT id FROM categories WHERE slug = 'retail');
UPDATE subcategories SET slug = 'artesanato' WHERE slug = 'crafts' AND category_id = (SELECT id FROM categories WHERE slug = 'retail');

-- mobilidade subs
UPDATE subcategories SET slug = 'aeroporto' WHERE slug = 'airport' AND category_id = (SELECT id FROM categories WHERE slug = 'mobilidade');
UPDATE subcategories SET slug = 'rent-a-car' WHERE slug = 'car_rental' AND category_id = (SELECT id FROM categories WHERE slug = 'mobilidade');

-- ─── 5. ADD NEW SUBCATEGORIES ─────────────────────────────────────────────

-- wine-bars (gastronomy)
INSERT INTO subcategories (category_id, slug, sort_order)
SELECT id, 'wine-bars', 4 FROM categories WHERE slug = 'gastronomy'
ON CONFLICT (category_id, slug) DO NOTHING;

-- pastelarias (gastronomy)
INSERT INTO subcategories (category_id, slug, sort_order)
SELECT id, 'pastelarias', 5 FROM categories WHERE slug = 'gastronomy'
ON CONFLICT (category_id, slug) DO NOTHING;

-- teatros (culture)
INSERT INTO subcategories (category_id, slug, sort_order)
SELECT id, 'teatros', 6 FROM categories WHERE slug = 'culture'
ON CONFLICT (category_id, slug) DO NOTHING;

-- praias (natureza-outdoor) — if not already present
INSERT INTO subcategories (category_id, slug, sort_order)
SELECT id, 'praias', 1 FROM categories WHERE slug = 'natureza-outdoor'
ON CONFLICT (category_id, slug) DO NOTHING;

-- tours (experiences)
INSERT INTO subcategories (category_id, slug, sort_order)
SELECT id, 'tours', 2 FROM categories WHERE slug = 'experiences'
ON CONFLICT (category_id, slug) DO NOTHING;

-- desporto (experiences — umbrella for sports)
INSERT INTO subcategories (category_id, slug, sort_order)
SELECT id, 'desporto', 4 FROM categories WHERE slug = 'experiences'
ON CONFLICT (category_id, slug) DO NOTHING;

-- eventos (experiences — umbrella for events)
INSERT INTO subcategories (category_id, slug, sort_order)
SELECT id, 'eventos', 5 FROM categories WHERE slug = 'experiences'
ON CONFLICT (category_id, slug) DO NOTHING;

-- resorts (alojamento)
INSERT INTO subcategories (category_id, slug, sort_order)
SELECT id, 'resorts', 2 FROM categories WHERE slug = 'alojamento'
ON CONFLICT (category_id, slug) DO NOTHING;

-- boutique (alojamento)
INSERT INTO subcategories (category_id, slug, sort_order)
SELECT id, 'boutique', 3 FROM categories WHERE slug = 'alojamento'
ON CONFLICT (category_id, slug) DO NOTHING;

-- mercados (retail)
INSERT INTO subcategories (category_id, slug, sort_order)
SELECT id, 'mercados', 5 FROM categories WHERE slug = 'retail'
ON CONFLICT (category_id, slug) DO NOTHING;

-- linhas-aereas (mobilidade)
INSERT INTO subcategories (category_id, slug, sort_order)
SELECT id, 'linhas-aereas', 3 FROM categories WHERE slug = 'mobilidade'
ON CONFLICT (category_id, slug) DO NOTHING;

-- ─── 6. ADD SUBCATEGORY TRANSLATIONS ──────────────────────────────────────

-- Helper: upsert translations for subcategory by slug + category slug
-- We'll do this for all subcategories in bulk

-- gastronomy subcategories
INSERT INTO subcategory_translations (subcategory_id, locale, name)
SELECT s.id, t.locale, t.name FROM subcategories s
JOIN categories c ON c.id = s.category_id AND c.slug = 'gastronomy'
CROSS JOIN (VALUES
  ('restaurantes', 'pt', 'Restaurantes'), ('restaurantes', 'en', 'Restaurants'), ('restaurantes', 'es', 'Restaurantes'),
  ('cafes',        'pt', 'Cafés'),        ('cafes',        'en', 'Cafes'),       ('cafes',        'es', 'Cafés'),
  ('bares',        'pt', 'Bares'),        ('bares',        'en', 'Bars'),        ('bares',        'es', 'Bares'),
  ('wine-bars',    'pt', 'Wine Bars'),    ('wine-bars',    'en', 'Wine Bars'),   ('wine-bars',    'es', 'Wine Bars'),
  ('adegas',       'pt', 'Adegas & Vinhos'), ('adegas',    'en', 'Wineries'),    ('adegas',       'es', 'Bodegas'),
  ('pastelarias',  'pt', 'Pastelarias'),  ('pastelarias',  'en', 'Bakeries & Pastry'), ('pastelarias', 'es', 'Pastelerías'),
  ('comida-tipica','pt', 'Gastronomia Típica'), ('comida-tipica', 'en', 'Traditional Food'), ('comida-tipica', 'es', 'Gastronomía Típica')
) AS t(sub_slug, locale, name)
WHERE s.slug = t.sub_slug
ON CONFLICT (subcategory_id, locale) DO UPDATE SET name = EXCLUDED.name, updated_at = now();

-- culture subcategories
INSERT INTO subcategory_translations (subcategory_id, locale, name)
SELECT s.id, t.locale, t.name FROM subcategories s
JOIN categories c ON c.id = s.category_id AND c.slug = 'culture'
CROSS JOIN (VALUES
  ('museus',            'pt', 'Museus'),           ('museus',            'en', 'Museums'),          ('museus',            'es', 'Museos'),
  ('monumentos',        'pt', 'Monumentos'),       ('monumentos',        'en', 'Monuments'),        ('monumentos',        'es', 'Monumentos'),
  ('galerias',          'pt', 'Galerias'),         ('galerias',          'en', 'Galleries'),        ('galerias',          'es', 'Galerías'),
  ('igrejas',           'pt', 'Igrejas'),          ('igrejas',           'en', 'Churches'),         ('igrejas',           'es', 'Iglesias'),
  ('sitios-historicos',  'pt', 'Sítios Históricos'), ('sitios-historicos', 'en', 'Historical Sites'), ('sitios-historicos', 'es', 'Sitios Históricos'),
  ('teatros',           'pt', 'Teatros'),          ('teatros',           'en', 'Theaters & Venues'), ('teatros',          'es', 'Teatros')
) AS t(sub_slug, locale, name)
WHERE s.slug = t.sub_slug
ON CONFLICT (subcategory_id, locale) DO UPDATE SET name = EXCLUDED.name, updated_at = now();

-- natureza-outdoor subcategories
INSERT INTO subcategory_translations (subcategory_id, locale, name)
SELECT s.id, t.locale, t.name FROM subcategories s
JOIN categories c ON c.id = s.category_id AND c.slug = 'natureza-outdoor'
CROSS JOIN (VALUES
  ('praias',     'pt', 'Praias'),             ('praias',     'en', 'Beaches'),          ('praias',     'es', 'Playas'),
  ('parques',    'pt', 'Parques'),            ('parques',    'en', 'Parks & Gardens'),   ('parques',    'es', 'Parques'),
  ('jardins',    'pt', 'Jardins'),            ('jardins',    'en', 'Gardens'),           ('jardins',    'es', 'Jardines'),
  ('miradouros', 'pt', 'Miradouros'),         ('miradouros', 'en', 'Viewpoints'),        ('miradouros', 'es', 'Miradores'),
  ('reservas',   'pt', 'Reservas Naturais'),   ('reservas',   'en', 'Nature Reserves'),   ('reservas',   'es', 'Reservas Naturales'),
  ('cascatas',   'pt', 'Cascatas'),            ('cascatas',   'en', 'Waterfalls'),         ('cascatas',   'es', 'Cascadas')
) AS t(sub_slug, locale, name)
WHERE s.slug = t.sub_slug
ON CONFLICT (subcategory_id, locale) DO UPDATE SET name = EXCLUDED.name, updated_at = now();

-- experiences subcategories
INSERT INTO subcategory_translations (subcategory_id, locale, name)
SELECT s.id, t.locale, t.name FROM subcategories s
JOIN categories c ON c.id = s.category_id AND c.slug = 'experiences'
CROSS JOIN (VALUES
  ('experiencias-unicas', 'pt', 'Experiências Únicas'), ('experiencias-unicas', 'en', 'Unique Experiences'), ('experiencias-unicas', 'es', 'Experiencias Únicas'),
  ('bem-estar',           'pt', 'Bem-Estar & Spa'),     ('bem-estar',           'en', 'Wellness & Spa'),     ('bem-estar',           'es', 'Bienestar & Spa'),
  ('tours',               'pt', 'Tours & Excursões'),    ('tours',               'en', 'Tours & Excursions'), ('tours',               'es', 'Tours & Excursiones'),
  ('vida-noturna',        'pt', 'Vida Noturna'),         ('vida-noturna',        'en', 'Nightlife'),          ('vida-noturna',        'es', 'Vida Nocturna'),
  ('desporto',            'pt', 'Desporto & Outdoor'),   ('desporto',            'en', 'Sports & Outdoor'),   ('desporto',            'es', 'Deporte & Outdoor'),
  ('eventos',             'pt', 'Eventos'),              ('eventos',             'en', 'Events'),             ('eventos',             'es', 'Eventos')
) AS t(sub_slug, locale, name)
WHERE s.slug = t.sub_slug
ON CONFLICT (subcategory_id, locale) DO UPDATE SET name = EXCLUDED.name, updated_at = now();

-- alojamento subcategories
INSERT INTO subcategory_translations (subcategory_id, locale, name)
SELECT s.id, t.locale, t.name FROM subcategories s
JOIN categories c ON c.id = s.category_id AND c.slug = 'alojamento'
CROSS JOIN (VALUES
  ('hoteis',   'pt', 'Hotéis'),          ('hoteis',   'en', 'Hotels'),          ('hoteis',   'es', 'Hoteles'),
  ('resorts',  'pt', 'Resorts'),         ('resorts',  'en', 'Resorts'),         ('resorts',  'es', 'Resorts'),
  ('boutique', 'pt', 'Hotéis Boutique'), ('boutique', 'en', 'Boutique Hotels'), ('boutique', 'es', 'Hoteles Boutique')
) AS t(sub_slug, locale, name)
WHERE s.slug = t.sub_slug
ON CONFLICT (subcategory_id, locale) DO UPDATE SET name = EXCLUDED.name, updated_at = now();

-- retail subcategories
INSERT INTO subcategory_translations (subcategory_id, locale, name)
SELECT s.id, t.locale, t.name FROM subcategories s
JOIN categories c ON c.id = s.category_id AND c.slug = 'retail'
CROSS JOIN (VALUES
  ('moda',               'pt', 'Moda'),              ('moda',               'en', 'Fashion'),           ('moda',               'es', 'Moda'),
  ('joalharia',          'pt', 'Joalharia'),          ('joalharia',          'en', 'Jewellery & Watches'), ('joalharia',        'es', 'Joyería'),
  ('lojas-locais',       'pt', 'Lojas Locais'),       ('lojas-locais',       'en', 'Local Shops'),       ('lojas-locais',       'es', 'Tiendas Locales'),
  ('centros-comerciais', 'pt', 'Centros Comerciais'),  ('centros-comerciais', 'en', 'Malls'),             ('centros-comerciais', 'es', 'Centros Comerciales'),
  ('decoracao',          'pt', 'Decoração & Design'),  ('decoracao',          'en', 'Home & Design'),     ('decoracao',          'es', 'Decoración'),
  ('mercados',           'pt', 'Mercados'),            ('mercados',           'en', 'Markets'),           ('mercados',           'es', 'Mercados'),
  ('imobiliario',        'pt', 'Imobiliário'),         ('imobiliario',        'en', 'Real Estate'),       ('imobiliario',        'es', 'Inmobiliario'),
  ('lembracas',          'pt', 'Lembranças'),          ('lembracas',          'en', 'Souvenirs'),         ('lembracas',          'es', 'Recuerdos'),
  ('lojas-tradicionais', 'pt', 'Lojas Tradicionais'),  ('lojas-tradicionais', 'en', 'Traditional Shops'), ('lojas-tradicionais', 'es', 'Tiendas Tradicionales'),
  ('relojoaria',         'pt', 'Relojoaria'),          ('relojoaria',         'en', 'Watches'),           ('relojoaria',         'es', 'Relojería'),
  ('artesanato',         'pt', 'Artesanato'),          ('artesanato',         'en', 'Crafts'),            ('artesanato',         'es', 'Artesanía')
) AS t(sub_slug, locale, name)
WHERE s.slug = t.sub_slug
ON CONFLICT (subcategory_id, locale) DO UPDATE SET name = EXCLUDED.name, updated_at = now();

-- mobilidade subcategories
INSERT INTO subcategory_translations (subcategory_id, locale, name)
SELECT s.id, t.locale, t.name FROM subcategories s
JOIN categories c ON c.id = s.category_id AND c.slug = 'mobilidade'
CROSS JOIN (VALUES
  ('aeroporto',     'pt', 'Aeroporto'),      ('aeroporto',     'en', 'Airport'),      ('aeroporto',     'es', 'Aeropuerto'),
  ('rent-a-car',    'pt', 'Aluguer de Carros'), ('rent-a-car', 'en', 'Car Rental'),    ('rent-a-car',    'es', 'Alquiler de Coches'),
  ('linhas-aereas', 'pt', 'Linhas Aéreas'),   ('linhas-aereas', 'en', 'Airlines'),     ('linhas-aereas', 'es', 'Líneas Aéreas')
) AS t(sub_slug, locale, name)
WHERE s.slug = t.sub_slug
ON CONFLICT (subcategory_id, locale) DO UPDATE SET name = EXCLUDED.name, updated_at = now();

-- ─── 7. CONSOLIDATE SPORT SUB-CATEGORIES INTO desporto ────────────────────
-- Move places from fine-grained sport subs to umbrella 'desporto'

UPDATE place_categories SET subcategory_id = (
  SELECT s.id FROM subcategories s JOIN categories c ON c.id = s.category_id
  WHERE c.slug = 'experiences' AND s.slug = 'desporto'
)
WHERE subcategory_id IN (
  SELECT s.id FROM subcategories s JOIN categories c ON c.id = s.category_id
  WHERE c.slug = 'experiences' AND s.slug IN ('desporto-golf', 'desporto-caminhadas', 'desporto-equitacao', 'desporto-aquatico')
);

-- Consolidate event sub-categories into 'eventos'
UPDATE place_categories SET subcategory_id = (
  SELECT s.id FROM subcategories s JOIN categories c ON c.id = s.category_id
  WHERE c.slug = 'experiences' AND s.slug = 'eventos'
)
WHERE subcategory_id IN (
  SELECT s.id FROM subcategories s JOIN categories c ON c.id = s.category_id
  WHERE c.slug = 'experiences' AND s.slug IN ('concertos', 'eventos-culturais', 'exposicoes', 'feiras', 'festivais')
);

-- Deactivate granular sport/event subs (keep umbrella ones)
UPDATE subcategories SET is_active = false
WHERE slug IN ('desporto-golf', 'desporto-caminhadas', 'desporto-equitacao', 'desporto-aquatico',
               'concertos', 'eventos-culturais', 'exposicoes', 'feiras', 'festivais');

COMMIT;
