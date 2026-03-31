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

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  // Never run i18n / cookie logic on Next internals (dev HMR, fallback chunks, static).
  // Prevents rare Edge cases where matcher differs and breaks chunk requests (e.g. fallback/pages/_app.js).
  if (pathname.startsWith('/_next/') || pathname.startsWith('/__nextjs')) {
    return NextResponse.next()
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
    '/((?!api|_next|_vercel|admin|waitlist|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp|txt|xml)$).*)',
  ],
}
