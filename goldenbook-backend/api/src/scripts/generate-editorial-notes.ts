#!/usr/bin/env tsx
// ─── Editorial Notes Generator ────────────────────────────────────────────
//
// Generates goldenbook_note + insider_tip for places lacking editorial copy.
// Uses structured data (tags, cuisine, price, location) to produce
// Michelin/Monocle-style editorial text. No LLM required.
//
// Usage:
//   npx tsx api/src/scripts/generate-editorial-notes.ts
//   npx tsx api/src/scripts/generate-editorial-notes.ts --dry-run
//   npx tsx api/src/scripts/generate-editorial-notes.ts --city=porto
//   npx tsx api/src/scripts/generate-editorial-notes.ts --limit=5

import { db } from '../db/postgres'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const CITY_FILTER = args.find(a => a.startsWith('--city='))?.split('=')[1] ?? null
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0', 10) || 0

// ─── Types ─────────────────────────────────────────────────────────────────

interface PlaceData {
  id: string
  name: string
  slug: string
  place_type: string
  city_name: string
  city_slug: string
  price_tier: number | null
  google_rating: number | null
  google_rating_count: number | null
  cuisine_types: string[] | null
  context_tags_auto: string[] | null
  moment_tags_auto: string[] | null
  address_line: string | null
  short_description: string | null
  classification_category: string | null
  classification_subcategory: string | null
  has_note: boolean
  has_tip: boolean
}

// ─── Helper ────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function has(tags: string[] | null, tag: string): boolean {
  return tags?.includes(tag) ?? false
}

function cityContext(city: string): string {
  const map: Record<string, string> = {
    porto: 'Porto', lisboa: 'Lisbon', algarve: 'the Algarve', madeira: 'Madeira',
  }
  return map[city] ?? city
}

// ─── Note templates — by place type ───────────────────────────────────────
// Each template receives structured data and returns a curated sentence.
// The tone is editorial: precise, understated, never promotional.

function generateNote(p: PlaceData): string | null {
  const tags = p.context_tags_auto ?? []
  const moments = p.moment_tags_auto ?? []
  const cuisines = p.cuisine_types ?? []
  const city = cityContext(p.city_slug)
  const addr = (p.address_line ?? '').toLowerCase()

  // Minimum data threshold — skip if we know almost nothing
  if (tags.length === 0 && !p.price_tier && !p.google_rating && cuisines.length === 0) {
    return null
  }

  switch (p.place_type) {
    case 'restaurant': return noteRestaurant(p, tags, cuisines, city, addr)
    case 'cafe':       return noteCafe(p, tags, city, addr)
    case 'bar':        return noteBar(p, tags, city, addr)
    case 'hotel':      return noteHotel(p, tags, city, addr)
    case 'shop':       return noteShop(p, tags, city, addr)
    case 'museum':     return noteMuseum(p, tags, city)
    case 'landmark':   return noteLandmark(p, tags, city)
    case 'beach':      return noteBeach(p, tags, city)
    case 'activity':   return noteActivity(p, tags, moments, city, addr)
    default:           return noteGeneric(p, tags, city)
  }
}

// ── Restaurant ──────────────────────────────────────────────────────────

