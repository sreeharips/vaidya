'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import Sidebar from '../../_components/Sidebar'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface BookingDetail {
  id: string
  patient_display: string
  patient_lang: string
  treatment_name: string
  treatment_description: string | null
  start_date: string
  end_date: string
  duration_days: number
  status: string
  lang: string
  total_amount: number | null
  commission_amount: number | null
  currency: string
  cancellation_policy: string | null
  created_at: string
  prakriti_type: string | null
  vata_pct: number | null
  pitta_pct: number | null
  kapha_pct: number | null
  doctor_name: string | null
  doctor_qualification: string | null
}

const LANG_FLAGS: Record<string, string> = {
  en: '🇬🇧 English', ar: '🇦🇪 Arabic', de: '🇩🇪 German',
  fr: '🇫🇷 French', ml: '🇮🇳 Malayalam', hi: '🇮🇳 Hindi',
}

const DOSHA_COLORS: Record<string, string> = {
  vata: '#8B6E5A', pitta: '#2D5440', kapha: '#B8862C',
}

export default function BookingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoading, isAuthenticated } = useAuth()

  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bookingId = params?.id as string

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated || (user?.role !== 'clinic_admin' && user?.role !== 'platform_admin')) {
      router.replace('/clinic/login')
      return
    }
    const token = localStorage.getItem('vaidya_refresh_token')
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    fetch(`${API}/api/clinic/bookings/${bookingId}`, { credentials: 'include', headers })
      .then((r) => r.ok ? r.json() : Promise.reject('Not found'))
      .then(setBooking)
      .catch(() => setError('Booking not found'))
      .finally(() => setDataLoading(false))
  }, [isLoading, isAuthenticated, bookingId])

  async function doAction(action: 'confirm' | 'decline') {
    if (!booking) return
    setActionLoading(true)
    setError(null)
    const token = localStorage.getItem('vaidya_refresh_token')
    const headers: HeadersInit = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    try {
      const res = await fetch(`${API}/api/clinic/bookings/${bookingId}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { detail?: string }).detail ?? `Failed to ${action}`)
      }
      const data = await res.json()
      setBooking((b) => b ? { ...b, status: data.status } : b)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setActionLoading(false)
    }
  }

  if (isLoading || dataLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontFamily: 'var(--sans)', fontSize: 14 }}>
        Loading…
      </div>
    )
  }

  if (error && !booking) {
    return (
      <div className="portal-shell">
        <Sidebar clinicName={null} pendingCount={0} />
        <main className="portal-main">
          <div className="portal-topbar">
            <Link href="/clinic/bookings" style={{ fontSize: 13, color: 'var(--forest)', textDecoration: 'none' }}>← Back to bookings</Link>
          </div>
          <div className="portal-content">
            <p style={{ color: '#c53030', fontSize: 14 }}>{error}</p>
          </div>
        </main>
      </div>
    )
  }

  if (!booking) return null

  const prakritiType = booking.prakriti_type?.toLowerCase()
  const doshaColor = prakritiType ? DOSHA_COLORS[prakritiType] : 'var(--muted)'

  const doshaLabel = prakritiType
    ? prakritiType.charAt(0).toUpperCase() + prakritiType.slice(1)
    : null

  const bars = prakritiType ? [
    { label: 'Vata', pct: booking.vata_pct ?? 0, color: DOSHA_COLORS.vata },
    { label: 'Pitta', pct: booking.pitta_pct ?? 0, color: DOSHA_COLORS.pitta },
    { label: 'Kapha', pct: booking.kapha_pct ?? 0, color: DOSHA_COLORS.kapha },
  ] : []

  const isPending = booking.status === 'pending'

  return (
    <div className="portal-shell">
      <Sidebar clinicName={null} pendingCount={isPending ? 1 : 0} />

      <main className="portal-main">
        <div className="portal-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/clinic/bookings" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}>
              ← Bookings
            </Link>
            <span className="portal-page-title">{booking.patient_display}</span>
            <span className={`status-badge status-${booking.status}`}>{booking.status}</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            Received {new Date(booking.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        <div className="portal-content">
          {error && (
            <div style={{ background: 'rgba(197,48,48,0.08)', border: '1px solid rgba(197,48,48,0.2)', borderRadius: 'var(--r-sm)', padding: '10px 14px', fontSize: 13, color: '#c53030', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div className="detail-grid">
            {/* Left — booking info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Treatment & dates */}
              <div className="detail-card">
                <div className="detail-section-title">Booking details</div>
                {[
                  { label: 'Treatment', value: booking.treatment_name },
                  { label: 'Start date', value: booking.start_date },
                  { label: 'End date', value: booking.end_date },
                  { label: 'Duration', value: `${booking.duration_days} days` },
                  { label: 'Amount', value: booking.total_amount ? `${booking.currency} ${booking.total_amount.toLocaleString()}` : 'TBC' },
                  { label: 'Commission', value: booking.commission_amount ? `${booking.currency} ${booking.commission_amount.toLocaleString()}` : '—' },
                ].map((r) => (
                  <div key={r.label} className="detail-row">
                    <span className="detail-row-label">{r.label}</span>
                    <span className="detail-row-value">{r.value}</span>
                  </div>
                ))}
                {booking.treatment_description && (
                  <p style={{ marginTop: 14, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, padding: '12px', background: 'var(--cream)', borderRadius: 'var(--r-sm)' }}>
                    {booking.treatment_description}
                  </p>
                )}
              </div>

              {/* Patient info */}
              <div className="detail-card">
                <div className="detail-section-title">Patient</div>
                {[
                  { label: 'Contact', value: booking.patient_display },
                  { label: 'Language', value: LANG_FLAGS[booking.lang] ?? booking.lang.toUpperCase() },
                  { label: 'Doctor', value: booking.doctor_name ? `${booking.doctor_name}${booking.doctor_qualification ? `, ${booking.doctor_qualification}` : ''}` : '—' },
                ].map((r) => (
                  <div key={r.label} className="detail-row">
                    <span className="detail-row-label">{r.label}</span>
                    <span className="detail-row-value">{r.value}</span>
                  </div>
                ))}
              </div>

              {/* Prakriti */}
              {prakritiType && (
                <div className="detail-card">
                  <div className="detail-section-title">Patient Prakriti</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: doshaColor, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--forest)' }}>{doshaLabel}</span>
                  </div>
                  {bars.map((b) => (
                    <div key={b.label} className="prakriti-bar-row">
                      <span className="prakriti-bar-label">{b.label}</span>
                      <div className="prakriti-bar-track">
                        <div className="prakriti-bar-fill" style={{ width: `${b.pct}%`, background: b.color }} />
                      </div>
                      <span className="prakriti-bar-pct">{b.pct}%</span>
                    </div>
                  ))}
                  <p style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, padding: '10px 12px', background: 'var(--forest-lt)', borderRadius: 'var(--r-sm)' }}>
                    This patient's constitution may respond well to treatments aligned with their {doshaLabel} type. Review treatment suitability before confirming.
                  </p>
                </div>
              )}
            </div>

            {/* Right — actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Action card */}
              <div className="detail-card">
                <div className="detail-section-title">Action required</div>

                {isPending ? (
                  <>
                    <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
                      Confirm to accept this booking. The patient will be notified immediately and their dates will be reserved.
                    </p>
                    <button
                      className="btn-confirm"
                      onClick={() => doAction('confirm')}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Processing…' : '✓ Confirm booking'}
                    </button>
                    <button
                      className="btn-decline"
                      onClick={() => doAction('decline')}
                      disabled={actionLoading}
                    >
                      Decline request
                    </button>
                    <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12, lineHeight: 1.5, textAlign: 'center' }}>
                      No payment is collected now. The patient will arrange payment on arrival.
                    </p>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <span className={`status-badge status-${booking.status}`} style={{ fontSize: 13, padding: '6px 16px' }}>
                      {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </span>
                    <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>
                      {booking.status === 'confirmed' && 'Booking confirmed. Patient has been notified.'}
                      {booking.status === 'cancelled' && 'This booking has been declined or cancelled.'}
                      {booking.status === 'completed' && 'Retreat completed.'}
                    </p>
                    {booking.status === 'confirmed' && (
                      <button
                        className="btn-decline"
                        style={{ marginTop: 16 }}
                        onClick={() => doAction('decline')}
                        disabled={actionLoading}
                      >
                        Cancel booking
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Cancellation policy */}
              {booking.cancellation_policy && (
                <div className="detail-card">
                  <div className="detail-section-title">Cancellation policy</div>
                  <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                    {booking.cancellation_policy}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
