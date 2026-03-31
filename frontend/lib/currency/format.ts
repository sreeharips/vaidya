import { convertFromInr } from './rates'
import type { DisplayCurrencyCode } from './types'

const LOCALE_BY_CURRENCY: Record<DisplayCurrencyCode, string> = {
  INR: 'en-IN',
  AED: 'en-AE',
}

/** Intl locale for formatting (matches DisplayCurrencyProvider). */
export function localeForVisitorCurrency(lang: string, currency: DisplayCurrencyCode): string {
  if (currency === 'AED' && lang === 'ar') return 'ar-AE'
  if (currency === 'INR') return 'en-IN'
  if (currency === 'AED') return 'en-AE'
  return lang || 'en'
}

/**
 * Format an amount whose base is INR into the visitor's display currency.
 */
export function formatMoney(
  amountInr: number,
  currency: DisplayCurrencyCode,
  localeHint?: string,
): string {
  const target = convertFromInr(amountInr, currency)
  const locale = localeHint || LOCALE_BY_CURRENCY[currency]
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(target)
  } catch {
    return `${currency} ${Math.round(target).toLocaleString()}`
  }
}