function noteRestaurant(p: PlaceData, tags: string[], cuisines: string[], city: string, addr: string): string {
  const parts: string[] = []

  // Opening: atmosphere/setting
  if (p.price_tier === 4) {
    parts.push(pick([
      `A refined address in ${city}`,
      `One of ${city}'s more distinguished dining rooms`,
      `An elegant restaurant that rewards the unhurried diner`,
    ]))
  } else if (p.price_tier === 3) {
    parts.push(pick([
      `A well-regarded table in ${city}`,
      `A restaurant with a quiet confidence about its cooking`,
      `A thoughtful dining room with considered details`,
    ]))
  } else if (p.price_tier === 2) {
    parts.push(pick([
      `An honest neighbourhood restaurant`,
      `A reliable local address with no pretension`,
      `Straightforward cooking in a welcoming setting`,
    ]))
  } else {
    parts.push(pick([
      `A local favourite with character`,
      `An unpretentious spot with a loyal following`,
      `A welcoming address in ${city}`,
    ]))
  }

  // Cuisine focus
  if (cuisines.length > 0) {
    const primary = cuisines[0]
    const cuisineMap: Record<string, string> = {
      portuguese: 'rooted in Portuguese tradition',
      seafood: 'with a focus on fresh seafood',
      italian: 'drawing on Italian technique',
      japanese: 'with precise Japanese cooking',
      french: 'informed by French culinary tradition',
      mediterranean: 'with a Mediterranean sensibility',
      'fine-dining': 'where each course is composed with care',
    }
    if (cuisineMap[primary]) parts.push(cuisineMap[primary])
  }

  // Setting detail
  if (has(tags, 'terrace') || addr.includes('praia') || addr.includes('mar')) {
    parts.push(pick(['with outdoor seating that catches the light', 'and an inviting terrace']))
  } else if (has(tags, 'viewpoint') || has(tags, 'rooftop')) {
    parts.push('with views that complement the menu')
  } else if (has(tags, 'romantic')) {
    parts.push(pick(['suited to longer evenings', 'with an atmosphere that encourages you to stay']))
  }

  return parts.join(', ') + '.'
}

// ── Café ────────────────────────────────────────────────────────────────

function noteCafe(p: PlaceData, tags: string[], city: string, addr: string): string {
  if (has(tags, 'brunch')) {
    return pick([
      `A well-paced café in ${city} where brunch feels unhurried and the coffee is taken seriously.`,
      `Morning light, good coffee, and a menu that understands the art of starting slow.`,
      `A café with the rare ability to make a late breakfast feel like the right decision.`,
    ])
  }
  return pick([
    `A quiet café in ${city} with considered details and coffee worth lingering over.`,
    `The kind of café that invites you to sit a little longer than planned.`,
    `An understated address for those who take their coffee — and their mornings — seriously.`,
  ])
}

// ── Bar ─────────────────────────────────────────────────────────────────

function noteBar(p: PlaceData, tags: string[], city: string, addr: string): string {
  if (has(tags, 'wine')) {
    return pick([
      `A wine-focused bar in ${city} where the list rewards curiosity and the atmosphere is easy.`,
      `A place for those who appreciate a well-chosen glass and unhurried conversation.`,
      `Wine bar with a thoughtful selection and a mood that improves with each glass.`,
    ])
  }
  if (has(tags, 'cocktails')) {
    return pick([
      `A cocktail bar in ${city} with a concise menu and confident execution.`,
      `The kind of bar where the drink list is short, deliberate, and well-made.`,
      `An evening address where the cocktails are precise and the lighting is right.`,
    ])
  }
  return pick([
    `A well-tuned bar in ${city} that understands the value of a good drink and good company.`,
    `An inviting spot for an evening drink, with a mood that suits the hour.`,
  ])
}

// ── Hotel ───────────────────────────────────────────────────────────────

function noteHotel(p: PlaceData, tags: string[], city: string, addr: string): string {
  if (p.price_tier && p.price_tier >= 3) {
    return pick([
      `A well-appointed hotel in ${city} where attention to detail extends from the rooms to the service.`,
      `A property with the quiet assurance of a place that knows its guests well.`,
      `Comfortable and considered, with the kind of hospitality that feels effortless.`,
    ])
  }
  if (has(tags, 'wellness')) {
    return pick([
      `A hotel in ${city} where the spa is more than an afterthought and the pace is deliberately slower.`,
      `A retreat-minded property where wellness is woven into the stay, not bolted on.`,
    ])
  }
  return pick([
    `A solid base in ${city} with well-judged rooms and reliable comfort.`,
    `A hotel that delivers on the fundamentals — clean design, good beds, and a sense of place.`,
  ])
}

