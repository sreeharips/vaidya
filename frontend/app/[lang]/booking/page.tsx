'use client'

import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useDisplayCurrency } from '@/contexts/DisplayCurrencyContext'
import type { ClinicAddOnOut } from '@/lib/admin-api'

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
  /** Canonical effective price in INR */
  price_inr?: number
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
  add_ons_total_inr: number
  currency: string
  nights: number
  clinic_name: string
  retreat_name: string
  start_date: string
  end_date: string
  guest_count: number
  add_ons: Array<{ name_snapshot: string; price_inr_snapshot: number; quantity: number; line_total_inr: number }>
}

function BookingForm() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const lang = (params?.lang as string) || 'en'
  const { user, getAccessToken } = useAuth()
  const { formatFromInr } = useDisplayCurrency()

  const clinicSlug = searchParams.get('clinic') || ''
  const retreatId = searchParams.get('retreat') || ''
  const preselectedAddons = searchParams.get('addons') || ''

  const [clinic, setClinic] = useState<ClinicData | null>(null)
  const [pkg, setPkg] = useState<PackageData | null>(null)
  const [loadError, setLoadError] = useState('')

  // Add-ons state
  const [availableAddOns, setAvailableAddOns] = useState<ClinicAddOnOut[]>([])
  const [selectedAddOns, setSelectedAddOns] = useState<Map<string, number>>(new Map())
  const [step, setStep] = useState<'details' | 'addons' | 'confirm'>('details')

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
        setPkg({
          ...data,
          price_inr: typeof data.price_inr === 'number' ? data.price_inr : 0,
        })
        if (data.duration_min_days) {
          setDuration(data.duration_min_days)
        }
      })
      .catch(() => {
        // Package load failed — user can still submit without package details
      })
  }, [retreatId])

  // Load clinic add-ons
  useEffect(() => {
    if (!retreatId) return
    fetch(`${API_BASE}/api/retreats/${retreatId}/experiences`)
      .then((r) => r.ok ? r.json() : { clinic_add_ons: [] })
      .then((data: { clinic_add_ons: ClinicAddOnOut[] }) => {
        setAvailableAddOns(data.clinic_add_ons ?? [])
        // Pre-select from ?addons= query param
        if (preselectedAddons) {
          const ids = preselectedAddons.split(',').filter(Boolean)
          const preselect = new Map<string, number>()
          for (const id of ids) {
            const addon = data.clinic_add_ons?.find((a: ClinicAddOnOut) => a.id === id)
            if (addon) preselect.set(id, 1)
          }
          if (preselect.size > 0) setSelectedAddOns(preselect)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retreatId])

  // Derived
  const endDate = (() => {
    if (!startDate) return ''
    const d = new Date(startDate)
    d.setDate(d.getDate() + duration)
    return d.toISOString().split('T')[0]
  })()

  const pkgInr = pkg ? (pkg.price_inr ?? 0) : 0
  const pricePerNightInr =
    pkg && pkgInr > 0 && pkg.duration_min_days
      ? Math.round(pkgInr / pkg.duration_min_days)
      : 0
  const baseTotal = Math.round(pricePerNightInr * duration * guestCount)
  const addOnsTotal = Array.from(selectedAddOns.entries()).reduce((sum, [id, qty]) => {
    const addon = availableAddOns.find((a) => a.id === id)
    return sum + (addon ? Math.round(addon.price_inr * qty) : 0)
  }, 0)
  const estimatedTotalInr = baseTotal + addOnsTotal

  const minDuration = pkg?.duration_min_days ?? 7
  const maxDuration = pkg?.duration_max_days ?? 28
  const maxGuests = pkg?.max_guests_per_slot ?? 10

  const today = new Date().toISOString().split('T')[0]

  const canSubmit = email.includes('@') && guestName && startDate && !submitting

  function handleDetailsNext(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    if (availableAddOns.length > 0) {
      setStep('addons')
    } else {
      void handleBookingSubmit()
    }
  }

  async function handleBookingSubmit() {
    if (!clinic) return
    setSubmitting(true)
    setSubmitError('')

    const addOnsPayload = Array.from(selectedAddOns.entries())
      .filter(([, qty]) => qty > 0)
      .map(([id, quantity]) => ({ experience_id: id, add_on_type: 'clinic', quantity }))

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
          add_ons: addOnsPayload,
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
                ...(result.add_ons?.length > 0 ? result.add_ons.map((ao) => [ao.name_snapshot, formatFromInr(Math.round(ao.line_total_inr))]) : []),
                ['Estimated total', formatFromInr(Math.round(result.total_amount))],
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
          {pkg && pricePerNightInr > 0 && (
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)' }}>
              from {formatFromInr(pricePerNightInr)}/night · {minDuration}–{maxDuration} days
            </p>
          )}
        </div>
      </section>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <form onSubmit={handleDetailsNext}>
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
                {estimatedTotalInr > 0 && (
                  <span style={{ fontWeight: 600, color: 'var(--forest)' }}>
                    Est. {formatFromInr(estimatedTotalInr)}
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

            {/* Submit / Next */}
            <button
              type="submit"
              className="btn-book"
              style={{ marginTop: 8, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
              disabled={!canSubmit}
            >
              {availableAddOns.length > 0 ? 'Continue →' : (submitting ? 'Sending request…' : 'Request booking')}
            </button>

            <p className="booking-note">
              No payment required now. The retreat will confirm availability and contact you within 24 hours.
            </p>
          </div>
        </form>

        {/* ── Add-ons step ──────────────────────────────────────────────── */}
        {step === 'addons' && availableAddOns.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 28, marginTop: 24, boxShadow: 'var(--shadow)' }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: '1.3rem', color: 'var(--forest)', marginBottom: 6 }}>
              Enhance Your Stay
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
              Optional experiences arranged by {clinic?.name}. Select to add to your booking.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {availableAddOns.map((addon) => {
                const qty = selectedAddOns.get(addon.id) ?? 0
                return (
                  <div
                    key={addon.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      border: `1px solid ${qty > 0 ? 'var(--forest)' : 'var(--border)'}`,
                      borderRadius: 'var(--r-md)',
                      padding: '14px 16px',
                      background: qty > 0 ? 'rgba(30,61,47,0.03)' : '#fff',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate)', marginBottom: 2 }}>{addon.name_en}</div>
                      {addon.description_en && (
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {addon.description_en.slice(0, 80)}{addon.description_en.length > 80 ? '…' : ''}
                        </div>
                      )}
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--forest)', marginTop: 4 }}>
                        {formatFromInr(Math.round(addon.price_inr))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAddOns((prev) => {
                            const next = new Map(prev)
                            const cur = next.get(addon.id) ?? 0
                            if (cur <= 1) next.delete(addon.id)
                            else next.set(addon.id, cur - 1)
                            return next
                          })
                        }}
                        style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                        disabled={qty === 0}
                      >−</button>
                      <span style={{ minWidth: 20, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{qty}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAddOns((prev) => {
                            const next = new Map(prev)
                            const cur = next.get(addon.id) ?? 0
                            if (cur < addon.max_per_booking) next.set(addon.id, cur + 1)
                            return next
                          })
                        }}
                        style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--forest)', background: qty >= addon.max_per_booking ? 'var(--forest-lt)' : 'var(--forest)', color: qty >= addon.max_per_booking ? 'var(--forest)' : '#fff', cursor: qty >= addon.max_per_booking ? 'not-allowed' : 'pointer', fontSize: 16, lineHeight: 1 }}
                        disabled={qty >= addon.max_per_booking}
                      >+</button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Running total */}
            {addOnsTotal > 0 && (
              <div style={{ background: 'var(--cream)', borderRadius: 'var(--r-md)', padding: '10px 16px', fontSize: 13, color: 'var(--slate)', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                <span>Add-ons total</span>
                <span style={{ fontWeight: 600, color: 'var(--forest)' }}>{formatFromInr(addOnsTotal)}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setStep('details')}
                style={{ flex: 1, padding: '11px 0', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', background: '#fff', fontSize: 14, cursor: 'pointer', color: 'var(--slate)' }}
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => void handleBookingSubmit()}
                disabled={submitting}
                style={{ flex: 2, padding: '11px 0', background: 'var(--forest)', color: '#fff', border: 'none', borderRadius: 'var(--r-xl)', fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? 'Sending request…' : 'Confirm booking'}
              </button>
            </div>

            {submitError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 13, color: '#dc2626', marginTop: 12 }}>
                {submitError}
              </div>
            )}
          </div>
        )}
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
