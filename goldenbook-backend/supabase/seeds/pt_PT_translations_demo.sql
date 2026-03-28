-- ==============================================================
-- GOLDENBOOK — pt-PT Translation Seed — DEMO FLOW
-- ==============================================================
--
-- Context
-- -------
-- All existing translation rows in the database use locale='pt'.
-- The Goldenbook app sends locale='pt-PT' for European Portuguese.
-- The backend queries join on AND pt.locale = $2 — so every existing
-- 'pt' row is invisible to the app when the user selects Portuguese.
--
-- This seed inserts locale='pt-PT' rows for all demo-critical content:
--   A) 4 destinations  (Lisboa, Porto, Algarve, Madeira)
--   B) 8 demo places   (Lisboa Discover: hero, picks[1-4], hidden[1-4])
--   C) 2 demo routes   (Lisbon Luxury Icons, A Quiet Lisbon Afternoon)
--
-- All statements are UPSERT-safe: ON CONFLICT DO UPDATE.
-- Safe to re-run. Does not touch existing 'pt' rows.
--
-- Place IDs confirmed from data-migration/transformed/places.json
-- Destination IDs confirmed from data-migration/transformed/destinations.json
-- Route IDs resolved at runtime by slug.
-- ==============================================================


-- ==============================================================
-- A) DESTINATION TRANSLATIONS
-- ==============================================================
-- destination_id  slug     name
-- 18d254ba...     lisboa   Lisboa
-- 6a1fff4f...     porto    Porto
-- 64a5271c...     algarve  Algarve
-- a7077813...     madeira  Madeira
-- All four destination names are proper nouns — identical in pt-PT.
-- We still need the rows so COALESCE finds them on the pt-PT join.
-- ==============================================================

INSERT INTO destination_translations
  (id, destination_id, locale, name, created_at, updated_at)
VALUES
  (gen_random_uuid(), '18d254ba-469d-e767-1bb8-f72ed9a48568', 'pt-PT', 'Lisboa',  now(), now()),
  (gen_random_uuid(), '6a1fff4f-250b-6909-c4fe-31d6daffa0c1', 'pt-PT', 'Porto',   now(), now()),
  (gen_random_uuid(), '64a5271c-b0f5-c07b-b0fa-9201ba11311d', 'pt-PT', 'Algarve', now(), now()),
  (gen_random_uuid(), 'a7077813-b0d1-1f2f-1e3d-68bf5be3670b', 'pt-PT', 'Madeira', now(), now())
ON CONFLICT (destination_id, locale) DO UPDATE
  SET name       = EXCLUDED.name,
      updated_at = now();


-- ==============================================================
-- B) PLACE TRANSLATIONS — 8 DEMO PLACES (ALL IN LISBOA)
-- ==============================================================
-- Slot mapping (from discover_lisboa.sql seed):
--   slot[1] = Xerjoff              → hero + picks[1] + route1_stop1
--   slot[2] = David Rosas          → picks[2] + route1_stop2
--   slot[3] = Fashion Clinic Women → picks[3] + route1_stop3
--   slot[4] = Fashion Clinic Men   → picks[4]
--   slot[5] = Embassy              → hidden[1]
--   slot[6] = Fundação Amália      → hidden[2] + route2_stop1
--   slot[7] = Elements 75'80       → hidden[3] + route2_stop2
--   slot[8] = Barbour              → hidden[4] + route2_stop3
--
-- Fields:
--   name             — brand/proper names are kept in their original form
--   short_description — concise card-level description (1–2 lines)
--   full_description  — editorial paragraph(s) for detail screen
--   goldenbook_note   — Goldenbook perspective (1st-person plural, opinionated)
--   why_we_love_it    — specific reason, sensory / concrete
--   insider_tip       — actionable, exclusive, specific to this place
-- ==============================================================


-- ── 1. XERJOFF – Boutique Lisboa ─────────────────────────────
-- place_id: c04152de-c905-b5c7-0fc9-2d9fe25391f0
-- Slot: hero + picks[1] + route1_stop1
-- Context: Italian luxury fragrance house flagship in central Lisbon.
--   Founded in Turin. Rare ingredients, artisan craftsmanship, bespoke service.
-- Note: name is a brand name — keep as-is.