// ── Shop ────────────────────────────────────────────────────────────────

function noteShop(p: PlaceData, tags: string[], city: string, addr: string): string {
  const sub = p.classification_subcategory
  if (sub === 'joalharia' || sub === 'relojoaria') {
    return pick([
      `A jeweller in ${city} with a curated selection and an eye for quality over quantity.`,
      `A refined address for those who value craftsmanship and a considered edit.`,
    ])
  }
  if (sub === 'moda') {
    return pick([
      `A fashion address in ${city} with a clear point of view and well-edited collections.`,
      `A shop where the curation feels personal and the selection rewards a closer look.`,
    ])
  }
  if (has(tags, 'local-secret')) {
    return pick([
      `A local find in ${city} — the kind of shop you're glad someone told you about.`,
      `Worth the detour. A shop with personality and a selection that reflects genuine taste.`,
    ])
  }
  return pick([
    `A well-curated shop in ${city} with a selection that speaks to local taste.`,
    `An address for considered shopping, away from the obvious.`,
  ])
}

// ── Museum ──────────────────────────────────────────────────────────────

function noteMuseum(p: PlaceData, tags: string[], city: string): string {
  return pick([
    `A museum in ${city} that rewards the curious visitor with thoughtful curation and an engaging collection.`,
    `A cultural address worth setting aside an afternoon for — well-presented and quietly absorbing.`,
    `A museum with substance. The kind of place that deepens your understanding of the region.`,
    `Well-curated and unhurried. A museum that treats its subject with the attention it deserves.`,
  ])
}

// ── Landmark ────────────────────────────────────────────────────────────

function noteLandmark(p: PlaceData, tags: string[], city: string): string {
  if (has(tags, 'viewpoint')) {
    return pick([
      `A vantage point in ${city} that puts the landscape in perspective — best at golden hour.`,
      `Worth the walk. The views from here reward patience and good timing.`,
    ])
  }
  return pick([
    `A landmark in ${city} that anchors the neighbourhood and rewards an unhurried visit.`,
    `A place with presence. The kind of landmark you return to and notice something new each time.`,
    `A point of reference in ${city} — historically grounded and worth the stop.`,
  ])
}

// ── Beach ───────────────────────────────────────────────────────────────

function noteBeach(p: PlaceData, tags: string[], city: string): string {
  if (has(tags, 'sunset')) {
    return pick([
      `A stretch of coast in ${city} where the afternoon light does most of the work.`,
      `Best approached late in the day, when the crowds thin and the light turns golden.`,
    ])
  }
  return pick([
    `A beach in ${city} with the right balance of space, water, and atmosphere.`,
    `The kind of beach that locals keep returning to — unpretentious and well-situated.`,
  ])
}

// ── Activity ────────────────────────────────────────────────────────────

function noteActivity(p: PlaceData, tags: string[], moments: string[], city: string, addr: string): string {
  if (has(tags, 'wellness')) {
    return pick([
      `A wellness experience in ${city} where the pace slows deliberately and the treatment is considered.`,
      `A well-run spa that understands the difference between luxury and genuine relaxation.`,
    ])
  }
  if (has(tags, 'wine') || addr.includes('adega') || addr.includes('wine')) {
    return pick([
      `A wine experience in ${city} that goes beyond tasting — a window into the region's terroir.`,
      `For those who appreciate wine as context, not just content. A visit that lingers.`,
    ])
  }
  return pick([
    `An experience in ${city} worth carving out time for — well-organised and genuinely engaging.`,
    `A thoughtfully run activity that offers more than the surface-level tourist experience.`,
  ])
}

// ── Generic fallback ────────────────────────────────────────────────────

function noteGeneric(p: PlaceData, tags: string[], city: string): string {
  return pick([
    `A distinctive address in ${city} that stands apart from the obvious choices.`,
    `Worth knowing about. A place in ${city} with character and a clear sense of purpose.`,
  ])
}

