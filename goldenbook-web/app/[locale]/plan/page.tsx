// Itinerario compartido.
//
// La app arma el plan a partir de dónde está el usuario y qué hora es, así que
// el plan en sí es efímero: no vive en ninguna tabla. Para compartirlo no hace
// falta guardarlo, basta con llevar los slugs en la URL:
//
//   /es/plan?s=jeronimos,jardin-botanico,pasteis-de-belem
//
// Sin almacenamiento, sin identificadores que caduquen y sin trabajo de
// backend. Esta página vuelve a pedir cada ficha a la API pública, así que los
// nombres, textos e imágenes que ve quien recibe el enlace están al día aunque
// el plan se compartiera hace semanas.
//
// Lo que deliberadamente NO se comparte son las distancias ni los minutos a
// pie: se calcularon desde donde estaba quien lo envió, y para quien lo abre
// serían falsos. Se comparte la secuencia, que es la parte que se sostiene.

import { setRequestLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import Image from 'next/image'

const locales = ['en', 'pt', 'es']

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  'https://goldenbook-production.up.railway.app/api/v1'

const STORAGE_BASE =
  process.env.NEXT_PUBLIC_STORAGE_URL ??
  'https://ltdhyshuxcnrjnbxkgzp.supabase.co/storage/v1/object/public'

interface PlaceDTO {
  id: string
  slug: string
  name: string
  shortDescription: string | null
  city?: { name?: string | null } | null
  heroImage?: { bucket: string | null; path: string | null } | null
}

const COPY = {
  es: {
    eyebrow: 'Itinerario compartido',
    title: 'Un plan para hoy',
    intro: 'Tres paradas seleccionadas, en orden, para recorrer a pie.',
    stop: 'Parada',
    cta: 'Descubre Goldenbook Go',
    ctaNote: 'Planes como este, hechos a partir de dónde estás y de la hora que es.',
    empty: 'Este enlace no lleva ningún itinerario.',
  },
  en: {
    eyebrow: 'Shared itinerary',
    title: 'A plan for today',
    intro: 'Three chosen stops, in order, within walking distance.',
    stop: 'Stop',
    cta: 'Discover Goldenbook Go',
    ctaNote: 'Plans like this one, built from where you are and what time it is.',
    empty: 'This link does not carry an itinerary.',
  },
  pt: {
    eyebrow: 'Itinerário partilhado',
    title: 'Um plano para hoje',
    intro: 'Três paragens escolhidas, por ordem, para percorrer a pé.',
    stop: 'Paragem',
    cta: 'Descobre o Goldenbook Go',
    ctaNote: 'Planos como este, feitos a partir de onde estás e da hora que é.',
    empty: 'Esta ligação não traz nenhum itinerário.',
  },
} as const

function copyFor(locale: string) {
  return COPY[locale as keyof typeof COPY] ?? COPY.en
}

function parseSlugs(raw: string | string[] | undefined): string[] {
  if (!raw) return []
  const value = Array.isArray(raw) ? raw[0] : raw
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]{1,120}$/i.test(s))
    .slice(0, 5)
}

async function fetchPlace(slug: string, locale: string): Promise<PlaceDTO | null> {
  try {
    const res = await fetch(`${API_BASE}/places/${slug}?locale=${locale}`, {
      // El contenido editorial cambia poco; una hora evita machacar la API si
      // un enlace se comparte en un grupo grande.
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    return (await res.json()) as PlaceDTO
  } catch {
    return null
  }
}

function imageUrl(place: PlaceDTO): string | null {
  const bucket = place.heroImage?.bucket
  const path = place.heroImage?.path
  if (!bucket || !path) return null
  return `${STORAGE_BASE}/${bucket}/${path}`
}

export async function generateMetadata({
  params: { locale },
  searchParams,
}: {
  params: { locale: string }
  searchParams: { s?: string }
}): Promise<Metadata> {
  const t = copyFor(locale)
  const slugs = parseSlugs(searchParams.s)
  const places = (await Promise.all(slugs.map((s) => fetchPlace(s, locale)))).filter(
    (p): p is PlaceDTO => p !== null,
  )
  const names = places.map((p) => p.name).join(' · ')
  const hero = places.map(imageUrl).find(Boolean) ?? undefined

  return {
    title: `${t.title} · Goldenbook Go`,
    description: names || t.intro,
    openGraph: {
      title: `${t.title} · Goldenbook Go`,
      description: names || t.intro,
      images: hero ? [{ url: hero }] : undefined,
    },
  }
}

export default async function SharedPlanPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string }
  searchParams: { s?: string }
}) {
  setRequestLocale(locale)
  const t = copyFor(locale)

  const slugs = parseSlugs(searchParams.s)
  const places = (await Promise.all(slugs.map((s) => fetchPlace(s, locale)))).filter(
    (p): p is PlaceDTO => p !== null,
  )

  return (
    <div className="bg-ivory min-h-screen">
      <div className="section-padding pt-40 pb-32 max-w-2xl">
        <p className="eyebrow mb-6">{t.eyebrow}</p>
        <h1
          className="text-[40px] md:text-[52px] font-medium leading-tight tracking-tight text-ink mb-6"
          style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}
        >
          {t.title}
        </h1>
        <p className="font-sans text-body text-ink-muted">{t.intro}</p>

        <div className="h-px bg-ink/8 my-10" />

        {places.length === 0 ? (
          <p className="font-sans text-body text-ink-muted">{t.empty}</p>
        ) : (
          <ol className="space-y-10">
            {places.map((place, i) => (
              <li key={place.slug} className="flex gap-6">
                {/* El número es lo que convierte una lista en un recorrido */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <span
                    className="w-9 h-9 rounded-full border border-primary flex items-center justify-center font-sans text-[13px] font-semibold text-primary"
                    aria-label={`${t.stop} ${i + 1}`}
                  >
                    {i + 1}
                  </span>
                  {i < places.length - 1 && (
                    <span className="flex-1 w-px bg-primary/25 mt-3" aria-hidden />
                  )}
                </div>

                <div className="flex-1 pb-2">
                  {imageUrl(place) && (
                    <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden mb-4">
                      <Image
                        src={imageUrl(place)!}
                        alt={place.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 640px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <h2
                    className="text-[24px] leading-snug text-ink mb-2"
                    style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}
                  >
                    {place.name}
                  </h2>
                  {place.shortDescription && (
                    <p className="font-sans text-body text-ink-muted leading-relaxed">
                      {place.shortDescription}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="h-px bg-ink/8 my-12" />

        <div>
          <p className="font-sans text-body text-ink-muted mb-5">{t.ctaNote}</p>
          <a
            href="https://apps.apple.com/app/id6748363796"
            className="inline-flex items-center justify-center rounded-lg bg-navy px-7 py-3.5 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-primary transition-opacity hover:opacity-90"
          >
            {t.cta}
          </a>
        </div>
      </div>
    </div>
  )
}
