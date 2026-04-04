import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Goldenbook GO',
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: '/favicon-transparent.svg', type: 'image/svg+xml' },
      { url: '/favicon-transparent-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-transparent-16x16.png', type: 'image/png', sizes: '16x16' },
    ],
    shortcut: '/favicon-transparent.ico',
    apple: '/apple-touch-icon.png',
  },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#1C1F2E', fontFamily: "'Inter', sans-serif" }}>
        {children}
      </body>
    </html>
  )
}
