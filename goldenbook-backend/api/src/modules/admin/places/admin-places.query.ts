import { db } from '../../../db/postgres'
import { AppError, NotFoundError, ValidationError } from '../../../shared/errors/AppError'
import type { CreatePlaceInput, UpdatePlaceInput, AdminPlaceResponseDTO } from './admin-places.dto'
import { translateFields } from '../../../lib/translation/deepl'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resolveDestinationId(citySlug: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM destinations WHERE slug = $1 AND is_active = true LIMIT 1`,
    [citySlug],
  )
  if (!rows[0]) throw new ValidationError(`City not found: ${citySlug}`)
  return rows[0].id
}

async function resolveCategoryId(categorySlug: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM categories WHERE slug = $1 AND is_active = true LIMIT 1`,
    [categorySlug],
  )
  if (!rows[0]) throw new ValidationError(`Category not found: ${categorySlug}`)
  return rows[0].id
}

async function resolveSubcategoryId(
  subcategorySlug: string,
  categoryId: string,
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM subcategories WHERE slug = $1 AND category_id = $2 AND is_active = true LIMIT 1`,
    [subcategorySlug, categoryId],
  )
  if (!rows[0])
    throw new ValidationError(`Subcategory not found: ${subcategorySlug}`)
  return rows[0].id
}

function nullify(v: string | undefined): string | null {
  return v === undefined || v === '' ? null : v
}

/** Resolve multiple city slugs to destination IDs. */
async function resolveDestinationIds(slugs: string[]): Promise<{ id: string; slug: string }[]> {
  if (slugs.length === 0) return []
  const placeholders = slugs.map((_, i) => `$${i + 1}`).join(', ')
  const { rows } = await db.query<{ id: string; slug: string }>(
    `SELECT id, slug FROM destinations WHERE slug IN (${placeholders}) AND is_active = true`,
    slugs,
  )
  return rows
}

/** Sync place_destinations join table. Adds missing, removes stale. */
async function syncPlaceDestinations(
  client: { query: typeof db.query },
  placeId: string,
  destinationIds: string[],
): Promise<void> {
  // Remove old links not in the new set
  if (destinationIds.length > 0) {
    const placeholders = destinationIds.map((_, i) => `$${i + 2}`).join(', ')
    await client.query(
      `DELETE FROM place_destinations WHERE place_id = $1 AND destination_id NOT IN (${placeholders})`,
      [placeId, ...destinationIds],
    )
  } else {
    await client.query(`DELETE FROM place_destinations WHERE place_id = $1`, [placeId])
  }
  // Insert new links
  for (const destId of destinationIds) {
    await client.query(
      `INSERT INTO place_destinations (place_id, destination_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [placeId, destId],
    )
  }
}

/** Get all city slugs for a place from the join table. */
async function getPlaceCitySlugs(placeId: string): Promise<string[]> {
  const { rows } = await db.query<{ slug: string }>(
    `SELECT d.slug FROM place_destinations pd JOIN destinations d ON d.id = pd.destination_id WHERE pd.place_id = $1 ORDER BY d.name`,
    [placeId],
  )
  return rows.map((r) => r.slug)
}

// ─── Create place ─────────────────────────────────────────────────────────────