INSERT INTO place_translations
  (id, place_id, locale, name, short_description, full_description,
   goldenbook_note, why_we_love_it, insider_tip, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'c04152de-c905-b5c7-0fc9-2d9fe25391f0',
  'pt-PT',
  'XERJOFF  – Boutique Lisboa',
  'Alta perfumaria italiana no coração de Lisboa.',
  'No centro de Lisboa encontra-se a única boutique Xerjoff em Portugal — um destino para quem trata a fragrância como arte e não como hábito. Fundada em Turim, a Xerjoff trabalha com ingredientes raros e técnicas artesanais que poucos perfumistas no mundo dominam. Cada frasco é uma afirmação de gosto. Cada composição, uma descoberta.',
  'Xerjoff representa o cume da perfumaria de autor: cada frasco é uma obra, cada fragrância uma declaração de intenções. Numa cidade saturada de perfumarias de shopping, esta boutique é um caso à parte.',
  'Porque num mundo de massificação, a Xerjoff escolhe a raridade como princípio. Os ingredientes são excepcionais. O atendimento é silenciosamente perfeito. E o espaço foi desenhado para tornar cada visita numa experiência, não numa compra.',
  'Peça para experimentar a coleção Sospiro em sessão privada — algumas das composições mais elaboradas da casa raramente estão nos expositores principais. O staff faz questão de apresentar o percurso criativo de cada fragrância.'
, now(), now())
ON CONFLICT (place_id, locale) DO UPDATE
  SET name              = EXCLUDED.name,
      short_description = EXCLUDED.short_description,
      full_description  = EXCLUDED.full_description,
      goldenbook_note   = EXCLUDED.goldenbook_note,
      why_we_love_it    = EXCLUDED.why_we_love_it,
      insider_tip       = EXCLUDED.insider_tip,
      updated_at        = now();


-- ── 2. DAVID ROSAS – Avenida da Liberdade, Lisboa ────────────
-- place_id: 4dcd7eb9-2926-b7a7-170f-3e2a41954926
-- Slot: picks[2] + route1_stop2
-- Context: Portugal's leading luxury jewelry and watch retailer.
--   Flagship on Av. da Liberdade — 3 floors, the largest high jewelry
--   and watchmaking boutique in Portugal. Carries Patek Philippe, Rolex,
--   Panerai, Chanel, Hermès, Chopard, Hublot, and own collections.

INSERT INTO place_translations
  (id, place_id, locale, name, short_description, full_description,
   goldenbook_note, why_we_love_it, insider_tip, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '4dcd7eb9-2926-b7a7-170f-3e2a41954926',
  'pt-PT',
  'DAVID ROSAS',
  'A maior loja de alta joalharia e relojoaria do país, na artéria mais elegante de Lisboa.',
  'A loja David Rosas na Avenida da Liberdade é o espaço de referência de alta joalharia e relojoaria em Portugal. Três pisos de arquitetura elegante, universos masculino e feminino cuidadosamente separados, e uma seleção das mais prestigiadas marcas mundiais: Patek Philippe, Rolex, Panerai, Chanel, Hermès, Chopard, Hublot e as próprias criações da casa. Um destino para quem reconhece a diferença entre comprar e escolher.',
  'Três pisos de excelência absoluta: alta joalharia, relógios de coleção e um serviço de atendimento que raramente se encontra fora de Genebra ou Paris. A David Rosas não vende objetos — cria relações duradouras com o tempo e com o luxo.',
  'Porque a David Rosas construiu décadas de confiança com quem percebe de joalharia e relojoaria séria em Portugal. A curadoria de marcas é irrepreensível e o conhecimento do staff vai muito além do catálogo.',
  'O terceiro piso é reservado a peças de alta joalharia e a algumas referências de relojoaria que não estão expostas nos pisos inferiores. Vale pedir acesso — a visita é discreta, o nível de peças é diferente.'
, now(), now())
ON CONFLICT (place_id, locale) DO UPDATE
  SET name              = EXCLUDED.name,
      short_description = EXCLUDED.short_description,
      full_description  = EXCLUDED.full_description,
      goldenbook_note   = EXCLUDED.goldenbook_note,
      why_we_love_it    = EXCLUDED.why_we_love_it,
      insider_tip       = EXCLUDED.insider_tip,
      updated_at        = now();


