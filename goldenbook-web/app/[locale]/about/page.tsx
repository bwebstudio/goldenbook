import { setRequestLocale } from 'next-intl/server'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

const locales = ['en', 'pt', 'es']

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'about' })
  return { title: `${t('title')} — Goldenbook` }
}

export default async function AboutPage({
  params: { locale },
}: {
  params: { locale: string }
}) {
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'about' })

  return (
    <div className="bg-ivory min-h-screen">
      <div className="section-padding pt-40 pb-32 max-w-2xl">
        <p className="eyebrow mb-6">Goldenbook</p>
        <h1
          className="text-[40px] md:text-[52px] font-medium leading-tight tracking-tight text-ink mb-6"
          style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}
        >
          {t('title')}
        </h1>
        <p className="font-sans text-body text-ink-muted mb-4">{t('subtitle')}</p>
        <div className="h-px bg-ink/8 my-10" />
        <div className="space-y-6">
          <p className="font-sans text-body text-ink-muted leading-relaxed">{t('body1')}</p>
          <p className="font-sans text-body text-ink-muted leading-relaxed">{t('body2')}</p>
          <p className="font-sans text-body text-ink-muted leading-relaxed">{t('body3')}</p>
        </div>
      </div>
    </div>
  )
}
