'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Sidebar from '../_components/Sidebar'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface BookingItem {
  id: string
  patient_display: string
  treatment_name: string
  start_date: string
  end_date: string
  duration_days: number
  status: string
  lang: string
  prakriti_type: string | null
  total_amount: number | null
  currency: string
  created_at: string
}

const LANG_FLAGS: Record<string, string> = {
  en: '🇬🇧', ar: '🇦🇪', de: '🇩🇪', fr: '🇫🇷', ml: '🇮🇳', hi: '🇮🇳',
}

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
]

function BookingsContent() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('status') ?? 'pending'

  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [total, setTotal] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated || (user?.role !== 'clinic_admin' && user?.role !== 'platform_admin')) {
      router.replace('/clinic/login')
    }
  }, [isLoading, isAuthenticated, user])

  useEffect(() => {
    if (!isAuthenticated) return
    setLoading(true)
    const token = localStorage.getItem('vaidya_refresh_token')
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    const status = activeTab !== 'all' ? `&status=${activeTab}` : ''
    fetch(`${API}/api/clinic/bookings?limit=50${status}`, { credentials: 'include', headers })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setBookings(data.items ?? [])
          setTotal(data.total ?? 0)
          setPendingCount(data.pending_count ?? 0)
        }
      })
      .finally(() => setLoading(false))
  }, [isAuthenticated, activeTab])

  return (
    <div className="portal-shell">
      <Sidebar clinicName={null} pendingCount={pendingCount} />

      <main className="portal-main">
        <div className="portal-topbar">
          <span className="portal-page-title">Bookings</span>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{total} total</span>
        </div>

        <div className="portal-content">
          <div className="booking-table-wrap">
            {/* Tab header */}
            <div className="booking-table-header">
              <div className="tab-row">
                {TABS.map((t) => (
                  <Link
                    key={t.value}
                    href={`/clinic/bookings?status=${t.value}`}
                    className={`tab-btn${activeTab === t.value ? ' active' : ''}`}
                  >
                    {t.label}
                    {t.value === 'pending' && pendingCount > 0 && (
                      <span style={{ marginLeft: 6, background: '#c53030', color: '#fff', fontSize: 10, padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>
                        {pendingCount}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
                Loading bookings…
              </div>
            ) : bookings.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>📭</div>
                <p style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--forest)', marginBottom: 6 }}>
                  No {activeTab !== 'all' ? activeTab : ''} bookings
                </p>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {activeTab === 'pending' ? 'You\'re all caught up.' : 'Nothing to show here yet.'}
                </p>
              </div>
            ) : (
              <table className="booking-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Treatment</th>
                    <th>Dates</th>
                    <th>Duration</th>
                    <th>Prakriti</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} onClick={() => router.push(`/clinic/bookings/${b.id}`)}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{b.patient_display}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                          {LANG_FLAGS[b.lang] ?? '🌐'} {b.lang.toUpperCase()}
                        </div>
                      </td>
                      <td>{b.treatment_name}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {b.start_date}<br />
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>→ {b.end_date}</span>
                      </td>
                      <td>{b.duration_days}d</td>
                      <td>
                        {b.prakriti_type ? (
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--bark)', background: 'var(--bark-lt)', padding: '2px 8px', borderRadius: 10 }}>
                            {b.prakriti_type.charAt(0).toUpperCase() + b.prakriti_type.slice(1)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {b.total_amount ? `${b.currency} ${b.total_amount.toLocaleString()}` : '—'}
                      </td>
                      <td>
                        <span className={`status-badge status-${b.status}`}>{b.status}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {new Date(b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function BookingsPage() {
  return (
    <Suspense fallback={null}>
      <BookingsContent />
    </Suspense>
  )
}
