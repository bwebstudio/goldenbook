#!/usr/bin/env npx tsx

import { db } from '../api/src/db/postgres'
import { translatePlaceFields, type PlaceTranslationFields } from '../api/src/lib/translation/deepl'

type TargetLocale = 'pt' | 'es'

interface PlaceSourceRow {
  id: string
  name: string | null
  short_description: string | null
  full_description: string | null
  goldenbook_note: string | null
  insider_tip: string | null
}

const TARGET_LOCALES: TargetLocale[] = ['pt', 'es']

async function upsertPlaceTranslation(
  placeId: string,
  locale: 'en' | TargetLocale,
  fields: PlaceTranslationFields,
): Promise<void> {
  await db.query(
    `
    INSERT INTO place_translations (
      place_id, locale, name, short_description, full_description, goldenbook_note, insider_tip
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (place_id, locale) DO UPDATE SET
      name = EXCLUDED.name,
      short_description = EXCLUDED.short_description,
      full_description = EXCLUDED.full_description,
      goldenbook_note = EXCLUDED.goldenbook_note,
      insider_tip = EXCLUDED.insider_tip,
      updated_at = now()
    `,
    [
      placeId,
      locale,
      fields.name,
      fields.short_description,
      fields.full_description,
      fields.goldenbook_note,
      fields.insider_tip,
    ],
  )
}

async function loadSourcePlaces(): Promise<PlaceSourceRow[]> {
  const { rows } = await db.query<PlaceSourceRow>(
    `
    SELECT
      p.id,
      COALESCE(en.name, p.name)                                 AS name,
      COALESCE(en.short_description, p.short_description)       AS short_description,
      COALESCE(en.full_description, p.full_description)         AS full_description,
      en.goldenbook_note                                        AS goldenbook_note,
      en.insider_tip                                            AS insider_tip
    FROM places p
    LEFT JOIN place_translations en
           ON en.place_id = p.id AND en.locale = 'en'
    `,
  )
  return rows
}

async function main() {
  const places = await loadSourcePlaces()

  let translated = 0
  let failed = 0
  let skipped = 0

  for (const place of places) {
    const source: PlaceTranslationFields = {
      name: place.name?.trim() ?? '',
      short_description: place.short_description,
      full_description: place.full_description,
      goldenbook_note: place.goldenbook_note,
      insider_tip: place.insider_tip,
    }

    if (!source.name) {
      skipped += 1
      continue
    }

    try {
      await upsertPlaceTranslation(place.id, 'en', source)

      for (const locale of TARGET_LOCALES) {
        const localized = await translatePlaceFields(source, locale, 'en')
        await upsertPlaceTranslation(place.id, locale, localized)
      }

      translated += 1
      if (translated % 20 === 0) {
        console.log(`Processed ${translated}/${places.length}`)
      }
    } catch (error) {
      failed += 1
      console.error(`Failed place ${place.id}:`, error)
    }
  }

  console.log(`Processed: ${places.length}`)
  console.log(`Translated: ${translated}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Failed: ${failed}`)

  await db.end()

  if (failed > 0) process.exit(1)
}

main().catch(async (error) => {
  console.error(error)
  await db.end()
  process.exit(1)
})