export async function createPlace(
  input: CreatePlaceInput,
): Promise<AdminPlaceResponseDTO> {
  // Resolve FKs before starting transaction
  const destinationId = await resolveDestinationId(input.citySlug)
  const categoryId    = await resolveCategoryId(input.categorySlug)

  let subcategoryId: string | null = null
  if (input.subcategorySlug) {
    subcategoryId = await resolveSubcategoryId(input.subcategorySlug, categoryId)
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // Check slug uniqueness
    const { rows: existing } = await client.query<{ id: string }>(
      `SELECT id FROM places WHERE slug = $1 LIMIT 1`,
      [input.slug],
    )
    if (existing[0]) {
      throw new AppError(409, `Slug "${input.slug}" is already taken`, 'SLUG_CONFLICT')
    }

    // Check if booking columns exist
    const hasBookingCols = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'booking_enabled' LIMIT 1`
    ).then(r => r.rows.length > 0)

    // Insert place
    const insertCols = [
      'destination_id', 'slug', 'name',
      'short_description', 'full_description',
      'address_line', 'website_url', 'phone', 'email', 'booking_url',
      'status', 'featured', 'place_type',
      'is_active', 'published_at',
    ]
    const insertVals = [
      '$1', '$2', '$3',
      '$4', '$5',
      '$6', '$7', '$8', '$9', '$10',
      '$11', '$12', `'other'`,
      'true',
      `CASE WHEN $11 = 'published' THEN now() ELSE NULL END`,
    ]
    const insertParams: unknown[] = [
      destinationId, input.slug, input.name,
      nullify(input.shortDescription), nullify(input.fullDescription),
      nullify(input.addressLine), nullify(input.websiteUrl),
      nullify(input.phone), nullify(input.email), nullify(input.bookingUrl),
      input.status, input.featured,
    ]

    if (hasBookingCols) {
      insertCols.push('booking_enabled', 'booking_mode', 'booking_label', 'booking_notes', 'reservation_relevant', 'reservation_source')
      insertVals.push('$13', `COALESCE($14, 'none')::booking_mode`, '$15', '$16', '$17', '$18::reservation_source')
      insertParams.push(
        input.bookingEnabled ?? false,
        input.bookingMode ?? 'none',
        nullify(input.bookingLabel),
        nullify(input.bookingNotes),
        input.reservationRelevant ?? false,
        input.reservationSource ?? null,
      )
    }

    const { rows: placed } = await client.query<{
      id: string; slug: string; status: string; featured: boolean
    }>(
      `INSERT INTO places (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')}) RETURNING id, slug, status, featured`,
      insertParams,
    )
    const place = placed[0]

    // Upsert English translation
    await client.query(
      `
      INSERT INTO place_translations (
        place_id, locale, name,
        short_description, full_description,
        goldenbook_note, why_we_love_it, insider_tip
      ) VALUES ($1, 'en', $2, $3, $4, $5, $6, $7)
      ON CONFLICT (place_id, locale) DO UPDATE SET
        name              = EXCLUDED.name,
        short_description = EXCLUDED.short_description,
        full_description  = EXCLUDED.full_description,
        goldenbook_note   = EXCLUDED.goldenbook_note,
        why_we_love_it    = EXCLUDED.why_we_love_it,
        insider_tip       = EXCLUDED.insider_tip,
        updated_at        = now()
      `,
      [
        place.id,
        input.name,
        nullify(input.shortDescription),
        nullify(input.fullDescription),
        nullify(input.goldenbookNote),
        nullify(input.whyWeLoveIt),
        nullify(input.insiderTip),
      ],
    )

    // Insert primary category
    await client.query(
      `
      INSERT INTO place_categories (place_id, category_id, subcategory_id, is_primary, sort_order)
      VALUES ($1, $2, $3, true, 0)
      `,
      [place.id, categoryId, subcategoryId],
    )

    // Sync place_destinations join table
    const allCitySlugs = input.citySlugs?.length ? input.citySlugs : [input.citySlug]
    const destRows = await resolveDestinationIds(allCitySlugs)
    const allDestIds = destRows.map((r) => r.id)
    // Always include the primary destination
    if (!allDestIds.includes(destinationId)) allDestIds.push(destinationId)
    await syncPlaceDestinations(client, place.id, allDestIds)

    await client.query('COMMIT')

    const citySlugs = await getPlaceCitySlugs(place.id)

    return {
      id:        place.id,
      slug:      place.slug,
      name:      input.name,
      status:    place.status,
      featured:  place.featured,
      citySlug:  input.citySlug,
      citySlugs,
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── Update place ─────────────────────────────────────────────────────────────

export async function updatePlace(
  placeId: string,
  input: UpdatePlaceInput,
): Promise<AdminPlaceResponseDTO> {
  // Verify place exists first
  const { rows: found } = await db.query<{
    id: string
    slug: string
    status: string
    featured: boolean
    destination_id: string
  }>(
    `
    SELECT p.id, p.slug, p.status, p.featured, p.destination_id
    FROM places p WHERE p.id = $1 LIMIT 1
    `,
    [placeId],
  )
  if (!found[0]) throw new NotFoundError('Place')
  const existing = found[0]

  // Resolve FKs only when they are being changed
  let destinationId: string | null = null
  if (input.citySlug) {
    destinationId = await resolveDestinationId(input.citySlug)
  }

  let categoryId: string | null = null
  if (input.categorySlug) {
    categoryId = await resolveCategoryId(input.categorySlug)
  }

  let subcategoryId: string | null = null
  if (input.subcategorySlug && categoryId) {
    subcategoryId = await resolveSubcategoryId(input.subcategorySlug, categoryId)
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // Check slug uniqueness if slug is being changed
    if (input.slug && input.slug !== existing.slug) {
      const { rows: slugCheck } = await client.query<{ id: string }>(
        `SELECT id FROM places WHERE slug = $1 LIMIT 1`,
        [input.slug],
      )
      if (slugCheck[0]) {
        throw new AppError(409, `Slug "${input.slug}" is already taken`, 'SLUG_CONFLICT')
      }
    }

    // Build dynamic SET clause for places table
    const setClauses: string[] = []
    const params: unknown[]    = []
    let   i = 1

    function addField(column: string, value: unknown) {
      setClauses.push(`${column} = $${i++}`)
      params.push(value)
    }

    if (input.name         !== undefined) addField('name',          input.name)
    if (input.slug         !== undefined) addField('slug',          input.slug)
    if (destinationId      !== null)      addField('destination_id', destinationId)
    if (input.addressLine  !== undefined) addField('address_line',   nullify(input.addressLine))
    if (input.websiteUrl   !== undefined) addField('website_url',    nullify(input.websiteUrl))
    if (input.phone        !== undefined) addField('phone',          nullify(input.phone))
    if (input.email        !== undefined) addField('email',          nullify(input.email))
    if (input.bookingUrl   !== undefined) addField('booking_url',    nullify(input.bookingUrl))
    if (input.featured     !== undefined) addField('featured',       input.featured)

    // Booking fields — only if the booking migration has been applied
    const hasBookingColumns = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'booking_enabled' LIMIT 1`
    ).then(r => r.rows.length > 0)

    if (hasBookingColumns) {
      if (input.bookingEnabled      !== undefined) addField('booking_enabled',      input.bookingEnabled)
      if (input.bookingMode         !== undefined) {
        setClauses.push(`booking_mode = $${i}::booking_mode`)
        params.push(input.bookingMode)
        i++
      }
      if (input.bookingLabel        !== undefined) addField('booking_label',        nullify(input.bookingLabel))
      if (input.bookingNotes        !== undefined) addField('booking_notes',        nullify(input.bookingNotes))
      if (input.reservationRelevant !== undefined) addField('reservation_relevant', input.reservationRelevant)
      if (input.reservationSource   !== undefined) {
        setClauses.push(`reservation_source = $${i}::reservation_source`)
        params.push(input.reservationSource ?? null)
        i++
      }
      if (input.bookingEnabled !== undefined || input.bookingMode !== undefined) {
        setClauses.push(`reservation_last_reviewed_at = now()`)
      }
    }

    // Handle status + published_at together
    if (input.status !== undefined) {
      addField('status', input.status)
      if (input.status === 'published') {
        setClauses.push(`published_at = COALESCE(published_at, now())`)
      }
    }

    // Always bump updated_at
    setClauses.push(`updated_at = now()`)

    if (setClauses.length > 1) { // more than just updated_at
      params.push(placeId)
      await client.query(
        `UPDATE places SET ${setClauses.join(', ')} WHERE id = $${i}`,
        params,
      )
    }

    // Upsert translation if any editorial field is changing
    const hasTranslationUpdate =
      input.name             !== undefined ||
      input.shortDescription !== undefined ||
      input.fullDescription  !== undefined ||
      input.goldenbookNote   !== undefined ||
      input.whyWeLoveIt      !== undefined ||
      input.insiderTip       !== undefined

    if (hasTranslationUpdate) {
      // Fetch current PT translation as fallback
      const { rows: currentPt } = await client.query<{
        name: string | null; short_description: string | null; full_description: string | null
        goldenbook_note: string | null; why_we_love_it: string | null; insider_tip: string | null
      }>(
        `SELECT name, short_description, full_description, goldenbook_note, why_we_love_it, insider_tip
         FROM place_translations WHERE place_id = $1 AND locale = 'pt' LIMIT 1`,
        [placeId],
      )
      const ptPrev = currentPt[0] ?? {}

      // Build the PT values
      const ptName = input.name ?? ptPrev.name ?? ''
      const ptShort = input.shortDescription !== undefined ? nullify(input.shortDescription) : ptPrev.short_description
      const ptFull = input.fullDescription !== undefined ? nullify(input.fullDescription) : ptPrev.full_description
      const ptNote = input.goldenbookNote !== undefined ? nullify(input.goldenbookNote) : ptPrev.goldenbook_note
      const ptWhy = input.whyWeLoveIt !== undefined ? nullify(input.whyWeLoveIt) : ptPrev.why_we_love_it
      const ptTip = input.insiderTip !== undefined ? nullify(input.insiderTip) : ptPrev.insider_tip

      // 1. Save Portuguese (source of truth)
      await client.query(
        `INSERT INTO place_translations (place_id, locale, name, short_description, full_description, goldenbook_note, why_we_love_it, insider_tip)
         VALUES ($1, 'pt', $2, $3, $4, $5, $6, $7)
         ON CONFLICT (place_id, locale) DO UPDATE SET
           name = EXCLUDED.name, short_description = EXCLUDED.short_description, full_description = EXCLUDED.full_description,
           goldenbook_note = EXCLUDED.goldenbook_note, why_we_love_it = EXCLUDED.why_we_love_it, insider_tip = EXCLUDED.insider_tip,
           updated_at = now()`,
        [placeId, ptName, ptShort, ptFull, ptNote, ptWhy, ptTip],
      )

      // 2. Check if EN has a manual override
      const { rows: enRow } = await client.query<{ translation_override: boolean }>(
        `SELECT COALESCE(translation_override, false) AS translation_override
         FROM place_translations WHERE place_id = $1 AND locale = 'en' LIMIT 1`,
        [placeId],
      )
      const hasOverride = enRow[0]?.translation_override ?? false

      // 3. Auto-translate to EN if no manual override
      if (!hasOverride) {
        // Release client before async translation (commit PT first)
        await client.query('SAVEPOINT pre_translate')

        try {
          const translated = await translateFields({
            name: ptName,
            short_description: ptShort,
            full_description: ptFull,
            goldenbook_note: ptNote,
            insider_tip: ptTip,
          })

          await client.query(
            `INSERT INTO place_translations (place_id, locale, name, short_description, full_description, goldenbook_note, why_we_love_it, insider_tip)
             VALUES ($1, 'en', $2, $3, $4, $5, $6, $7)
             ON CONFLICT (place_id, locale) DO UPDATE SET
               name = EXCLUDED.name, short_description = EXCLUDED.short_description, full_description = EXCLUDED.full_description,
               goldenbook_note = EXCLUDED.goldenbook_note, why_we_love_it = EXCLUDED.why_we_love_it, insider_tip = EXCLUDED.insider_tip,
               updated_at = now()`,
            [
              placeId,
              translated.name ?? ptName,
              translated.short_description ?? ptShort,
              translated.full_description ?? ptFull,
              translated.goldenbook_note ?? ptNote,
              translated.why_we_love_it ?? ptWhy,
              translated.insider_tip ?? ptTip,
            ],
          )
        } catch (translationErr) {
          console.error('[translation] Auto-translate failed, using PT as EN fallback:', translationErr)
          await client.query('ROLLBACK TO SAVEPOINT pre_translate')
          // Save PT content as EN fallback
          await client.query(
            `INSERT INTO place_translations (place_id, locale, name, short_description, full_description, goldenbook_note, why_we_love_it, insider_tip)
             VALUES ($1, 'en', $2, $3, $4, $5, $6, $7)
             ON CONFLICT (place_id, locale) DO UPDATE SET
               name = EXCLUDED.name, short_description = EXCLUDED.short_description, full_description = EXCLUDED.full_description,
               goldenbook_note = EXCLUDED.goldenbook_note, why_we_love_it = EXCLUDED.why_we_love_it, insider_tip = EXCLUDED.insider_tip,
               updated_at = now()`,
            [placeId, ptName, ptShort, ptFull, ptNote, ptWhy, ptTip],
          )
        }
      }
    }

    // Replace primary category if categorySlug is being changed
    if (categoryId !== null) {
      await client.query(
        `DELETE FROM place_categories WHERE place_id = $1 AND is_primary = true`,
        [placeId],
      )
      await client.query(
        `
        INSERT INTO place_categories (place_id, category_id, subcategory_id, is_primary, sort_order)
        VALUES ($1, $2, $3, true, 0)
        `,
        [placeId, categoryId, subcategoryId],
      )
    }

    // Sync place_destinations join table if citySlugs is provided
    if (input.citySlugs?.length) {
      const destRows = await resolveDestinationIds(input.citySlugs)
      const allDestIds = destRows.map((r) => r.id)
      // Ensure primary destination is included
      const primaryDestId = destinationId ?? existing.destination_id
      if (!allDestIds.includes(primaryDestId)) allDestIds.push(primaryDestId)
      await syncPlaceDestinations(client, placeId, allDestIds)
    } else if (destinationId) {
      // Only primary city changed, ensure it's in the join table
      await client.query(
        `INSERT INTO place_destinations (place_id, destination_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [placeId, destinationId],
      )
    }

    await client.query('COMMIT')

    // Fetch final state for response
    const { rows: final } = await db.query<{
      slug: string
      name: string
      status: string
      featured: boolean
      city_slug: string
    }>(
      `
      SELECT p.slug, p.name, p.status, p.featured, d.slug AS city_slug
      FROM places p
      JOIN destinations d ON d.id = p.destination_id
      WHERE p.id = $1 LIMIT 1
      `,
      [placeId],
    )

    const citySlugs = await getPlaceCitySlugs(placeId)

    return {
      id:        placeId,
      slug:      final[0].slug,
      name:      final[0].name,
      status:    final[0].status,
      featured:  final[0].featured,
      citySlug:  final[0].city_slug,
      citySlugs,
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── Delete place ─────────────────────────────────────────────────────────────

export async function deletePlace(placeId: string): Promise<void> {
  const { rowCount } = await db.query('DELETE FROM places WHERE id = $1', [placeId])
  if (!rowCount) throw new NotFoundError('Place')
}
