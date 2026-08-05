#!/usr/bin/env tsx
// ─── Notas editoriales: Belém y Parque das Nações ─────────────────────────
//
// Escritas a mano leyendo las reseñas reales de cada sitio, no generadas por
// plantilla. El intento automático (editorial-from-reviews.ts) servía para
// extraer la evidencia, pero producía prosa plana y repetida: "el servicio
// sale bien parado" aparecía en la mitad de las fichas. Lo que hace que un
// texto suene a persona no es el adjetivo, es el detalle concreto, y ese hay
// que sacarlo leyendo.
//
// Reglas que se siguieron en las tres tandas:
//
//   1. Nada en primera persona. No decimos que hemos estado. Lo que se afirma
//      se atribuye a quien lo dijo: "quien va destaca", "los comentarios
//      coinciden". La guía es honesta sobre de dónde saca lo que sabe.
//   2. Todo dato viene de reseñas reales o de la ficha de Google. Ni un plato,
//      ni un horario, ni un precio inventado.
//   3. Se incluye lo malo cuando es consistente. Que el servicio se resienta
//      los domingos o que fuera del bacalao la carta sea corta es justo la
//      clase de aviso por el que alguien vuelve a una guía.
//   4. Sin guiones largos.
//
// Uso:
//   npx tsx src/scripts/editorial-belem-nacoes.ts --dry-run
//   npx tsx src/scripts/editorial-belem-nacoes.ts

import { db } from '../db/postgres'

const DRY_RUN = process.argv.includes('--dry-run')

interface Note { slug: string; note: string; tip: string | null }