// ─── Insider tip templates ────────────────────────────────────────────────

function generateTip(p: PlaceData): string | null {
  const tags = p.context_tags_auto ?? []
  const moments = p.moment_tags_auto ?? []
  const type = p.place_type

  // Minimum data
  if (tags.length === 0 && moments.length === 0) return null

  switch (type) {
    case 'restaurant': return tipRestaurant(tags, moments, p)
    case 'cafe':       return tipCafe(tags, moments)
    case 'bar':        return tipBar(tags, moments)
    case 'hotel':      return tipHotel(tags)
    case 'shop':       return tipShop(tags)
    case 'museum':     return tipMuseum(tags, moments)
    case 'landmark':   return tipLandmark(tags, moments)
    case 'beach':      return tipBeach(tags, moments)
    case 'activity':   return tipActivity(tags, moments, p)
    default:           return tipGeneric(tags)
  }
}

function tipRestaurant(tags: string[], moments: string[], p: PlaceData): string {
  if (has(tags, 'terrace') && has(tags, 'sunset')) {
    return pick([
      'Ask for a terrace table before sunset — the light alone is worth the timing.',
      'Book the terrace for the last seating. The view does half the work.',
    ])
  }
  if (has(tags, 'terrace')) {
    return pick([
      'The terrace seats fill first — reserve ahead if the weather is good.',
      'Request an outdoor table. The atmosphere changes entirely.',
    ])
  }
  if (has(tags, 'wine')) {
    return pick([
      'Ask the sommelier for a regional recommendation — the local pours are often the most interesting.',
      'The wine list is deeper than it looks. Ask for off-menu suggestions.',
    ])
  }
  if (has(moments, 'romantic-dinner')) {
    return pick([
      'The corner tables offer the most privacy — worth requesting when you book.',
      'A late reservation tends to be quieter and more intimate.',
    ])
  }
  if (has(moments, 'business-lunch')) {
    return pick([
      'Midweek lunch is less crowded and the service is particularly attentive.',
      'The lunch menu offers the same kitchen at a more approachable price.',
    ])
  }
  if (has(tags, 'lunch') && has(tags, 'dinner')) {
    return pick([
      'The lunch service is calmer and lets the food speak for itself.',
      'Arrive early for dinner to enjoy the room before it fills.',
    ])
  }
  if (has(tags, 'family')) {
    return pick([
      'Weekday lunch is ideal for families — more space, less noise.',
      'The kitchen is flexible with portions for younger guests if you ask.',
    ])
  }
  return pick([
    'Arrive without a fixed order in mind — the daily suggestions are often the strongest.',
    'The kitchen is at its sharpest during the first seating.',
  ])
}

function tipCafe(tags: string[], moments: string[]): string {
  if (has(moments, 'breakfast') || has(tags, 'brunch')) {
    return pick([
      'The early morning is the best window — quieter, with the best pastries still warm.',
      'Come before 10 for the full selection and a seat by the window.',
    ])
  }
  return pick([
    'The outdoor seats are perfect for a slow afternoon coffee.',
    'Mid-morning, midweek — the sweet spot for a quiet visit.',
  ])
}

function tipBar(tags: string[], moments: string[]): string {
  if (has(tags, 'cocktails')) {
    return pick([
      'Ask the bartender for something off-menu — they tend to be generous with regulars.',
      'The first hour after opening is the best time for a seat and full attention at the bar.',
    ])
  }
  if (has(tags, 'wine')) {
    return pick([
      'Ask for the glass pours — they rotate frequently and tend to feature local producers.',
      'The by-the-glass list is more adventurous than the bottle list suggests.',
    ])
  }
  return pick([
    'The atmosphere shifts after 22:00 — earlier is more conversational, later more spirited.',
    'Go early if you want a seat. Go late if you want the energy.',
  ])
}

