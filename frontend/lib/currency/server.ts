import { cookies } from 'next/headers'

import { formatMoney, localeForVisitorCurrency } from './format'
import { COOKIE_DISPLAY_CURRENCY, isDisplayCurrencyCode, type DisplayCurrencyCode } from './types'

export function getVisitorDisplayCurrency(): DisplayCurrencyCode {
  const raw = cookies().get(COOKIE_DISPLAY_CURRENCY)?.value
  return isDisplayCurrencyCode(raw) ? raw : 'INR'
}

/** Server components: format canonical INR using the same cookie as DisplayCurrencyProvider. */
export function formatInrForVisitor(amountInr: number, lang: string): string {
  const currency = getVisitorDisplayCurrency()
  return formatMoney(amountInr, currency, localeForVisitorCurrency(lang, currency))
}