-- ── 3. FASHION CLINIC WOMEN ──────────────────────────────────
-- place_id: 6e1d294c-84e1-3481-3de1-31111831fa81
-- Slot: picks[3] + route1_stop3
-- Context: Multi-brand luxury fashion boutique for women. Over 50 brands
--   including Moncler, Valentino, Max Mara, Balenciaga, and fragrances/accessories.
-- Note: source data had "THE BEST CURATION OF LUXURY BRANDS" in both locales — replaced.

INSERT INTO place_translations
  (id, place_id, locale, name, short_description, full_description,
   goldenbook_note, why_we_love_it, insider_tip, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '6e1d294c-84e1-3481-3de1-31111831fa81',
  'pt-PT',
  'FASHION CLINIC WOMEN',
  'A curadoria de mais de cinquenta marcas de moda de luxo para mulher em Lisboa.',
  'A Fashion Clinic Women reúne mais de cinquenta marcas de moda de luxo, fragrâncias e lifestyle num espaço desenhado para a mulher que não precisa de explicações. De Moncler a Valentino, de Max Mara a Balenciaga, a seleção é feita com o olho apurado de um editor de moda que sabe o que funciona nesta cidade.',
  'A Fashion Clinic tem o olhar de um editor de moda: não encontra aqui o óbvio, mas a seleção que alguém com muito gosto faria por si. Num único espaço, as melhores maisons — dispostas com a clareza de quem sabe o que vende.',
  'Pela amplitude sem excessos e pela forma como o espaço facilita a decisão. As coleções conversam entre si. A iluminação é honesta. O resultado é uma loja onde raramente se sai de mãos a abanar.',
  'As novidades de temporada chegam frequentemente antes de estarem disponíveis nos sites das marcas. O primeiro andar costuma ter peças que ainda não chegaram ao radar do grande público.'
, now(), now())
ON CONFLICT (place_id, locale) DO UPDATE
  SET name              = EXCLUDED.name,
      short_description = EXCLUDED.short_description,
      full_description  = EXCLUDED.full_description,
      goldenbook_note   = EXCLUDED.goldenbook_note,
      why_we_love_it    = EXCLUDED.why_we_love_it,
      insider_tip       = EXCLUDED.insider_tip,
      updated_at        = now();


-- ── 4. FASHION CLINIC MEN ────────────────────────────────────
-- place_id: 8242da11-2654-8460-e3c1-7efe8da02051
-- Slot: picks[4]
-- Context: Multi-brand luxury fashion boutique for men. Over 50 brands
--   including Brioni, Moncler, Dsquared2, Kenzo, Canali, fragrances/lifestyle.
-- Note: source data had "THE BEST CURATION OF LUXURY BRANDS" — replaced.

INSERT INTO place_translations
  (id, place_id, locale, name, short_description, full_description,
   goldenbook_note, why_we_love_it, insider_tip, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '8242da11-2654-8460-e3c1-7efe8da02051',
  'pt-PT',
  'FASHION CLINIC MEN',
  'A curadoria de mais de cinquenta marcas de moda, fragrâncias e lifestyle para homem.',
  'A Fashion Clinic Men apresenta uma das mais completas seleções de moda de luxo masculina em Portugal. De Brioni a Moncler, de Canali a Dsquared2 — cada coleção foi escolhida por quem percebe o que distingue uma peça memorável de uma peça apenas cara. O espaço facilita a decisão: limpo, bem iluminado, sem ruído visual.',
  'O melhor do guarda-roupa masculino de luxo sob o mesmo teto, sem compromissos de qualidade. Da cerimónia ao casual de primeira linha, a Fashion Clinic Men tem o que é preciso e pouco mais — o que, neste caso, é um elogio.',
  'Porque aqui encontra desde o fato de cerimônia ao casaco de viagem ideal, com a certeza de que cada peça foi selecionada com genuíno rigor editorial, não por quota de marcas ou acordos comerciais.',
  'Os estilistas da loja conhecem as coleções com profundidade real. Peça aconselhamento diretamente — a competência é genuína e o serviço não é invasivo.'
, now(), now())
ON CONFLICT (place_id, locale) DO UPDATE
  SET name              = EXCLUDED.name,
      short_description = EXCLUDED.short_description,
      full_description  = EXCLUDED.full_description,
      goldenbook_note   = EXCLUDED.goldenbook_note,
      why_we_love_it    = EXCLUDED.why_we_love_it,
      insider_tip       = EXCLUDED.insider_tip,
      updated_at        = now();