function tipHotel(tags: string[]): string {
  if (has(tags, 'wellness')) {
    return pick([
      'Book the spa in advance — the morning slots are the calmest.',
      'The spa is worth a visit even if you\'re not staying — enquire at reception.',
    ])
  }
  return pick([
    'Ask for a room with a view when booking — the upgrade is often available.',
    'The breakfast service is worth waking up for. Arrive early for the best selection.',
  ])
}

function tipShop(tags: string[]): string {
  if (has(tags, 'local-secret')) {
    return pick([
      'Ask about pieces that aren\'t on display — the back catalogue is often more interesting.',
      'The staff know their stock well. A conversation usually leads to the best finds.',
    ])
  }
  return pick([
    'Visit on a weekday morning for the most unhurried browsing experience.',
    'Worth spending a few extra minutes — the details reveal themselves slowly.',
  ])
}

function tipMuseum(tags: string[], moments: string[]): string {
  if (has(moments, 'morning-visit')) {
    return pick([
      'Visit in the first hour after opening — the galleries are quieter and the light is better.',
      'Early morning is best. The tour groups arrive after 11.',
    ])
  }
  return pick([
    'Allow more time than you think. The collection rewards a slower pace.',
    'The temporary exhibitions are often stronger than the permanent collection — check what\'s on.',
  ])
}

function tipLandmark(tags: string[], moments: string[]): string {
  if (has(tags, 'viewpoint') || has(moments, 'sunset')) {
    return pick([
      'Late afternoon light is the most flattering. Time your visit accordingly.',
      'Arrive 30 minutes before sunset for the best position and softest light.',
    ])
  }
  return pick([
    'Visit outside peak hours for a more contemplative experience.',
    'The approach is part of the experience — take the longer route if time allows.',
  ])
}

function tipBeach(tags: string[], moments: string[]): string {
  if (has(tags, 'sunset') || has(moments, 'sunset')) {
    return pick([
      'Late afternoon is the best window — calmer winds, warmer light, fewer crowds.',
      'Stay for sunset. The beach empties and the light changes entirely.',
    ])
  }
  return pick([
    'Arrive before midday for the best spots. Bring your own shade.',
    'The water is calmest in the morning. By afternoon, the wind picks up.',
  ])
}

function tipActivity(tags: string[], moments: string[], p: PlaceData): string {
  if (has(tags, 'wine')) {
    return pick([
      'Book ahead and ask about the reserve tasting — it\'s not always listed.',
      'The guided visit adds context that improves every glass that follows.',
    ])
  }
  if (has(tags, 'wellness')) {
    return pick([
      'Morning treatments tend to be more relaxed — the afternoon fills up faster.',
      'Ask about the local-inspired treatments. They\'re usually the most considered.',
    ])
  }
  return pick([
    'Book in advance — walk-ins are possible but the schedule fills quickly.',
    'Ask the team about the less obvious options. The standard programme is only the beginning.',
  ])
}

function tipGeneric(tags: string[]): string {
  return pick([
    'Visit during off-peak hours for the most rewarding experience.',
    'Worth arriving with a little extra time — the details reward attention.',
  ])
}

