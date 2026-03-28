'use client'

import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface PackageData {
  id: string
  name: string
  description: string | null
  package_type: string | null
  wellness_categories: string[]
  duration_min_days: number | null
  duration_max_days: number | null
  price_usd: number | null
  includes_accommodation: boolean
  includes_meals: boolean
  includes_transfers: boolean
  max_guests_per_slot: number | null
}

interface ClinicData {
  id: string
  name: string
  slug: string
}

interface BookingResult {
  booking_id: string
  status: string
  total_amount: number
  currency: string
  nights: number
  clinic_name: string
  retreat_name: string
  start_date: string
  end_date: string
  guest_count: number
}

function BookingForm() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const lang = (params?.lang as string) || 'en'
  const { user, getAccessToken } = useAuth()

  const clinicSlug = searchParams.get('clinic') || ''
  const retreatId = searchParams.get('retreat') || ''

  const [clinic, setClinic] = useState<ClinicData | null>(null)
  const [pkg, setPkg] = useState<PackageData | null>(null)
  const [loadError, setLoadError] = useState('')

  // Form state — pre-fill from logged-in user if available
  const [guestName, setGuestName] = useState(user?.full_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [startDate, setStartDate] = useState('')
  const [duration, setDuration] = useState(14)
  const [guestCount, setGuestCount] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<BookingResult | null>(null)
  const [submitError, setSubmitError] = useState('')

  // Sync auth user into form fields once auth resolves
  useEffect(() => {
    if (user) {
      if (!guestName && user.full_name) setGuestName(user.full_name)
      if (!email && user.email) setEmail(user.email)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Load clinic data
  useEffect(() => {
    if (!clinicSlug) { setLoadError('No clinic specified.'); return }

    fetch(`${API_BASE}/api/clinics/${clinicSlug}`)
      .then((r) => {
        if (!r.ok) throw new Error('Clinic not found')
        return r.json()
      })
      .then((data: ClinicData) => {
        setClinic(data)
      })
      .catch(() => setLoadError('Could not load clinic details. Please try again.'))
  }, [clinicSlug])

  // Load package data
  useEffect(() => {
    if (!retreatId) return

    fetch(`${API_BASE}/api/retreats/${retreatId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Retreat not found')
        return r.json()
      })
      .then((data: PackageData) => {
        setPkg(data)
        // Set initial duration to package minimum
        if (data.duration_min_days) {
          setDuration(data.duration_min_days)
        }
      })
      .catch(() => {
        // Package load failed — user can still submit without package details
      })
  }, [retreatId])

  // Derived
  const endDate = (() => {
    if (!startDate) return ''
    const d = new Date(startDate)
    d.setDate(d.getDate() + duration)
    return d.toISOString().split('T')[0]
  })()

  const pricePerNight = pkg?.price_usd && pkg?.duration_min_days
    ? Math.round(pkg.price_usd / pkg.duration_min_days)
    : 0
  const estimatedTotal = Math.round(pricePerNight * duration * guestCount)

  const minDuration = pkg?.duration_min_days ?? 7
  const maxDuration = pkg?.duration_max_days ?? 28
  const maxGuests = pkg?.max_guests_per_slot ?? 10

  const today = new Date().toISOString().split('T')[0]

  const canSubmit = email.includes('@') && guestName && startDate && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !clinic) return
    setSubmitting(true)
    setSubmitError('')

    try {
      const token = getAccessToken()
      const res = await fetch(`${API_BASE}/api/bookings/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          retreat_id: retreatId || undefined,
          clinic_id: clinic.id,
          start_date: startDate,
          end_date: endDate,
          guest_email: email,
          guest_name: guestName,
          guest_count: guestCount,
          lang,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || `Error ${res.status}`)
      }
      setResult(data)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Confirmation screen ────────────────────────────────────────────────────
  if (result) {
    return (
      <main style={{ background: 'var(--cream)', minHeight: '100vh' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '3rem 1.5rem' }}>
          <div style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            padding: '36px',
            textAlign: 'center',
          }}>
            <div style={{
              width: 56, height: 56,
              background: 'var(--forest)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: '1.6rem', color: 'var(--slate)', marginBottom: 8 }}>
              Booking Request Sent
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 28 }}>
              {result.clinic_name} will confirm within 24 hours.
            </p>

            <div style={{
              background: 'var(--cream)',
              borderRadius: 'var(--r-md)',
              padding: '20px 24px',
              textAlign: 'left',
              marginBottom: 24,
            }}>
              {[
                ['Retreat', result.retreat_name],
                ['Dates', `${result.start_date} → ${result.end_date}`],
                ['Duration', `${result.nights} nights`],
                ['Guests', `${result.guest_count}`],
                ['Estimated total', `${result.currency} ${result.total_amount.toFixed(2)}`],
                ['Status', 'Pending clinic confirmation'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{label}</span>
                  <span style={{ color: 'var(--slate)', fontSize: '0.82rem', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 24 }}>
              A confirmation will be sent to <strong>{email}</strong>.
              No payment is required now.
            </p>

            <button
              onClick={() => router.push(`/${lang}/clinics/${clinicSlug}`)}
              style={{
                padding: '10px 24px',
                background: 'var(--forest)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--r-xl)',
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Back to retreat
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <main style={{ background: 'var(--cream)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>{loadError}</p>
      </main>
    )
  }

  if (!clinic) {
    return (
      <main style={{ background: 'var(--cream)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid var(--forest)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </main>
    )
  }

  // ── Booking form ───────────────────────────────────────────────────────────
  return (
    <main style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      {/* Hero */}
      <section style={{
        background: 'linear-gradient(135deg, #1a3c2e 0%, #2d5a3d 100%)',
        color: '#fff',
        padding: '2.5rem 1.5rem 2rem',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <p style={{ fontSize: '0.72rem', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 6 }}>
            {clinic.name}
          </p>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(1.5rem, 3.5vw, 2rem)', fontWeight: 400, lineHeight: 1.25, marginBottom: 6 }}>
            {pkg ? pkg.name : 'Request a booking'}
          </h1>
          {pkg && pricePerNight > 0 && (
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)' }}>
              from ${pricePerNight}/night · {minDuration}–{maxDuration} days
            </p>
          )}
        </div>
      </section>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <form onSubmit={handleSubmit}>
          <div style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            padding: '28px',
            boxShadow: 'var(--shadow)',
          }}>

            {/* Guest name */}
            <div className="booking-field">
              <label htmlFor="guest-name" className="booking-label" style={{ display: 'block', marginBottom: 6 }}>
                Full name
              </label>
              <input
                id="guest-name"
                type="text"
                className="booking-input"
                placeholder="Your full name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>

            {/* Email */}
            <div className="booking-field" style={{ marginTop: 20 }}>
              <label htmlFor="guest-email" className="booking-label" style={{ display: 'block', marginBottom: 6 }}>
                Email address{' '}
                <span style={{ fontWeight: 300, color: 'var(--muted)', fontSize: '11px', textTransform: 'none', letterSpacing: 0 }}>
                  {user ? '(your account email)' : '(for confirmation)'}
                </span>
              </label>
              <input
                id="guest-email"
                type="email"
                className="booking-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                readOnly={!!user}
                style={{ width: '100%', ...(user ? { background: 'var(--cream)', cursor: 'default', color: 'var(--muted)' } : {}) }}
              />
            </div>

            {/* Start date */}
            <div className="booking-field" style={{ marginTop: 20 }}>
              <label className="booking-label" style={{ display: 'block', marginBottom: 6 }}>
                Preferred start date
              </label>
              <input
                type="date"
                className="booking-input"
                style={{ width: '100%' }}
                min={today}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            {/* Duration */}
            <div className="booking-field" style={{ marginTop: 20 }}>
              <label className="booking-label" style={{ display: 'block', marginBottom: 6 }}>
                Duration
              </label>
              <select
                className="booking-select"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                {Array.from({ length: maxDuration - minDuration + 1 }, (_, i) => minDuration + i)
                  .filter((d) => d === minDuration || d === maxDuration || d % 7 === 0)
                  .map((d) => (
                    <option key={d} value={d}>{d} days</option>
                  ))}
              </select>
            </div>

            {/* Guest count */}
            <div className="booking-field" style={{ marginTop: 20 }}>
              <label className="booking-label" style={{ display: 'block', marginBottom: 6 }}>
                Number of guests
              </label>
              <select
                className="booking-select"
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
              >
                {Array.from({ length: Math.min(maxGuests, 10) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n} guest{n !== 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>

            {/* Date summary */}
            {startDate && endDate && (
              <div style={{
                background: 'var(--cream)',
                borderRadius: 'var(--r-md)',
                padding: '12px 16px',
                fontSize: '0.85rem',
                color: 'var(--slate)',
                marginTop: 20,
                marginBottom: 12,
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
              }}>
                <span>
                  {new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' → '}
                  {new Date(endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {guestCount > 1 && ` · ${guestCount} guests`}
                </span>
                {estimatedTotal > 0 && (
                  <span style={{ fontWeight: 600, color: 'var(--forest)' }}>
                    Est. ${estimatedTotal.toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {/* Error */}
            {submitError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--r-md)',
                padding: '10px 14px',
                fontSize: '0.83rem',
                color: '#dc2626',
                marginBottom: 12,
              }}>
                {submitError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="btn-book"
              style={{ marginTop: 8, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
              disabled={!canSubmit}
            >
              {submitting ? 'Sending request…' : 'Request booking'}
            </button>

            <p className="booking-note">
              No payment required now. The retreat will confirm availability and contact you within 24 hours.
            </p>
          </div>
        </form>
      </div>
    </main>
  )
}

export default function BookingPage() {
  return (
    <Suspense fallback={
      <main style={{ background: 'var(--cream)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid var(--forest)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </main>
    }>
      <BookingForm />
    </Suspense>
  )
}
