import { createHash } from 'crypto'
import { db } from '../../db/postgres'

const DEEPL_API_KEY = process.env.DEEPL_API_KEY ?? ''
const DEFAULT_DEEPL_URLS = [
  process.env.DEEPL_URL,
  'https://api-free.deepl.com/v2/translate',
  'https://api.deepl.com/v2/translate',
].filter((v): v is string => !!v)

function uniqueUrls(urls: string[]): string[] {
  return [...new Set(urls)]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type DeepLSource = 'EN' | 'PT' | 'ES'
type DeepLTarget = 'EN' | 'PT-PT' | 'ES'

function normalizeLocale(locale: string): 'en' | 'pt' | 'es' {
  const family = locale.trim().toLowerCase().replace('_', '-').split('-')[0]
  if (family === 'pt') return 'pt'
  if (family === 'es') return 'es'
  return 'en'
}

function toDeepLSource(locale: string): DeepLSource {
  const normalized = normalizeLocale(locale)
  if (normalized === 'pt') return 'PT'
  if (normalized === 'es') return 'ES'
  return 'EN'
}

function toDeepLTarget(locale: string): DeepLTarget {
  const normalized = normalizeLocale(locale)
  if (normalized === 'pt') return 'PT-PT'
  if (normalized === 'es') return 'ES'
  return 'EN'
}

function hashTextForPair(text: string, sourceLang: DeepLSource, targetLang: DeepLTarget): string {
  const payload = `${sourceLang}:${targetLang}:${text.trim()}`
  return createHash('sha256').update(payload).digest('hex')
}

async function getCachedTranslation(hash: string): Promise<string | null> {
  try {
    const { rows } = await db.query<{ translated_text: string }>(
      'SELECT translated_text FROM translation_cache WHERE source_hash = $1 LIMIT 1',
      [hash],
    )
    return rows[0]?.translated_text ?? null
  } catch {
    return null
  }
}

async function cacheTranslation(
  hash: string,
  sourceText: string,
  sourceLang: DeepLSource,
  targetLang: DeepLTarget,
  translatedText: string,
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO translation_cache (source_hash, source_text, source_lang, target_lang, translated_text)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (source_hash) DO UPDATE SET translated_text = EXCLUDED.translated_text`,
      [hash, sourceText, sourceLang, targetLang, translatedText],
    )
  } catch {
    // Cache write failures are non-fatal
  }
}

/**
 * Translate a single text to the requested target locale using DeepL.
 * Throws when DeepL cannot authorize or return a valid translation.
 */
export async function translateText(
  text: string,
  targetLocale: string,
  sourceLocale = 'en',
): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) return ''

  const sourceLang = toDeepLSource(sourceLocale)
  const targetLang = toDeepLTarget(targetLocale)
  if ((sourceLang === 'EN' && targetLang === 'EN')
    || (sourceLang === 'PT' && targetLang === 'PT-PT')
    || (sourceLang === 'ES' && targetLang === 'ES')) {
    return trimmed
  }

  const hash = hashTextForPair(trimmed, sourceLang, targetLang)
  const cached = await getCachedTranslation(hash)
  if (cached) return cached

  if (!DEEPL_API_KEY) {
    throw new Error('DEEPL_API_KEY_MISSING')
  }

  const urls = uniqueUrls(DEFAULT_DEEPL_URLS)
  const maxAttemptsPerUrl = 4

  for (const url of urls) {
    for (let attempt = 1; attempt <= maxAttemptsPerUrl; attempt++) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          auth_key: DEEPL_API_KEY,
          text: trimmed,
          source_lang: sourceLang,
          target_lang: targetLang,
        }),
      })

      if (response.ok) {
        const data = await response.json() as { translations?: { text: string }[] }
        const translated = data.translations?.[0]?.text?.trim()
        if (!translated) throw new Error('DEEPL_EMPTY_RESPONSE')
        await cacheTranslation(hash, trimmed, sourceLang, targetLang, translated)
        return translated
      }

      if (response.status === 403) {
        // Wrong DeepL endpoint for the provided key type; try next URL.
        break
      }

      if (response.status === 429 && attempt < maxAttemptsPerUrl) {
        await sleep(1000 * attempt)
        continue
      }

      throw new Error(`DEEPL_REQUEST_FAILED_${response.status}`)
    }
  }

  throw new Error('DEEPL_ENDPOINT_NOT_AUTHORIZED')
}

/**
 * Backward-compatible helper used in older paths.
 */
export async function translatePtToEn(text: string): Promise<string> {
  return translateText(text, 'en', 'pt')
}

/**
 * Translate multiple fields at once.
 * By default this preserves old behavior (PT -> EN) for compatibility.
 */
export async function translateFields(
  fields: Record<string, string | null | undefined>,
  targetLocale = 'en',
  sourceLocale = 'pt',
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (!value || !value.trim()) continue
    result[key] = await translateText(value, targetLocale, sourceLocale)
  }
  return result
}

export interface PlaceTranslationFields {
  name: string
  short_description: string | null
  full_description: string | null
  goldenbook_note: string | null
  why_we_love_it: string | null
  insider_tip: string | null
}

export async function translatePlaceFields(
  source: PlaceTranslationFields,
  targetLocale: string,
  sourceLocale = 'en',
): Promise<PlaceTranslationFields> {
  const translated = await translateFields(
    source as unknown as Record<string, string | null | undefined>,
    targetLocale,
    sourceLocale,
  )
  return {
    name: translated.name ?? source.name,
    short_description: source.short_description ? (translated.short_description ?? source.short_description) : null,
    full_description: source.full_description ? (translated.full_description ?? source.full_description) : null,
    goldenbook_note: source.goldenbook_note ? (translated.goldenbook_note ?? source.goldenbook_note) : null,
    why_we_love_it: source.why_we_love_it ? (translated.why_we_love_it ?? source.why_we_love_it) : null,
    insider_tip: source.insider_tip ? (translated.insider_tip ?? source.insider_tip) : null,
  }
}
