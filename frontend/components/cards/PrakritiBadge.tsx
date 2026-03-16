type Dosha = 'vata' | 'pitta' | 'kapha'

interface PrakritiBadgeProps {
  dosha: Dosha
  label?: string
}

const DOSHA_STYLES: Record<Dosha, { bg: string; color: string; dot: string }> = {
  vata:  { bg: 'rgba(107,79,58,0.10)',  color: 'var(--bark)',    dot: '#8B6E5A' },
  pitta: { bg: 'rgba(30,61,47,0.08)',   color: 'var(--forest2)', dot: '#1E3D2F' },
  kapha: { bg: 'rgba(184,134,44,0.10)', color: 'var(--gold)',    dot: '#B8862C' },
}

export default function PrakritiBadge({ dosha, label }: PrakritiBadgeProps) {
  const styles = DOSHA_STYLES[dosha]
  const displayLabel = label ?? `${dosha.charAt(0).toUpperCase() + dosha.slice(1)}`

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        fontSize: '11px',
        fontWeight: 500,
        padding: '4px 10px',
        borderRadius: '10px',
        background: styles.bg,
        color: styles.color,
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: styles.dot,
          flexShrink: 0,
        }}
      />
      {displayLabel}
    </span>
  )
}
