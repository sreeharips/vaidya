import createMiddleware from 'next-intl/middleware'

export default createMiddleware({
  locales: ['en', 'ar', 'de', 'fr', 'ml', 'hi'],
  defaultLocale: 'en',
  localePrefix: 'always',
})

export const config = {
  // Match all paths except Next.js internals, static files, and the clinic portal
  matcher: ['/((?!api|_next|_vercel|admin|.*\\..*).*)'],
}
