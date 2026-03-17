'use client'

import Link from 'next/link'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

// Dosha colour map
const DOSHA_COLORS: Record<string, { bg: string; dot: string; text: string }> = {
  vata:  { bg: 'rgba(107,79,58,0.10)', dot: '#8B6E5A', text: 'var(--bark)' },
  pitta: { bg: 'rgba(30,61,47,0.08)',  dot: '#1E3D2F', text: 'var(--forest2)' },
  kapha: { bg: 'rgba(184,134,44,0.10)', dot: '#B8862C', text: 'var(--gold)' },
}

function PrakritiChip({ type, lang }: { type: string; lang: string }) {
  const key = type.toLowerCase()
  const colors = DOSHA_COLORS[key] ?? DOSHA_COLORS.vata
  return (
    <Link
      href={`/${lang}/assessment/results`}
      title="View your Prakriti profile"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 12px',
        background: colors.bg,
        borderRadius: 'var(--r-xl)',
        border: '1px solid rgba(107,79,58,0.12)',
        fontSize: '12px',
        fontWeight: 500,
        color: colors.text,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: colors.dot,
          flexShrink: 0,
        }}
      />
      {type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()}
    </Link>
  )
}

function UserMenu({ user, lang, onLogout }: {
  user: { full_name: string | null; email: string }
  lang: string
  onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const initials = user.full_name
    ? user.full_name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
    : user.email[0].toUpperCase()

  const menuItems = [
    { href: `/${lang}/profile/bookings`, label: 'My bookings' },
    { href: `/${lang}/profile/watchlist`, label: 'Saved clinics' },
    { href: `/${lang}/profile/prescriptions`, label: 'My prescriptions' },
    { href: `/${lang}/profile/purchases`, label: 'Purchase history' },
  ]

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'var(--forest)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--serif)',
          fontSize: '14px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          letterSpacing: '0.02em',
          flexShrink: 0,
        }}
      >
        {initials}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow2)',
            minWidth: '192px',
            zIndex: 200,
            overflow: 'hidden',
          }}
        >
          {/* User label */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              fontSize: '12px',
              color: 'var(--muted)',
            }}
          >
            <div style={{ fontWeight: 500, color: 'var(--slate)', marginBottom: '2px' }}>
              {user.full_name ?? user.email}
            </div>
            {user.full_name && (
              <div style={{ fontSize: '11px' }}>{user.email}</div>
            )}
          </div>

          {menuItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                padding: '10px 16px',
                fontSize: '13px',
                color: 'var(--slate)',
                textDecoration: 'none',
                transition: 'background var(--transition)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cream)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {label}
            </Link>
          ))}

          <div style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}>
            <button
              onClick={() => { setOpen(false); onLogout() }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 16px',
                fontSize: '13px',
                color: 'var(--muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--sans)',
                transition: 'color var(--transition)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--slate)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function NavBar() {
  const params = useParams()
  const lang = (params?.lang as string) || 'en'
  const path = usePathname() ?? ''
  const router = useRouter()
  const { user, preferences, isAuthenticated, logout } = useAuth()

  const links = [
    { href: `/${lang}/clinics`,               label: 'Clinics'    },
    { href: `/${lang}/doctors`,               label: 'Doctors'    },
    { href: `/${lang}/search?type=treatment`, label: 'Treatments' },
    { href: `/${lang}/shop`,                  label: 'Herbal Shop'},
    { href: `/${lang}/conditions`,            label: 'Conditions' },
  ]

  async function handleLogout() {
    await logout()
    router.push(`/${lang}`)
  }

  const prakritiType = preferences?.primary_type ?? null

  return (
    <nav
      style={{
        position:       'sticky',
        top:            0,
        zIndex:         100,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '0 48px',
        height:         '68px',
        background:     'rgba(247,243,237,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom:   '1px solid var(--border)',
        gap:            '16px',
      }}
    >
      {/* Logo */}
      <Link
        href={`/${lang}`}
        style={{
          fontFamily:    'var(--serif)',
          fontSize:      '26px',
          fontWeight:    600,
          color:         'var(--forest)',
          letterSpacing: '-0.02em',
          textDecoration:'none',
          display:       'flex',
          alignItems:    'center',
          gap:           '8px',
          flexShrink:    0,
        }}
      >
        <span style={{ color: 'var(--gold)' }}>✦</span> Vaidya
      </Link>

      {/* Nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1, justifyContent: 'center' }}>
        {links.map(({ href, label }) => {
          const active = path.startsWith(href.split('?')[0])
          return (
            <Link
              key={href}
              href={href}
              className="nav-link"
              style={{
                fontWeight:    active ? 500 : 400,
                color:         active ? 'var(--forest)' : 'var(--muted)',
                borderBottom:  active ? '2px solid var(--gold)' : '2px solid transparent',
                paddingBottom: '4px',
              }}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Right side: Prakriti chip + Assessment CTA + Auth */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>

        {/* Prakriti chip — shown for guests AND authenticated users */}
        {prakritiType && (
          <PrakritiChip type={prakritiType} lang={lang} />
        )}

        {/* Prakriti Assessment CTA */}
        <Link href={`/${lang}/assessment`} style={{ textDecoration: 'none' }}>
          <button className="nav-cta-btn">
            {prakritiType ? 'Retake' : 'Prakriti'}
          </button>
        </Link>

        {/* Auth: guest → Sign in button | authenticated → avatar dropdown */}
        {isAuthenticated && user ? (
          <UserMenu user={user} lang={lang} onLogout={handleLogout} />
        ) : (
          <Link href={`/${lang}/login`} style={{ textDecoration: 'none' }}>
            <button
              style={{
                fontFamily:    'var(--sans)',
                fontSize:      '13px',
                fontWeight:    500,
                padding:       '8px 18px',
                borderRadius:  'var(--r-xl)',
                border:        '1.5px solid var(--border2)',
                background:    'transparent',
                color:         'var(--slate)',
                cursor:        'pointer',
                letterSpacing: '0.01em',
                transition:    'all var(--transition)',
                whiteSpace:    'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--forest)'
                e.currentTarget.style.color = 'var(--forest)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border2)'
                e.currentTarget.style.color = 'var(--slate)'
              }}
            >
              Sign in
            </button>
          </Link>
        )}
      </div>
    </nav>
  )
}
