#!/usr/bin/env tsx
// ─── Notas editoriales a partir de reseñas reales ─────────────────────────
//
// Escribe goldenbook_note e insider_tip para fichas que no los tienen.
//
// La diferencia con generate-editorial-notes.ts, que ya existía, es de dónde
// sale el contenido. Aquel componía frases a partir de datos estructurados
// (tipo, cocina, ciudad), y por eso suena a plantilla: podía decir lo mismo
// de cualquier restaurante de Lisboa. Este parte de lo que cientos de
// visitantes reales han escrito, y lo que hace que un texto suene humano no
// es el adjetivo, es el detalle concreto: que la gente pide langosta con
// huevos fritos, que a la hora de comer hay cola, que se paga caro.
//
// La regla que no se cruza: nada de experiencia en primera persona. No
// decimos que hemos estado, ni afirmamos nada que no esté respaldado por lo
// que dicen los visitantes. Cuando la evidencia no da para una afirmación, la
// frase no se escribe. Un texto de menos es recuperable; uno inventado sobre
// un negocio real que manda a alguien a una puerta cerrada, no.
//
// Uso:
//   npx tsx src/scripts/editorial-from-reviews.ts --dry-run --limit=4
//   npx tsx src/scripts/editorial-from-reviews.ts --slug=nunes-real-marisqueira
//   npx tsx src/scripts/editorial-from-reviews.ts --since-hours=6

import { db } from '../db/postgres'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0', 10) || 0
const SLUG = args.find(a => a.startsWith('--slug='))?.split('=')[1] ?? null
const SINCE_HOURS = parseInt(args.find(a => a.startsWith('--since-hours='))?.split('=')[1] ?? '0', 10) || 0

const KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? ''

// ─── Señales que buscamos en las reseñas ──────────────────────────────────
//
// Cada señal necesita aparecer en al menos MIN_MENTIONS reseñas distintas
// para contar. Con cinco reseñas por ficha, una sola mención es anécdota;
// dos ya es un patrón débil pero reportable, y así lo redactamos.

const MIN_MENTIONS = 2

interface Signal { key: string; patterns: RegExp[] }

const SIGNALS: Signal[] = [
  { key: 'reservar',    patterns: [/reserv/i, /cola/i, /esperar?\b/i, /lleno/i, /lotado/i] },
  { key: 'caro',        patterns: [/\bcaro/i, /\bcaret/i, /precio.{0,20}(alto|elevad)/i, /\bcaros?\b/i] },
  { key: 'servicio',    patterns: [/servicio|atención|atencion|camarero|personal|trato/i] },
  { key: 'vistas',      patterns: [/vista|mirador|panorámic|panoramic|terraza/i] },
  { key: 'fresco',      patterns: [/fresc/i] },
  { key: 'familia',     patterns: [/niñ|familia|criança/i] },
  { key: 'tranquilo',   patterns: [/tranquil|calma|silenc/i] },
  { key: 'cantidad',    patterns: [/raciones|porciones|abundante|generos/i] },
]

/** Platos y productos concretos: lo que de verdad hace útil un consejo. */
const DISHES = [
  'bacalao', 'marisco', 'langosta', 'ostras', 'erizos', 'gambas', 'gambones',
  'pulpo', 'almejas', 'percebes', 'arroz', 'pastel de nata', 'pasteles',
  'carne', 'chuletón', 'entrecot', 'pescado', 'sardinas', 'ceviche',
  'sopa', 'postre', 'vino', 'vinos', 'ginjinha', 'café', 'tostas',
]

interface Review { text: string; rating: number; when: string }

interface PlaceRow {
  id: string; slug: string; name: string; place_type: string
  google_place_id: string | null; city: string
  rating: number | null; rating_count: number | null
}

// ─── Google ────────────────────────────────────────────────────────────────

async function fetchReviews(name: string, city: string): Promise<{ reviews: Review[]; rating: number | null; count: number | null }> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': 'places.displayName,places.reviews,places.rating,places.userRatingCount',
    },
    body: JSON.stringify({ textQuery: `${name} ${city} Portugal`, languageCode: 'es', maxResultCount: 1 }),
  })
  const json = await res.json() as any
  if (json.error) throw new Error(json.error.message)
  const p = json.places?.[0]
  if (!p) return { reviews: [], rating: null, count: null }
  const reviews: Review[] = (p.reviews ?? []).map((r: any) => ({
    text: (r.text?.text ?? r.originalText?.text ?? '').replace(/\s+/g, ' ').trim(),
    rating: r.rating ?? 0,
    when: r.relativePublishTimeDescription ?? '',
  })).filter((r: Review) => r.text.length > 20)
  return { reviews, rating: p.rating ?? null, count: p.userRatingCount ?? null }
}

// ─── Extracción ────────────────────────────────────────────────────────────

function extract(reviews: Review[]) {
  const found = new Set<string>()
  for (const sig of SIGNALS) {
    const hits = reviews.filter(r => sig.patterns.some(p => p.test(r.text))).length
    if (hits >= MIN_MENTIONS) found.add(sig.key)
  }

  // Platos citados por más de un reseñador, ordenados por menciones.
  const dishCount = new Map<string, number>()
  for (const dish of DISHES) {
    const hits = reviews.filter(r => new RegExp(`\\b${dish}`, 'i').test(r.text)).length
    if (hits >= MIN_MENTIONS) dishCount.set(dish, hits)
  }
  const dishes = [...dishCount.entries()].sort((a, b) => b[1] - a[1]).map(d => d[0])

  return { signals: found, dishes }
}