const NOTES: Note[] = [
  {
    slug: 'feitoria',
    note: "Una estrella Michelin junto al muelle, dentro del Altis Belém. Lo que más se repite entre quienes salen de aquí es la sencillez: platos sin artificio donde todo el peso lo lleva el producto. El menú degustación es el camino, con su maridaje.",
    tip: "Es caro y no lo disimula. Reservad con tiempo y guardaos la noche entera, porque el degustación no tiene ninguna prisa.",
  },
  {
    slug: 'sud-lisboa-terrazza',
    note: "Una terraza sobre el Tajo con piscina y, un piso más arriba, un rooftop que se llena al caer la tarde. Las vistas son lo primero que se lleva todo el mundo. Para empezar, el pulpo y la burrata son lo que más sale de la cocina.",
    tip: "Guardaos la última copa para el rooftop. Es donde está el ambiente cuando ya ha caído el sol.",
  },
  {
    slug: 'descobre',
    note: "A un paseo de la Torre de Belém, con una terraza interior que desde la calle nadie adivina. La fachada engaña, y esa es media gracia del sitio. De la carta salen sobre todo los pimientos rellenos de queso de cabra, las croquetas de pato y los chipirones a la parrilla.",
    tip: "Pedid la terraza interior nada más entrar. Es lo mejor que tiene y desde fuera no se ve.",
  },
  {
    slug: 'pastelaria-pasteles-de-belem',
    note: "Aquí nació el pastel de nata, y la receta sigue siendo la del monasterio de al lado. Salen del horno durante todo el día y llegan calientes, con la canela y el azúcar aparte para que cada uno se lo ponga. Está siempre lleno, y aun así la diferencia con cualquier otro se nota en el primer bocado.",
    tip: "Hay tres colas: mostrador para llevar, servicio de mesa y servicio rápido. La del mostrador impone pero avanza deprisa. Y dentro hay más salas de las que parece, así que sitio casi siempre hay.",
  },
  {
    slug: 'senhor-peixe-restaurante-marisqueira-lda',
    note: "Marisquería de las de mostrador, donde el pescado se elige a la vista y se pesa delante. El cabracho es lo que más se pide. Y hay algo que se agradece: el personal se toma su tiempo en explicar qué es cada pieza antes de que decidáis.",
    tip: "Los domingos a mediodía se llena y el servicio se resiente; entre semana por la noche está tranquilo. Ojo al couvert: el pan, la mantequilla y las aceitunas se cobran, y se pueden devolver.",
  },
  {
    slug: 'd-bacalhau',
    note: "El bacalao en casi todas las formas que la tradición portuguesa ha ido inventando. La degustación es la manera de probar varias de una sentada, y es lo que casi todo el mundo acaba pidiendo. Fuera del bacalao la carta es corta, y conviene saberlo antes de sentarse.",
    tip: "Abre a las siete para cenas y a esa hora se entra sin cola. Aunque la terraza parezca vacía, la planta de arriba suele estar llena.",
  },
  {
    slug: 'monasterio-de-los-jeronimos-de-belem',
    note: "El claustro es la razón por la que se viene. Dos pisos de piedra tallada como si fuera encaje, donde no hay dos columnas iguales, y una calma que sorprende teniendo medio Lisboa esperando fuera. Dentro conviven también el Museo de Marina y el Arqueológico.",
    tip: "Comprar la entrada por internet se ha vuelto un lío de reventas y precios raros. En las casetas oficiales de enfrente se compran sin intermediarios.",
  },
  {
    slug: 'torre-de-belem',
    note: "Cinco siglos guardando la entrada del Tajo y todavía parece recién salida del agua. Se sube hasta la terraza, que es donde de verdad se entiende por qué la levantaron ahí: el río abriéndose hacia el Atlántico, exactamente lo mismo que veían los que se marchaban.",
    tip: "La entrada se vende solo por internet, 15 euros en junio de 2026. Si Maps la da por cerrada temporalmente, no os fieis: en el quiosco frente a los Jerónimos confirman si abre ese día.",
  },
  {
    slug: 'museu-de-arte-arquitetura-e-tecnologia',
    note: "Aquí el edificio es la obra. La cubierta ondulada de Amanda Levete se recorre entera a pie y acaba siendo el mejor mirador del tramo, con el río y el puente delante. Al lado sigue en pie la vieja central eléctrica, con sus calderas intactas. Las exposiciones cambian y no todas están al mismo nivel.",
    tip: "Los dos edificios entran en la misma entrada. Y el exterior, incluida la subida a la cubierta, se recorre sin pasar por taquilla.",
  },
  {
    slug: 'monumento-a-los-descubrimientos',
    note: "Cincuenta y dos metros de piedra con forma de carabela, mirando al río por el que se fueron todos. A sus pies, la rosa de los vientos de mármol señala dónde y cuándo llegaron los portugueses a cada rincón del mundo. Arriba hay mirador, y se sube en ascensor.",
    tip: "La explanada de la orilla es lo mejor de la visita, sobre todo con sol. Merece el paseo aunque no subáis.",
  },
  {
    slug: 'jardin-botanico-tropical',
    note: "Un respiro verde en mitad de Belém, con más de seiscientas especies traídas de donde Portugal navegó y ordenadas por continente. Los pavos reales andan sueltos y se cruzan contigo sin inmutarse. Es justo el sitio al que ir cuando ya llevas tres monumentos encima y aprieta el calor.",
    tip: "La zona oriental está algo descuidada. Lo bueno se concentra en la parte central y en los invernaderos.",
  },
  {
    slug: 'darwin-s-cafe',
    note: "Dentro de la Fundación Champalimaud, con el Tajo abriéndose justo delante. El interior sorprende: criaturas de colores por todas partes, un capricho que sale bien. Está tranquilo, cosa rara tan cerca de Belém, y se come bien sin que la cuenta se dispare.",
    tip: "Buena opción con niños: hay menú infantil y espacio de sobra.",
  },
  {
    slug: 'oceanario-de-lisboa',
    note: "Todo gira alrededor de un tanque central de cinco millones de litros que se recorre en dos alturas, así que el mismo océano se ve dos veces y nunca igual. Alrededor, hábitats enteros reconstruidos, del Atlántico norte al Pacífico. Se recorre en un par de horas largas.",
    tip: "Bajad al segundo nivel. Es donde el tanque central se ve desde abajo, y mucha gente se lo salta sin saber que existe.",
  },
  {
    slug: 'pavilhao-do-conhecimento-ciencia-viva',
    note: "Ciencia que se toca. Todo está pensado para manipularlo, con zonas separadas por edades, y funciona igual de bien con un niño de cinco años que con un adolescente aburrido. Es de los pocos museos donde nadie mira el reloj.",
    tip: "Por la mañana hay poca gente y se puede probar todo sin esperar turno. La entrada familiar sale por 35 euros.",
  },
  {
    slug: 'casino-lisboa',
    note: "Más que una sala de juego: varias plantas, espectáculos y un bar que gira despacio, tan despacio que se tarda un rato en darse cuenta. Es de los pocos sitios de la zona que sigue en pie de madrugada.",
    tip: "El bar giratorio merece la parada aunque no vayáis a jugar. Hace falta documento de identidad para entrar, como en cualquier casino.",
  },
  {
    slug: 'telecabina-lisboa-estacion-norte',
    note: "Un kilómetro de recorrido a treinta metros sobre el paseo ribereño, con el puente Vasco da Gama de fondo. Es corto, y quien lo hace lo dice, pero las vistas compensan de sobra el trayecto.",
    tip: "Siete euros solo ida, nueve y medio ida y vuelta. Con un sentido basta: se baja en la otra punta y se vuelve andando por el paseo. En agosto las cabinas se calientan bastante.",
  },
  {
    slug: 'teatro-camoes',
    note: "Sede de la Compañía Nacional de Bailado, en un edificio moderno junto al agua. Se respira ambiente de casa de danza, incluido su Café Ballet, que es buen sitio para esperar a que abran la sala.",
    tip: "Llegar en transporte público es un incordio: el metro no deja en la puerta. Contad tiempo de sobra, o venid andando desde el Oceanário.",
  },
  {
    slug: 'torre-vasco-da-gama',
    note: "Ciento cuarenta y cinco metros con perfil de vela, el edificio más alto de Lisboa. Arriba hay un bar tranquilo desde el que se ve el estuario entero y el puente Vasco da Gama estirándose hasta perderse de vista, que es el más largo de Europa.",
    tip: "El café con pastel de nata sale por 4,50 euros, que para las vistas que acompañan es de lo mejor pagado de la ciudad. El chupito de ginjinha se va de precio.",
  },
  {
    slug: 'garcia-de-orta-garden',
    note: "Un paseo largo junto al agua, con esculturas hechas de material reciclado y el teleférico cruzando por encima. Es la Lisboa nueva, la que se levantó para la Expo, y se recorre entera sin esfuerzo.",
    tip: "Hay tramos algo descuidados. Lo mejor del jardín es el trozo que va del Oceanário hacia el norte.",
  },
  {
    slug: 'jardin-de-vasco-da-gama',
    note: "Justo enfrente de los Jerónimos y aun así en calma. Hay bancos, sombra de sobra y un pabellón tailandés que fue un regalo del país y que casi nadie espera encontrarse aquí. Es el sitio donde sentarse cuando Belém aprieta.",
    tip: "Bueno para picnic. Con los pasteles de Belém a dos minutos, la combinación se cae por su propio peso.",
  },
  {
    slug: 'museo-nacional-de-carruajes',
    note: "Decenas de carrozas reales, doradas y talladas como retablos, en el mayor conjunto de su clase que existe. No es un museo para todo el mundo: quien no le vea la gracia lo sabrá en diez minutos, y quien se la vea saldrá dos horas después.",
    tip: "Entra en la Lisboa Card. Si ya la lleváis, la visita no cuesta nada extra.",
  },
  {
    slug: 'centro-cultural-de-belem',
    note: "Un bloque de hormigón que por fuera no promete nada y por dentro guarda dos auditorios, el grande con palcos y una acústica que sorprende. Desde las plantas altas se ve Belém entero, con los Jerónimos justo delante.",
    tip: "Mirad la programación antes de venir. Fuera de los días con función, buena parte del edificio está cerrada y solo quedan abiertas las terrazas.",
  },
  {
    slug: 'the-club-steakhouse-rooftop-bar-parque-das-nacoes',
    note: "Asador con azotea en Parque das Nações, con la carne como única razón de ser. La picaña es lo que más sale de la cocina y el Tomahawk el que se pide cuando hay algo que celebrar. La sala está bien puesta y se cena tranquilo.",
    tip: "El Tomahawk ronda los 95 euros. Si lo pedís, confirmad el corte con el camarero antes de que salga: hay quien ha recibido otro distinto.",
  },
  {
    slug: 'nunes-real-marisqueira',
    note: "Marisquería de las de siempre en pleno Belém, con el género a la vista y el peso delante del cliente. Los grupos acaban pidiendo lo mismo casi sin hablarlo: erizos y ostras para empezar, y langosta con huevos rotos para terminar.",
    tip: "Es caro y nadie lo disimula. Se lleva mejor yendo varios y pidiendo para compartir.",
  },
]

