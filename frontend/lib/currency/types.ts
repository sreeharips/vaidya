/**
 * Display currencies for guest-facing UI. Amounts are always converted from INR base.
 * Add new codes here + rates + COUNTRY_TO_CURRENCY when expanding markets.
 */
export type DisplayCurrencyCode = 'INR' | 'AED'

export const DISPLAY_CURRENCY_CODES: DisplayCurrencyCode[] = ['INR', 'AED']

export function isDisplayCurrencyCode(v: string | undefined | null): v is DisplayCurrencyCode {
  return v === 'INR' || v === 'AED'
}

/** ISO 3166-1 alpha-2 → default display currency for first visit (cookie override wins). */
export const COUNTRY_TO_DISPLAY_CURRENCY: Record<string, DisplayCurrencyCode> = {
  IN: 'INR',
  AE: 'AED',
}

export const COOKIE_DISPLAY_CURRENCY = 'vaidya_display_currency'
