import Link from 'next/link'

interface ConditionMatch {
  slug: string
  name: string
  treatmentCount: number
}

interface ConditionBannerProps {
  condition: ConditionMatch
  lang: string
}

export default function ConditionBanner({ condition, lang }: ConditionBannerProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '14px 20px',
        background: 'var(--forest-lt)',
        border: '1px solid rgba(30,61,47,0.12)',
        borderRadius: 'var(--r-md)',
        marginBottom: '20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Leaf icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest2)" strokeWidth="1.8">
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
        </svg>
        <span style={{ fontSize: '14px', color: 'var(--forest)' }}>
          <strong>Showing results for &ldquo;{condition.name}&rdquo;</strong>
          <span style={{ color: 'var(--forest2)', fontWeight: 300 }}>
            {' '}· {condition.treatmentCount} Ayurvedic treatments found
          </span>
        </span>
      </div>
      <Link
        href={`/${lang}/conditions/${condition.slug}`}
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--forest2)',
          textDecoration: 'none',
          background: 'var(--white)',
          padding: '5px 14px',
          borderRadius: 'var(--r-xl)',
          border: '1px solid rgba(30,61,47,0.15)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        View condition page →
      </Link>
    </div>
  )
}
