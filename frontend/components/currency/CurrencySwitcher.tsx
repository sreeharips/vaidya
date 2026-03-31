'use client'

import { useRouter } from 'next/navigation'
import { useDisplayCurrency } from '@/contexts/DisplayCurrencyContext'
import { DISPLAY_CURRENCY_CODES, type DisplayCurrencyCode } from '@/lib/currency'

/**
 * Guest-facing override (Booking.com-style). Persists via /api/preferences/currency.
 */
export default function CurrencySwitcher({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { currency } = useDisplayCurrency()
  const router = useRouter()

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as DisplayCurrencyCode
    await fetch('/api/preferences/currency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency: next }),
    })
    router.refresh()
  }

  const selectCls =
    variant === 'dark'
      ? 'bg-transparent border border-white/20 rounded-lg px-2 py-1 font-sans text-sm cursor-pointer text-[#FDFAF6]'
      : 'bg-transparent border border-cream2 rounded-lg px-2 py-1 font-sans text-slate cursor-pointer'

  return (
    <label className={`flex items-center gap-1.5 text-xs ${variant === 'dark' ? 'text-white/60' : 'text-muted'}`}>
      <span className="sr-only">Currency</span>
      <select
        value={currency}
        onChange={onChange}
        className={selectCls}
        aria-label="Display currency"
      >
        {DISPLAY_CURRENCY_CODES.map((c) => (
          <option key={c} value={c}>
            {c === 'INR' ? '₹ INR' : 'د.إ AED'}
          </option>
        ))}
      </select>
    </label>
  )
}