-- ── 5. EMBASSY ───────────────────────────────────────────────
-- place_id: 61e14af7-8768-cbf5-dab2-753e2bbbf17b
-- Slot: hidden[1]
-- Context: Niche perfumery in Lisbon, focused exclusively on artisanal and
--   independent fragrance houses. Editorial curation, intimate space, no
--   mainstream brands. Many labels exclusive to this address in Portugal.

INSERT INTO place_translations
  (id, place_id, locale, name, short_description, full_description,
   goldenbook_note, why_we_love_it, insider_tip, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '61e14af7-8768-cbf5-dab2-753e2bbbf17b',
  'pt-PT',
  'EMBASSY',
  'A melhor seleção de perfumaria de nicho de Lisboa, num espaço intimista e sem pressa.',
  'Na Embassy, o perfume é tratado como arte, expressão e identidade. Um espaço dedicado exclusivamente a casas de fragrâncias independentes — marcas que escolhem a liberdade criativa acima das tendências. O ambiente é sofisticado e intimista, o atendimento é personalizado e o tempo tem outro ritmo. Muitas das marcas aqui representadas são exclusivas a este espaço em Portugal.',
  'Na Embassy, o perfume é tratado como arte: cada frasco representa uma decisão criativa, não uma fórmula de mercado. É aqui que Lisboa descobre as casas que ainda não chegaram a mais nenhuma loja do país.',
  'Pelo rigor da curadoria e pela raridade das marcas. Entrar na Embassy é ter acesso a um universo olfativo que a maioria das pessoas nunca encontrará num centro comercial. Isso, em Lisboa, é muito.',
  'Chegue sem pressa e diga o que sente, não o que procura. O staff trabalha por associação sensorial e raramente falha a leitura. Reserve pelo menos quarenta e cinco minutos para a primeira visita.'
, now(), now())
ON CONFLICT (place_id, locale) DO UPDATE
  SET name              = EXCLUDED.name,
      short_description = EXCLUDED.short_description,
      full_description  = EXCLUDED.full_description,
      goldenbook_note   = EXCLUDED.goldenbook_note,
      why_we_love_it    = EXCLUDED.why_we_love_it,
      insider_tip       = EXCLUDED.insider_tip,
      updated_at        = now();


-- ── 6. FUNDAÇÃO AMÁLIA RODRIGUES ─────────────────────────────
-- place_id: e3720f28-1703-14f8-9a7a-292f3b1dd992
-- Slot: hidden[2] + route2_stop1
-- Context: Foundation dedicated to fado legend Amália Rodrigues.
--   Located in the house where she lived in Lisbon until her death in 1999.
--   A cultural museum of the highest emotional resonance.
-- Note: proper noun — name stays in Portuguese as-is.