// ─── Main pipeline ────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  Editorial Notes Generator')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`${'═'.repeat(60)}\n`)

  let query = `
    SELECT
      p.id, p.name, p.slug, p.place_type,
      d.slug AS city_slug, d.name AS city_name,
      p.price_tier, p.google_rating::float, p.google_rating_count,
      p.cuisine_types,
      p.context_tags_auto,
      p.moment_tags_auto,
      p.address_line,
      p.short_description,
      (p.classification_auto->>'category') AS classification_category,
      (p.classification_auto->>'subcategory') AS classification_subcategory,
      (pt_en.goldenbook_note IS NOT NULL AND pt_en.goldenbook_note != '') AS has_note,
      (pt_en.insider_tip IS NOT NULL AND pt_en.insider_tip != '') AS has_tip
    FROM places p
    JOIN destinations d ON d.id = p.destination_id
    LEFT JOIN place_translations pt_en ON pt_en.place_id = p.id AND pt_en.locale = 'en'
    WHERE p.status = 'published' AND p.is_active = true
      AND (pt_en.goldenbook_note IS NULL OR pt_en.goldenbook_note = ''
           OR pt_en.insider_tip IS NULL OR pt_en.insider_tip = '')
  `
  const params: unknown[] = []
  if (CITY_FILTER) {
    params.push(CITY_FILTER)
    query += ` AND d.slug = $${params.length}`
  }
  query += ' ORDER BY d.name, p.name'
  if (LIMIT > 0) {
    params.push(LIMIT)
    query += ` LIMIT $${params.length}`
  }

  const { rows } = await db.query<PlaceData>(query, params)
  console.log(`Found ${rows.length} places needing editorial notes\n`)

  let processed = 0
  let notesGenerated = 0
  let tipsGenerated = 0
  let skipped = 0

  for (const place of rows) {
    processed++

    const note = place.has_note ? null : generateNote(place)
    const tip = place.has_tip ? null : generateTip(place)

    if (!note && !tip) {
      skipped++
      console.log(`[${processed}/${rows.length}] ${place.name} — skipped (insufficient data)`)
      continue
    }

    console.log(`[${processed}/${rows.length}] ${place.name} (${place.city_slug}) [${place.place_type}]`)
    if (note) {
      console.log(`  note: ${note}`)
      notesGenerated++
    }
    if (tip) {
      console.log(`  tip:  ${tip}`)
      tipsGenerated++
    }

    if (!DRY_RUN) {
      // Upsert into place_translations (en locale)
      if (note && tip) {
        await db.query(`
          INSERT INTO place_translations (place_id, locale, name, goldenbook_note, insider_tip)
          VALUES ($1, 'en', $2, $3, $4)
          ON CONFLICT (place_id, locale) DO UPDATE SET
            goldenbook_note = COALESCE(NULLIF(place_translations.goldenbook_note, ''), EXCLUDED.goldenbook_note),
            insider_tip = COALESCE(NULLIF(place_translations.insider_tip, ''), EXCLUDED.insider_tip),
            updated_at = now()
        `, [place.id, place.name, note, tip])
      } else if (note) {
        await db.query(`
          INSERT INTO place_translations (place_id, locale, name, goldenbook_note)
          VALUES ($1, 'en', $2, $3)
          ON CONFLICT (place_id, locale) DO UPDATE SET
            goldenbook_note = COALESCE(NULLIF(place_translations.goldenbook_note, ''), EXCLUDED.goldenbook_note),
            updated_at = now()
        `, [place.id, place.name, note])
      } else if (tip) {
        await db.query(`
          INSERT INTO place_translations (place_id, locale, name, insider_tip)
          VALUES ($1, 'en', $2, $3)
          ON CONFLICT (place_id, locale) DO UPDATE SET
            insider_tip = COALESCE(NULLIF(place_translations.insider_tip, ''), EXCLUDED.insider_tip),
            updated_at = now()
        `, [place.id, place.name, tip])
      }
    }
  }

  // Report
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  EDITORIAL NOTES REPORT')
  console.log(`${'═'.repeat(60)}`)
  console.log(`  Processed:       ${processed}`)
  console.log(`  Notes generated:  ${notesGenerated}`)
  console.log(`  Tips generated:   ${tipsGenerated}`)
  console.log(`  Skipped:          ${skipped}`)
  console.log(`${'═'.repeat(60)}\n`)

  const fs = await import('fs')
  fs.writeFileSync('./editorial-notes-report.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : 'live',
    processed, notesGenerated, tipsGenerated, skipped,
  }, null, 2))
  console.log('Report: editorial-notes-report.json\n')

  await db.end()
}

main().catch(e => { console.error(e); process.exit(1) })
