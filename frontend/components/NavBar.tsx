'use client'

import Link from 'next/link'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import CurrencySwitcher from '@/components/currency/CurrencySwitcher'

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
  const { user, isAuthenticated, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isHome = path === `/${lang}` || path === `/${lang}/`
  const dark = isHome

  const links = [
    { href: `/${lang}/clinics`, label: 'Clinics'  },
    { href: `/${lang}/search`,  label: 'Search'   },
  ]

  async function handleLogout() {
    await logout()
    router.push(`/${lang}`)
    setMobileOpen(false)
  }

  return (
    <nav
      style={{
        position:       'sticky',
        top:            0,
        zIndex:         100,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '0 clamp(16px, 4vw, 48px)',
        height:         '56px',
        background:     dark ? '#0f2218' : 'rgba(247,243,237,0.92)',
        backdropFilter: dark ? 'none' : 'blur(12px)',
        borderBottom:   dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid var(--border)',
        gap:            '12px',
      }}
    >
      {/* Logo */}
      <Link
        href={`/${lang}`}
        style={{
          fontFamily:    'var(--serif)',
          fontSize:      '20px',
          fontWeight:    600,
          color:         dark ? '#FDFAF6' : 'var(--forest)',
          letterSpacing: '-0.02em',
          textDecoration:'none',
          display:       'flex',
          alignItems:    'center',
          gap:           '6px',
          flexShrink:    0,
        }}
      >
        <span style={{ color: 'var(--gold)' }}>✦</span> AyuRetreats
      </Link>

      {/* Nav links — hidden on mobile */}
      <div className="nav-desktop-links" style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1, justifyContent: 'center' }}>
        {links.map(({ href, label }) => {
          const active = path.startsWith(href.split('?')[0])
          return (
            <Link
              key={href}
              href={href}
              className="nav-link"
              style={{
                fontWeight:    active ? 500 : 400,
                color:         dark
                  ? (active ? '#FDFAF6' : 'rgba(253,250,246,0.5)')
                  : (active ? 'var(--forest)' : 'var(--muted)'),
                borderBottom:  active ? '2px solid var(--gold)' : '2px solid transparent',
                paddingBottom: '4px',
                fontSize:      '13px',
              }}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Currency + auth — hidden currency on mobile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span className="nav-currency">
          <CurrencySwitcher variant={dark ? 'dark' : 'light'} />
        </span>
        {isAuthenticated && user ? (
          <UserMenu user={user} lang={lang} onLogout={handleLogout} />
        ) : (
          <Link href={`/${lang}/login`} style={{ textDecoration: 'none' }}>
            <button
              style={{
                fontFamily:    'var(--sans)',
                fontSize:      '13px',
                fontWeight:    500,
                padding:       '7px 14px',
                borderRadius:  'var(--r-xl)',
                border:        dark ? '1px solid rgba(253,250,246,0.2)' : '1.5px solid var(--border2)',
                background:    'transparent',
                color:         dark ? 'rgba(253,250,246,0.7)' : 'var(--slate)',
                cursor:        'pointer',
                transition:    'all var(--transition)',
                whiteSpace:    'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = dark ? 'rgba(253,250,246,0.5)' : 'var(--forest)'
                e.currentTarget.style.color = dark ? '#FDFAF6' : 'var(--forest)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = dark ? 'rgba(253,250,246,0.2)' : 'var(--border2)'
                e.currentTarget.style.color = dark ? 'rgba(253,250,246,0.7)' : 'var(--slate)'
              }}
            >
              Sign in
            </button>
          </Link>
        )}

        {/* Hamburger — mobile only */}
        <button
          className="nav-mobile-btn"
          aria-label="Menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((o) => !o)}
          style={{ color: dark ? 'rgba(253,250,246,0.8)' : 'var(--slate)' }}
        >
          {mobileOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="8" x2="21" y2="8" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="16" x2="21" y2="16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      <div className={`nav-mobile-overlay${dark ? ' dark-bg' : ''}${mobileOpen ? ' open' : ''}`}>
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`nav-mobile-link${dark ? ' dark-link' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            {label}
          </Link>
        ))}
        <div style={{ padding: '10px 20px 4px', borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'var(--border)'}`, marginTop: 4 }}>
          <CurrencySwitcher variant={dark ? 'dark' : 'light'} />
        </div>
      </div>
    </nav>
  )
}