INSERT INTO place_translations
  (id, place_id, locale, name, short_description, full_description,
   goldenbook_note, why_we_love_it, insider_tip, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'e3720f28-1703-14f8-9a7a-292f3b1dd992',
  'pt-PT',
  'FUNDAÇÃO AMÁLIA RODRIGUES',
  'A casa onde Amália viveu, preservada como memória viva do fado e da alma portuguesa.',
  'A Fundação Amália Rodrigues ocupa o edifício setecentista onde a maior voz do fado viveu durante décadas. Mais do que um museu, é uma visita à memória de uma mulher que conquistou os maiores palcos internacionais sem nunca deixar de ser de Lisboa. O espaço preserva o quotidiano e os objetos pessoais de Amália com uma dignidade que toca qualquer pessoa que entre.',
  'Entrar nesta casa é encontrar Lisboa como ela se sonha a si mesma: intensa, melancólica e profundamente humana. A Fundação Amália não é um museu — é uma peregrinação ao coração do fado.',
  'Porque Amália não pertence ao passado. Pertence à cidade, às ruas e ao fado que ainda se ouve nas noites de Lisboa. Esta fundação recorda-nos porque é que a música pode ser maior do que quem a faz.',
  'As visitas guiadas revelam pormenores da vida privada de Amália que nunca constam nos textos de parede. Os lugares são limitados e esgotam-se depressa — reserve com antecedência.'
, now(), now())
ON CONFLICT (place_id, locale) DO UPDATE
  SET name              = EXCLUDED.name,
      short_description = EXCLUDED.short_description,
      full_description  = EXCLUDED.full_description,
      goldenbook_note   = EXCLUDED.goldenbook_note,
      why_we_love_it    = EXCLUDED.why_we_love_it,
      insider_tip       = EXCLUDED.insider_tip,
      updated_at        = now();


-- ── 7. ELEMENTS 75'80 LISBOA ─────────────────────────────────
-- place_id: 5cc082ec-5cc0-c90f-518b-956762b9d2d4
-- Slot: hidden[3] + route2_stop2
-- Context: Contemporary Portuguese jewelry house by brothers Nuno and Marco
--   dos Santos. Specializes in bespoke pieces, precious stone selection,
--   gemology services, and jewelry transformation/restoration.

INSERT INTO place_translations
  (id, place_id, locale, name, short_description, full_description,
   goldenbook_note, why_we_love_it, insider_tip, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '5cc082ec-5cc0-c90f-518b-956762b9d2d4',
  'pt-PT',
  'ELEMENTS 75''80 LISBOA',
  'Joalharia contemporânea de autor, criada por gemologistas com paixão genuína pelas pedras que escolhem.',
  'A Elements 75''80 foi fundada pelos irmãos Nuno e Marco dos Santos, gemologistas com uma paixão pelas pedras preciosas que se sente em cada peça da casa. O atelier de Lisboa oferece jóias contemporâneas de autor, criação por medida, transformação de peças antigas e serviços de gemologia — desde a identificação de pedras à certificação de coleções.',
  'A Elements 75''80 é a prova de que a joalharia portuguesa contemporânea pode rivalizar com as grandes casas europeias. Cada peça é pensada do zero, cada pedra escolhida a dedo. O conhecimento é genuíno e nota-se.',
  'Porque Nuno e Marco não vendem jóias como se vendem artigos — apresentam-nas com o contexto das pedras, das origens e das decisões de design por detrás de cada peça. Essa diferença é palpável.',
  'Se tem uma pedra de família ou uma peça por transformar, venha conversar antes de decidir. O serviço de criação por medida é o verdadeiro diferencial desta casa — e o orçamento inicial é sem compromisso.'
, now(), now())
ON CONFLICT (place_id, locale) DO UPDATE
  SET name              = EXCLUDED.name,
      short_description = EXCLUDED.short_description,
      full_description  = EXCLUDED.full_description,
      goldenbook_note   = EXCLUDED.goldenbook_note,
      why_we_love_it    = EXCLUDED.why_we_love_it,
      insider_tip       = EXCLUDED.insider_tip,
      updated_at        = now();


-- ── 8. BARBOUR – Lisboa ──────────────────────────────────────
-- place_id: 0178bf45-a60d-6a63-c2aa-6c2d409985d4
-- Slot: hidden[4] + route2_stop3
-- Context: Heritage British outdoor and fashion brand. Founded 1894.
--   Known globally for waxed jackets crafted by hand at the Simonside factory.
--   Strong presence in Portugal. Jackets can be returned for rewaxing/repair.
-- Note: brand name stays as-is.

