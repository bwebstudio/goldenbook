import type { Metadata } from 'next'
import { Playfair_Display, Inter, Cormorant_Garamond, Cinzel } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import '../globals.css'
import { NavBar } from '@/components/layout/NavBar'
import { Footer } from '@/components/layout/Footer'

const cinzel = Cinzel({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-cinzel',
  weight: ['400', '600', '700'],
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-cormorant',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
})

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Goldenbook Go — The curated city guide',
  description:
    'Golden picks, hidden routes, and the places that actually matter. Discover Lisbon, Porto, and beyond.',
  openGraph: {
    title: 'Goldenbook Go — The curated city guide',
    description: 'Golden picks, hidden routes, and the places that actually matter.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Goldenbook Go',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Goldenbook Go — The curated city guide',
    description: 'Golden picks, hidden routes, and the places that actually matter.',
  },
  icons: {
    icon: [
      { url: '/favicon-transparent.svg', type: 'image/svg+xml' },
      { url: '/favicon-transparent-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-transparent-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-transparent-48x48.png', type: 'image/png', sizes: '48x48' },
    ],
    shortcut: '/favicon-transparent.ico',
    apple: '/apple-touch-icon.png',
  },
}

const locales = ['en', 'pt', 'es']

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  if (!locales.includes(locale)) {
    notFound()
  }

  // Enable static rendering for all locales
  setRequestLocale(locale)

  const messages = await getMessages()

  return (
    <html
      lang={locale}
      className={`${cinzel.variable} ${cormorant.variable} ${playfair.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body>
        <NextIntlClientProvider messages={messages}>
          <NavBar />
          <main>{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}
