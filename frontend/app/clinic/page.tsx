'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import Sidebar from './_components/Sidebar'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface Stats {
  pending_count: number
  confirmed_count: number
  arriving_today: number
  arriving_this_week: number
  revenue_pending: number
}

interface ClinicInfo {
  name: string
  tier: number
  district: string | null
}

export default function ClinicDashboard() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()

  const [stats, setStats] = useState<Stats | null>(null)
  const [clinic, setClinic] = useState<ClinicInfo | null>(null)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) { router.replace('/clinic/login'); return }
    if (user?.role !== 'clinic_admin' && user?.role !== 'platform_admin') {
      router.replace('/clinic/login'); return
    }

    const token = localStorage.getItem('vaidya_refresh_token')
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}

    Promise.all([
      fetch(`${API}/api/clinic/dashboard`, { credentials: 'include', headers }),
      fetch(`${API}/api/clinic/me`, { credentials: 'include', headers }),
    ]).then(async ([sRes, cRes]) => {
      if (sRes.ok) setStats(await sRes.json())
      if (cRes.ok) setClinic(await cRes.json())
    }).finally(() => setDataLoading(false))
  }, [isLoading, isAuthenticated, user])

  if (isLoading || dataLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontFamily: 'var(--sans)', fontSize: 14 }}>
        Loading…
      </div>
    )
  }

  const kpis = [
    { label: 'Pending', value: stats?.pending_count ?? 0, sub: 'Need action', alert: (stats?.pending_count ?? 0) > 0 },
    { label: 'Confirmed', value: stats?.confirmed_count ?? 0, sub: 'Upcoming bookings', alert: false },
    { label: 'Arriving today', value: stats?.arriving_today ?? 0, sub: 'Check-ins today', alert: false },
    { label: 'This week', value: stats?.arriving_this_week ?? 0, sub: 'Arrivals in 7 days', alert: false },
    { label: 'Revenue pending', value: `$${((stats?.revenue_pending ?? 0)).toLocaleString()}`, sub: 'From confirmed', alert: false },
  ]

  return (
    <div className="portal-shell">
      <Sidebar clinicName={clinic?.name ?? null} pendingCount={stats?.pending_count ?? 0} />

      <main className="portal-main">
        <div className="portal-topbar">
          <span className="portal-page-title">Dashboard</span>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        <div className="portal-content">
          {/* KPIs */}
          <div className="kpi-grid">
            {kpis.map((k) => (
              <div key={k.label} className="kpi-card">
                <div className="kpi-label">{k.label}</div>
                <div className={`kpi-value${k.alert ? ' alert' : ''}`}>{k.value}</div>
                <div className="kpi-sub">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Pending action banner */}
          {(stats?.pending_count ?? 0) > 0 && (
            <div
              style={{
                background: 'rgba(197,48,48,0.07)',
                border: '1px solid rgba(197,48,48,0.2)',
                borderRadius: 'var(--r-md)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                marginBottom: 24,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: '#c53030', fontSize: 14, marginBottom: 2 }}>
                  {stats!.pending_count} booking request{stats!.pending_count !== 1 ? 's' : ''} need your response
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Patients are waiting — respond within 24 hours to avoid cancellation.
                </div>
              </div>
              <Link
                href="/clinic/bookings?status=pending"
                style={{
                  background: '#c53030',
                  color: '#fff',
                  padding: '9px 20px',
                  borderRadius: 'var(--r-xl)',
                  fontWeight: 500,
                  fontSize: 13,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Review now →
              </Link>
            </div>
          )}

          {/* Quick links */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {[
              { href: '/clinic/bookings?status=confirmed', label: 'View confirmed bookings', icon: '✓' },
              { href: '/clinic/availability', label: 'Manage availability', icon: '📅' },
              { href: '/clinic/profile', label: 'Update clinic profile', icon: '✏️' },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'var(--white)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  padding: '14px 16px',
                  textDecoration: 'none',
                  color: 'var(--slate)',
                  fontSize: 13,
                  fontWeight: 500,
                  transition: 'box-shadow var(--transition)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
              >
                <span style={{ fontSize: 16 }}>{l.icon}</span>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
