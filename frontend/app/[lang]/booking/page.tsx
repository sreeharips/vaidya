'use client'

import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface ClinicDoctor {
  id: string
  name: string
  qualification: string
  photo_url: string | null
  years_exp: number
}

interface ClinicTreatment {
  id: string
  slug: string
  name: string
  duration_min_days: number | null
  duration_max_days: number | null
  price_per_day: number | null
  doctors: string[]  // names
}

interface ClinicData {
  id: string
  name: string
  doctors: ClinicDoctor[]
  treatments: ClinicTreatment[]
}

interface BookingResult {
  booking_id: string
  status: string
  total_amount: number
  currency: string
  nights: number
  clinic_name: string
  doctor_name: string
  treatment_name: string
  start_date: string
  end_date: string
}

function BookingForm() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const lang = (params?.lang as string) || 'en'

  const clinicSlug = searchParams.get('clinic') || ''
  const treatmentSlug = searchParams.get('treatment') || ''

  const [clinic, setClinic] = useState<ClinicData | null>(null)
  const [treatment, setTreatment] = useState<ClinicTreatment | null>(null)
  const [availableDoctors, setAvailableDoctors] = useState<ClinicDoctor[]>([])
  const [loadError, setLoadError] = useState('')

  // Form state
  const [email, setEmail] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [duration, setDuration] = useState(14)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<BookingResult | null>(null)
  const [submitError, setSubmitError] = useState('')

  // Load clinic + resolve treatment
  useEffect(() => {
    if (!clinicSlug) { setLoadError('No clinic specified.'); return }

    fetch(`${API_BASE}/api/clinics/${clinicSlug}`)
      .then((r) => {
        if (!r.ok) throw new Error('Clinic not found')
        return r.json()
      })
      .then((data: ClinicData) => {
        setClinic(data)

        // Match treatment by slug
        const t = treatmentSlug
          ? data.treatments.find((x) => x.slug === treatmentSlug) || null
          : null
        setTreatment(t)

        // Build doctors list: treatment's named doctors matched against clinic doctors
        const clinicDocs = data.doctors || []
        if (t && t.doctors.length > 0) {
          const linked = clinicDocs.filter((d) => t.doctors.includes(d.name))
          setAvailableDoctors(linked.length > 0 ? linked : clinicDocs)
        } else {
          setAvailableDoctors(clinicDocs)
        }
      })
      .catch(() => setLoadError('Could not load clinic details. Please try again.'))
  }, [clinicSlug, treatmentSlug])

  // Auto-select doctor if only one
  useEffect(() => {
    if (availableDoctors.length === 1) {
      setDoctorId(availableDoctors[0].id)
    }
  }, [availableDoctors])

  // Derived
  const endDate = (() => {
    if (!startDate) return ''
    const d = new Date(startDate)
    d.setDate(d.getDate() + duration)
    return d.toISOString().split('T')[0]
  })()

  const pricePerDay = treatment?.price_per_day ?? 0
  const estimatedTotal = Math.round(pricePerDay * duration)

  const minDuration = treatment?.duration_min_days ?? 7
  const maxDuration = treatment?.duration_max_days ?? 28

  const today = new Date().toISOString().split('T')[0]

  const canSubmit = email.includes('@') && doctorId && startDate && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !clinic || !treatment) return
    setSubmitting(true)
    setSubmitError('')

    try {
      const res = await fetch(`${API_BASE}/api/bookings/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_id: clinic.id,
          doctor_id: doctorId,
          treatment_id: treatment.id,
          start_date: startDate,
          end_date: endDate,
          guest_email: email,
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
                ['Treatment', result.treatment_name],
                ['Doctor', `Dr. ${result.doctor_name.replace(/^Dr\.?\s*/i, '')}`],
                ['Dates', `${result.start_date} → ${result.end_date}`],
                ['Duration', `${result.nights} nights`],
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
              Back to clinic
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
            {treatment ? treatment.name : 'Request a booking'}
          </h1>
          {treatment && pricePerDay > 0 && (
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)' }}>
              from USD {pricePerDay.toFixed(0)}/night · {minDuration}–{maxDuration} days
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

            {/* Email */}
            <div className="booking-field">
              <label htmlFor="guest-email" className="booking-label" style={{ display: 'block', marginBottom: 6 }}>
                Email address{' '}
                <span style={{ fontWeight: 300, color: 'var(--muted)', fontSize: '11px', textTransform: 'none', letterSpacing: 0 }}>
                  (for confirmation)
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
                style={{ width: '100%' }}
              />
            </div>

            {/* Doctor picker */}
            {availableDoctors.length > 0 && (
              <div className="booking-field" style={{ marginTop: 20 }}>
                <label className="booking-label" style={{ display: 'block', marginBottom: 8 }}>
                  Choose your doctor
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {availableDoctors.map((doc) => (
                    <label
                      key={doc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '12px 16px',
                        border: `2px solid ${doctorId === doc.id ? 'var(--forest)' : 'var(--border)'}`,
                        borderRadius: 'var(--r-md)',
                        cursor: 'pointer',
                        background: doctorId === doc.id ? 'var(--forest-lt)' : '#fff',
                        transition: 'all 0.15s',
                      }}
                    >
                      <input
                        type="radio"
                        name="doctor"
                        value={doc.id}
                        checked={doctorId === doc.id}
                        onChange={() => setDoctorId(doc.id)}
                        style={{ accentColor: 'var(--forest)' }}
                      />
                      {doc.photo_url && (
                        <img
                          src={doc.photo_url}
                          alt={doc.name}
                          width={40}
                          height={40}
                          style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        />
                      )}
                      <div>
                        <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--slate)', marginBottom: 2 }}>
                          {doc.name}
                        </p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                          {doc.qualification} · {doc.years_exp} yrs experience
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

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
            <div className="booking-field">
              <label className="booking-label" style={{ display: 'block', marginBottom: 6 }}>
                Duration
              </label>
              <select
                className="booking-select"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                {[7, 14, 21, 28].filter((d) => d >= minDuration && d <= maxDuration).map((d) => (
                  <option key={d} value={d}>{d} days</option>
                ))}
                {/* fallback: if min/max don't align with presets, show min and max */}
                {![7, 14, 21, 28].some((d) => d >= minDuration && d <= maxDuration) && (
                  <>
                    <option value={minDuration}>{minDuration} days</option>
                    <option value={maxDuration}>{maxDuration} days</option>
                  </>
                )}
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
                </span>
                {estimatedTotal > 0 && (
                  <span style={{ fontWeight: 600, color: 'var(--forest)' }}>
                    Est. USD {estimatedTotal.toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {/* Special requests */}
            <div className="booking-field">
              <label className="booking-label" style={{ display: 'block', marginBottom: 6 }}>
                Special requests{' '}
                <span style={{ fontWeight: 300, color: 'var(--muted)', fontSize: '11px', textTransform: 'none', letterSpacing: 0 }}>
                  (optional)
                </span>
              </label>
              <textarea
                rows={3}
                className="booking-input"
                placeholder="Dietary restrictions, accessibility needs, language preferences…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: '100%', resize: 'vertical', minHeight: 80 }}
              />
            </div>

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
              No payment required now. The clinic will confirm availability and contact you within 24 hours.
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
