// Unified admin place save — writes canonical fields plus translations for
// EN, ES, PT in a single database transaction. Replaces the old flow where
// PT was the only editable locale and ES/EN were derived.
//
// Translation rules (strict):
//   - Each (place_id, locale) row is first-class and editable.
//   - `source` records provenance: 'manual' (edited by human), 'deepl' (AI
//     suggestion accepted verbatim), 'import' (bulk import).
//   - `is_override = true` means the row is a human-curated value; it must
//     never be overwritten by automatic translation jobs.
//   - DeepL is ONLY invoked from POST .../translations/suggest. This write
//     path never calls DeepL.
//
// Content version: the per-statement trigger on place_translations +
// places bumps `content_version.global` once per statement; a single
// unified save therefore produces a deterministic bump that mobile clients
// observe on next foreground.

import { db } from '../../../db/postgres'
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError'
import { z } from 'zod'

// ─── Input schema ──────────────────────────────────────────────────────────

export const SUPPORTED_LOCALES = ['en', 'es', 'pt'] as const
export type Locale = typeof SUPPORTED_LOCALES[number]

const translationSchema = z.object({
  name:             z.string().min(1).optional(),
  shortDescription: z.string().nullable().optional(),
  fullDescription:  z.string().nullable().optional(),
  goldenbookNote:   z.string().nullable().optional(),
  insiderTip:       z.string().nullable().optional(),
  isOverride:       z.boolean().optional(),
  source:           z.enum(['manual', 'deepl', 'import']).optional(),
  translatedFrom:   z.enum(['en', 'es', 'pt']).nullable().optional(),
}).strict()

const canonicalSchema = z.object({
  slug:              z.string().min(1).optional(),
  citySlug:          z.string().min(1).optional(),
  citySlugs:         z.array(z.string().min(1)).optional(),
  categorySlug:      z.string().min(1).optional(),
  subcategorySlug:   z.string().optional(),
  addressLine:       z.string().optional(),
  websiteUrl:        z.string().optional(),
  phone:             z.string().optional(),
  email:             z.string().optional(),
  bookingUrl:        z.string().optional(),
  status:            z.enum(['draft', 'published', 'archived']).optional(),
  featured:          z.boolean().optional(),
  placeType:         z.string().optional(),
  originalLocale:    z.enum(['en', 'es', 'pt']).optional(),
  // booking + NOW fields accepted for parity with legacy PUT
  bookingEnabled:    z.boolean().optional(),
  bookingMode:       z.string().optional(),
  bookingLabel:      z.string().optional(),
  bookingNotes:      z.string().optional(),
}).strict()

export const updatePlaceUnifiedSchema = z.object({
  canonical:    canonicalSchema.optional(),
  translations: z.object({
    en: translationSchema.optional(),
    es: translationSchema.optional(),
    pt: translationSchema.optional(),
  }).optional(),
}).strict()

export type UpdatePlaceUnifiedInput = z.infer<typeof updatePlaceUnifiedSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────

type Client = { query: typeof db.query }

function nullify(v: string | null | undefined): string | null {
  return v === undefined || v === '' ? null : v
}

async function upsertTranslation(
  client: Client,
  placeId: string,
  locale: Locale,
  t: z.infer<typeof translationSchema>,
  updatedBy: string | null,
) {
  // Default to manual source + override=true for unified-endpoint writes —
  // editors are explicitly saving this locale, so it is a human-curated value.
  const source         = t.source ?? 'manual'
  const isOverride     = t.isOverride ?? (source === 'manual')
  const translatedFrom = t.translatedFrom ?? null

  await client.query(
    `
    INSERT INTO place_translations (
      place_id, locale, name, short_description, full_description,
      goldenbook_note, insider_tip,
      source, is_override, translated_from, updated_by
    ) VALUES (
      $1, $2, COALESCE($3, ''), $4, $5, $6, $7,
      $8, $9, $10, $11
    )
    ON CONFLICT (place_id, locale) DO UPDATE SET
      name              = COALESCE(EXCLUDED.name, place_translations.name),
      short_description = COALESCE($4, place_translations.short_description),
      full_description  = COALESCE($5, place_translations.full_description),
      goldenbook_note   = COALESCE($6, place_translations.goldenbook_note),
      insider_tip       = COALESCE($7, place_translations.insider_tip),
      source            = EXCLUDED.source,
      is_override       = EXCLUDED.is_override,
      translated_from   = EXCLUDED.translated_from,
      updated_by        = EXCLUDED.updated_by,
      updated_at        = now()
    `,
    [
      placeId, locale,
      t.name ?? null,
      nullify(t.shortDescription ?? null),
      nullify(t.fullDescription ?? null),
      nullify(t.goldenbookNote ?? null),
      nullify(t.insiderTip ?? null),
      source, isOverride, translatedFrom, updatedBy,
    ],
  )
}