async function main() {
  console.log(`\n${NOTES.length} notas  ${DRY_RUN ? '[DRY RUN]' : ''}\n`)
  let ok = 0, missing = 0

  for (const n of NOTES) {
    const { rows } = await db.query<{ id: string; name: string }>(
      'SELECT id, name FROM places WHERE slug = $1', [n.slug])
    if (rows.length === 0) { console.log(`  ${n.slug}: no existe`); missing++; continue }

    console.log(`\n${rows[0].name}`)
    console.log(`  ${n.note}`)
    if (n.tip) console.log(`  Tip: ${n.tip}`)

    if (!DRY_RUN) {
      // Español: es el 68,7% del uso real de la app. El sistema de traducción
      // propaga desde aquí a PT y EN.
      // `name` es NOT NULL en place_translations. En una fila nueva se siembra
      // con el nombre canónico de la ficha; si la fila ya existe se deja el que
      // hubiera, porque los nombres propios no se traducen y no queremos que
      // este script los pise.
      await db.query(`
        INSERT INTO place_translations (place_id, locale, name, goldenbook_note, insider_tip, source)
        VALUES ($1, 'es', $2, $3, $4, 'manual_fix')
        ON CONFLICT (place_id, locale) DO UPDATE SET
          goldenbook_note = EXCLUDED.goldenbook_note,
          insider_tip     = EXCLUDED.insider_tip,
          source          = 'manual_fix'
      `, [rows[0].id, rows[0].name, n.note, n.tip])
    }
    ok++
  }

  console.log(`\n${ok} escritas · ${missing} sin ficha\n`)
  await db.end()
}

main().catch(e => { console.error(e); process.exit(1) })
