import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  COOKIE_DISPLAY_CURRENCY,
  DISPLAY_CURRENCY_CODES,
  type DisplayCurrencyCode,
} from '@/lib/currency'

export async function POST(request: Request) {
  let body: { currency?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const c = body.currency?.toUpperCase()
  if (!c || !DISPLAY_CURRENCY_CODES.includes(c as DisplayCurrencyCode)) {
    return NextResponse.json({ error: 'Invalid currency' }, { status: 422 })
  }
  const cookieStore = cookies()
  cookieStore.set(COOKIE_DISPLAY_CURRENCY, c, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  return NextResponse.json({ ok: true, currency: c })
}
