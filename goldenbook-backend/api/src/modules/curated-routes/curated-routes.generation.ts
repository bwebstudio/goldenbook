import { db } from '../../db/postgres'

// ─── Types ───────────────────────────────────────────────────────────────────

export type TemplateType = 'morning' | 'lunch' | 'evening' | 'sunset'

interface PlaceCandidate {
  id: string
  slug: string
  name: string
  place_type: string
  latitude: number
  longitude: number
  google_rating: number | null
  short_description: string | null
  goldenbook_note: string | null
  context_tags_auto: string[] | null
}

export interface GeneratedRoute {
  citySlug: string
  routeType: 'editorial' | 'sponsored'
  templateType: string
  sponsorPlaceId: string | null
  title: string
  summary: string
  stops: Array<{
    placeId: string
    stopOrder: number
    editorialNote: string
  }>
}

// ─── Experience patterns ────────────────────────────────────────────────────
// Each pattern defines 3 ROLES (not rigid types) with preferred + acceptable types.
// The engine picks the best available place for each role, never repeating a type.

interface SlotRole {
  label: string            // what this stop represents in the experience
  preferred: string[]      // ideal place_types for this role
  acceptable: string[]     // fallback types if preferred unavailable
}

interface ExperiencePattern {
  templateType: TemplateType
  startHour: number
  endHour: number
  roles: [SlotRole, SlotRole, SlotRole]
}

const PATTERNS: ExperiencePattern[] = [
  {
    templateType: 'morning',
    startHour: 9,
    endHour: 13,
    roles: [
      { label: 'start', preferred: ['cafe', 'restaurant'], acceptable: ['shop', 'hotel'] },
      { label: 'explore', preferred: ['museum', 'landmark', 'activity'], acceptable: ['shop'] },
      { label: 'eat', preferred: ['restaurant'], acceptable: ['cafe'] },
    ],
  },
  {
    templateType: 'lunch',
    startHour: 11,
    endHour: 15,
    roles: [
      { label: 'browse', preferred: ['shop', 'museum', 'landmark'], acceptable: ['activity'] },
      { label: 'eat', preferred: ['restaurant'], acceptable: ['cafe'] },
      { label: 'linger', preferred: ['cafe', 'shop'], acceptable: ['landmark', 'activity'] },
    ],
  },
  {
    templateType: 'evening',
    startHour: 17,
    endHour: 23,
    roles: [
      { label: 'scenery', preferred: ['landmark', 'activity', 'museum'], acceptable: ['hotel'] },
      { label: 'dinner', preferred: ['restaurant'], acceptable: ['cafe'] },
      { label: 'drinks', preferred: ['bar'], acceptable: ['restaurant', 'hotel'] },
    ],
  },
  {
    templateType: 'sunset',
    startHour: 18,
    endHour: 23,
    roles: [
      { label: 'view', preferred: ['landmark', 'beach', 'activity'], acceptable: ['hotel'] },
      { label: 'dinner', preferred: ['restaurant'], acceptable: ['cafe'] },
      { label: 'nightcap', preferred: ['bar'], acceptable: ['restaurant'] },
    ],
  },
]

