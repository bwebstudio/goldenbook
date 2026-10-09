import { db } from '../../../db/postgres'
import { AppError, NotFoundError, ValidationError } from '../../../shared/errors/AppError'
import type { CreatePlaceInput, UpdatePlaceInput, AdminPlaceResponseDTO, AutoTranslationOutcome } from './admin-places.dto'
import { normalizeNowTimeWindows } from './admin-places.dto'
import { translatePlaceFields, type PlaceTranslationFields } from '../../../lib/translation/deepl'
import { autoClassifyPlace } from './auto-classify'
import { replaceOpeningHours } from './opening-hours'
import { deleteAssetsIfUnreferenced, type StorageObjectRef } from './admin-images.query'
import {
  AUTO_TARGET_LOCALES,
  CANONICAL_LOCALE,
  isOverrideEnforceable,
  resolveCanonicalPortuguese,
} from './translation-policy'

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

type TranslationLocale = 'en' | 'pt' | 'es'

async function isLocaleOverridden(
  client: { query: typeof db.query },
  placeId: string,
  locale: TranslationLocale,
): Promise<boolean> {
  const { rows } = await client.query<{ translation_override: boolean | null }>(
    `SELECT COALESCE(translation_override, false) AS translation_override
       FROM place_translations
      WHERE place_id = $1 AND locale = $2 LIMIT 1`,
    [placeId, locale],
  )
  return Boolean(rows[0]?.translation_override)
}

async function upsertPlaceTranslation(
  client: { query: typeof db.query },
  placeId: string,
  locale: TranslationLocale,
  fields: PlaceTranslationFields,
  options: { translatedFrom?: TranslationLocale | null } = {},
): Promise<void> {
  // Never overwrite a locale that the editor explicitly curated by hand.
  // The new dashboard translations editor sets translation_override=true on
  // EN/ES manual saves; this guard keeps those values stable when an editor
  // later saves canonical fields through the legacy place form.
  //
  // The guard must NOT apply to the canonical locale. "Override" means "this
  // row is human-curated, so auto-translation must not clobber it" — a
  // statement about translations, which Portuguese never is. Applying it to PT
  // made the canonical row read-only: the place form silently skipped the PT
  // write while `upsertAutoTranslationsFromPortuguese` went on to regenerate
  // EN and ES from the *new* text, so the app served the old Portuguese beside
  // an English translation of the new one, and the save still returned 200.
  //
  // 24 PT rows were flagged this way by a `source='manual_fix'` maintenance
  // pass, which the is_override/translation_override sync trigger propagated
  // to the legacy column. Those places could not have their Portuguese edited
  // at all until this guard was scoped to the translated locales.
  const overrideApplies = isOverrideEnforceable(locale)
  if (overrideApplies && await isLocaleOverridden(client, placeId, locale)) return

  // `translated_from` is set on auto-translation paths so the dashboard can
  // tell the user "EN was translated from PT". The canonical PT row stores
  // its own locale (or null) — it isn't a translation of anything.
  const translatedFrom = options.translatedFrom ?? null

  await client.query(
    `
    INSERT INTO place_translations (
      place_id, locale, name, short_description, full_description, goldenbook_note, insider_tip,
      translation_override, translated_from
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
    ON CONFLICT (place_id, locale) DO UPDATE SET
      name = EXCLUDED.name,
      short_description = EXCLUDED.short_description,
      full_description = EXCLUDED.full_description,
      goldenbook_note = EXCLUDED.goldenbook_note,
      insider_tip = EXCLUDED.insider_tip,
      translated_from = EXCLUDED.translated_from,
      updated_at = now()
    WHERE $9::boolean OR COALESCE(place_translations.translation_override, false) = false
    `,
    [
      placeId,
      locale,
      fields.name,
      fields.short_description,
      fields.full_description,
      fields.goldenbook_note,
      fields.insider_tip,
      translatedFrom,
      // $9 — bypass the override guard for the canonical locale. Mirrors the
      // early-return above so a row flagged as an override still can't block
      // an editor's Portuguese edit.
      !overrideApplies,
    ],
  )
}

/**
 * Auto-translate the canonical Portuguese fields into EN and ES and write
 * those rows. PT is the editorial source-of-truth (see translation-policy.ts).
 * Targets default to ['en', 'es']; per-locale override-protection is enforced
 * by `upsertPlaceTranslation`.
 *
 * Per-locale failures are logged and swallowed so a flaky DeepL call for one
 * target never blocks the other. The outcome per locale is returned so the
 * save response can tell the editor which languages did NOT follow the PT
 * edit (locked as manual translations, or DeepL failed) instead of letting
 * them find out from the app.
 */
