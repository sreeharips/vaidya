"""
Canonical pricing in INR for retreats when `price_inr` is unset.

`price_usd` on Retreat is treated as legacy USD list price and converted using
VAIDYA_INR_PER_USD (default 85) for display, sorting, and booking totals.
Clinic `pricing_min` / `pricing_max` are stored and interpreted as INR.
"""

import os

INR_PER_USD_FALLBACK = float(os.getenv("VAIDYA_INR_PER_USD", "85"))


def retreat_effective_inr(price_inr: float | None, price_usd: float | None) -> float:
    """Single retreat package price in INR for guests and admins."""
    if price_inr is not None:
        return float(price_inr)
    if price_usd is not None:
        return float(price_usd) * INR_PER_USD_FALLBACK
    return 0.0