// ─── Haversine ───────────────────────────────────────────────────────────────

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function formatTime(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00:00`
}

// ─── Candidate query ────────────────────────────────────────────────────────

async function queryCandidates(
  citySlug: string,
  placeTypes: string[],
  startHour: number,
  endHour: number,
  excludePlaceIds: string[],
): Promise<PlaceCandidate[]> {
  const dayOfWeek = new Date().getDay()
  const typeParams = placeTypes.map((_, i) => `$${i + 4}`)
  const excludeClause = excludePlaceIds.length > 0
    ? `AND p.id NOT IN (${excludePlaceIds.map((_, i) => `$${i + 4 + placeTypes.length}`).join(', ')})`
    : ''

  const params: (string | number)[] = [citySlug, startHour, endHour, ...placeTypes, ...excludePlaceIds]

  const { rows } = await db.query<PlaceCandidate>(`
    SELECT
      p.id, p.slug, p.name, p.place_type,
      p.latitude::float AS latitude, p.longitude::float AS longitude,
      p.google_rating::float AS google_rating,
      p.short_description,
      pt_en.goldenbook_note,
      p.context_tags_auto
    FROM places p
    JOIN destinations d ON d.id = p.destination_id AND d.slug = $1
    LEFT JOIN place_translations pt_en ON pt_en.place_id = p.id AND pt_en.locale = 'en'
    WHERE p.status = 'published'
      AND p.is_active = true
      AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
      AND p.place_type IN (${typeParams.join(', ')})
      ${excludeClause}
      AND NOT EXISTS (
        SELECT 1 FROM curated_route_stops crs
        JOIN curated_routes cr ON cr.id = crs.route_id
        WHERE crs.place_id = p.id AND cr.city_slug = $1 AND cr.is_active = true
      )
      AND (
        NOT EXISTS (
          SELECT 1 FROM opening_hours oh
          WHERE oh.place_id = p.id AND oh.day_of_week = ${dayOfWeek}
        )
        OR EXISTS (
          SELECT 1 FROM opening_hours oh
          WHERE oh.place_id = p.id AND oh.day_of_week = ${dayOfWeek}
            AND oh.is_closed = false
            AND oh.opens_at <= $2::time AND oh.closes_at >= $3::time
        )
      )
    ORDER BY
      (p.context_tags_auto IS NOT NULL)::int DESC,
      p.google_rating DESC NULLS LAST
    LIMIT 30
  `, [citySlug, formatTime(startHour), formatTime(endHour), ...placeTypes, ...excludePlaceIds])

  return rows
}

// ─── Place selection ────────────────────────────────────────────────────────

async function selectPlaces(
  citySlug: string,
  pattern: ExperiencePattern,
  seedPlaceId: string | null,
): Promise<PlaceCandidate[] | null> {
  const selected: PlaceCandidate[] = []
  const usedTypes = new Set<string>()
  const excludeIds: string[] = []

  for (let i = 0; i < pattern.roles.length; i++) {
    const role = pattern.roles[i]

    // Sponsored: seed place always goes to slot 1
    if (i === 0 && seedPlaceId) {
      const { rows } = await db.query<PlaceCandidate>(`
        SELECT p.id, p.slug, p.name, p.place_type,
          p.latitude::float AS latitude, p.longitude::float AS longitude,
          p.google_rating::float AS google_rating, p.short_description,
          pt_en.goldenbook_note, p.context_tags_auto
        FROM places p
        LEFT JOIN place_translations pt_en ON pt_en.place_id = p.id AND pt_en.locale = 'en'
        WHERE p.id = $1 LIMIT 1
      `, [seedPlaceId])
      if (rows.length === 0) return null
      selected.push(rows[0])
      usedTypes.add(rows[0].place_type)
      excludeIds.push(rows[0].id)
      continue
    }

    // Try preferred types first (excluding already-used types for diversity)
    const preferredAvail = role.preferred.filter(t => !usedTypes.has(t))
    const acceptableAvail = role.acceptable.filter(t => !usedTypes.has(t))
    const allAvail = [...preferredAvail, ...acceptableAvail]

    // Also try with used types as last resort (but only if no diverse option exists)
    const allTypes = [...role.preferred, ...role.acceptable]

    let pick: PlaceCandidate | null = null

    // Try diverse types first
    if (allAvail.length > 0) {
      const candidates = await queryCandidates(citySlug, allAvail, pattern.startHour, pattern.endHour, excludeIds)
      pick = pickBestCandidate(candidates, selected)
    }

    // If nothing diverse, allow repeated types
    if (!pick) {
      const candidates = await queryCandidates(citySlug, allTypes, pattern.startHour, pattern.endHour, excludeIds)
      pick = pickBestCandidate(candidates, selected)
    }

    if (!pick) return null // Can't fill this slot at all

    selected.push(pick)
    usedTypes.add(pick.place_type)
    excludeIds.push(pick.id)
  }

  return selected
}

/** Pick the best candidate: prefer close to previous stops, good rating */
function pickBestCandidate(candidates: PlaceCandidate[], previousStops: PlaceCandidate[]): PlaceCandidate | null {
  if (candidates.length === 0) return null
  if (previousStops.length === 0) return candidates[0] // highest rated

  const prev = previousStops[previousStops.length - 1]
  const scored = candidates.map(c => ({
    candidate: c,
    distance: haversineMeters(prev.latitude, prev.longitude, c.latitude, c.longitude),
  })).sort((a, b) => a.distance - b.distance)

  // Prefer within 5km (cities like Algarve are spread out)
  const nearby = scored.find(s => s.distance < 5000)
  return (nearby ?? scored[0]).candidate
}

// ─── Title & copy generation (adapts to actual places) ──────────────────────

const TYPE_LABELS: Record<string, string> = {
  restaurant: 'a good table',
  cafe: 'good coffee',
  bar: 'a well-made drink',
  shop: 'something local',
  museum: 'culture and calm',
  landmark: 'a sense of place',
  activity: 'something different',
  beach: 'the coast',
  hotel: 'a beautiful setting',
}

function generateTitle(templateType: TemplateType, places: PlaceCandidate[]): string {
  const banks: Record<TemplateType, string[]> = {
    morning: [
      'A Slow Start to the Day',
      'Morning, Unhurried',
      'Before the Crowds',
      'The Quiet Hours',
      'First Light, First Steps',
      'The City Before It Wakes',
      'No Alarm, No Rush',
      'Early Hours, Good Taste',
    ],
    lunch: [
      'The Long Lunch',
      'Midday, Well Spent',
      'An Afternoon to Wander',
      'Three Stops, No Rush',
      'Where the Afternoon Goes',
      'Between Courses',
      'The Midday Edition',
      'A Proper Afternoon',
    ],
    evening: [
      'An Evening Worth Remembering',
      'Sunset to Nightcap',
      'The Night Starts Here',
      'From Dusk, With Intent',
      'After Hours',
      'The Evening Route',
      'When the Lights Come On',
      'A Night in Three Acts',
    ],
    sunset: [
      'Golden Hour',
      'Where the Light Fades',
      'A Sunset Worth Chasing',
      'The Last Light',
      'Before Dark',
      'The Evening Glow',
      'Light Changes Everything',
      'The Hour Before Night',
    ],
  }
  return pickRandom(banks[templateType])
}

function generateSummary(templateType: TemplateType, places: PlaceCandidate[]): string {
  const types = places.map(p => TYPE_LABELS[p.place_type] ?? 'a discovery')
  const unique = [...new Set(types)]

  const banks: Record<TemplateType, ((items: string[]) => string)[]> = {
    morning: [
      (items) => `A gentle start: ${items.join(', then ')}. Let the morning set its own pace.`,
      (items) => `Three stops before lunch — ${items.join(', ')}. The city is quieter and the choices are better.`,
      (items) => `Start with ${items[0]}, move through ${items.slice(1).join(' and ')}. No schedule required.`,
    ],
    lunch: [
      (items) => `A midday built around ${items.join(', ')} — the kind of afternoon worth protecting.`,
      (items) => `Three stops, one afternoon: ${items.join(', ')}. No rush, no regrets.`,
      (items) => `An afternoon that moves from ${items.join(' to ')}. Better than your original plan.`,
    ],
    evening: [
      (items) => `As the light changes: ${items.join(', ')}. The kind of evening you don't plan to end.`,
      (items) => `An evening in three chapters — ${items.join(', ')}. Each one better than the last.`,
      (items) => `From ${items[0]} to ${items[items.length - 1]}, with purpose. This is how the night should start.`,
    ],
    sunset: [
      (items) => `Chase the last light, then ease into ${items.slice(1).join(' and ')}. No agenda required.`,
      (items) => `Start with the view, end with ${items[items.length - 1]}. The evening writes itself.`,
      (items) => `The sun sets, the night begins: ${items.join(', ')}. Three stops, zero rush.`,
    ],
  }

  return pickRandom(banks[templateType])(unique)
}

