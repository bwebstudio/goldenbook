#!/usr/bin/env tsx
// ─── Seed: Editorial content for the 9 new route/pick places ──────────────
//
// Adds full_description, goldenbook_note and insider_tip in en/es/pt
// for the places created by the routes & golden picks seed.
//
// Usage:
//   npx tsx api/src/scripts/seed-new-places-editorial.ts
//   npx tsx api/src/scripts/seed-new-places-editorial.ts --dry-run

import { db } from '../db/postgres'

const DRY_RUN = process.argv.includes('--dry-run')

interface EditorialContent {
  full_description: string
  goldenbook_note: string
  insider_tip: string
}

interface PlaceEditorial {
  id: string
  name: string
  en: EditorialContent
  es: EditorialContent
  pt: EditorialContent
}

const EDITORIAL: PlaceEditorial[] = [
  // ── LISBOA / SINTRA ────────────────────────────────────────────────
  {
    id: 'c92e4a2b-f98a-4079-baf1-340c41d88c71',
    name: 'Arneiro',
    en: {
      full_description: `Set in the hills near Sintra, Arneiro is a restaurant built around seasonal Portuguese cooking and a deep respect for local produce. The atmosphere is warm and unfussy, with a menu that changes often and reflects the rhythms of the land around it.`,
      goldenbook_note: `A table that feels honest and rooted — exactly what good Portuguese food should be.`,
      insider_tip: `Let the kitchen guide you rather than sticking to the menu — the daily suggestions are usually the strongest choices.`,
    },
    es: {
      full_description: `Situado en las colinas cerca de Sintra, Arneiro es un restaurante construido sobre cocina portuguesa de temporada y un respeto profundo por el producto local. El ambiente es cálido y sin pretensiones, con una carta que cambia a menudo y refleja los ritmos del terreno que lo rodea.`,
      goldenbook_note: `Una mesa que se siente honesta y arraigada, exactamente lo que la buena cocina portuguesa debería ser.`,
      insider_tip: `Mejor dejarse llevar por las sugerencias del día que aferrarse a la carta; suelen ser las opciones más acertadas.`,
    },
    pt: {
      full_description: `Nas colinas perto de Sintra, o Arneiro é um restaurante que gira em torno da cozinha portuguesa sazonal e de um profundo respeito pelo produto local. O ambiente é acolhedor e descomplicado, com uma ementa que muda com frequência e reflete os ritmos da terra.`,
      goldenbook_note: `Uma mesa honesta e com raízes — exatamente aquilo que a boa cozinha portuguesa deve ser.`,
      insider_tip: `Vale a pena seguir as sugestões do dia em vez de se fixar na ementa — costumam ser as escolhas mais fortes.`,
    },
  },

  // ── PORTO ──────────────────────────────────────────────────────────
  {
    id: '1f4346e6-2a5e-4d91-a260-019ee57e7a1b',
    name: 'Loja THE',
    en: {
      full_description: `Located in the historic centre of Porto, Loja THE is a concept store that brings together fashion, footwear and design in an industrial-chic setting. The selection leans toward independent and contemporary brands, with a café space that makes it more than just a shop.`,
      goldenbook_note: `A store with a clear editorial eye — curated, not crowded.`,
      insider_tip: `The shoe selection is the standout, but don't skip the upper floor — the clothing edit there is worth the visit on its own.`,
    },
    es: {
      full_description: `En el centro histórico de Oporto, Loja THE es una concept store que reúne moda, calzado y diseño en un espacio con estética industrial. La selección se inclina hacia marcas independientes y contemporáneas, con una cafetería integrada que la convierte en algo más que una tienda.`,
      goldenbook_note: `Una tienda con mirada editorial: curada, no saturada.`,
      insider_tip: `La selección de calzado es lo más destacado, pero no te saltes la planta de arriba; la edición de ropa merece la visita por sí sola.`,
    },
    pt: {
      full_description: `No centro histórico do Porto, a Loja THE é uma concept store que reúne moda, calçado e design num espaço com estética industrial. A seleção tende para marcas independentes e contemporâneas, com um café integrado que a torna mais do que uma simples loja.`,
      goldenbook_note: `Uma loja com olhar editorial — curada, não saturada.`,
      insider_tip: `A seleção de calçado é o ponto forte, mas vale a pena subir ao piso superior — a edição de roupa justifica a visita por si só.`,
    },
  },
  {
    id: 'e4911180-b224-4857-a7a9-1548a1db92ba',
    name: 'Imobiliária KA',
    en: {
      full_description: `Based in Porto's Foz neighbourhood, Imobiliária KA is a real estate consultancy focused on premium properties along the northern Portuguese coast. Their approach combines local market knowledge with a personalised service designed for discerning buyers.`,
      goldenbook_note: `A trusted address for anyone considering property in Porto or the surrounding coast.`,
      insider_tip: `Even if you're just exploring, a conversation with their team can offer useful insight into Porto's most interesting neighbourhoods.`,
    },
    es: {
      full_description: `Con sede en el barrio de Foz en Oporto, Imobiliária KA es una consultora inmobiliaria centrada en propiedades premium a lo largo de la costa norte de Portugal. Su enfoque combina conocimiento del mercado local con un servicio personalizado pensado para compradores exigentes.`,
      goldenbook_note: `Una dirección de confianza para quien se plantee invertir en Oporto o la costa del norte.`,
      insider_tip: `Incluso sin un proyecto concreto, una conversación con su equipo puede dar una perspectiva muy útil sobre los barrios más interesantes de Oporto.`,
    },
    pt: {
      full_description: `Sediada no bairro da Foz do Porto, a Imobiliária KA é uma consultora focada em propriedades premium ao longo da costa norte de Portugal. A sua abordagem combina conhecimento do mercado local com um serviço personalizado pensado para compradores exigentes.`,
      goldenbook_note: `Uma referência de confiança para quem pondera investir no Porto ou na costa norte.`,
      insider_tip: `Mesmo sem um projeto concreto, uma conversa com a equipa pode revelar perspetivas úteis sobre os bairros mais interessantes do Porto.`,
    },
  },

  // ── MADEIRA ────────────────────────────────────────────────────────
  {
    id: '15e2337a-2645-4cb1-85eb-f2349b82313b',
    name: 'Seapleasure',
    en: {
      full_description: `Seapleasure offers private boat experiences along Madeira's southern coast. From dolphin watching to sunset cruises, the focus is on small-group excursions that let you experience the island's coastline in a personal, unhurried way.`,
      goldenbook_note: `The kind of ocean experience where the boat, the crew and the coastline all feel right.`,
      insider_tip: `The sunset trip is especially worthwhile — Madeira's coastline takes on a completely different character in the evening light.`,
    },
    es: {
      full_description: `Seapleasure ofrece experiencias náuticas privadas a lo largo de la costa sur de Madeira. Desde avistamiento de delfines hasta travesías al atardecer, el enfoque está en excursiones para grupos reducidos que permiten vivir el litoral de la isla de forma personal y sin prisas.`,
      goldenbook_note: `Una experiencia marítima donde el barco, la tripulación y la costa encajan a la perfección.`,
      insider_tip: `La salida al atardecer merece especialmente la pena: la costa de Madeira cambia por completo con la luz del final del día.`,
    },
    pt: {
      full_description: `A Seapleasure oferece experiências náuticas privadas ao longo da costa sul da Madeira. Desde observação de golfinhos a passeios ao pôr do sol, o foco está em excursões para pequenos grupos que permitem viver o litoral da ilha de forma pessoal e descontraída.`,
      goldenbook_note: `O tipo de experiência marítima onde o barco, a tripulação e a paisagem estão em perfeita sintonia.`,
      insider_tip: `O passeio ao pôr do sol é especialmente recomendável — a costa da Madeira ganha um carácter completamente diferente com a luz do fim do dia.`,
    },
  },
  {
    id: 'eeefc818-5919-415a-ae82-8bdde277c11f',
    name: 'Quinta Magnólia',
    en: {
      full_description: `Quinta Magnólia is a historic garden in the heart of Funchal, originally part of a 19th-century estate. Today it serves as a peaceful green space with mature trees, walking paths and a sense of calm that feels a world apart from the city around it.`,
      goldenbook_note: `A garden where Funchal slows down — refined, green, and unexpectedly quiet.`,
      insider_tip: `Ideal as a pause between visits rather than a destination in itself — the atmosphere is best enjoyed without a fixed plan.`,
    },
    es: {
      full_description: `Quinta Magnólia es un jardín histórico en el corazón de Funchal, originalmente parte de una finca del siglo XIX. Hoy funciona como un espacio verde con árboles maduros, senderos y una calma que parece pertenecer a otro mundo respecto a la ciudad que lo rodea.`,
      goldenbook_note: `Un jardín donde Funchal desacelera: refinado, verde y sorprendentemente tranquilo.`,
      insider_tip: `Funciona mejor como pausa entre visitas que como destino en sí mismo; la atmósfera se disfruta más sin un plan fijo.`,
    },
    pt: {
      full_description: `A Quinta Magnólia é um jardim histórico no coração do Funchal, originalmente parte de uma propriedade do século XIX. Hoje funciona como um espaço verde tranquilo, com árvores centenárias, caminhos para passear e uma calma que parece de outro mundo em relação à cidade em redor.`,
      goldenbook_note: `Um jardim onde o Funchal abranda — refinado, verde e surpreendentemente silencioso.`,
      insider_tip: `Ideal como pausa entre visitas, sem plano fixo — a atmosfera é o verdadeiro motivo para vir.`,
    },
  },
  {
    id: 'e5c9a113-723f-407d-83a5-d163f4532f6d',
    name: 'Winetours',
    en: {
      full_description: `Wine Tours Madeira offers guided tastings and experiences through the world of Madeira wine, one of the island's most distinctive cultural traditions. Set in Funchal's old town, the visits are designed to be both informative and enjoyable, even for those new to the region's wines.`,
      goldenbook_note: `A well-run introduction to one of Portugal's most underrated wine traditions.`,
      insider_tip: `Ask about the older vintages — Madeira wine improves with age in a way that few other wines can match.`,
    },
    es: {
      full_description: `Wine Tours Madeira ofrece catas guiadas y experiencias en torno al vino de Madeira, una de las tradiciones culturales más distintivas de la isla. Situadas en la zona vieja de Funchal, las visitas están pensadas para ser formativas y agradables, incluso para quienes se acercan por primera vez a los vinos de la región.`,
      goldenbook_note: `Una introducción bien llevada a una de las tradiciones vinícolas más infravaloradas de Portugal.`,
      insider_tip: `Pregunta por las añadas más antiguas: el vino de Madeira mejora con el tiempo de una forma que pocos vinos pueden igualar.`,
    },
    pt: {
      full_description: `A Wine Tours Madeira oferece provas guiadas e experiências pelo mundo do vinho da Madeira, uma das tradições culturais mais distintivas da ilha. Situada na zona velha do Funchal, as visitas são pensadas para serem informativas e agradáveis, mesmo para quem está a descobrir os vinhos da região.`,
      goldenbook_note: `Uma introdução bem conduzida a uma das tradições vinícolas mais subestimadas de Portugal.`,
      insider_tip: `Pergunte pelas colheitas mais antigas — o vinho da Madeira melhora com o tempo de uma forma que poucos vinhos conseguem igualar.`,
    },
  },
  {
    id: '31508126-2452-41d8-904f-9dfa478e5a4b',
    name: 'Dermalaser',
    en: {
      full_description: `Clínica Dermalaser is a dermatology and aesthetic medicine clinic in Funchal. With a focus on personalised treatments and advanced technology, it offers a range of services from skincare to more specialised procedures in a modern, discreet setting.`,
      goldenbook_note: `A clinic where expertise and discretion set the standard.`,
      insider_tip: `Worth booking a consultation in advance — the team takes time to understand what each patient actually needs.`,
    },
    es: {
      full_description: `Clínica Dermalaser es un centro de dermatología y medicina estética en Funchal. Con un enfoque en tratamientos personalizados y tecnología avanzada, ofrece una gama de servicios desde cuidado de la piel hasta procedimientos más especializados, en un entorno moderno y discreto.`,
      goldenbook_note: `Una clínica donde la experiencia y la discreción marcan el estándar.`,
      insider_tip: `Merece la pena reservar una consulta con antelación; el equipo se toma el tiempo necesario para entender lo que cada paciente realmente necesita.`,
    },
    pt: {
      full_description: `A Clínica Dermalaser é um centro de dermatologia e medicina estética no Funchal. Com foco em tratamentos personalizados e tecnologia avançada, oferece uma gama de serviços desde cuidados de pele até procedimentos mais especializados, num ambiente moderno e discreto.`,
      goldenbook_note: `Uma clínica onde a competência e a discrição definem o padrão.`,
      insider_tip: `Vale a pena marcar uma consulta com antecedência — a equipa dedica tempo a perceber o que cada paciente realmente precisa.`,
    },
  },
  {
    id: '34bde57e-8b9e-481b-b375-0c61b70a53db',
    name: 'Forest Food',
    en: {
      full_description: `Set inside Funchal's Ecological Park, Forest Food is a restaurant that celebrates Madeira's native ingredients in a setting surrounded by nature. The cooking is modern and ingredient-led, with a menu that changes with the seasons and a terrace that feels far from the city.`,
      goldenbook_note: `A place where the landscape and the plate feel connected — exactly what Madeira does best.`,
      insider_tip: `The terrace is the best seat in the house, especially at lunchtime when the light filters through the trees.`,
    },
    es: {
      full_description: `Situado dentro del Parque Ecológico de Funchal, Forest Food es un restaurante que celebra los ingredientes nativos de Madeira en un entorno rodeado de naturaleza. La cocina es moderna y centrada en el producto, con una carta que cambia con las estaciones y una terraza que se siente lejos de la ciudad.`,
      goldenbook_note: `Un lugar donde el paisaje y el plato se sienten conectados, exactamente lo que Madeira hace mejor.`,
      insider_tip: `La terraza es el mejor sitio del restaurante, especialmente a la hora del almuerzo, cuando la luz se filtra entre los árboles.`,
    },
    pt: {
      full_description: `Situado no Parque Ecológico do Funchal, o Forest Food é um restaurante que celebra os ingredientes nativos da Madeira num ambiente rodeado de natureza. A cozinha é moderna e centrada no produto, com uma ementa que muda com as estações e uma esplanada que parece estar longe da cidade.`,
      goldenbook_note: `Um lugar onde a paisagem e o prato se sentem ligados — exatamente aquilo que a Madeira faz melhor.`,
      insider_tip: `A esplanada é o melhor lugar do restaurante, especialmente ao almoço, quando a luz se filtra por entre as árvores.`,
    },
  },

  // ── ALGARVE ────────────────────────────────────────────────────────
  {
    id: '0b633731-1710-4ba5-ae59-dc0e65d08a4f',
    name: 'CVA – Comissão Vitivinícola do Algarve',
    en: {
      full_description: `The Comissão Vitivinícola do Algarve is the official body dedicated to promoting the wines of the Algarve region. Through tastings, events and educational programmes, it offers visitors a structured introduction to a wine-producing area that is still largely undiscovered.`,
      goldenbook_note: `The best starting point for understanding that the Algarve is more than beaches — it's also wine country.`,
      insider_tip: `Ask about the lesser-known producers — the Algarve has a growing number of small estates making genuinely interesting wines.`,
    },
    es: {
      full_description: `La Comissão Vitivinícola do Algarve es el organismo oficial dedicado a la promoción de los vinos de la región del Algarve. A través de catas, eventos y programas divulgativos, ofrece a los visitantes una introducción estructurada a una zona vinícola aún por descubrir para muchos.`,
      goldenbook_note: `El mejor punto de partida para entender que el Algarve es mucho más que playas: también es tierra de vinos.`,
      insider_tip: `Pregunta por los productores menos conocidos; el Algarve tiene un número creciente de pequeñas fincas que elaboran vinos genuinamente interesantes.`,
    },
    pt: {
      full_description: `A Comissão Vitivinícola do Algarve é o organismo oficial dedicado à promoção dos vinhos da região algarvia. Através de provas, eventos e programas educativos, oferece aos visitantes uma introdução estruturada a uma zona vinícola que continua em grande parte por descobrir.`,
      goldenbook_note: `O melhor ponto de partida para perceber que o Algarve é muito mais do que praias — é também terra de vinhos.`,
      insider_tip: `Pergunte pelos produtores menos conhecidos — o Algarve tem um número crescente de pequenas quintas a fazer vinhos genuinamente interessantes.`,
    },
  },
]

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  New Places — Editorial Content (en/es/pt)')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log('═══════════════════════════════════════════════════════════\n')

  let updated = 0

  for (const place of EDITORIAL) {
    const { rows } = await db.query<{ id: string }>(`SELECT id FROM places WHERE id = $1`, [place.id])
    if (!rows[0]) { console.log(`✗ ${place.name} — not found`); continue }

    console.log(`── ${place.name} (${place.id.slice(0, 8)}...)`)

    for (const locale of ['en', 'es', 'pt'] as const) {
      const c = place[locale]

      if (DRY_RUN) {
        console.log(`  [${locale}] would update`)
        continue
      }

      // Try update first
      const { rowCount } = await db.query(`
        UPDATE place_translations SET
          full_description = $1,
          goldenbook_note  = $2,
          insider_tip      = $3,
          updated_at       = now()
        WHERE place_id = $4 AND locale = $5
      `, [c.full_description, c.goldenbook_note, c.insider_tip, place.id, locale])

      // Insert if no row existed (name is NOT NULL so we pull it from places)
      if (!rowCount || rowCount === 0) {
        await db.query(`
          INSERT INTO place_translations (place_id, locale, name, full_description, goldenbook_note, insider_tip)
          SELECT $1, $2, p.name, $3, $4, $5
          FROM places p WHERE p.id = $1
        `, [place.id, locale, c.full_description, c.goldenbook_note, c.insider_tip])
      }

      console.log(`  [${locale}] ✓`)
    }

    updated++
  }

  console.log(`\n═══════════════════════════════════════════════════════════`)
  console.log(`  Done: ${updated}/${EDITORIAL.length} places updated`)
  console.log('═══════════════════════════════════════════════════════════')

  await db.end()
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
