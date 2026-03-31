'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { type DisplayCurrencyCode, formatMoney, localeForVisitorCurrency } from '@/lib/currency'

type Ctx = {
  currency: DisplayCurrencyCode
  /** API amounts are canonical INR */
  formatFromInr: (amountInr: number) => string
}

const DisplayCurrencyContext = createContext<Ctx | null>(null)

export function DisplayCurrencyProvider({
  children,
  initialCurrency,
  locale,
  forceInr,
}: {
  children: ReactNode
  initialCurrency: DisplayCurrencyCode
  locale: string
  /** Admin — always INR regardless of visitor cookie */
  forceInr?: boolean
}) {
  const currency: DisplayCurrencyCode = forceInr ? 'INR' : initialCurrency

  const formatFromInr = useCallback(
    (amountInr: number) =>
      formatMoney(amountInr, currency, localeForVisitorCurrency(locale, currency)),
    [currency, locale],
  )

  const value = useMemo(() => ({ currency, formatFromInr }), [currency, formatFromInr])

  return (
    <DisplayCurrencyContext.Provider value={value}>
      {children}
    </DisplayCurrencyContext.Provider>
  )
}

export function useDisplayCurrency(): Ctx {
  const ctx = useContext(DisplayCurrencyContext)
  if (!ctx) {
    return {
      currency: 'INR',
      formatFromInr: (amountInr: number) =>
        formatMoney(amountInr, 'INR', 'en-IN'),
    }
  }
  return ctx
}
