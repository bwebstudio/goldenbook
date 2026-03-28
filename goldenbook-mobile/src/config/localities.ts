// ─── Goldenbook Locality Config ───────────────────────────────────────────────
//
// Single source of truth for all supported localities.
// Add new localities here — no changes needed elsewhere in the app.
//
// Domain term: "locality" for internal state/config.
// User-facing copy: "destination", "location" as fits context.

/** Bilingual string keyed by app locale. Always has English; other locales optional. */
export type LocalizedString = {
  en: string;
  'pt-PT'?: string;
};

export interface Locality {
  /** Stable ID — matches backend city slug. */
  id: string;
  slug: string;
  name: string;
  country: string;
  /** Short editorial tagline shown in selection cards. Bilingual. */
  tagline: LocalizedString;
  /** Default map centre for this locality. */
  coordinates: { latitude: number; longitude: number };
  /** Default zoom deltas for the map view. */
  mapDelta: { latitudeDelta: number; longitudeDelta: number };
  featured: boolean;
}

export const LOCALITIES: Locality[] = [
  {
    id: 'lisboa',
    slug: 'lisboa',
    name: 'Lisboa',
    country: 'Portugal',
    tagline: {
      en: 'The golden city on the Tagus',
      'pt-PT': 'A cidade dourada do Tejo',
    },
    coordinates: { latitude: 38.7169, longitude: -9.1399 },
    mapDelta: { latitudeDelta: 0.08, longitudeDelta: 0.08 },
    featured: true,
  },
  {
    id: 'porto',
    slug: 'porto',
    name: 'Porto',
    country: 'Portugal',
    tagline: {
      en: 'Riverside charm and Douro gold',
      'pt-PT': 'Charme ribeirinho e ouro do Douro',
    },
    coordinates: { latitude: 41.1496, longitude: -8.6109 },
    mapDelta: { latitudeDelta: 0.06, longitudeDelta: 0.06 },
    featured: true,
  },
  {
    id: 'algarve',
    slug: 'algarve',
    name: 'Algarve',
    country: 'Portugal',
    tagline: {
      en: 'Where the Atlantic meets golden cliffs',
      'pt-PT': 'Onde o Atlântico encontra as falésias douradas',
    },
    coordinates: { latitude: 37.0179, longitude: -7.9307 },
    mapDelta: { latitudeDelta: 0.5, longitudeDelta: 0.5 },
    featured: true,
  },
  {
    id: 'madeira',
    slug: 'madeira',
    name: 'Madeira',
    country: 'Portugal',
    tagline: {
      en: 'Eternal spring in the Atlantic',
      'pt-PT': 'Primavera eterna no Atlântico',
    },
    coordinates: { latitude: 32.7607, longitude: -16.9595 },
    mapDelta: { latitudeDelta: 0.5, longitudeDelta: 0.5 },
    featured: true,
  },
];

/** O(1) lookup by slug. */
export const LOCALITY_BY_SLUG: Readonly<Record<string, Locality>> =
  Object.fromEntries(LOCALITIES.map((l) => [l.slug, l]));

/** Returns undefined if slug is not found — callers must handle gracefully. */
export function getLocalityBySlug(slug: string): Locality | undefined {
  return LOCALITY_BY_SLUG[slug];
}

/** Slug used when no persisted selection exists yet. */
export const DEFAULT_LOCALITY_SLUG = 'lisboa';
