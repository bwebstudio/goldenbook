#!/usr/bin/env tsx
// ─── Editorial Notes Generator v2 ──────────────────────────────────────────
//
// Generates goldenbook_note + insider_tip for places lacking editorial copy.
// Uses structured data (tags, cuisine, price, location) to produce
// Michelin/Monocle-style editorial text. No LLM required.
//
// v2 improvements:
//   - 3x larger template pools per type
//   - Zero use of "address" (translates badly to ES/PT via DeepL)
//   - Anti-repetition: tracks used templates within a session
//   - More varied sentence structures (not always "A [adj] [type] in [city]")
//   - Tips use available data (cuisines, subcategory, city context)
//   - Avoids editorial clichés: "unhurried", "rewards", "considered"
//
// Usage:
//   npx tsx api/src/scripts/generate-editorial-notes.ts
//   npx tsx api/src/scripts/generate-editorial-notes.ts --dry-run
//   npx tsx api/src/scripts/generate-editorial-notes.ts --city=porto
//   npx tsx api/src/scripts/generate-editorial-notes.ts --limit=5
//   npx tsx api/src/scripts/generate-editorial-notes.ts --force   # regenerate ALL, even existing

import { db } from '../db/postgres'
import { assertLegacyEnAllowed } from './_guards/legacy-en-guard'

// This script generates goldenbook_note + insider_tip directly into the
// `place_translations.locale = 'en'` row. Portuguese is now the canonical
// editorial locale (see modules/admin/places/translation-policy.ts) so
// rerunning this without porting it to PT-first would silently bring back
// the old EN-canonical pattern. Refuse to run unless `--allow-legacy-en`
// is passed.
assertLegacyEnAllowed('generate-editorial-notes')

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const FORCE = args.includes('--force')
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

// ─── Anti-repetition ──────────────────────────────────────────────────────
// Tracks which templates have been used recently. Prefers unused templates.

const usedNotes = new Set<string>()
const usedTips = new Set<string>()

