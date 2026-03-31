import type { DisplayCurrencyCode } from './types'

/**
 * Multiply an amount in INR by this factor to get the target currency.
 * Tune via env for production (refresh periodically like Booking.com FX snapshots).
 */
function parseRate(envVal: string | undefined, fallback: number): number {
  if (envVal == null || envVal === '') return fallback
  const n = Number(envVal)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** INR → AED (approximate; override with NEXT_PUBLIC_FX_INR_TO_AED). */
const INR_TO_AED = () => parseRate(process.env.NEXT_PUBLIC_FX_INR_TO_AED, 0.044)

export function convertFromInr(amountInr: number, to: DisplayCurrencyCode): number {
  if (to === 'INR') return amountInr
  if (to === 'AED') return amountInr * INR_TO_AED()
  return amountInr
}

/** Aligns with backend VAIDYA_INR_PER_USD when only USD list price exists (admin / legacy). */
export function inrPerUsdFallback(): number {
  return parseRate(process.env.NEXT_PUBLIC_INR_PER_USD, 85)
}

/** Canonical listing INR: prefer stored INR, else convert USD at fallback rate. */
export function effectiveInrListing(
  price_inr: number | null | undefined,
  price_usd: number | null | undefined,
): number {
  const pi = price_inr != null ? Number(price_inr) : 0
  if (pi > 0) return pi
  const usd = price_usd != null ? Number(price_usd) : 0
  if (usd > 0) return Math.round(usd * inrPerUsdFallback())
  return 0
}
