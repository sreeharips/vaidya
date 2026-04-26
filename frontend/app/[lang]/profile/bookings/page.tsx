'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface Booking {
  id: string
  clinic_id: string
  retreat_name: string
  start_date: string
  end_date: string
  nights: number
  guest_count: number
  total_paid: number | null
  status: string
  created_at: string
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  confirmed:   { bg: 'var(--forest-lt)',      color: 'var(--forest2)' },
  pending:     { bg: 'rgba(184,134,44,0.10)', color: 'var(--bark)'    },
  cancelled:   { bg: 'rgba(220,38,38,0.08)',  color: '#dc2626'        },
  completed:   { bg: 'var(--cream2)',         color: 'var(--muted)'   },
}

export default function BookingsPage() {
  const params = useParams()
  const lang = (params?.lang as string) || 'en'
  const { isAuthenticated, isLoading: authLoading, getAccessToken } = useAuth()

  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || authLoading) return
    setLoading(true)
    const token = getAccessToken()
    fetch(`${API}/api/users/me/bookings`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => {
        if (r.status === 401) return []
        if (!r.ok) throw new Error('Failed to load bookings')
        return r.json()
      })
      .then((data: Booking[]) => setBookings(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [isAuthenticated, authLoading])

  // ── Unauthenticated state — soft gate, not redirect ──────────────────────────
  if (!authLoading && !isAuthenticated) {
    return (
      <main style={{ background: 'var(--cream)', minHeight: '100vh' }}>
        <div
          style={{
            maxWidth: 640,
            margin: '0 auto',
            padding: '80px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📋</div>
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontSize: '28px',
              fontWeight: 400,
              color: 'var(--forest)',
              marginBottom: '12px',
              letterSpacing: '-0.01em',
            }}
          >
            Your booking history
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.7, maxWidth: 440, marginBottom: '32px' }}>
            Sign in to see all your Ayurveda retreat bookings in one place —
            package details, dates, and payment history.
          </p>
          <Link
            href={`/${lang}/login?redirect=/${lang}/profile/bookings`}
            style={{
              background: 'var(--forest)',
              color: '#fff',
              padding: '12px 28px',
              borderRadius: 'var(--r-xl)',
              fontWeight: 500,
              fontSize: '14px',
              textDecoration: 'none',
              display: 'inline-block',
              marginBottom: '14px',
            }}
          >
            Sign in to view bookings
          </Link>
          <Link
            href={`/${lang}`}
            style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}
          >
            ← Back to homepage
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(135deg, #143d22 0%, #1e4d2c 100%)',
          color: '#fff',
          padding: '2.5rem 1.5rem 2rem',
        }}
      >
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <p
            style={{
              fontSize: '0.75rem',
              letterSpacing: '0.12em',
              color: 'rgba(255,255,255,0.55)',
              textTransform: 'uppercase',
              marginBottom: '0.5rem',
            }}
          >
            My account
          </p>
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
              fontWeight: 400,
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
            }}
          >
            Booking history
          </h1>
        </div>
      </section>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)', fontSize: '14px' }}>
            Loading bookings…
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '14px 18px',
              background: '#fef2f2',
              border: '1px solid rgba(220,38,38,0.2)',
              borderRadius: 'var(--r-sm)',
              fontSize: '14px',
              color: '#dc2626',
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && bookings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🌿</div>
            <p style={{ fontFamily: 'var(--serif)', fontSize: '20px', color: 'var(--forest)', marginBottom: '8px' }}>
              No bookings yet
            </p>
            <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '24px' }}>
              Your retreat bookings will appear here once confirmed.
            </p>
            <Link
              href={`/${lang}/clinics`}
              style={{
                background: 'var(--forest)',
                color: '#fff',
                padding: '10px 24px',
                borderRadius: 'var(--r-xl)',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Browse clinics
            </Link>
          </div>
        )}

        {!loading && bookings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {bookings.map((b) => {
              const statusStyle = STATUS_STYLES[b.status] ?? STATUS_STYLES.pending
              return (
                <div
                  key={b.id}
                  style={{
                    background: '#fff',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-lg)',
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div
                      style={{
                        fontFamily: 'var(--serif)',
                        fontSize: '18px',
                        fontWeight: 500,
                        color: 'var(--forest)',
                        marginBottom: '4px',
                      }}
                    >
                      {b.retreat_name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
                      {b.start_date} — {b.end_date}
                      {b.nights > 0 && <span style={{ marginLeft: 8 }}>· {b.nights} nights</span>}
                      {b.guest_count > 1 && <span style={{ marginLeft: 8 }}>· {b.guest_count} guests</span>}
                    </div>
                    {b.total_paid != null && (
                      <div
                        style={{
                          fontFamily: 'var(--serif)',
                          fontSize: '16px',
                          color: 'var(--forest)',
                        }}
                      >
                        ${b.total_paid.toLocaleString()}{' '}
                        <span style={{ fontFamily: 'var(--sans)', fontSize: '12px', color: 'var(--muted)', fontWeight: 300 }}>
                          paid
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 500,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        background: statusStyle.bg,
                        color: statusStyle.color,
                      }}
                    >
                      {b.status}
                    </span>
                    <Link
                      href={`/${lang}/clinics`}
                      style={{ fontSize: '12px', color: 'var(--gold)', textDecoration: 'none' }}
                    >
                      View clinic →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
