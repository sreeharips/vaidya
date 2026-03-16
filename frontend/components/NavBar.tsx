'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'

export default function NavBar() {
  const params  = useParams()
  const lang    = (params?.lang as string) || 'en'
  const path    = usePathname() ?? ''

  const links = [
    { href: `/${lang}/clinics`,                   label: 'Clinics'    },
    { href: `/${lang}/doctors`,                   label: 'Doctors'    },
    { href: `/${lang}/search?type=treatment`,     label: 'Treatments' },
    { href: `/${lang}/shop`,                      label: 'Herbal Shop'},
    { href: `/${lang}/conditions`,                label: 'Conditions' },
  ]

  return (
    <nav
      style={{
        position:      'sticky',
        top:           0,
        zIndex:        100,
        display:       'flex',
        alignItems:    'center',
        justifyContent:'space-between',
        padding:       '0 48px',
        height:        '68px',
        background:    'rgba(247,243,237,0.92)',
        backdropFilter:'blur(12px)',
        borderBottom:  '1px solid var(--border)',
      }}
    >
      {/* Logo */}
      <Link
        href={`/${lang}`}
        style={{
          fontFamily:     'var(--serif)',
          fontSize:       '26px',
          fontWeight:     600,
          color:          'var(--forest)',
          letterSpacing:  '-0.02em',
          textDecoration: 'none',
          display:        'flex',
          alignItems:     'center',
          gap:            '8px',
        }}
      >
        <span style={{ color: 'var(--gold)' }}>✦</span> Vaidya
      </Link>

      {/* Nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
        {links.map(({ href, label }) => {
          const active = path.startsWith(href.split('?')[0])
          return (
            <Link
              key={href}
              href={href}
              style={{
                fontSize:       '14px',
                fontWeight:     active ? 500 : 400,
                color:          active ? 'var(--forest)' : 'var(--muted)',
                textDecoration: 'none',
                letterSpacing:  '0.01em',
                borderBottom:   active ? '2px solid var(--gold)' : '2px solid transparent',
                paddingBottom:  '4px',
                transition:     'color var(--transition)',
              }}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* CTA */}
      <Link href={`/${lang}/assessment`} style={{ textDecoration: 'none' }}>
        <button style={ctaStyle}>
          Prakriti Assessment
        </button>
      </Link>
    </nav>
  )
}

const ctaStyle: React.CSSProperties = {
  background:    'var(--forest)',
  color:         'var(--cream)',
  fontFamily:    'var(--sans)',
  fontSize:      '13px',
  fontWeight:    500,
  padding:       '9px 20px',
  borderRadius:  'var(--r-xl)',
  border:        'none',
  cursor:        'pointer',
  letterSpacing: '0.02em',
}