function generateStopNote(place: PlaceCandidate, stopIndex: number): string {
  // Use goldenbook_note if available — already editorial
  if (place.goldenbook_note && place.goldenbook_note.length > 10) {
    return place.goldenbook_note.length > 140
      ? place.goldenbook_note.slice(0, 137) + '...'
      : place.goldenbook_note
  }

  // Type-specific evocative notes — varied enough to avoid repetition across routes
  const notes: Record<string, string[]> = {
    cafe: [
      `Good coffee, good light, and no pressure to leave.`,
      `A warm start — sit by the window and let the city set the pace.`,
      `The kind of café where a second cup feels like the right decision.`,
      `Order slowly. The morning is long and the coffee is worth it.`,
    ],
    restaurant: [
      `A table worth the walk. Let the menu take its time.`,
      `The cooking here has conviction — trust it.`,
      `This is where the route earns its name. Eat well.`,
      `The kind of meal that changes the rest of your day.`,
    ],
    bar: [
      `A drink that sets the tone for what comes next.`,
      `The glass list here tells you something about the city's taste.`,
      `Low light, sharp drinks, no fuss. Let the evening settle.`,
      `The kind of bar you'll want to come back to on your own.`,
    ],
    shop: [
      `A detour that feels like a discovery.`,
      `The selection here says more about the city than a guidebook.`,
      `Browse slowly — the best pieces don't announce themselves.`,
      `A shop with taste. Take your time.`,
    ],
    museum: [
      `Give yourself more time than you planned — it's worth it.`,
      `A shift in rhythm. Let the collection do the talking.`,
      `The kind of visit that stays with you after you leave.`,
      `Culture, calm, and a reason to slow down.`,
    ],
    landmark: [
      `More than a photograph. Stand here for a moment.`,
      `The city reveals itself from this spot.`,
      `A place with presence. The neighbourhood starts here.`,
      `Worth the walk, worth the pause.`,
    ],
    activity: [
      `Something different — the kind of experience you'll talk about later.`,
      `Not the obvious choice. That's why it works.`,
      `An experience that earns its place on the route.`,
    ],
    beach: [
      `Shoes off. Eyes on the water. Take your time.`,
      `The coastline does the work — you just have to show up.`,
      `A stretch of coast that makes you want to stay longer.`,
    ],
    hotel: [
      `A setting worth passing through, even if you're not staying.`,
      `Architecture and atmosphere — both worth your attention.`,
      `The kind of property that makes you reconsider your booking.`,
    ],
  }

  return pickRandom(notes[place.place_type] ?? [
    `One of those places you're glad someone told you about.`,
  ])
}