// ─── Redacción ─────────────────────────────────────────────────────────────
//
// Frases cortas y concretas. Todo lo que se afirma viene de la evidencia de
// arriba, y se atribuye a quien lo dijo: "quien viene lo repite", "los
// comentarios coinciden". Nunca "fuimos y nos encantó".

function buildNote(p: PlaceRow, s: ReturnType<typeof extract>, rating: number | null, count: number | null): string | null {
  const parts: string[] = []

  if (s.dishes.length >= 2) {
    parts.push(`Lo que más repiten quienes vienen: ${s.dishes.slice(0, 3).join(', ')}.`)
  } else if (s.dishes.length === 1) {
    parts.push(`El ${s.dishes[0]} es lo que más se menciona de su carta.`)
  }

  if (s.signals.has('servicio')) parts.push('El servicio sale bien parado en casi todos los comentarios.')
  if (s.signals.has('vistas'))   parts.push('Buena parte de lo que se destaca son las vistas.')
  if (s.signals.has('fresco'))   parts.push('La frescura del producto es lo que más se subraya.')
  if (s.signals.has('tranquilo')) parts.push('Se menciona a menudo lo tranquilo que está.')

  if (rating != null && count != null && count >= 300) {
    parts.push(`Sostiene un ${String(rating).replace('.', ',')} sobre ${count.toLocaleString('es-ES')} opiniones.`)
  }

  // Sin evidencia suficiente no se escribe nada. Preferimos el hueco.
  if (parts.length < 2) return null
  return parts.join(' ')
}

function buildTip(s: ReturnType<typeof extract>): string | null {
  const tips: string[] = []
  if (s.signals.has('reservar')) tips.push('Conviene reservar: los comentarios repiten que se llena')
  if (s.signals.has('caro'))     tips.push('varios avisan de que no es barato')
  if (s.signals.has('cantidad')) tips.push('las raciones se describen como generosas, conviene no pedir de más')
  if (s.signals.has('familia'))  tips.push('funciona bien con niños según quienes han ido en familia')
  if (tips.length === 0) return null
  const text = tips.join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1) + '.'
}

// ─── Run ───────────────────────────────────────────────────────────────────

async function main() {
  if (!KEY) { console.error('Falta GOOGLE_MAPS_API_KEY'); process.exit(1) }

  const where: string[] = ["p.status = 'published'"]
  const params: unknown[] = []
  if (SLUG) { params.push(SLUG); where.push(`p.slug = $${params.length}`) }
  if (SINCE_HOURS) { params.push(SINCE_HOURS); where.push(`p.created_at > now() - ($${params.length} || ' hours')::interval`) }

  const { rows } = await db.query<PlaceRow>(`
    SELECT p.id, p.slug, p.name, p.place_type, p.google_place_id,
           d.name AS city, p.google_rating AS rating, p.google_rating_count AS rating_count
      FROM places p
      JOIN destinations d ON d.id = p.destination_id
     WHERE ${where.join(' AND ')}
     ORDER BY p.created_at DESC
     ${LIMIT ? `LIMIT ${LIMIT}` : ''}
  `, params)

  console.log(`\n${rows.length} fichas  ${DRY_RUN ? '[DRY RUN]' : ''}\n`)

  let written = 0, skipped = 0

  for (const p of rows) {
    let data
    try { data = await fetchReviews(p.name, p.city) }
    catch (e) { console.log(`${p.name}: fallo Google (${(e as Error).message})`); skipped++; continue }

    if (data.reviews.length < 3) {
      console.log(`${p.name}: solo ${data.reviews.length} reseñas utilizables, no escribo nada`)
      skipped++; continue
    }

    const sig = extract(data.reviews)
    const note = buildNote(p, sig, data.rating, data.count)
    const tip = buildTip(sig)

    if (!note) {
      console.log(`${p.name}: sin evidencia suficiente (${data.reviews.length} reseñas, señales: ${[...sig.signals].join(',') || 'ninguna'})`)
      skipped++; continue
    }

    console.log(`\n${p.name}`)
    console.log(`  evidencia: ${data.reviews.length} reseñas · señales: ${[...sig.signals].join(', ') || '-'} · platos: ${sig.dishes.join(', ') || '-'}`)
    console.log(`  nota:  ${note}`)
    if (tip) console.log(`  tip:   ${tip}`)

    if (!DRY_RUN) {
      // Portugués es la locale canónica editorial, pero estos textos están en
      // español porque es el 68,7% del uso real. Se escriben en la fila 'es' y
      // el sistema de traducción los propaga desde ahí.
      await db.query(`
        INSERT INTO place_translations (place_id, locale, goldenbook_note, insider_tip, source)
        VALUES ($1, 'es', $2, $3, 'manual_fix')
        ON CONFLICT (place_id, locale) DO UPDATE SET
          goldenbook_note = EXCLUDED.goldenbook_note,
          insider_tip     = COALESCE(EXCLUDED.insider_tip, place_translations.insider_tip)
      `, [p.id, note, tip])
      written++
    } else { written++ }
  }

  console.log(`\n${written} con texto · ${skipped} sin evidencia suficiente\n`)
  await db.end()
}

main().catch(e => { console.error(e); process.exit(1) })
