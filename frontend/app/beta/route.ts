import { NextResponse } from 'next/server'

// /beta — sets the beta access cookie then redirects into the app.
// Share this URL with beta testers. Only holders of this cookie can access [lang] routes.
export function GET() {
  const res = NextResponse.redirect(new URL('/en', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'))
  res.cookies.set('beta_access', '1', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    // No maxAge = session cookie. Add maxAge: 60 * 60 * 24 * 30 for 30-day persistence.
  })
  return res
}
