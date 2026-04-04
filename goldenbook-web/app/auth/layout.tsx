import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Goldenbook GO',
  robots: { index: false, follow: false },
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
