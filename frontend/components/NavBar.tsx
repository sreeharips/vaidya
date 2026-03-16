'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function NavBar() {
  const params = useParams()
  const lang = (params?.lang as string) || 'en'

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 48px',
        height: '68px',
        background: 'rgba(247,243,237,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <Link
        href={`/${lang}`}
        style={{
          fontFamily: 'var(--serif)',
          fontSize: '26px',
          fontWeight: 600,
          color: 'var(--forest)',
          letterSpacing: '-0.02em',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ color: 'var(--gold)' }}>✦</span> Vaidya
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        <Link href={`/${lang}/search`} style={navLinkStyle}>Find a Doctor</Link>
        <Link href={`/${lang}/search?type=treatment`} style={navLinkStyle}>Treatments</Link>
        <Link href={`/${lang}/conditions`} style={navLinkStyle}>About Ayurveda</Link>
        <Link href={`/${lang}/clinics`} style={navLinkStyle}>For Clinics</Link>
      </div>

      <Link href={`/${lang}/assessment`}>
        <button style={ctaStyle}>
          Take Prakriti Assessment
        </button>
      </Link>
    </nav>
  )
}

const navLinkStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 400,
  color: 'var(--muted)',
  textDecoration: 'none',
  letterSpacing: '0.01em',
  transition: 'color var(--transition)',
}

const ctaStyle: React.CSSProperties = {
  background: 'var(--forest)',
  color: 'var(--cream)',
  fontFamily: 'var(--sans)',
  fontSize: '13px',
  fontWeight: 500,
  padding: '9px 20px',
  borderRadius: 'var(--r-xl)',
  border: 'none',
  cursor: 'pointer',
  letterSpacing: '0.02em',
  transition: 'background var(--transition), transform var(--transition)',
}