async function applyCanonical(
  client: Client,
  placeId: string,
  canonical: z.infer<typeof canonicalSchema>,
) {
  const sets: string[] = []
  const params: unknown[] = []
  let i = 1
  const add = (col: string, val: unknown) => {
    sets.push(`${col} = $${i++}`)
    params.push(val)
  }

  if (canonical.slug            !== undefined) add('slug',            canonical.slug)
  if (canonical.addressLine     !== undefined) add('address_line',    nullify(canonical.addressLine))
  if (canonical.websiteUrl      !== undefined) add('website_url',     nullify(canonical.websiteUrl))
  if (canonical.phone           !== undefined) add('phone',           nullify(canonical.phone))
  if (canonical.email           !== undefined) add('email',           nullify(canonical.email))
  if (canonical.bookingUrl      !== undefined) add('booking_url',     nullify(canonical.bookingUrl))
  if (canonical.status          !== undefined) add('status',          canonical.status)
  if (canonical.featured        !== undefined) add('featured',        canonical.featured)
  if (canonical.placeType       !== undefined) add('place_type',      canonical.placeType)
  if (canonical.originalLocale  !== undefined) add('original_locale', canonical.originalLocale)

  if (canonical.citySlug !== undefined) {
    const { rows: dest } = await client.query<{ id: string }>(
      `SELECT id FROM destinations WHERE slug = $1 AND is_active = true LIMIT 1`,
      [canonical.citySlug],
    )
    if (!dest[0]) throw new ValidationError(`City not found: ${canonical.citySlug}`)
    add('destination_id', dest[0].id)
  }

  if (sets.length === 0) return
  sets.push('updated_at = now()')
  params.push(placeId)
  await client.query(`UPDATE places SET ${sets.join(', ')} WHERE id = $${i}`, params)
}

// ─── Main entry point ────────────────────────────────────────────────────

export async function updatePlaceUnified(
  placeId: string,
  input: UpdatePlaceUnifiedInput,
  updatedBy: string | null,
): Promise<{ id: string; contentVersion: number }> {
  const { rows: found } = await db.query<{ id: string }>(
    `SELECT id FROM places WHERE id = $1 LIMIT 1`, [placeId],
  )
  if (!found[0]) throw new NotFoundError('Place')

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    if (input.canonical) {
      await applyCanonical(client, placeId, input.canonical)
    }

    if (input.translations) {
      for (const locale of SUPPORTED_LOCALES) {
        const t = input.translations[locale]
        if (!t) continue
        await upsertTranslation(client, placeId, locale, t, updatedBy)
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  // Read the bumped version so the response tells the dashboard when to
  // consider its local caches stale.
  const { rows } = await db.query<{ version: string }>(
    `SELECT version::text FROM content_version WHERE scope = 'global' LIMIT 1`,
  )
  return { id: placeId, contentVersion: rows[0] ? Number(rows[0].version) : 0 }
}

// ─── Read: all three locales for the dashboard editor ────────────────────

export async function getPlaceTranslationsForEditor(placeId: string) {
  const { rows } = await db.query<{
    locale: Locale
    name: string
    short_description: string | null
    full_description: string | null
    goldenbook_note: string | null
    insider_tip: string | null
    source: string
    is_override: boolean
    translated_from: string | null
    updated_at: string
    updated_by: string | null
  }>(
    `SELECT locale, name, short_description, full_description,
            goldenbook_note, insider_tip,
            source, is_override, translated_from, updated_at, updated_by
       FROM place_translations
      WHERE place_id = $1 AND locale IN ('en','es','pt')
      ORDER BY locale`,
    [placeId],
  )

  const out: Record<Locale, typeof rows[number] | null> = { en: null, es: null, pt: null }
  for (const r of rows) out[r.locale] = r
  return out
}