// ─── Template picker ────────────────────────────────────────────────────────

export async function pickTemplateType(citySlug: string): Promise<TemplateType> {
  const { rows } = await db.query<{ template_type: string }>(`
    SELECT template_type FROM curated_routes
    WHERE city_slug = $1 AND is_active = true
    ORDER BY created_at DESC LIMIT 10
  `, [citySlug])

  const recentTypes = new Set(rows.map(r => r.template_type))
  const allTypes: TemplateType[] = ['morning', 'lunch', 'evening', 'sunset']
  const unused = allTypes.filter(t => !recentTypes.has(t))
  if (unused.length > 0) return pickRandom(unused)

  const counts = new Map<string, number>()
  for (const t of allTypes) counts.set(t, 0)
  for (const r of rows) counts.set(r.template_type, (counts.get(r.template_type) ?? 0) + 1)
  return allTypes.slice().sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0))[0]
}

// ─── Main generation functions ──────────────────────────────────────────────

export async function generateEditorialRoute(citySlug: string): Promise<GeneratedRoute | null> {
  const preferredType = await pickTemplateType(citySlug)

  const ordered = [
    PATTERNS.find(p => p.templateType === preferredType)!,
    ...PATTERNS.filter(p => p.templateType !== preferredType),
  ]

  for (const pattern of ordered) {
    const places = await selectPlaces(citySlug, pattern, null)
    if (!places || places.length < 3) continue

    // Verify diversity: no two stops with the same type
    const types = places.map(p => p.place_type)
    const hasDupes = new Set(types).size < types.length
    if (hasDupes) {
      // Try once more with another pattern before accepting dupes
      continue
    }

    return {
      citySlug,
      routeType: 'editorial',
      templateType: pattern.templateType,
      sponsorPlaceId: null,
      title: generateTitle(pattern.templateType, places),
      summary: generateSummary(pattern.templateType, places),
      stops: places.map((place, i) => ({
        placeId: place.id,
        stopOrder: i + 1,
        editorialNote: generateStopNote(place, i),
      })),
    }
  }

  // Last resort: accept routes with duplicate types if no diverse option exists
  for (const pattern of ordered) {
    const places = await selectPlaces(citySlug, pattern, null)
    if (!places || places.length < 3) continue

    return {
      citySlug,
      routeType: 'editorial',
      templateType: pattern.templateType,
      sponsorPlaceId: null,
      title: generateTitle(pattern.templateType, places),
      summary: generateSummary(pattern.templateType, places),
      stops: places.map((place, i) => ({
        placeId: place.id,
        stopOrder: i + 1,
        editorialNote: generateStopNote(place, i),
      })),
    }
  }

  return null
}

export async function generateSponsoredRoute(
  citySlug: string,
  sponsorPlaceId: string,
): Promise<GeneratedRoute | null> {
  // Find a pattern that works with the sponsor's place type
  for (const pattern of PATTERNS) {
    const places = await selectPlaces(citySlug, pattern, sponsorPlaceId)
    if (!places || places.length < 3) continue

    return {
      citySlug,
      routeType: 'sponsored',
      templateType: pattern.templateType,
      sponsorPlaceId,
      title: generateTitle(pattern.templateType, places),
      summary: generateSummary(pattern.templateType, places),
      stops: places.map((place, i) => ({
        placeId: place.id,
        stopOrder: i + 1,
        editorialNote: generateStopNote(place, i),
      })),
    }
  }
  return null
}
