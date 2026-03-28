import { db } from '../../../db/postgres'
import { AppError, NotFoundError, ValidationError } from '../../../shared/errors/AppError'
import type { CreatePlaceInput, UpdatePlaceInput, AdminPlaceResponseDTO } from './admin-places.dto'

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

    // Insert place
    const { rows: placed } = await client.query<{
      id: string
      slug: string
      status: string
      featured: boolean
    }>(
      `
      INSERT INTO places (
        destination_id, slug, name,
        short_description, full_description,
        address_line, website_url, phone, email, booking_url,
        status, featured, place_type,
        is_active, published_at
      ) VALUES (
        $1, $2, $3,
        $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, 'other',
        true,
        CASE WHEN $11 = 'published' THEN now() ELSE NULL END
      )
      RETURNING id, slug, status, featured
      `,
      [
        destinationId,
        input.slug,
        input.name,
        nullify(input.shortDescription),
        nullify(input.fullDescription),
        nullify(input.addressLine),
        nullify(input.websiteUrl),
        nullify(input.phone),
        nullify(input.email),
        nullify(input.bookingUrl),
        input.status,
        input.featured,
      ],
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

    await client.query('COMMIT')

    return {
      id:       place.id,
      slug:     place.slug,
      name:     input.name,
      status:   place.status,
      featured: place.featured,
      citySlug: input.citySlug,
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
      // Fetch current translation as fallback
      const { rows: currentTrans } = await client.query<{
        name: string | null
        short_description: string | null
        full_description: string | null
        goldenbook_note: string | null
        why_we_love_it: string | null
        insider_tip: string | null
      }>(
        `SELECT name, short_description, full_description, goldenbook_note, why_we_love_it, insider_tip
         FROM place_translations WHERE place_id = $1 AND locale = 'en' LIMIT 1`,
        [placeId],
      )
      const ct = currentTrans[0] ?? {}

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
          placeId,
          input.name             ?? ct.name,
          input.shortDescription !== undefined ? nullify(input.shortDescription) : ct.short_description,
          input.fullDescription  !== undefined ? nullify(input.fullDescription)  : ct.full_description,
          input.goldenbookNote   !== undefined ? nullify(input.goldenbookNote)   : ct.goldenbook_note,
          input.whyWeLoveIt      !== undefined ? nullify(input.whyWeLoveIt)      : ct.why_we_love_it,
          input.insiderTip       !== undefined ? nullify(input.insiderTip)       : ct.insider_tip,
        ],
      )
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

    return {
      id:       placeId,
      slug:     final[0].slug,
      name:     final[0].name,
      status:   final[0].status,
      featured: final[0].featured,
      citySlug: final[0].city_slug,
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