function pickFresh<T extends string>(arr: T[], usedSet: Set<string>): T {
  // First pass: prefer unused templates
  const unused = arr.filter(t => !usedSet.has(t))
  const pool = unused.length > 0 ? unused : arr
  const choice = pool[Math.floor(Math.random() * pool.length)]
  usedSet.add(choice)
  // Reset tracking when most templates have been used (prevents starvation)
  if (usedSet.size > 200) usedSet.clear()
  return choice
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
// RULES:
// - Never use "address" (translates to "dirección" in ES)
// - Vary sentence openings — avoid "A [adj] [type] in [city]" pattern
// - No clichés: "unhurried", "rewards curiosity", "considered details"
// - Each note should feel specific, not applicable to any place in the world
// - Tone: editorial observation, not promotional copy

function generateNote(p: PlaceData): string | null {
  const tags = p.context_tags_auto ?? []
  const moments = p.moment_tags_auto ?? []
  const cuisines = p.cuisine_types ?? []
  const city = cityContext(p.city_slug)
  const addr = (p.address_line ?? '').toLowerCase()

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

  // Opening: atmosphere/setting — 6 options per tier
  if (p.price_tier === 4) {
    parts.push(pickFresh([
      `One of ${city}'s more serious kitchens`,
      `The kind of restaurant ${city} needs more of`,
      `Fine dining in ${city}, without the performance`,
      `Elegance without excess — a restaurant that trusts its cooking`,
      `${city} at its most refined, with a kitchen to match`,
      `A restaurant that sets the standard quietly`,
    ], usedNotes))
  } else if (p.price_tier === 3) {
    parts.push(pickFresh([
      `A restaurant in ${city} with more depth than the menu suggests`,
      `Serious cooking in a setting that doesn't take itself too seriously`,
      `The kitchen here has a point of view — and commits to it`,
      `A restaurant that gets better the more attention you pay`,
      `Good food, clear intentions, no fuss`,
      `Where the cooking speaks louder than the décor`,
    ], usedNotes))
  } else if (p.price_tier === 2) {
    parts.push(pickFresh([
      `A neighbourhood restaurant with regulars for a reason`,
      `The menu doesn't change much — it doesn't need to`,
      `Honest cooking, fair prices, no pretension`,
      `The sort of restaurant where the waiter already knows the table's order`,
      `Straightforward and consistent — what a neighbourhood restaurant should be`,
      `A local table that earns its regulars`,
    ], usedNotes))
  } else {
    parts.push(pickFresh([
      `A local favourite that the guidebooks haven't caught up with`,
      `The prices are kind and the portions speak for themselves`,
      `No frills, no apologies — just good food done right`,
      `A restaurant with more character per square metre than most`,
      `Where the food matters more than the furniture — and it shows`,
      `${city} as the locals eat it`,
    ], usedNotes))
  }

  // Cuisine focus — more specific phrasing
  if (cuisines.length > 0) {
    const primary = cuisines[0]
    const cuisineMap: Record<string, string[]> = {
      portuguese: [
        'rooted in Portuguese cooking',
        'with a kitchen built on Portuguese tradition',
        'where Portuguese flavours lead',
      ],
      seafood: [
        'with seafood that arrives before most restaurants open',
        'where the fish tells you what\'s on the menu',
        'built around whatever the sea brings in',
      ],
      italian: [
        'with Italian technique at its core',
        'where the pasta is made with the right kind of stubbornness',
      ],
      japanese: [
        'with the precision of a Japanese kitchen',
        'where the knife work alone is worth the visit',
      ],
      french: [
        'shaped by French culinary sensibility',
        'with French technique behind every plate',
      ],
      mediterranean: [
        'with a Mediterranean ease to the cooking',
        'where the olive oil and the light do most of the work',
      ],
      'fine-dining': [
        'where each course arrives with intention',
        'a menu that reads like a statement',
      ],
    }
    const options = cuisineMap[primary]
    if (options) parts.push(pickFresh(options, usedNotes))
  }

  // Setting detail — more varied
  if (has(tags, 'terrace') || addr.includes('praia') || addr.includes('mar')) {
    parts.push(pickFresh([
      'with an outdoor setting that earns its place on the bill',
      'and a terrace worth booking ahead for',
      'where the view doesn\'t have to compensate for the food',
    ], usedNotes))
  } else if (has(tags, 'viewpoint') || has(tags, 'rooftop')) {
    parts.push(pickFresh([
      'with a view that changes how the food tastes',
      'where what\'s outside the window is part of the experience',
    ], usedNotes))
  } else if (has(tags, 'romantic')) {
    parts.push(pickFresh([
      'with the kind of lighting that makes everyone look better',
      'best after dark, when the room finds its rhythm',
    ], usedNotes))
  }

  return parts.join(', ') + '.'
}

// ── Café ────────────────────────────────────────────────────────────────

function noteCafe(p: PlaceData, tags: string[], city: string, addr: string): string {
  if (has(tags, 'brunch')) {
    return pickFresh([
      `Brunch done well: good coffee, no rush, and a kitchen that cares about the first meal of the day.`,
      `The kind of morning table that makes you cancel your afternoon plans.`,
      `A brunch spot in ${city} where the coffee is strong and the eggs are taken seriously.`,
      `Late mornings work best here — arrive hungry, leave slowly.`,
      `Where brunch feels like a decision, not a default.`,
      `${city}'s answer to the slow morning — and it's convincing.`,
    ], usedNotes)
  }
  if (has(tags, 'specialty-coffee')) {
    return pickFresh([
      `Single-origin, properly extracted, served without pretension.`,
      `A café that knows the difference between good coffee and performance.`,
      `The beans rotate, the quality doesn't.`,
    ], usedNotes)
  }
  return pickFresh([
    `A café in ${city} that understands the value of a good seat and a better cup.`,
    `The sort of place where a quick coffee turns into an hour you don't regret.`,
    `Mornings here have their own pace — the coffee sets it.`,
    `A neighbourhood café with just enough personality to stand out.`,
    `Not the loudest café on the street, but the one people come back to.`,
    `Simple, warm, and honest — what a café should be before it tries to be anything else.`,
    `A café that earns loyalty one cup at a time.`,
    `The pastries arrive early, the regulars arrive on time.`,
    `Good light, good coffee, and the rare ability to leave you alone when you need it.`,
  ], usedNotes)
}

// ── Bar ─────────────────────────────────────────────────────────────────

function noteBar(p: PlaceData, tags: string[], city: string, addr: string): string {
  if (has(tags, 'wine')) {
    return pickFresh([
      `A wine bar where the glass pours tell you more about the region than any guide.`,
      `The list is short and sharp. Every bottle is here for a reason.`,
      `Wine bar in ${city} with a palate behind the selection — not just a catalogue.`,
      `A place that takes wine seriously enough to keep it fun.`,
      `Quiet, focused, and stocked with bottles you won't find at the shop downstairs.`,
      `The sommelier's picks here are more interesting than most restaurants' full lists.`,
    ], usedNotes)
  }
  if (has(tags, 'cocktails')) {
    return pickFresh([
      `A cocktail bar in ${city} where the menu is concise and every drink is deliberate.`,
      `Short menu, strong convictions, well-made drinks.`,
      `The bartenders here mix with precision — no wasted movements, no wasted ingredients.`,
      `A bar that proves you only need six cocktails if they're the right six.`,
      `Low light, clean lines, and drinks that arrive exactly as intended.`,
      `The kind of bar where ordering off-menu is a compliment, not a risk.`,
    ], usedNotes)
  }
  return pickFresh([
    `A bar in ${city} that improves with the hour.`,
    `Good drinks, good company, and the sense not to overplay its hand.`,
    `The mood shifts after 10 — earlier for conversation, later for energy.`,
    `A spot that doesn't try too hard and gets it right anyway.`,
    `${city} after dark, done well.`,
    `Unpretentious, well-poured, and open late enough to matter.`,
  ], usedNotes)
}

// ── Hotel ───────────────────────────────────────────────────────────────

function noteHotel(p: PlaceData, tags: string[], city: string, addr: string): string {
  if (p.price_tier && p.price_tier >= 3) {
    return pickFresh([
      `A hotel in ${city} where the service remembers you before you remember to ask.`,
      `The rooms are well-judged, the staff are better.`,
      `Comfort that doesn't need to announce itself.`,
      `A property that treats hospitality as a discipline, not a slogan.`,
      `Quiet luxury in ${city} — no gold leaf, just gold-standard service.`,
      `The kind of hotel where checking in already feels like arriving somewhere.`,
    ], usedNotes)
  }
  if (has(tags, 'wellness')) {
    return pickFresh([
      `A hotel where the spa isn't an afterthought — it's the reason to stay.`,
      `Built around rest, not just sleep. The wellness programme is genuine.`,
      `A property in ${city} that takes recovery as seriously as the room rate.`,
    ], usedNotes)
  }
  if (has(tags, 'boutique')) {
    return pickFresh([
      `Boutique in the truest sense — small, personal, and impossible to standardise.`,
      `The personality of the owner is in every room. That's a compliment.`,
      `A small hotel with the confidence of a much larger one.`,
    ], usedNotes)
  }
  return pickFresh([
    `A dependable hotel in ${city} that gets the fundamentals right.`,
    `Clean rooms, good beds, and a location that earns the booking.`,
    `A hotel that delivers exactly what it promises — and that's enough.`,
    `Practical, well-maintained, and honest about what it is.`,
    `No surprises, no disappointments — the way a good hotel works.`,
    `A base in ${city} worth coming back to.`,
  ], usedNotes)
}

// ── Shop ────────────────────────────────────────────────────────────────

function noteShop(p: PlaceData, tags: string[], city: string, addr: string): string {
  const sub = p.classification_subcategory
  if (sub === 'joalharia' || sub === 'relojoaria') {
    return pickFresh([
      `A jeweller in ${city} where the selection is smaller than expected — and better for it.`,
      `Fewer pieces, more conviction. A jeweller that edits instead of accumulating.`,
      `A shop where the craft behind each piece matters more than the price tag.`,
      `The kind of jeweller where the staff know the origin of every stone in the room.`,
      `Jewellery here is presented with context, not just display lighting.`,
      `Not the biggest window on the street, but the most interesting one.`,
    ], usedNotes)
  }
  if (sub === 'moda') {
    return pickFresh([
      `Fashion with a point of view — not everything, but the right things.`,
      `A shop in ${city} where the edit is the product.`,
      `The curation here feels personal, not algorithmic.`,
      `A boutique that buys like a private collection, not a department store.`,
      `Every rack here tells you someone made a decision — and stood by it.`,
      `Less stock, more taste. A fashion shop that knows what to leave out.`,
    ], usedNotes)
  }
  if (sub === 'perfumaria') {
    return pickFresh([
      `A perfumery where fragrance is treated as an art form, not a commodity.`,
      `The kind of shop where the conversation matters as much as the catalogue.`,
      `Independent houses, rare compositions, and staff who know the difference.`,
    ], usedNotes)
  }
  if (has(tags, 'local-secret')) {
    return pickFresh([
      `The kind of shop you're glad someone told you about.`,
      `A find in ${city} — not on the main drag, not on most people's radar.`,
      `Local knowledge, genuine stock, and the charm of a shop that doesn't need foot traffic.`,
      `A discovery that doesn't show up on the first page of search results.`,
    ], usedNotes)
  }
  return pickFresh([
    `A shop in ${city} where everything on the shelf was chosen, not just stocked.`,
    `What's missing from the shelves matters as much as what's on them.`,
    `A shop with taste — quiet, specific, and hard to replicate online.`,
    `The inventory here feels chosen by someone who actually uses these things.`,
    `A retail space that still believes in discovery over convenience.`,
    `${city} has hundreds of shops. This is one of the few where the selection tells a story.`,
  ], usedNotes)
}

// ── Museum ──────────────────────────────────────────────────────────────

function noteMuseum(p: PlaceData, tags: string[], city: string): string {
  if (has(tags, 'contemporary')) {
    return pickFresh([
      `A museum in ${city} that shows the kind of work other institutions are still debating.`,
      `Contemporary art here isn't wallpaper — the programme has teeth.`,
      `The exhibitions here are the ones people argue about at dinner. That's the point.`,
    ], usedNotes)
  }
  return pickFresh([
    `A museum that deepens your understanding of the region — not just decorates it.`,
    `The collection here tells a story the city rarely tells about itself.`,
    `A cultural space in ${city} that earns the time it asks for.`,
    `Better than the brochure suggests. The curation is what sets it apart.`,
    `A museum with substance — the kind of place where two hours disappear easily.`,
    `Not the biggest collection in ${city}, but the most coherent.`,
    `The permanent collection alone justifies the visit. The temporary exhibitions are a bonus.`,
    `A museum that respects your attention and gives you something to think about on the way out.`,
    `Serious curation in a city that takes its cultural institutions seriously.`,
  ], usedNotes)
}

// ── Landmark ────────────────────────────────────────────────────────────

function noteLandmark(p: PlaceData, tags: string[], city: string): string {
  if (has(tags, 'viewpoint')) {
    return pickFresh([
      `The view from here puts the rest of ${city} in context.`,
      `Come for the light, stay for the perspective — both literal and otherwise.`,
      `A vantage point that explains why the city grew the way it did.`,
      `The kind of view that makes you stop talking and just look.`,
    ], usedNotes)
  }
  return pickFresh([
    `It's been here longer than most of the city. There's a reason.`,
    `A landmark that anchors the neighbourhood — and gives it its character.`,
    `Part of ${city}'s fabric in a way that no new building can replicate.`,
    `A place with presence — the kind you notice even when you're not looking for it.`,
    `History here isn't on a plaque. It's in the walls.`,
    `A point of reference in ${city} — geographically and culturally.`,
    `The kind of landmark that locals still stop to look at.`,
  ], usedNotes)
}

// ── Beach ───────────────────────────────────────────────────────────────

function noteBeach(p: PlaceData, tags: string[], city: string): string {
  if (has(tags, 'sunset')) {
    return pickFresh([
      `The afternoon light here does most of the work.`,
      `Best approached late in the day, when the crowds thin and the sky opens up.`,
      `A beach where the sunset isn't an afterthought — it's the main event.`,
      `Come after 4, stay until dark. The light alone is worth it.`,
    ], usedNotes)
  }
  if (has(tags, 'surf')) {
    return pickFresh([
      `Consistent breaks and enough space to share the lineup without resentment.`,
      `A surf beach with the right mix of challenge and accessibility.`,
    ], usedNotes)
  }
  return pickFresh([
    `A stretch of coast in ${city} with the right balance of space, water, and quiet.`,
    `The kind of beach that locals keep returning to — no Instagram account, no marketing.`,
    `A beach that earns repeat visits through simplicity, not facilities.`,
    `Sand, water, and enough space to not feel managed. That's the appeal.`,
    `Not the most famous beach in the region, but the one people actually go back to.`,
    `A beach where the water is clean, the sand is wide, and nobody is selling you anything.`,
  ], usedNotes)
}

// ── Activity ────────────────────────────────────────────────────────────

function noteActivity(p: PlaceData, tags: string[], moments: string[], city: string, addr: string): string {
  if (has(tags, 'wellness')) {
    return pickFresh([
      `A wellness experience that goes deeper than the surface-level spa menu.`,
      `A space where the pace slows deliberately and the treatment has genuine expertise behind it.`,
      `The kind of wellness programme that doesn't need to sell you candles on the way out.`,
    ], usedNotes)
  }
  if (has(tags, 'wine') || addr.includes('adega') || addr.includes('wine')) {
    return pickFresh([
      `A wine experience that goes beyond tasting — a window into the region's terroir.`,
      `Here, wine is context, not content. The visit lingers long after the glass is empty.`,
      `The kind of visit that changes how you drink wine from this region.`,
      `More than a tasting — an education disguised as an afternoon.`,
    ], usedNotes)
  }
  return pickFresh([
    `An experience in ${city} worth carving out real time for — not a filler activity.`,
    `Well-organised, genuinely engaging, and better than the tourist-track alternative.`,
    `The sort of activity that gives you a story, not just a photo.`,
    `A programme built around depth, not volume.`,
    `An experience that earns its time slot — you'll remember this one.`,
  ], usedNotes)
}

// ── Generic fallback ────────────────────────────────────────────────────

function noteGeneric(p: PlaceData, tags: string[], city: string): string {
  return pickFresh([
    `Not where the crowds go. That's precisely the point.`,
    `A place in ${city} with a clear sense of what it is — and what it isn't.`,
    `The kind of find in ${city} that makes you trust the person who recommended it.`,
    `Worth knowing about, even if it's hard to categorise.`,
    `A place that doesn't need a category to make an impression.`,
    `${city} has a way of hiding its best places in plain sight. This is one of them.`,
  ], usedNotes)
}

// ─── Insider tip templates ────────────────────────────────────────────────
// RULES:
// - Must be SPECIFIC and ACTIONABLE — something a local would actually say
// - Never generic advice that applies to any place (e.g. "reserve ahead", "arrive early")
// - Reference concrete details: table numbers, specific dishes, time windows, staff roles
// - Each tip should make the reader feel like they know something others don't

function generateTip(p: PlaceData): string | null {
  const tags = p.context_tags_auto ?? []
  const moments = p.moment_tags_auto ?? []
  const type = p.place_type

  if (tags.length === 0 && moments.length === 0) return null

  switch (type) {
    case 'restaurant': return tipRestaurant(tags, moments, p)
    case 'cafe':       return tipCafe(tags, moments, p)
    case 'bar':        return tipBar(tags, moments, p)
    case 'hotel':      return tipHotel(tags, p)
    case 'shop':       return tipShop(tags, p)
    case 'museum':     return tipMuseum(tags, moments, p)
    case 'landmark':   return tipLandmark(tags, moments, p)
    case 'beach':      return tipBeach(tags, moments, p)
    case 'activity':   return tipActivity(tags, moments, p)
    default:           return tipGeneric(tags, p)
  }
}

function tipRestaurant(tags: string[], moments: string[], p: PlaceData): string {
  const cuisines = p.cuisine_types ?? []
  const city = cityContext(p.city_slug)

  if (has(tags, 'terrace') && has(tags, 'sunset')) {
    return pickFresh([
      'The terrace tables facing west fill first for a reason — book for the last seating.',
      'Sunset from the terrace is the unofficial second course. Time your reservation around it.',
      'The outdoor tables after 7pm have a different atmosphere entirely. Ask to sit outside.',
    ], usedTips)
  }
  if (has(tags, 'terrace')) {
    return pickFresh([
      'The terrace only has six tables — call ahead, or the indoor room won\'t disappoint either.',
      'Lunch on the terrace midweek is a different restaurant. Quieter, slower, better.',
      'Skip the indoor seats in good weather. The terrace changes the whole experience.',
      'The best tables are outside, but the service is sharper indoors. Choose your priority.',
    ], usedTips)
  }
  if (has(tags, 'wine') && cuisines.includes('portuguese')) {
    return pickFresh([
      'The Portuguese reds on the second page of the wine list outsell the imports — there\'s a reason.',
      'Ask the staff which bottles are from small producers. The list has gems that don\'t advertise themselves.',
      'The house wine is surprisingly good — but ask about the regional reserve pours for a small upgrade.',
    ], usedTips)
  }
  if (has(tags, 'wine')) {
    return pickFresh([
      'The wine list is deeper than the menu suggests. Ask what\'s open by the glass today.',
      'Tell the staff what you\'re eating and let them pick the wine. They\'re better at it than the list suggests.',
      'The by-the-glass selection rotates — what\'s on today might not be tomorrow.',
    ], usedTips)
  }
  if (cuisines.includes('seafood')) {
    return pickFresh([
      'The fish changes daily — ask what came in this morning before ordering from the menu.',
      'The grilled fish is the play here. Keep it simple and let the ingredients do the work.',
      'Midweek lunch gets the pick of the morning catch. Weekends are busier and the choice narrows.',
      'Ask if the cataplana is available — it\'s not always on the menu but they\'ll make it.',
    ], usedTips)
  }
  if (cuisines.includes('portuguese')) {
    return pickFresh([
      'The daily specials are often better than the printed menu — ask what the kitchen is cooking today.',
      'The bacalhau preparation changes with the chef\'s mood. Worth asking which version is on.',
      'Lunch service is where this kitchen shines. Dinner is good, but lunch is the insider move.',
    ], usedTips)
  }
  if (has(moments, 'romantic-dinner')) {
    return pickFresh([
      'The corner tables offer the most privacy — mention it when you book.',
      'A later reservation — after 9 — gets you a quieter room and more attentive service.',
      'Ask for the table by the window. It\'s the one the staff would pick for their own anniversary.',
    ], usedTips)
  }
  if (has(moments, 'business-lunch')) {
    return pickFresh([
      'The lunch menu offers the same kitchen at a friendlier price. Smart move for business.',
      'Midweek lunch is calmer and the service is faster — ideal if you\'re on a schedule.',
    ], usedTips)
  }
  if (has(tags, 'family')) {
    return pickFresh([
      'The kitchen adjusts portions for younger guests if you ask — they don\'t advertise it.',
      'Weekday lunch is calmer for families. The weekend crowd is different.',
      'There\'s a quieter section in the back that works well with children — ask the host.',
    ], usedTips)
  }
  if (p.price_tier && p.price_tier >= 3) {
    return pickFresh([
      'The tasting menu is the kitchen\'s real statement. À la carte is good, but the menu tells the full story.',
      'Don\'t skip the bread course — the kitchen takes it as seriously as everything else.',
      'Ask the server what the chef is most proud of today. The answer changes — and it\'s always honest.',
    ], usedTips)
  }
  return pickFresh([
    'The daily suggestions are often the strongest thing on the menu — ask before you order.',
    'Sit at the bar if there\'s a wait. The service is faster and the kitchen is closer.',
    'The first seating gets a sharper kitchen. Later in the night, the pace changes.',
    'Ask what\'s fresh today rather than ordering from the menu. The answer usually leads somewhere better.',
    'The desserts are made in-house — worth leaving room for.',
    'Lunch is the locals\' secret here. Same food, half the wait.',
  ], usedTips)
}

function tipCafe(tags: string[], moments: string[], p: PlaceData): string {
  const city = cityContext(p.city_slug)

  if (has(moments, 'breakfast') || has(tags, 'brunch')) {
    return pickFresh([
      'The pastries are baked fresh — ask what just came out. The morning batch is warmest around 9.',
      'Come before the brunch crowd arrives. By 11, the best seats and the best pastries are gone.',
      'The savoury options are stronger than the sweet ones. Try the eggs before the pancakes.',
      'Weekday mornings have a different energy — quieter, faster service, and usually a better table.',
      'Ask if they have the seasonal special — it rotates monthly and isn\'t always on the board.',
    ], usedTips)
  }
  if (has(tags, 'specialty-coffee')) {
    return pickFresh([
      'Ask about the current single-origin — the rotation changes weekly and the barista knows the story behind each one.',
      'If you like your coffee with milk, try the flat white. The beans are chosen with milk drinks in mind.',
    ], usedTips)
  }
  return pickFresh([
    'The window seats fill first. Come early or come midweek.',
    'Mid-morning on a weekday is the sweet spot — full counter, empty room.',
    'The pastel de nata here is baked in-house. Not all of them are.',
    'If the courtyard is open, skip the main room. Different atmosphere entirely.',
    'Ask for the daily pastry — it\'s not always on the board but it\'s always good.',
    'The afternoon espresso crowd is smaller and the staff have more time. After 3 is a different café.',
  ], usedTips)
}

function tipBar(tags: string[], moments: string[], p: PlaceData): string {
  if (has(tags, 'cocktails')) {
    return pickFresh([
      'Ask the bartender for something off-menu. The best drinks here aren\'t on the list.',
      'The first hour after opening is when the bartender has the most time for conversation — and experimentation.',
      'The signature cocktails are good, but the seasonal specials are where the creativity lives.',
      'Sit at the bar, not at a table. The experience is different and the drinks arrive faster.',
      'Tell the bartender what flavours you like and let them improvise. That\'s when this place shines.',
    ], usedTips)
  }
  if (has(tags, 'wine')) {
    return pickFresh([
      'The glass pours rotate frequently — what\'s on today might not be tomorrow. Ask what just opened.',
      'The by-the-glass list is more adventurous than the bottle list. Start there.',
      'Ask for the producer\'s story behind your glass. The staff here know their wines beyond the label.',
      'The natural wine selection is tucked away on the last page. Worth finding.',
    ], usedTips)
  }
  return pickFresh([
    'The atmosphere shifts around 10pm — earlier is more conversational, later has more energy.',
    'Go early if you want a seat and the bartender\'s attention. Go late if you want the crowd.',
    'The back room is quieter and usually has space when the front bar is packed.',
    'Thursday nights tend to have the best crowd. Weekends are busier but more transient.',
    'The snack menu is better than it needs to be. Don\'t skip it.',
    'Happy hour isn\'t listed but exists. Ask what\'s on special before 8.',
  ], usedTips)
}

function tipHotel(tags: string[], p: PlaceData): string {
  if (has(tags, 'wellness')) {
    return pickFresh([
      'The morning spa slots are the calmest — by afternoon the pool area fills up.',
      'The spa is open to non-guests too. Worth a visit even if you\'re not staying.',
      'Book the treatment room with the view — it\'s the same price but a different experience.',
      'Ask about the local-ingredient treatments. They\'re usually the most considered option on the menu.',
    ], usedTips)
  }
  if (p.price_tier && p.price_tier >= 3) {
    return pickFresh([
      'Request a room on the upper floors when booking — the view upgrade is usually available.',
      'The breakfast buffet is good, but the à la carte eggs are better. Ask.',
      'The concierge here knows the city properly. Ask for restaurant recommendations — they\'re better than any app.',
      'Late checkout is often available midweek. Ask at reception, not at booking.',
    ], usedTips)
  }
  return pickFresh([
    'Ask for a quiet room away from the street. The difference in sleep quality is noticeable.',
    'The breakfast spread is worth waking up for — but get there in the first 30 minutes for the full selection.',
    'If you need a late checkout, ask at reception the night before. It\'s easier to arrange than you\'d think.',
    'The front desk usually has local recommendations that aren\'t on any website. Ask.',
  ], usedTips)
}

function tipShop(tags: string[], p: PlaceData): string {
  const sub = p.classification_subcategory

  if (sub === 'joalharia' || sub === 'relojoaria') {
    return pickFresh([
      'Ask to see what\'s not in the display cases. The back stock is often where the best pieces are.',
      'The staff know the story behind every piece — a conversation here is more useful than browsing alone.',
      'Ask about bespoke or custom work. The workshop capacity isn\'t advertised but it exists.',
      'Seasonal collections arrive quietly — ask what\'s just come in. The first look has the full range.',
    ], usedTips)
  }
  if (sub === 'moda') {
    return pickFresh([
      'New season arrivals land before the websites update. If you see something, don\'t assume it\'ll be there next week.',
      'The personal styling service isn\'t always advertised. Ask — it changes the experience.',
      'The sale section in the back is better curated than most shops\' full-price selection.',
      'The staff dress from the stock. Ask what they\'re wearing — it\'s usually the best recommendation.',
    ], usedTips)
  }
  if (sub === 'perfumaria') {
    return pickFresh([
      'Don\'t rush the first visit. Spend forty-five minutes. Tell the staff what you feel, not what you\'re looking for.',
      'Ask about the houses that are exclusive to this shop — some labels only exist at this counter in the country.',
      'Book a private consultation if it\'s your first niche fragrance. The guided experience is worth it.',
    ], usedTips)
  }
  if (has(tags, 'local-secret')) {
    return pickFresh([
      'The staff know their stock deeply. Ask — they\'ll point you to things you wouldn\'t find on your own.',
      'Visit on a weekday morning when there\'s time for a real conversation about the stock.',
      'Ask what just arrived. The new pieces are often not yet on display.',
    ], usedTips)
  }
  return pickFresh([
    'The pieces that don\'t sell online are usually the most interesting ones in-store.',
    'Weekday mornings are the best time to browse. The staff have time and the shop has space.',
    'Ask about items that aren\'t on display — there\'s usually a back catalogue worth exploring.',
    'The selection rotates more than you\'d think. What\'s here today might be gone next week.',
    'If something catches your eye, ask about the maker. The backstory is usually part of the value.',
  ], usedTips)
}

function tipMuseum(tags: string[], moments: string[], p: PlaceData): string {
  if (has(moments, 'morning-visit')) {
    return pickFresh([
      'The first hour after opening is a different museum. Empty galleries, natural light, no queues.',
      'Morning visits get the best light in the main galleries — by afternoon the angle changes.',
      'Tour groups arrive around 11. Before that, you have the collection to yourself.',
    ], usedTips)
  }
  return pickFresh([
    'Check the temporary exhibition before you go — it often outshines the permanent collection.',
    'Allow more time than you think. Two hours is a minimum if you want to do it justice.',
    'The gift shop is better than average — check it before you leave.',
    'Ask at the desk about guided tours. The docent-led version surfaces details the audio guide misses.',
    'The café inside is surprisingly good and usually empty around 3pm.',
    'The top floor is the one most visitors skip — it\'s often the strongest part of the collection.',
    'Rainy days fill the museum fast. Clear mornings are your best window.',
  ], usedTips)
}

function tipLandmark(tags: string[], moments: string[], p: PlaceData): string {
  if (has(tags, 'viewpoint') || has(moments, 'sunset')) {
    return pickFresh([
      'Late afternoon light is the most flattering from here. Arrive by 5 in summer.',
      'Arrive thirty minutes before sunset for the best position — and stay ten minutes after.',
      'The west-facing side has the view everyone photographs. The east side has the one worth keeping.',
      'Morning is quieter, but the golden hour light transforms this place. Come twice if you can.',
    ], usedTips)
  }
  return pickFresh([
    'The longer approach from the south is more scenic. Take it if you have the time.',
    'Most visitors spend ten minutes here. Thirty is better — the details surface slowly.',
    'The history plaque tells one version. Ask a local for the other.',
    'Avoid the midday rush. Early morning or late afternoon — different place entirely.',
    'Bring a camera with a good lens. The details at the top are invisible from the ground.',
  ], usedTips)
}

function tipBeach(tags: string[], moments: string[], p: PlaceData): string {
  if (has(tags, 'sunset') || has(moments, 'sunset')) {
    return pickFresh([
      'Stay for sunset — the beach empties and the sky puts on a show.',
      'Late afternoon is the best window: calmer winds, warmer light, fewer people.',
      'The sunset here is worth planning your day around. Arrive by 6.',
      'Bring a blanket, stay past the swimsuit crowd. The evening is the reward.',
    ], usedTips)
  }
  if (has(tags, 'surf')) {
    return pickFresh([
      'Early morning sessions get the cleanest waves. By noon the wind picks up.',
      'The left break at the south end is more consistent and less crowded.',
    ], usedTips)
  }
  return pickFresh([
    'Arrive before midday for the best spots. By 1pm the good positions are taken.',
    'The water is calmest in the morning. Afternoon brings wind and chop.',
    'Bring your own shade — the rental umbrellas go fast and cost more than they should.',
    'The beach bar at the south end has better food than the one at the entrance.',
    'Low tide exposes rock pools on the left side — worth the short walk.',
    'The locals park on the side road, not the main lot. Saves time getting out.',
  ], usedTips)
}

function tipActivity(tags: string[], moments: string[], p: PlaceData): string {
  if (has(tags, 'wine')) {
    return pickFresh([
      'Ask about the reserve tasting — it\'s not always listed but it\'s the version worth doing.',
      'The guided visit adds context that makes every glass afterwards taste different.',
      'Book the smaller group if there\'s an option. The winemaker talks more.',
      'Ask which vintage the winemaker is proudest of. The answer is rarely the most expensive.',
    ], usedTips)
  }
  if (has(tags, 'wellness')) {
    return pickFresh([
      'Morning slots are calmer — the afternoon schedule fills with walk-ins.',
      'Ask about the treatment inspired by local ingredients. It\'s usually the most original option.',
      'Book two treatments back-to-back. The second one hits different when you\'re already relaxed.',
    ], usedTips)
  }
  return pickFresh([
    'Book ahead — the schedule fills quickly and the small-group sessions are the best.',
    'Ask the team about options that aren\'t on the website. The standard programme is only the beginning.',
    'The private version costs more but delivers a fundamentally different experience.',
    'Morning sessions tend to be smaller. Afternoon gets the tour-bus crowd.',
    'Ask questions during the visit — the guides here actually know their subject.',
  ], usedTips)
}

function tipGeneric(tags: string[], p: PlaceData): string {
  return pickFresh([
    'Off-peak hours change the experience completely. Ask locally when the quiet window is.',
    'The details here surface slowly — give it more time than your first instinct suggests.',
    'Ask the staff what most visitors miss. They usually know.',
    'A weekday visit and a weekend visit are almost two different places.',
  ], usedTips)
}

// ─── Main pipeline ────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  Editorial Notes Generator v2')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${FORCE ? ' (FORCE — regenerating all)' : ''}`)
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
  `

  // In FORCE mode, regenerate everything; otherwise only fill gaps
  if (!FORCE) {
    query += `
      AND (pt_en.goldenbook_note IS NULL OR pt_en.goldenbook_note = ''
           OR pt_en.insider_tip IS NULL OR pt_en.insider_tip = '')
    `
  }

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
  console.log(`Found ${rows.length} places ${FORCE ? 'for regeneration' : 'needing editorial notes'}\n`)

  let processed = 0
  let notesGenerated = 0
  let tipsGenerated = 0
  let skipped = 0

  for (const place of rows) {
    processed++

    const skipNote = !FORCE && place.has_note
    const skipTip = !FORCE && place.has_tip
    const note = skipNote ? null : generateNote(place)
    const tip = skipTip ? null : generateTip(place)

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
      if (FORCE && note && tip) {
        // In force mode, overwrite existing content
        await db.query(`
          INSERT INTO place_translations (place_id, locale, name, goldenbook_note, insider_tip)
          VALUES ($1, 'en', $2, $3, $4)
          ON CONFLICT (place_id, locale) DO UPDATE SET
            goldenbook_note = EXCLUDED.goldenbook_note,
            insider_tip = EXCLUDED.insider_tip,
            updated_at = now()
        `, [place.id, place.name, note, tip])
      } else if (note && tip) {
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
            goldenbook_note = ${FORCE ? 'EXCLUDED.goldenbook_note' : "COALESCE(NULLIF(place_translations.goldenbook_note, ''), EXCLUDED.goldenbook_note)"},
            updated_at = now()
        `, [place.id, place.name, note])
      } else if (tip) {
        await db.query(`
          INSERT INTO place_translations (place_id, locale, name, insider_tip)
          VALUES ($1, 'en', $2, $3)
          ON CONFLICT (place_id, locale) DO UPDATE SET
            insider_tip = ${FORCE ? 'EXCLUDED.insider_tip' : "COALESCE(NULLIF(place_translations.insider_tip, ''), EXCLUDED.insider_tip)"},
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
    version: 2,
    mode: DRY_RUN ? 'dry-run' : (FORCE ? 'force' : 'live'),
    processed, notesGenerated, tipsGenerated, skipped,
  }, null, 2))
  console.log('Report: editorial-notes-report.json\n')

  await db.end()
}

main().catch(e => { console.error(e); process.exit(1) })
