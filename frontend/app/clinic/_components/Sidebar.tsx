'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const NAV = [
  { href: '/clinic', label: 'Dashboard', icon: '◈' },
  { href: '/clinic/bookings', label: 'Bookings', icon: '📋' },
  { href: '/clinic/availability', label: 'Availability', icon: '📅' },
  { href: '/clinic/profile', label: 'Clinic profile', icon: '🏥' },
]

export default function Sidebar({
  clinicName,
  pendingCount,
}: {
  clinicName: string | null
  pendingCount: number
}) {
  const path = usePathname() ?? ''
  const router = useRouter()
  const { logout } = useAuth()

  async function handleLogout() {
    await logout()
    router.push('/clinic/login')
  }

  return (
    <aside className="portal-sidebar">
      {/* Logo */}
      <div className="portal-logo">
        <div className="portal-logo-title">✦ Vaidya</div>
        <div className="portal-logo-sub">Clinic Portal</div>
      </div>

      {/* Nav */}
      <nav className="portal-nav">
        {NAV.map(({ href, label, icon }) => {
          const isBookings = href === '/clinic/bookings'
          const active = href === '/clinic'
            ? path === '/clinic'
            : path.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`portal-nav-item${active ? ' active' : ''}`}
            >
              <span style={{ fontSize: '14px' }}>{icon}</span>
              {label}
              {isBookings && pendingCount > 0 && (
                <span className="portal-nav-badge">{pendingCount}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="portal-sidebar-footer">
        {clinicName && (
          <div className="portal-clinic-name">
            <strong>{clinicName}</strong>
            Tier 1 Verified
          </div>
        )}
        <button className="portal-nav-item" onClick={handleLogout} style={{ paddingLeft: 0 }}>
          <span style={{ fontSize: '14px' }}>↩</span>
          Sign out
        </button>
      </div>
    </aside>
  )
}