INSERT INTO place_translations
  (id, place_id, locale, name, short_description, full_description,
   goldenbook_note, why_we_love_it, insider_tip, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '0178bf45-a60d-6a63-c2aa-6c2d409985d4',
  'pt-PT',
  'BARBOUR',
  'O casaco encerado mais famoso do mundo, fabricado à mão na Grã-Bretanha desde 1894.',
  'A Barbour fabrica os seus icónicos casacos encerados manualmente na fábrica de Simonside desde o século XIX. Os tartans exclusivos da marca, criados em colaboração com o mestre Kinloch Anderson, rastreiam a família Barbour até ao século XIII. Mais do que moda, é artesanato com data de nascimento — e que melhora com o uso.',
  'A Barbour não segue tendências — sobrevive-lhes. Um casaco desta casa dura décadas e ganha carácter com o tempo, como tudo o que é bem feito. Numa indústria dominada pela obsolescência programada, é um caso à parte.',
  'Pela durabilidade que confronta de frente a cultura do descartável. Uma peça Barbour é um investimento com nome próprio — e a marca ainda a repara e impermeabiliza gratuitamente, independentemente da idade do casaco.',
  'Qualquer casaco Barbour antigo pode ser devolvido à marca para ser impermeabilizado e reparado. Um serviço que nenhuma outra marca de moda oferece da mesma forma. Pergunte na loja pelo programa de rewaxing.'
, now(), now())
ON CONFLICT (place_id, locale) DO UPDATE
  SET name              = EXCLUDED.name,
      short_description = EXCLUDED.short_description,
      full_description  = EXCLUDED.full_description,
      goldenbook_note   = EXCLUDED.goldenbook_note,
      why_we_love_it    = EXCLUDED.why_we_love_it,
      insider_tip       = EXCLUDED.insider_tip,
      updated_at        = now();


-- ==============================================================
-- C) ROUTE TRANSLATIONS — 2 DEMO ROUTES
-- ==============================================================
-- Routes are resolved by slug because IDs are generated at seed time.
-- The discover_lisboa.sql seed already inserted these routes with
-- locale='pt' translations. Those rows exist but are unreachable
-- because the app queries for locale='pt-PT'.
-- This block inserts the correct pt-PT rows.
--
-- route_translations has a UNIQUE constraint on (route_id, locale).
-- ==============================================================


-- ── Route 1: Lisbon Luxury Icons ─────────────────────────────
-- slug: lisbon-luxury-icons
-- route_type: editor_pick | estimated: 150 min
-- stops: Xerjoff (40min) → David Rosas (35min) → Fashion Clinic Women (35min)

INSERT INTO route_translations
  (id, route_id, locale, title, summary, body, created_at, updated_at)
SELECT
  gen_random_uuid(),
  r.id,
  'pt-PT',
  'Ícones de Luxo de Lisboa',
  'Uma jornada curada pelos endereços de luxo mais refinados de Lisboa.',
  'Algumas cidades têm alguns endereços de luxo. Lisboa tem uma constelação. '
  'Esta rota liga as boutiques e ateliers mais cobiçados da cidade — '
  'desde uma casa de fragrâncias raras criada em Turim à maior loja de alta joalharia do país, '
  'passando por uma curadoria de moda que rivalize com as melhores do continente. '
  'Reserve duas horas e meia. Mova-se devagar. '
  'Não é uma sessão de compras — é uma educação no bom gosto.',
  now(),
  now()
FROM routes r
WHERE r.slug = 'lisbon-luxury-icons'
ON CONFLICT (route_id, locale) DO UPDATE
  SET title      = EXCLUDED.title,
      summary    = EXCLUDED.summary,
      body       = EXCLUDED.body,
      updated_at = now();


-- ── Route 2: A Quiet Lisbon Afternoon ────────────────────────
-- slug: quiet-lisbon-afternoon
-- route_type: day_plan | estimated: 180 min
-- stops: Fundação Amália (60min) → Elements 75'80 (50min) → Barbour (45min)

INSERT INTO route_translations
  (id, route_id, locale, title, summary, body, created_at, updated_at)
SELECT
  gen_random_uuid(),
  r.id,
  'pt-PT',
  'Uma Tarde Tranquila em Lisboa',
  'Abrande e descubra a alma cultural de Lisboa, uma paragem sem pressa de cada vez.',
  'Nem todas as tardes em Lisboa devem ser apressadas. '
  'Esta rota existe para as horas em que a luz fica dourada e a cidade respira fundo. '
  'Começa onde o fado encontrou a sua voz e uma lenda guarda ainda o seu silêncio, '
  'continua para um atelier onde a joalharia contemporânea portuguesa se apresenta sem artifícios, '
  'e termina numa casa britânica que Lisboa adotou como sua há gerações. '
  'Três paragens. Três horas. Sem agenda além da presença.',
  now(),
  now()