async function upsertAutoTranslationsFromPortuguese(
  client: { query: typeof db.query },
  placeId: string,
  portugueseFields: PlaceTranslationFields,
  targets: ReadonlyArray<Exclude<TranslationLocale, 'pt'>> = AUTO_TARGET_LOCALES,
): Promise<AutoTranslationOutcome> {
  const outcome: AutoTranslationOutcome = { updated: [], skippedLocked: [], failed: [] }
  for (const targetLocale of targets) {
    if (await isLocaleOverridden(client, placeId, targetLocale)) {
      // Editor curated this locale by hand — leave it alone.
      outcome.skippedLocked.push(targetLocale)
      continue
    }
    try {
      const translated = await translatePlaceFields(portugueseFields, targetLocale, CANONICAL_LOCALE)
      await upsertPlaceTranslation(client, placeId, targetLocale, translated, {
        translatedFrom: CANONICAL_LOCALE,
      })
      outcome.updated.push(targetLocale)
    } catch (err) {
      // Per-locale failure must not block remaining locales
      console.error(`[translation] DeepL failed for ${targetLocale} on place ${placeId}:`, err)
      outcome.failed.push(targetLocale)
    }
  }
  return outcome
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

// ─── Create place ───────────────────────��─────────────────────────────────────

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

    // Check if the FULL booking system columns exist. Keyed on `booking_mode`
    // (NOT booking_enabled): booking_enabled now exists on its own, but the rest
    // of the booking columns (booking_mode, reservation_*) do not — so this block
    // must stay disabled to avoid INSERTing into non-existent columns. New places
    // get booking_enabled via its column DEFAULT (true).
    const hasBookingCols = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'booking_mode' LIMIT 1`
    ).then(r => r.rows.length > 0)

    // Insert place
    const insertCols = [
      'destination_id', 'slug', 'name',
      'short_description', 'full_description',
      'address_line', 'website_url', 'phone', 'email', 'booking_url',
      'status', 'featured', 'place_type',
      'is_active', 'published_at',
      'google_place_id', 'google_maps_url', 'google_rating', 'google_rating_count',
      'latitude', 'longitude', 'price_tier',
    ]
    const insertVals = [
      '$1', '$2', '$3',
      '$4', '$5',
      '$6', '$7', '$8', '$9', '$10',
      '$11', '$12', '$13',
      'true',
      `CASE WHEN $11 = 'published' THEN now() ELSE NULL END`,
      '$14', '$15', '$16', '$17',
      '$18', '$19', '$20',
    ]
    const insertParams: unknown[] = [
      destinationId, input.slug, input.name,
      nullify(input.shortDescription), nullify(input.fullDescription),
      nullify(input.addressLine), nullify(input.websiteUrl),
      nullify(input.phone), nullify(input.email), nullify(input.bookingUrl),
      input.status, input.featured, input.placeType ?? 'other',
      nullify(input.googlePlaceId), nullify(input.googleMapsUrl),
      input.googleRating ?? null, input.googleRatingCount ?? null,
      input.latitude ?? null, input.longitude ?? null, input.priceTier ?? null,
    ]

    if (hasBookingCols) {
      insertCols.push('booking_enabled', 'booking_mode', 'booking_label', 'booking_notes', 'reservation_relevant', 'reservation_source')
      insertVals.push('$21', `COALESCE($22, 'none')::booking_mode`, '$23', '$24', '$25', '$26::reservation_source')
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

    // Editorial fields as submitted by the caller. The dashboard form
    // submits Portuguese (canonical). The Google import flow passes
    // `sourceLocale: 'en'` because Google Places returns English content
    // — the API translates it into PT before persisting the canonical row.
    const submittedFields: PlaceTranslationFields = {
      name: input.name,
      short_description: nullify(input.shortDescription),
      full_description: nullify(input.fullDescription),
      goldenbook_note: nullify(input.goldenbookNote),
      insider_tip: nullify(input.insiderTip),
    }

    const ptCanonical = await resolveCanonicalPortuguese(
      input.sourceLocale ?? 'pt',
      submittedFields,
      async (fields, sourceLocale) => translatePlaceFields(fields, 'pt', sourceLocale),
    )

    // 1. Persist the canonical Portuguese row first. Everything else
    //    (auto EN/ES, dashboard reads with locale=pt) depends on it.
    await upsertPlaceTranslation(client, place.id, 'pt', ptCanonical)

    // 2. Auto-translate PT → EN and PT → ES. If the import was already in
    //    English we keep that pristine source instead of re-translating
    //    PT→EN — round-tripping degrades the copy with no benefit.
    if (input.sourceLocale === 'en') {
      await upsertPlaceTranslation(client, place.id, 'en', submittedFields, {
        translatedFrom: 'en',
      })
      await upsertAutoTranslationsFromPortuguese(client, place.id, ptCanonical, ['es'])
    } else {
      await upsertAutoTranslationsFromPortuguese(client, place.id, ptCanonical)
    }

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

    // Opening hours previewed by the Place Generator (or typed in the form)
    // used to be dropped here; persist them with the rest of the place.
    if (input.openingHours !== undefined) {
      await replaceOpeningHours(client, place.id, input.openingHours)
    }

    await client.query('COMMIT')

    // Auto-classify (fire-and-forget — don't block response)
    autoClassifyPlace(place.id).catch((err) => {
      console.error(`[auto-classify] Failed for place ${place.id}:`, err)
    })

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
    name: string
    slug: string
    status: string
    featured: boolean
    destination_id: string
  }>(
    `
    SELECT p.id, p.name, p.slug, p.status, p.featured, p.destination_id
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
    if (input.placeType    !== undefined) addField('place_type',     input.placeType)

    // The "poder reservar" toggle. booking_enabled is the one booking column
    // that exists, so persist it independently of the rest of the (absent)
    // booking system below.
    const hasBookingEnabled = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'booking_enabled' LIMIT 1`
    ).then(r => r.rows.length > 0)
    if (hasBookingEnabled && input.bookingEnabled !== undefined) {
      addField('booking_enabled', input.bookingEnabled)
    }

    // Full booking system — only if those columns exist (keyed on booking_mode,
    // which does NOT exist here, so this block stays disabled).
    const hasBookingColumns = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'booking_mode' LIMIT 1`
    ).then(r => r.rows.length > 0)

    if (hasBookingColumns) {
      // NOTE: booking_enabled is handled above (it exists on its own); do NOT
      // write it here too or the SET clause would list it twice.
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

      // Auto-sync: when a booking URL is set, auto-enable reservation relevance
      const newBookingUrl = input.bookingUrl !== undefined ? nullify(input.bookingUrl) : null
      if (newBookingUrl && /^https?:\/\/.+/i.test(newBookingUrl)) {
        if (input.reservationRelevant === undefined) addField('reservation_relevant', true)
        if (input.bookingMode === undefined) {
          setClauses.push(`booking_mode = 'direct_website'::booking_mode`)
        }
      }
    }

    // NOW visibility fields
    if (input.nowEnabled   !== undefined) addField('now_enabled',  input.nowEnabled)
    if (input.nowPriority  !== undefined) addField('now_priority', input.nowPriority)
    if (input.nowFeatured  !== undefined) addField('now_featured', input.nowFeatured)
    if (input.nowStartAt   !== undefined) addField('now_start_at', input.nowStartAt)
    if (input.nowEndAt     !== undefined) addField('now_end_at',   input.nowEndAt)

    // Handle status + published_at together
    if (input.status !== undefined) {
      addField('status', input.status)
      if (input.status === 'published') {
        setClauses.push(`published_at = COALESCE(published_at, now())`)
      }
    }

    // Always bump updated_at
    setClauses.push(`updated_at = now()`)

    // more than just updated_at, or an hours-only edit: opening_hours has no
    // content_version trigger, so touching places is what tells the app to
    // drop its cached place detail.
    if (setClauses.length > 1 || input.openingHours !== undefined) {
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
      input.insiderTip       !== undefined

    let autoTranslation: AutoTranslationOutcome | undefined
    if (hasTranslationUpdate) {
      // Portuguese is the canonical editorial source. The dashboard place
      // form always submits PT — these fields are merged on top of the
      // existing PT row (so unspecified fields stay as they were) and EN/ES
      // are auto-translated from the resulting PT canonical state.
      // Manual EN/ES overrides are preserved by `upsertPlaceTranslation`'s
      // override guard.
      const { rows: currentPt } = await client.query<{
        name: string | null; short_description: string | null; full_description: string | null
        goldenbook_note: string | null; insider_tip: string | null
      }>(
        `SELECT name, short_description, full_description, goldenbook_note, insider_tip
         FROM place_translations WHERE place_id = $1 AND locale = 'pt' LIMIT 1`,
        [placeId],
      )
      const ptPrev = currentPt[0] ?? {}
      const portugueseFields: PlaceTranslationFields = {
        name: input.name ?? ptPrev.name ?? existing.name,
        short_description: input.shortDescription !== undefined ? nullify(input.shortDescription) : (ptPrev.short_description ?? null),
        full_description: input.fullDescription !== undefined ? nullify(input.fullDescription) : (ptPrev.full_description ?? null),
        goldenbook_note: input.goldenbookNote !== undefined ? nullify(input.goldenbookNote) : (ptPrev.goldenbook_note ?? null),
        insider_tip: input.insiderTip !== undefined ? nullify(input.insiderTip) : (ptPrev.insider_tip ?? null),
      }

      await upsertPlaceTranslation(client, placeId, 'pt', portugueseFields)
      autoTranslation = await upsertAutoTranslationsFromPortuguese(client, placeId, portugueseFields)
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

    // Sync NOW context tags if provided
    if (input.nowTagSlugs !== undefined) {
      // Delete existing tags and re-insert
      await client.query(`DELETE FROM place_now_tags WHERE place_id = $1`, [placeId])
      if (input.nowTagSlugs.length > 0) {
        for (const tagSlug of input.nowTagSlugs) {
          await client.query(
            `INSERT INTO place_now_tags (place_id, tag_id)
             SELECT $1, id FROM now_context_tags WHERE slug = $2
             ON CONFLICT DO NOTHING`,
            [placeId, tagSlug],
          )
        }
      }
    }

    // Sync NOW time windows if provided
    if (input.nowTimeWindows !== undefined) {
      // Normalise legacy aliases ('night' → 'late_evening') and de-duplicate
      // before writing, so the table only ever holds values the NOW candidate
      // query can actually match. See admin-places.dto.ts:NOW_TIME_WINDOWS.
      const timeWindows = normalizeNowTimeWindows(input.nowTimeWindows)
      await client.query(`DELETE FROM place_now_time_windows WHERE place_id = $1`, [placeId])
      if (timeWindows.length > 0) {
        for (const tw of timeWindows) {
          await client.query(
            `INSERT INTO place_now_time_windows (place_id, time_window) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [placeId, tw],
          )
        }
      }
    }

    // Replace the weekly opening hours if provided. Same transaction, so the
    // week is never half-written; auto-classify below re-derives the context
    // windows from the new hours once this commits.
    if (input.openingHours !== undefined) {
      await replaceOpeningHours(client, placeId, input.openingHours)
    }

    await client.query('COMMIT')

    // Auto-classify (fire-and-forget — don't block response)
    autoClassifyPlace(placeId).catch((err) => {
      console.error(`[auto-classify] Failed for place ${placeId}:`, err)
    })

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
      ...(autoTranslation ? { autoTranslation } : {}),
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── Delete place ─────────────────────────────────────────────────────────────

export type DeletedStorageObject = StorageObjectRef

/**
 * Delete a place and the media_assets only it used.
 *
 * Deleting `places` cascades to `place_images`, but `media_assets` rows (and
 * the Storage objects behind them) used to stay behind forever. Within the
 * same transaction we now drop every asset of this place that nothing else
 * references (another place's images, a destination hero, a route cover, a
 * user avatar) and return their locations so the caller can remove the bytes
 * from Storage once the delete has committed.
 *
 * An object is only returned when no remaining media_assets row points at the
 * same key, comparing paths with the legacy '<bucket>/' prefix stripped (the
 * same object can be registered under both spellings). The reference check
 * lives in `deleteAssetsIfUnreferenced`, shared with the single-image delete.
 */
export async function deletePlace(placeId: string): Promise<DeletedStorageObject[]> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const { rows: assets } = await client.query<{ asset_id: string }>(
      `SELECT DISTINCT asset_id FROM place_images WHERE place_id = $1`,
      [placeId],
    )

    const { rowCount } = await client.query('DELETE FROM places WHERE id = $1', [placeId])
    if (!rowCount) throw new NotFoundError('Place')

    const removed = await deleteAssetsIfUnreferenced(client, assets.map((a) => a.asset_id))

    await client.query('COMMIT')
    return removed
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
