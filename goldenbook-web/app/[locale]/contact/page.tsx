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
  const t = await getTranslations({ locale, namespace: 'contact' })
  return { title: `${t('title')} — Goldenbook` }
}

export default async function ContactPage({
  params: { locale },
}: {
  params: { locale: string }
}) {
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'contact' })

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

        {/* Email */}
        <div className="mb-10">
          <p className="font-sans text-caption text-ink/40 uppercase tracking-widest mb-3">
            {t('labelEmail')}
          </p>
          <a
            href="mailto:mail@goldenbook.pt"
            className="font-sans text-body text-ink hover:text-primary transition-colors duration-200 no-underline"
          >
            mail@goldenbook.pt
          </a>
        </div>

        {/* Social */}
        <div>
          <p className="font-sans text-caption text-ink/40 uppercase tracking-widest mb-4">
            {t('labelSocial')}
          </p>
          <div className="flex flex-col gap-3">
            <a
              href="https://www.instagram.com/goldenbook.pt/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 font-sans text-body text-ink hover:text-primary transition-colors duration-200 no-underline group"
            >
              {/* Instagram icon */}
              <svg className="w-5 h-5 text-ink/40 group-hover:text-primary transition-colors duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
              </svg>
              Instagram
            </a>
            <a
              href="https://www.facebook.com/goldenbookportugal/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 font-sans text-body text-ink hover:text-primary transition-colors duration-200 no-underline group"
            >
              {/* Facebook icon */}
              <svg className="w-5 h-5 text-ink/40 group-hover:text-primary transition-colors duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
              </svg>
              Facebook
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
