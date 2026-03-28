-- Portuguese (pt) translations for categories and subcategories
-- Locale: pt  (resolved via pt-PT → pt fallback in backend queries)
-- Tone: premium, editorial, natural European Portuguese
-- Generated: 2026-03-21

-- ============================================================
-- CATEGORY TRANSLATIONS  (8 rows)
-- ============================================================

INSERT INTO category_translations (category_id, locale, name, description)
VALUES
  -- Stay & Do → Experiências
  ('0bcd1a75-9213-6e5f-623d-e00835dae01b', 'pt', 'Experiências',         NULL),
  -- Nature → Natureza
  ('9503ce4f-d713-9c18-d8d7-aecc267a8ec0', 'pt', 'Natureza',             NULL),
  -- Culture → Cultura
  ('8eede68d-4e47-c3c4-b9c1-422a38bf9877', 'pt', 'Cultura',              NULL),
  -- Events → Eventos
  ('b34801c1-6c87-55f8-0d70-292652acd569', 'pt', 'Eventos',              NULL),
  -- Food & Drinks → Gastronomia
  ('bdb3b756-9cde-ffcf-442a-72302f397034', 'pt', 'Gastronomia',          NULL),
  -- Shopping → Compras
  ('2252caf7-c09c-a804-3617-e55e592ecc92', 'pt', 'Compras',              NULL),
  -- Sports → Desporto
  ('c26a7611-3562-d85a-08df-1b5b5a0dad91', 'pt', 'Desporto',             NULL),
  -- Transport → Mobilidade
  ('09a2b5d0-8eaa-c7d6-44e5-3977242a236e', 'pt', 'Mobilidade',           NULL)
ON CONFLICT (category_id, locale)
DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;


-- ============================================================
-- SUBCATEGORY TRANSLATIONS  (43 rows)
-- ============================================================

INSERT INTO subcategory_translations (subcategory_id, locale, name, description)
VALUES
  -- ── Experiências (formerly Stay & Do) ─────────────────────
  ('02eefb0e-9483-a519-233c-e2d05ff7ebfa', 'pt', 'Hotéis',               NULL),
  ('57e5bac2-facc-7060-3a1a-4e496e4bc087', 'pt', 'Tours',                NULL),
  ('04781da5-1587-97da-0ec4-38ee1546f8b9', 'pt', 'Experiências',         NULL),
  ('37e012d7-3bb7-9f57-f85f-61a4e0b92e87', 'pt', 'Vida Noturna',         NULL),
  ('a9950a06-3c4e-6d00-0afa-9e33ef10635e', 'pt', 'Saúde & Bem-Estar',    NULL),
  ('e858f086-d574-7094-ea4c-4d2c5c41e654', 'pt', 'Imobiliário',          NULL),

  -- ── Natureza ─────────────────────────────────────────────
  ('e974c458-63c9-6d0c-9c8e-28d1c61f5d74', 'pt', 'Parques',              NULL),
  ('efad3dae-95eb-10d4-1af4-e39d4d7e3918', 'pt', 'Reservas Naturais',    NULL),
  ('6c5b7ba6-282d-6871-1cfd-9d61591f16cd', 'pt', 'Miradouros',           NULL),
  ('c6462b97-3d9b-35b2-0ed1-1b6ddfa52926', 'pt', 'Jardins',              NULL),
  ('32fe4add-d374-3cba-85ff-5806186531cc', 'pt', 'Cascatas',             NULL),

  -- ── Cultura ──────────────────────────────────────────────
  ('c7df18e7-f879-87d3-e427-3d4f02d6988d', 'pt', 'Museus',               NULL),
  ('0b9582eb-75de-02e1-0f33-2abdb40be090', 'pt', 'Sítios Históricos',    NULL),
  ('a5c70e80-42b8-b2a7-979d-576de51e6265', 'pt', 'Monumentos',           NULL),
  ('1787c0b1-31b8-6a18-ff0e-da715ebf05be', 'pt', 'Igrejas',              NULL),
  ('8d0c6c0b-fd9a-62f1-fc96-8677902db59e', 'pt', 'Galerias',             NULL),

  -- ── Eventos ──────────────────────────────────────────────
  ('2b2e1ca2-21ca-192a-9415-0a5c74fb4587', 'pt', 'Festivais',            NULL),
  ('925f07e6-1506-e591-09f3-603217ab900c', 'pt', 'Concertos',            NULL),
  ('91952d04-8804-214c-4347-b54e8844b2eb', 'pt', 'Exposições',           NULL),
  ('7270dc8d-7676-dd4a-f099-13ede22334e9', 'pt', 'Feiras',               NULL),
  ('1eb2594d-bd7e-773c-340e-c983744641c2', 'pt', 'Eventos Culturais',    NULL),

  -- ── Gastronomia ──────────────────────────────────────────
  ('a501b2c7-5435-5fdb-d780-7c83e9ca034a', 'pt', 'Restaurantes',         NULL),
  ('d689d17b-2334-d3eb-a6f8-ee2bd50e337c', 'pt', 'Bares',                NULL),
  ('405ea4fc-456c-4785-37c1-e7f072180419', 'pt', 'Adegas',               NULL),
  ('7c05ef7f-9a5c-b8a1-dfe2-38bcbfc5283f', 'pt', 'Cafés',                NULL),
  ('c098c718-b4a8-36e0-1a8e-64b0a001ea65', 'pt', 'Gastronomia Típica',   NULL),

  -- ── Compras ──────────────────────────────────────────────
  ('6c03ad78-89ed-71ca-38b2-59ea56a7f169', 'pt', 'Centros Comerciais',   NULL),
  ('898055d9-a2b7-89c3-0640-5ad2e283048f', 'pt', 'Lojas Locais',         NULL),
  ('3ed432d6-71f4-c8d3-f87c-94fe6ade4189', 'pt', 'Lembranças',           NULL),
  ('999478d4-fea1-8066-45ae-646a9ce253c0', 'pt', 'Moda',                 NULL),
  ('cebd7568-b162-b2e3-f508-b62438bed8fa', 'pt', 'Artesanato',           NULL),
  ('935c3485-dcd7-62d5-3d9f-e49ed415030b', 'pt', 'Joalharia',            NULL),
  ('336d6942-735a-8046-b93c-c4f0a9e60e75', 'pt', 'Relojoaria',           NULL),
  ('66ac7224-23aa-c4f9-e8fe-f112b80327df', 'pt', 'Decoração',            NULL),
  ('b097b479-797b-6923-b84e-289ca941a5b0', 'pt', 'Lojas Tradicionais',   NULL),

  -- ── Desporto ─────────────────────────────────────────────
  ('3bff3360-f247-a0f5-df50-17784bc528df', 'pt', 'Golfe',                NULL),
  ('15a6151c-0d2c-3fba-1484-cf00247c39a6', 'pt', 'Desportos Aquáticos',  NULL),
  ('141ab7e6-c3ee-a04c-7f0c-e2e469ef9dad', 'pt', 'Caminhadas',           NULL),
  ('67a8a085-e40f-ae17-b3d3-3d485c6608a0', 'pt', 'Equitação',            NULL),

  -- ── Mobilidade (formerly Transport) ─────────────────────
  ('ba737bd0-6f20-8052-3f8d-979520fbcdb4', 'pt', 'Aeroporto',            NULL),
  ('7850e1e4-862a-16dc-74d6-1977468478f7', 'pt', 'Aluguer de Carros',    NULL)
ON CONFLICT (subcategory_id, locale)
DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;