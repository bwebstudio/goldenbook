import { createHash } from 'crypto'
import { db } from '../../db/postgres'

const DEEPL_API_KEY = process.env.DEEPL_API_KEY ?? ''
const DEEPL_URL = 'https://api-free.deepl.com/v2/translate'

function hashText(text: string): string {
  return createHash('sha256').update(text.trim()).digest('hex')
}

/**
 * Translate a single text from PT to EN.
 * Uses cache first, then DeepL API, then stores in cache.
 * Returns original text if translation fails or API key is missing.
 */
export async function translatePtToEn(text: string): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) return ''

  // 1. Check cache
  const hash = hashText(trimmed)
  try {
    const { rows } = await db.query<{ translated_text: string }>(
      'SELECT translated_text FROM translation_cache WHERE source_hash = $1 LIMIT 1',
      [hash],
    )
    if (rows[0]) {
      console.log('[translation] PT→EN cache hit')
      return rows[0].translated_text
    }
  } catch {
    // Cache table may not exist yet — proceed to API
  }

  // 2. Call DeepL
  if (!DEEPL_API_KEY) {
    console.log('[translation] PT→EN skipped (no API key)')
    return trimmed
  }

  try {
    console.log('[translation] PT→EN DeepL call (new text)')

    const response = await fetch(DEEPL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        auth_key: DEEPL_API_KEY,
        text: trimmed,
        source_lang: 'PT',
        target_lang: 'EN',
      }),
    })

    if (!response.ok) {
      console.error('[translation] DeepL error:', response.status)
      return trimmed
    }

    const data = await response.json() as { translations?: { text: string }[] }
    const translated = data.translations?.[0]?.text ?? trimmed

    // 3. Store in cache
    try {
      await db.query(
        `INSERT INTO translation_cache (source_hash, source_text, source_lang, target_lang, translated_text)
         VALUES ($1, $2, 'PT', 'EN', $3)
         ON CONFLICT (source_hash) DO UPDATE SET translated_text = $3`,
        [hash, trimmed, translated],
      )
    } catch {
      // Cache write failure is non-fatal
    }

    return translated
  } catch (err) {
    console.error('[translation] DeepL call failed:', err)
    return trimmed
  }
}

/**
 * Translate multiple fields at once (batched for efficiency).
 * Only translates non-empty fields.
 * Returns a map of field → translated text.
 */
export async function translateFields(
  fields: Record<string, string | null | undefined>,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  const toTranslate: [string, string][] = []

  for (const [key, value] of Object.entries(fields)) {
    if (value && value.trim()) {
      toTranslate.push([key, value.trim()])
    }
  }

  // Translate each field (sequential to respect rate limits)
  for (const [key, text] of toTranslate) {
    result[key] = await translatePtToEn(text)
  }

  return result
}
