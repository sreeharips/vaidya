'use client'

import { useDisplayCurrency } from '@/contexts/DisplayCurrencyContext'

export default function PriceFromInr({
  amountInr,
  className,
  style,
}: {
  amountInr: number
  className?: string
  style?: React.CSSProperties
}) {
  const { formatFromInr } = useDisplayCurrency()
  return (
    <span className={className} style={style}>
      {formatFromInr(amountInr)}
    </span>
  )
}
