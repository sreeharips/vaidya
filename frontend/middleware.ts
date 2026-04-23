import createMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import {
  COOKIE_DISPLAY_CURRENCY,
  COUNTRY_TO_DISPLAY_CURRENCY,
  isDisplayCurrencyCode,
} from '@/lib/currency'

const handleI18n = createMiddleware({
  locales: ['en', 'ar', 'de', 'fr', 'ml', 'hi'],
  defaultLocale: 'en',
  localePrefix: 'always',
})

const LOCALE_RE = /^\/(en|ar|de|fr|ml|hi)(\/|$)/

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  // Never run i18n / cookie logic on Next internals (dev HMR, fallback chunks, static).
  // Prevents rare Edge cases where matcher differs and breaks chunk requests (e.g. fallback/pages/_app.js).
  if (pathname.startsWith('/_next/') || pathname.startsWith('/__nextjs')) {
    return NextResponse.next()
  }

  // Root path — serve waitlist directly, bypass i18n so there's no redirect to /en.
  if (pathname === '/') {
    return NextResponse.next()
  }

  // Beta gate: all [lang] routes require the beta_access cookie.
  // Visitors without it are sent to the waitlist at /.
  if (LOCALE_RE.test(pathname) && !request.cookies.get('beta_access')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const response = handleI18n(request)

  const country =
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('cf-ipcountry') ||
    ''

  const inferred =
    COUNTRY_TO_DISPLAY_CURRENCY[country] ??
    ('INR' as const)

  const existing = request.cookies.get(COOKIE_DISPLAY_CURRENCY)?.value

  if (!isDisplayCurrencyCode(existing)) {
    response.cookies.set(COOKIE_DISPLAY_CURRENCY, inferred, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }

  return response
}

// Exclude static assets and favicon so /favicon.ico is not handled as app/[lang] (lang="favicon.ico" → 500).
export const config = {
  matcher: [
    '/((?!api|_next|_vercel|admin|waitlist|beta|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp|txt|xml)$).*)',
  ],
}
