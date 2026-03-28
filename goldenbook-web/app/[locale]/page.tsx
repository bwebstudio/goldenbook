import { setRequestLocale } from 'next-intl/server'
import { fetchHomepage } from '@/lib/api'

// Revalidate every 5 minutes (ISR)
export const revalidate = 300
import { Hero } from '@/components/sections/Hero'
import { GoldenPicks } from '@/components/sections/GoldenPicks'
import { WhatToExperience } from '@/components/sections/WhatToExperience'
import { GoldenRoutes } from '@/components/sections/GoldenRoutes'
import { Categories } from '@/components/sections/Categories'
import { AppPreview } from '@/components/sections/AppPreview'
import { FinalCTA } from '@/components/sections/FinalCTA'

const locales = ['en', 'pt', 'es']

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

// Default city — extend this to be dynamic (geo-IP, user preference, etc.) later
const DEFAULT_CITY = 'lisboa'

export default async function HomePage({
  params: { locale },
}: {
  params: { locale: string }
}) {
  setRequestLocale(locale)

  // Fetch homepage data server-side with ISR (5 min revalidate)
  const data = await fetchHomepage({ locale, city: DEFAULT_CITY })

  return (
    <>
      <Hero
        imageUrl={data?.hero.imageUrl ?? null}
        cityName={data?.hero.cityName ?? null}
      />

      {data?.goldenPicks && data.goldenPicks.length > 0 && (
        <GoldenPicks picks={data.goldenPicks} />
      )}

      {data?.experienceNow && (
        <WhatToExperience slots={data.experienceNow} />
      )}

      {data?.routes && data.routes.length > 0 && (
        <GoldenRoutes routes={data.routes} />
      )}

      <Categories categories={data?.categories ?? []} />

      <AppPreview />

      <FinalCTA />
    </>
  )
}