FROM routes r
WHERE r.slug = 'quiet-lisbon-afternoon'
ON CONFLICT (route_id, locale) DO UPDATE
  SET title      = EXCLUDED.title,
      summary    = EXCLUDED.summary,
      body       = EXCLUDED.body,
      updated_at = now();


-- ==============================================================
-- VERIFY — run after executing the above
-- ==============================================================

-- V1. Confirm all 4 destination pt-PT rows exist
SELECT d.slug, dt.locale, dt.name
FROM   destination_translations dt
JOIN   destinations d ON d.id = dt.destination_id
WHERE  dt.locale = 'pt-PT'
ORDER  BY d.slug;

-- V2. Confirm all 8 demo place pt-PT rows with field coverage
SELECT
  p.slug,
  pt.locale,
  LEFT(pt.short_description, 60)  AS short_desc,
  CASE WHEN pt.full_description IS NOT NULL THEN 'yes' ELSE 'no' END  AS has_full,
  CASE WHEN pt.goldenbook_note  IS NOT NULL THEN 'yes' ELSE 'no' END  AS has_note,
  CASE WHEN pt.why_we_love_it   IS NOT NULL THEN 'yes' ELSE 'no' END  AS has_why,
  CASE WHEN pt.insider_tip      IS NOT NULL THEN 'yes' ELSE 'no' END  AS has_tip
FROM place_translations pt
JOIN places p ON p.id = pt.place_id
WHERE pt.locale = 'pt-PT'
  AND p.slug IN (
    'xerjoff-boutique-lisboa',
    'david-rosas-liberdade-lisboa',
    'fashion-clinic-women-lisboa',
    'fashion-clinic-men-lisboa',
    'embassy',
    'fundacao-amalia-rodrigues-lisboa',
    'elements-7580-lisboa-lisboa',
    'barbour-lisboa'
  )
ORDER BY p.slug;

-- V3. Confirm route pt-PT translations
SELECT
  r.slug,
  rt.locale,
  rt.title,
  LEFT(rt.summary, 80) AS summary_preview,
  CASE WHEN rt.body IS NOT NULL THEN 'yes' ELSE 'no' END AS has_body
FROM   route_translations rt
JOIN   routes r ON r.id = rt.route_id
WHERE  rt.locale = 'pt-PT'
  AND  r.slug IN ('lisbon-luxury-icons', 'quiet-lisbon-afternoon')
ORDER  BY r.slug, rt.locale;

-- V4. Quick end-to-end test — simulate what the app queries for Lisboa Discover
-- in Portuguese (mirrors getEditorsPicks, getHiddenSpots, getGoldenRoutes)
SELECT 'editors_picks' AS section, p.slug, pt.name, LEFT(pt.short_description, 50) AS short_desc
FROM editorial_collections ec
JOIN destinations d ON d.id = ec.destination_id AND d.slug = 'lisboa'
JOIN editorial_collection_items eci ON eci.collection_id = ec.id
JOIN places p ON p.id = eci.place_id
LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.locale = 'pt-PT'
LEFT JOIN place_translations pt_fb ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
WHERE ec.collection_type = 'editors_picks' AND ec.is_active = true
UNION ALL
SELECT 'hidden_spots', p.slug, pt.name, LEFT(pt.short_description, 50)
FROM editorial_collections ec
JOIN destinations d ON d.id = ec.destination_id AND d.slug = 'lisboa'
JOIN editorial_collection_items eci ON eci.collection_id = ec.id
JOIN places p ON p.id = eci.place_id
LEFT JOIN place_translations pt ON pt.place_id = p.id AND pt.locale = 'pt-PT'
LEFT JOIN place_translations pt_fb ON pt_fb.place_id = p.id AND pt_fb.locale = 'en'
WHERE ec.collection_type = 'hidden_spots' AND ec.is_active = true
ORDER BY 1, 2;
