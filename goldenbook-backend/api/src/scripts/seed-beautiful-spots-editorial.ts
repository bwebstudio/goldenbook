#!/usr/bin/env tsx
// ─── Seed: Beautiful Spots Editorial Content ──────────────────────────────
//
// Updates the 12 beautiful spots with full editorial content in 3 languages:
//   - full_description (long description)
//   - goldenbook_note (editor's note)
//   - insider_tip
//
// Usage:
//   npx tsx api/src/scripts/seed-beautiful-spots-editorial.ts
//   npx tsx api/src/scripts/seed-beautiful-spots-editorial.ts --dry-run

import { db } from '../db/postgres'

const DRY_RUN = process.argv.includes('--dry-run')

// ─── Editorial content per place ──────────────────────────────────────────

interface EditorialContent {
  full_description: string
  goldenbook_note: string
  insider_tip: string
}

interface PlaceEditorial {
  slug: string
  /** Fallback: match by google_place_id if slug doesn't match */
  googlePlaceId?: string
  en: EditorialContent
  es: EditorialContent
  pt: EditorialContent
}

const EDITORIAL: PlaceEditorial[] = [
  // ── Lisboa ─────────────────────────────────────────────────────────────
  {
    slug: 'miradouro-de-santa-catarina-lisboa',
    en: {
      full_description: `One of Lisbon's most beloved viewpoints, Miradouro de Santa Catarina opens wide views over the Tagus River and the western side of the city. It's a place where Lisbon's light, river breeze and relaxed rhythm come together naturally, making it an easy stop when you want to take in the city from above.`,
      goldenbook_note: `A classic Lisbon viewpoint that still feels effortlessly authentic.`,
      insider_tip: `Best approached as a slow pause rather than a quick stop — the pleasure here is simply watching the river and the city unfold.`,
    },
    es: {
      full_description: `Uno de los miradores más emblemáticos de Lisboa, con vistas abiertas sobre el Tajo y un ambiente relajado que resume muy bien la cara más luminosa de la ciudad. Es un lugar para detenerse, mirar el río y dejar que Lisboa haga el resto.`,
      goldenbook_note: `Un clásico lisboeta que sigue sintiéndose genuino cuando lo que apetece es belleza sin artificio.`,
      insider_tip: `Funciona especialmente bien como parada sin prisas, más para contemplar que para "hacer check" en una lista.`,
    },
    pt: {
      full_description: `Um dos miradouros mais emblemáticos de Lisboa, o Miradouro de Santa Catarina abre-se sobre o Tejo e sobre a parte ocidental da cidade. A luz, o rio e a atmosfera descontraída fazem deste um lugar perfeito para parar um momento e observar Lisboa com calma.`,
      goldenbook_note: `Um clássico lisboeta que continua a sentir-se autêntico.`,
      insider_tip: `Melhor apreciado sem pressa — o prazer está simplesmente em observar o rio e a cidade.`,
    },
  },
  {
    slug: 'jardim-do-torel-lisboa',
    en: {
      full_description: `Set within the quiet Jardim do Torel, this small hilltop garden offers a wide view over Avenida da Liberdade and the surrounding neighborhoods. Originally part of an 18th-century estate, the space today feels calm and residential, with trees, terraces and a perspective that reveals a softer side of Lisbon.`,
      goldenbook_note: `One of those places that makes Lisbon feel unexpectedly intimate.`,
      insider_tip: `A lovely alternative when you want a viewpoint without the crowds of the more famous miradouros.`,
    },
    es: {
      full_description: `Situado en el jardín do Torel, antiguo enclave de una quinta del siglo XVIII, este mirador ofrece una vista amplia sobre la Avenida da Liberdade y la colina de São Roque, rodeado además por jardín y casas nobles de los siglos XVIII y XIX. Tiene una Lisboa más silenciosa y elegante que otros miradores más obvios.`,
      goldenbook_note: `Uno de esos lugares que hacen que la ciudad parezca más íntima y refinada.`,
      insider_tip: `Encaja mejor cuando buscas una Lisboa menos evidente y con una sensación más residencial.`,
    },
    pt: {
      full_description: `Situado no tranquilo Jardim do Torel, este pequeno miradouro oferece uma vista ampla sobre a Avenida da Liberdade e os bairros em redor. Antigamente parte de uma quinta do século XVIII, hoje é um espaço verde discreto onde Lisboa revela um lado mais sereno.`,
      goldenbook_note: `Um daqueles lugares que mostram a Lisboa mais íntima e elegante.`,
      insider_tip: `Uma excelente alternativa aos miradouros mais conhecidos quando se procura um ambiente mais tranquilo.`,
    },
  },
  {
    slug: 'palacio-chiado-lisboa',
    en: {
      full_description: `Located in the heart of Chiado, Palácio Chiado occupies an elegant 18th-century palace reimagined as a restaurant and cultural venue. High ceilings, historic rooms and theatrical interiors create an atmosphere where architecture and experience go hand in hand.`,
      goldenbook_note: `A space where the setting is just as memorable as the visit itself.`,
      insider_tip: `Take a moment to explore the rooms and architectural details — the building is part of the experience.`,
    },
    es: {
      full_description: `En pleno Chiado, Palácio Chiado ocupa un palacio histórico levantado en 1781 y hoy reimaginado como restaurante y bar con espíritu bohemio, arquitectura noble y un ambiente pensado para convertir una comida o una copa en una experiencia con contexto.`,
      goldenbook_note: `Más que un sitio bonito, es uno de esos espacios donde la arquitectura hace parte de la experiencia.`,
      insider_tip: `Merece la pena elegirlo cuando el plan es alargar la visita y disfrutar tanto del lugar como de la mesa.`,
    },
    pt: {
      full_description: `No coração do Chiado, o Palácio Chiado ocupa um elegante palácio do século XVIII transformado em restaurante e espaço cultural. As salas históricas, os tetos altos e a arquitetura original criam um ambiente onde o próprio espaço faz parte da experiência.`,
      goldenbook_note: `Um lugar onde a arquitetura é tão marcante quanto a experiência.`,
      insider_tip: `Vale a pena reparar nos detalhes das salas e na arquitetura do palácio.`,
    },
  },

  // ── Porto ──────────────────────────────────────────────────────────────
  {
    slug: 'jardim-do-morro-porto',
    en: {
      full_description: `Across the river from Porto's historic center, Jardim do Morro offers one of the most recognizable views of the Douro and the Dom Luís I Bridge. The elevated garden provides a clear perspective over the old city, making it a simple yet memorable place to take in Porto's landscape.`,
      goldenbook_note: `Few viewpoints explain the geography of Porto as clearly as this one.`,
      insider_tip: `Think of it as a short contemplative stop rather than a long visit — the view is the main attraction.`,
    },
    es: {
      full_description: `Mirador-jardín en Vila Nova de Gaia, frente a Oporto, con una de las panorámicas más reconocibles sobre el Douro y el puente Dom Luís I. Es uno de esos puntos que condensan la relación visual entre ambas orillas en una sola parada.`,
      goldenbook_note: `Un lugar sencillo, pero con una vista que explica Oporto de inmediato.`,
      insider_tip: `Funciona mejor como parada contemplativa que como visita larga; lo importante aquí es la perspectiva.`,
    },
    pt: {
      full_description: `Situado em Vila Nova de Gaia, em frente ao centro histórico do Porto, o Jardim do Morro oferece uma das vistas mais reconhecíveis sobre o Douro e a ponte Dom Luís I. Um espaço simples, mas com uma perspetiva privilegiada sobre a cidade.`,
      goldenbook_note: `Um dos pontos onde o Porto se revela de forma mais clara.`,
      insider_tip: `Ideal como uma pausa breve para apreciar a vista sobre o rio.`,
    },
  },
  {
    slug: 'livraria-lello-porto',
    en: {
      full_description: `Opened in 1906, Livraria Lello is one of Porto's most celebrated landmarks. Known for its ornate interior and historic atmosphere, it remains both a functioning bookshop and a striking architectural space, where literature and design meet in a memorable setting.`,
      goldenbook_note: `Even with its fame, the interior still manages to impress.`,
      insider_tip: `Approach it as a cultural landmark as much as a bookstore — that's where its true appeal lies.`,
    },
    es: {
      full_description: `Librería histórica de Oporto abierta desde 1906, célebre tanto por su legado literario como por la fuerza de su arquitectura interior. Es una visita donde el edificio y los libros tienen el mismo peso, y por eso encaja tan bien en una selección de lugares con belleza propia.`,
      goldenbook_note: `Incluso con su fama, sigue impresionando por la teatralidad del espacio.`,
      insider_tip: `Conviene abordarla como un lugar patrimonial y no solo como una librería; así se disfruta mucho más.`,
    },
    pt: {
      full_description: `Fundada em 1906, a Livraria Lello é uma das livrarias mais conhecidas do mundo e um dos espaços culturais mais emblemáticos do Porto. A sua arquitetura interior marcante e atmosfera histórica fazem dela uma visita memorável.`,
      goldenbook_note: `Mesmo com toda a sua fama, o interior continua impressionante.`,
      insider_tip: `Mais do que uma livraria, é um verdadeiro espaço patrimonial.`,
    },
  },
  {
    slug: 'casa-da-musica-porto',
    googlePlaceId: 'ChIJz0Pm3ABlJA0R7UBFROy6XsM',
    en: {
      full_description: `Designed by architect Rem Koolhaas, Casa da Música is one of Porto's most distinctive contemporary buildings. Its bold geometric form and open relationship with the surrounding city have made it an architectural icon as well as a major cultural venue.`,
      goldenbook_note: `A striking piece of architecture that feels both monumental and modern.`,
      insider_tip: `Even without attending a concert, the building itself is worth seeing for its design and presence.`,
    },
    es: {
      full_description: `Diseñada por Rem Koolhaas, Casa da Música se ha convertido en un icono de la arquitectura contemporánea de Oporto. Su volumen facetado de hormigón blanco y la manera en que se abre visualmente a la ciudad la convierten en una visita estimulante incluso antes de entrar a un concierto.`,
      goldenbook_note: `Una pieza arquitectónica rotunda, perfecta para quien disfruta de espacios con identidad propia.`,
      insider_tip: `Aunque no vayas a un evento, merece la pena por el edificio en sí y por cómo dialoga con su entorno.`,
    },
    pt: {
      full_description: `Projetada pelo arquiteto Rem Koolhaas, a Casa da Música tornou-se um dos edifícios contemporâneos mais icónicos do Porto. A sua forma geométrica distinta e a relação com o espaço urbano fazem dela um marco arquitetónico da cidade.`,
      goldenbook_note: `Arquitetura contemporânea que se tornou símbolo cultural do Porto.`,
      insider_tip: `Mesmo sem assistir a um concerto, vale a pena visitar pelo edifício.`,
    },
  },

  // ── Algarve ────────────────────────────────────────────────────────────
  {
    slug: 'ponta-da-piedade-algarve',
    en: {
      full_description: `Near the town of Lagos, Ponta da Piedade is famous for its dramatic cliffs, rock formations and small grottoes shaped by the Atlantic. The coastline here reveals some of the Algarve's most striking natural scenery, where golden rock meets deep blue water.`,
      goldenbook_note: `One of the Algarve's most spectacular coastal landscapes.`,
      insider_tip: `Allow a little time to take in the different viewpoints — the beauty here is in the details of the coastline.`,
    },
    es: {
      full_description: `A pocos kilómetros de Lagos, Ponta da Piedade reúne grutas, bahías y formaciones rocosas que resumen la cara más escénica del Algarve. Es uno de esos paisajes que parecen pensados para recordar por qué esta costa es tan especial.`,
      goldenbook_note: `Uno de los grandes paisajes del sur de Portugal, espectacular sin dejar de sentirse natural.`,
      insider_tip: `Mejor ir con tiempo y sin prisa; aquí la experiencia está en detenerse a mirar el relieve y el color del mar.`,
    },
    pt: {
      full_description: `Perto de Lagos, a Ponta da Piedade é conhecida pelas suas falésias douradas, grutas naturais e formações rochosas esculpidas pelo Atlântico. É um dos cenários naturais mais impressionantes do Algarve.`,
      goldenbook_note: `Um dos paisagens costeiras mais marcantes do sul de Portugal.`,
      insider_tip: `Reserve algum tempo para explorar os vários miradouros ao longo das falésias.`,
    },
  },
  {
    slug: 'marinha-beach-algarve',
    en: {
      full_description: `Praia da Marinha is widely considered one of the Algarve's most beautiful beaches. Surrounded by limestone cliffs and distinctive rock formations, the beach offers a landscape that has become one of the region's most recognizable natural settings.`,
      goldenbook_note: `A postcard-perfect stretch of coast that fully lives up to its reputation.`,
      insider_tip: `Even if you're not planning a full beach day, the surrounding viewpoints make the visit worthwhile.`,
    },
    es: {
      full_description: `Praia da Marinha es una de las playas más emblemáticas del Algarve, conocida por sus arcos, calas y formaciones rocosas. Su entorno de acantilados y agua clara la convierte en uno de los lugares más visuales de toda la región.`,
      goldenbook_note: `Pocas postales del Algarve resultan tan inmediatas y memorables como esta.`,
      insider_tip: `Funciona muy bien como parada paisajística incluso aunque el plan no sea pasar el día entero en la playa.`,
    },
    pt: {
      full_description: `A Praia da Marinha é frequentemente considerada uma das praias mais bonitas do Algarve. Rodeada por falésias calcárias e formações rochosas únicas, oferece um cenário natural verdadeiramente memorável.`,
      goldenbook_note: `Um dos grandes ícones naturais do litoral algarvio.`,
      insider_tip: `Mesmo para uma visita breve, os miradouros sobre a praia valem a pena.`,
    },
  },
  {
    slug: 'benagil-cave-algarve',
    en: {
      full_description: `The Algarve coastline around Benagil is known for its striking sea caves and sculpted rock formations. Among them, the famous Benagil cave stands out for its circular opening and cathedral-like interior, shaped entirely by the Atlantic over centuries.`,
      goldenbook_note: `A remarkable example of the Algarve's natural architecture.`,
      insider_tip: `Conditions and access rules can change, so it's best to check the latest guidance before planning a visit.`,
    },
    es: {
      full_description: `Benagil destaca por su costa excavada en la roca, con cavidades y formas propias de los paisajes kársticos; entre ellas, el célebre algar de Benagil, convertido en una de las imágenes más reconocibles del Algarve. Es un lugar de enorme fuerza visual, más geológico que playero en el mejor sentido.`,
      goldenbook_note: `Más que un simple arenal, aquí lo que impresiona es la arquitectura natural del litoral.`,
      insider_tip: `Antes de planificar el acceso, conviene comprobar la situación y las normas vigentes del momento, porque es una zona muy sensible y cambiante.`,
    },
    pt: {
      full_description: `A costa de Benagil é conhecida pelas suas grutas e formações rochosas impressionantes. Entre elas destaca-se o famoso Algar de Benagil, uma cavidade natural aberta no topo que se tornou uma das imagens mais reconhecíveis do Algarve.`,
      goldenbook_note: `Um exemplo extraordinário da arquitetura natural da costa algarvia.`,
      insider_tip: `Antes de planear a visita, é aconselhável verificar as condições e regras de acesso.`,
    },
  },

  // ── Madeira ────────────────────────────────────────────────────────────
  {
    slug: 'cabo-girao-madeira',
    en: {
      full_description: `Rising around 580 meters above the Atlantic, Cabo Girão is one of the highest sea cliffs in Europe. Its glass skywalk platform offers a sweeping view over Madeira's southern coastline and the surrounding landscape.`,
      goldenbook_note: `A dramatic viewpoint where Madeira's scale becomes immediately clear.`,
      insider_tip: `Take a moment to absorb the panorama — the experience here is all about the perspective.`,
    },
    es: {
      full_description: `En Câmara de Lobos, Cabo Girão se eleva a 580 metros y es presentado por el turismo oficial de Madeira como el cabo más alto de Europa. Su plataforma suspendida de cristal abre una panorámica muy amplia sobre el Atlántico y la costa sur de la isla.`,
      goldenbook_note: `Un lugar pensado para impresionar, pero que sigue teniendo algo casi silencioso cuando la vista se abre por completo.`,
      insider_tip: `Es mejor ir con disposición a contemplar el paisaje que a "consumir" la parada rápido; la vista merece un poco de tiempo.`,
    },
    pt: {
      full_description: `Com cerca de 580 metros de altura, o Cabo Girão é um dos promontórios mais elevados da Europa. A plataforma panorâmica com piso de vidro oferece uma vista impressionante sobre o oceano e a costa sul da Madeira.`,
      goldenbook_note: `Um miradouro onde se percebe a escala dramática da ilha.`,
      insider_tip: `Vale a pena parar alguns minutos para apreciar a paisagem.`,
    },
  },
  {
    slug: 'monte-palace-madeira-madeira',
    googlePlaceId: 'ChIJZzh5QV5hYAwRq2LFs5H6Maw',
    en: {
      full_description: `Located in the hills above Funchal, Monte Palace Tropical Garden combines exotic plants, sculptures and landscaped water features into one of Madeira's most beautiful gardens. The space blends nature and art in a way that feels both curated and immersive.`,
      goldenbook_note: `A garden where nature, art and atmosphere meet beautifully.`,
      insider_tip: `Give yourself time to wander — the experience unfolds gradually as you explore.`,
    },
    es: {
      full_description: `Situado en el anfiteatro de Funchal, a unos 5 km del centro, Monte Palace es uno de los jardines más bellos de Madeira. Reúne una gran colección de especies exóticas y obras de arte, lo que lo convierte en una visita especialmente rica para quien busca naturaleza con dimensión cultural.`,
      goldenbook_note: `Uno de esos lugares donde jardín, arte y atmósfera se sienten cuidadosamente compuestos.`,
      insider_tip: `Mejor reservarle tiempo real; no es una visita para hacer deprisa.`,
    },
    pt: {
      full_description: `Localizado nas colinas acima do Funchal, o Monte Palace Madeira é um dos jardins mais belos da ilha. Combina espécies exóticas, esculturas e elementos paisagísticos que criam uma experiência rica e contemplativa.`,
      goldenbook_note: `Um jardim onde natureza e arte convivem em perfeita harmonia.`,
      insider_tip: `Reserve tempo suficiente para explorar os diferentes espaços do jardim.`,
    },
  },
  {
    slug: 'fanal-forest-madeira',
    en: {
      full_description: `Fanal, in the northwest of Madeira, is known for its ancient laurel forest, part of the Laurisilva ecosystem recognized as a UNESCO World Heritage landscape. The twisted trees and open plateau create a scenery that feels almost otherworldly.`,
      goldenbook_note: `One of Madeira's most atmospheric natural landscapes.`,
      insider_tip: `This is a place to slow down and simply absorb the surroundings.`,
    },
    es: {
      full_description: `Fanal, en Porto Moniz, es uno de los lugares más emblemáticos de Madeira y destaca por su bosque centenario de laurisilva, con ejemplares anteriores al descubrimiento de la isla. Su paisaje, protegido dentro de la red Natura 2000 y descrito por la propia promoción turística como de atmósfera casi mística, tiene una belleza muy distinta a la del litoral.`,
      goldenbook_note: `Un lugar de naturaleza solemne y fotogénica, más contemplativo que espectacular en el sentido obvio.`,
      insider_tip: `Funciona especialmente bien para quien quiere sentir Madeira desde el silencio y la textura del paisaje, no solo desde los grandes miradores.`,
    },
    pt: {
      full_description: `Situado no planalto do Paul da Serra, o Fanal é conhecido pela sua floresta de laurissilva centenária, parte do património natural da Madeira. As árvores antigas e a paisagem envolvente criam uma atmosfera quase mística.`,
      goldenbook_note: `Um dos cenários naturais mais evocadores da ilha.`,
      insider_tip: `Um lugar ideal para caminhar devagar e apreciar a natureza.`,
    },
  },
]

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Beautiful Spots — Editorial Content')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log('═══════════════════════════════════════════════════════════\n')

  let updated = 0
  let failed = 0

  for (const place of EDITORIAL) {
    // Resolve place ID
    let placeId: string | null = null
    const { rows: bySlug } = await db.query<{ id: string }>(
      `SELECT id FROM places WHERE slug = $1 LIMIT 1`,
      [place.slug],
    )
    placeId = bySlug[0]?.id ?? null

    if (!placeId && place.googlePlaceId) {
      const { rows: byGoogle } = await db.query<{ id: string }>(
        `SELECT id FROM places WHERE google_place_id = $1 LIMIT 1`,
        [place.googlePlaceId],
      )
      placeId = byGoogle[0]?.id ?? null
    }

    if (!placeId) {
      console.log(`✗ ${place.slug} — not found in DB`)
      failed++
      continue
    }

    console.log(`── ${place.slug} (${placeId})`)

    for (const locale of ['en', 'es', 'pt'] as const) {
      const content = place[locale]

      if (DRY_RUN) {
        console.log(`  [${locale}] would update: ${content.goldenbook_note.slice(0, 50)}...`)
        continue
      }

      await db.query(`
        UPDATE place_translations
        SET
          full_description = $1,
          goldenbook_note  = $2,
          insider_tip      = $3,
          updated_at       = now()
        WHERE place_id = $4 AND locale = $5
      `, [content.full_description, content.goldenbook_note, content.insider_tip, placeId, locale])

      // If no row was updated (translation doesn't exist yet), insert it
      const { rowCount } = await db.query(`
        INSERT INTO place_translations (place_id, locale, full_description, goldenbook_note, insider_tip)
        SELECT $1, $2, $3, $4, $5
        WHERE NOT EXISTS (
          SELECT 1 FROM place_translations WHERE place_id = $1 AND locale = $2
        )
      `, [placeId, locale, content.full_description, content.goldenbook_note, content.insider_tip])

      const action = rowCount && rowCount > 0 ? 'inserted' : 'updated'
      console.log(`  [${locale}] ${action}`)
    }

    updated++
  }

  console.log(`\n═══════════════════════════════════════════════════════════`)
  console.log(`  Done: ${updated} places updated, ${failed} not found`)
  console.log('═══════════════════════════════════════════════════════════')

  await db.end()
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
