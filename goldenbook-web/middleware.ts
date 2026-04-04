import createMiddleware from 'next-intl/middleware'

export default createMiddleware({
  locales: ['en', 'pt', 'es'],
  defaultLocale: 'en',
  localePrefix: 'as-needed', // /en/ hidden, /pt/ and /es/ explicit
})

export const config = {
  matcher: [
    // Match all paths except api, _next, _vercel, static files, and /auth routes
    '/((?!api|_next|_vercel|auth|.*\\..*).*)',
  ],
}
