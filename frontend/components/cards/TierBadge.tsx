interface TierBadgeProps {
  tier: 1 | 2
  size?: 'sm' | 'md'
}

export default function TierBadge({ tier, size = 'md' }: TierBadgeProps) {
  const isT2 = tier === 2
  const fontSize = size === 'sm' ? '10px' : '11px'
  const padding = size === 'sm' ? '3px 8px' : '4px 10px'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize,
        fontWeight: 500,
        padding,
        borderRadius: '10px',
        whiteSpace: 'nowrap',
        background: isT2 ? 'var(--gold-lt)' : 'var(--forest-lt)',
        color: isT2 ? 'var(--bark)' : 'var(--forest2)',
      }}
    >
      <span
        style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: 'currentColor',
          flexShrink: 0,
        }}
      />
      {isT2 ? 'Certified Authentic' : 'Tier 1 Verified'}
    </span>
  )
}
