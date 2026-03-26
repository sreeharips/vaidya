'use client'

import Link from 'next/link'

interface WellnessGoal {
  icon: string
  label: string
  desc: string
  href: string
}

export default function WellnessGoalGrid({ goals, lang }: { goals: WellnessGoal[]; lang: string }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: '12px',
    }}>
      {goals.map((goal) => (
        <Link key={goal.label} href={`/${lang}${goal.href}`} style={{ textDecoration: 'none' }}>
          <div
            style={{
              padding: '20px 22px',
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              transition: 'all var(--transition)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.borderColor = 'var(--forest2)'
              el.style.background = 'var(--forest-lt)'
              el.style.transform = 'translateY(-2px)'
              el.style.boxShadow = 'var(--shadow)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.borderColor = 'var(--border)'
              el.style.background = '#fff'
              el.style.transform = 'translateY(0)'
              el.style.boxShadow = 'none'
            }}
          >
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'var(--forest-lt)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              color: 'var(--forest)',
              flexShrink: 0,
              fontFamily: 'var(--serif)',
            }}>
              {goal.icon}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '16px', color: 'var(--forest)', fontWeight: 500, marginBottom: '2px' }}>
                {goal.label}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.4 }}>
                {goal.desc}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
