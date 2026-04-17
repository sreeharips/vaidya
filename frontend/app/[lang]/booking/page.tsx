'use client'

import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
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
  photos?: string[]
  district?: string | null
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

type Step = 'details' | 'addons' | 'confirm'

// ── Step progress indicator ────────────────────────────────────────────────

function StepBar({ steps, current }: { steps: { id: Step; label: string }[]; current: Step }) {
  const currentIdx = steps.findIndex(s => s.id === current)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 32 }}>
      {steps.map((s, i) => {
        const idx = i
        const done = idx < currentIdx
        const active = idx === currentIdx
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Connector line */}
            {i > 0 && (
              <div style={{
                width: 48,
                height: 2,
                background: done || active ? 'var(--forest)' : 'var(--border)',
                transition: 'background 0.3s',
                flexShrink: 0,
              }} />
            )}
            {/* Step circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: `2px solid ${active ? 'var(--forest)' : done ? 'var(--forest)' : 'var(--border)'}`,
                background: done ? 'var(--forest)' : active ? 'var(--forest)' : '#fff',
                color: done || active ? '#fff' : 'var(--muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: done ? 14 : 13,
                fontWeight: 600,
                transition: 'all 0.3s',
                flexShrink: 0,
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: active ? 700 : 500,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: active ? 'var(--forest)' : done ? 'var(--forest)' : 'var(--muted)',
                whiteSpace: 'nowrap',
              }}>
                {s.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Retreat summary pill at top ────────────────────────────────────────────

function RetreatSummary({ clinic, pkg, pricePerNight, formatFromInr }: {
  clinic: ClinicData
  pkg: PackageData | null
  pricePerNight: number
  formatFromInr: (v: number) => string
}) {
  return (
    <div style={{
      background: 'rgba(30,61,47,0.06)',
      border: '1px solid rgba(30,61,47,0.12)',
      borderRadius: 'var(--r-md)',
      padding: '14px 16px',
      marginBottom: 24,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 8, background: 'var(--forest)',
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: '#fff', fontSize: 18, fontFamily: 'var(--serif)' }}>✦</span>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate)', lineHeight: 1.3, marginBottom: 2 }}>
          {pkg ? pkg.name : 'Ayurveda Retreat'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          {clinic.name}{clinic.district ? ` · ${clinic.district}` : ''}
        </div>
      </div>
      {pricePerNight > 0 && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--forest)' }}>{formatFromInr(pricePerNight)}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>per night</div>
        </div>
      )}
    </div>
  )
}

// ── Main form ──────────────────────────────────────────────────────────────

function BookingForm() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const lang = (params?.lang as string) || 'en'
  const { user, getAccessToken } = useAuth()
  const { formatFromInr } = useDisplayCurrency()
  const topRef = useRef<HTMLDivElement>(null)

  const clinicSlug = searchParams.get('clinic') || ''
  const retreatId = searchParams.get('retreat') || ''
  const preselectedAddons = searchParams.get('addons') || ''

  const [clinic, setClinic] = useState<ClinicData | null>(null)
  const [pkg, setPkg] = useState<PackageData | null>(null)
  const [loadError, setLoadError] = useState('')
  const [availableAddOns, setAvailableAddOns] = useState<ClinicAddOnOut[]>([])
  const [selectedAddOns, setSelectedAddOns] = useState<Map<string, number>>(new Map())
  const [step, setStep] = useState<Step>('details')

  const [guestName, setGuestName] = useState(user?.full_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [startDate, setStartDate] = useState('')
  const [duration, setDuration] = useState(14)
  const [guestCount, setGuestCount] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<BookingResult | null>(null)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (user) {
      if (!guestName && user.full_name) setGuestName(user.full_name)
      if (!email && user.email) setEmail(user.email)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (!clinicSlug) { setLoadError('No clinic specified.'); return }
    fetch(`${API_BASE}/api/clinics/${clinicSlug}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setClinic)
      .catch(() => setLoadError('Could not load clinic details. Please try again.'))
  }, [clinicSlug])

  useEffect(() => {
    if (!retreatId) return
    fetch(`${API_BASE}/api/retreats/${retreatId}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then((data: PackageData) => {
        setPkg({ ...data, price_inr: typeof data.price_inr === 'number' ? data.price_inr : 0 })
        if (data.duration_min_days) setDuration(data.duration_min_days)
      })
      .catch(() => {})
  }, [retreatId])

  useEffect(() => {
    if (!retreatId) return
    fetch(`${API_BASE}/api/retreats/${retreatId}/experiences`)
      .then(r => r.ok ? r.json() : { clinic_add_ons: [] })
      .then((data: { clinic_add_ons: ClinicAddOnOut[] }) => {
        setAvailableAddOns(data.clinic_add_ons ?? [])
        if (preselectedAddons) {
          const ids = preselectedAddons.split(',').filter(Boolean)
          const preselect = new Map<string, number>()
          for (const id of ids) {
            if (data.clinic_add_ons?.find((a: ClinicAddOnOut) => a.id === id)) preselect.set(id, 1)
          }
          if (preselect.size > 0) setSelectedAddOns(preselect)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retreatId])

  // Scroll to top of card on every step change
  function goToStep(s: Step) {
    setStep(s)
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  // Derived
  const endDate = (() => {
    if (!startDate) return ''
    const d = new Date(startDate)
    d.setDate(d.getDate() + duration)
    return d.toISOString().split('T')[0]
  })()

  const pkgInr = pkg ? (pkg.price_inr ?? 0) : 0
  const pricePerNightInr = pkg && pkgInr > 0 && pkg.duration_min_days
    ? Math.round(pkgInr / pkg.duration_min_days) : 0
  const baseTotal = Math.round(pricePerNightInr * duration * guestCount)
  const addOnsTotal = Array.from(selectedAddOns.entries()).reduce((sum, [id, qty]) => {
    const addon = availableAddOns.find(a => a.id === id)
    return sum + (addon ? Math.round(addon.price_inr * qty) : 0)
  }, 0)
  const estimatedTotalInr = baseTotal + addOnsTotal

  const minDuration = pkg?.duration_min_days ?? 7
  const maxDuration = pkg?.duration_max_days ?? 28
  const maxGuests = pkg?.max_guests_per_slot ?? 10
  const today = new Date().toISOString().split('T')[0]
  const canContinue = email.includes('@') && guestName.trim() !== '' && startDate !== ''

  const steps: { id: Step; label: string }[] = availableAddOns.length > 0
    ? [{ id: 'details', label: 'Your details' }, { id: 'addons', label: 'Enhance stay' }, { id: 'confirm', label: 'Confirm' }]
    : [{ id: 'details', label: 'Your details' }, { id: 'confirm', label: 'Confirm' }]

  function handleDetailsNext(e: React.FormEvent) {
    e.preventDefault()
    if (!canContinue) return
    goToStep(availableAddOns.length > 0 ? 'addons' : 'confirm')
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
      if (!res.ok) throw new Error(data.detail || `Error ${res.status}`)
      setResult(data)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (result) {
    return (
      <main style={{ background: 'var(--cream)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: 520, width: '100%' }}>
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: '0 8px 40px rgba(30,61,47,0.1)' }}>
            {/* Green top bar */}
            <div style={{ background: 'var(--forest)', padding: '32px 36px', textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, background: 'rgba(255,255,255,0.15)',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', border: '2px solid rgba(255,255,255,0.4)',
              }}>
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: '1.5rem', color: '#fff', fontWeight: 400, margin: '0 0 8px' }}>
                Booking Request Sent
              </h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: 0 }}>
                {result.clinic_name} will confirm within 24 hours
              </p>
            </div>

            {/* Summary */}
            <div style={{ padding: '28px 32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 24 }}>
                {[
                  ['Retreat', result.retreat_name],
                  ['Check-in', new Date(result.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })],
                  ['Check-out', new Date(result.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })],
                  ['Duration', `${result.nights} nights`],
                  ['Guests', `${result.guest_count} guest${result.guest_count !== 1 ? 's' : ''}`],
                  ...(result.add_ons?.length > 0 ? result.add_ons.map(ao => [ao.name_snapshot, formatFromInr(Math.round(ao.line_total_inr))]) : []),
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--muted)', fontSize: 13 }}>{label}</span>
                    <span style={{ color: 'var(--slate)', fontSize: 13, fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 0' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--forest)' }}>Estimated total</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--forest)' }}>{formatFromInr(Math.round(result.total_amount))}</span>
                </div>
              </div>

              <div style={{ background: 'var(--cream)', borderRadius: 'var(--r-md)', padding: '12px 16px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24 }}>
                A confirmation will be sent to <strong style={{ color: 'var(--slate)' }}>{email}</strong>. No payment is required now.
              </div>

              <button
                onClick={() => router.push(`/${lang}/clinics/${clinicSlug}`)}
                style={{
                  width: '100%', padding: '12px 0', background: 'var(--forest)', color: '#fff',
                  border: 'none', borderRadius: 'var(--r-xl)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Back to retreat
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <main style={{ background: 'var(--cream)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>{loadError}</p>
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

  // ── Step content ───────────────────────────────────────────────────────────

  return (
    <main style={{ background: 'var(--cream)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: 'var(--forest)', padding: '20px 24px 0' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: 13, cursor: 'pointer', padding: '0 0 16px', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            ← Back
          </button>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(1.3rem, 3vw, 1.7rem)', fontWeight: 400, color: '#fff', margin: '0 0 6px', lineHeight: 1.2 }}>
            {pkg?.name ?? 'Request a booking'}
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '0 0 20px' }}>
            {clinic.name}{clinic.district ? ` · ${clinic.district}` : ''}
          </p>
        </div>

        {/* Step bar sits at the bottom of the header */}
        <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 0 }}>
          <div style={{
            background: 'rgba(255,255,255,0.07)',
            borderRadius: 'var(--r-md) var(--r-md) 0 0',
            padding: '20px 24px 16px',
          }}>
            <StepBar steps={steps} current={step} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px 60px' }} ref={topRef}>
        <div style={{ background: '#fff', borderRadius: '0 0 var(--r-lg) var(--r-lg)', border: '1px solid var(--border)', borderTop: 'none', boxShadow: '0 8px 32px rgba(30,61,47,0.08)', padding: '28px 28px 32px' }}>

          {/* ── STEP 1: Details ─────────────────────────────────────────── */}
          {step === 'details' && (
            <form onSubmit={handleDetailsNext}>
              <RetreatSummary clinic={clinic} pkg={pkg} pricePerNight={pricePerNightInr} formatFromInr={formatFromInr} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                <Field label="Full name">
                  <input
                    type="text"
                    className="booking-input"
                    placeholder="Your full name"
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </Field>

                <Field label={<>Email address {user && <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 11, textTransform: 'none', letterSpacing: 0 }}>(your account email)</span>}</>}>
                  <input
                    type="email"
                    className="booking-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    readOnly={!!user}
                    style={{ width: '100%', ...(user ? { background: 'var(--cream)', cursor: 'default', color: 'var(--muted)' } : {}) }}
                  />
                </Field>

                <Field label="Preferred start date">
                  <input
                    type="date"
                    className="booking-input"
                    style={{ width: '100%' }}
                    min={today}
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    required
                  />
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Duration">
                    <select
                      className="booking-select"
                      value={duration}
                      onChange={e => setDuration(Number(e.target.value))}
                    >
                      {Array.from({ length: maxDuration - minDuration + 1 }, (_, i) => minDuration + i)
                        .filter(d => d === minDuration || d === maxDuration || d % 7 === 0)
                        .map(d => <option key={d} value={d}>{d} days</option>)}
                    </select>
                  </Field>

                  <Field label="Guests">
                    <select
                      className="booking-select"
                      value={guestCount}
                      onChange={e => setGuestCount(Number(e.target.value))}
                    >
                      {Array.from({ length: Math.min(maxGuests, 10) }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n} guest{n !== 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </Field>
                </div>

              </div>

              {/* Date + price summary */}
              {startDate && endDate && (
                <div style={{
                  background: 'var(--forest-lt)',
                  border: '1px solid rgba(30,61,47,0.12)',
                  borderRadius: 'var(--r-md)',
                  padding: '12px 16px',
                  marginTop: 20,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--forest)', fontWeight: 600 }}>
                      {new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      {' → '}
                      {new Date(endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {duration} nights{guestCount > 1 ? ` · ${guestCount} guests` : ''}
                    </div>
                  </div>
                  {estimatedTotalInr > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--forest)' }}>{formatFromInr(estimatedTotalInr)}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>estimated total</div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={!canContinue}
                style={{
                  width: '100%', marginTop: 24,
                  padding: '13px 0',
                  background: canContinue ? 'var(--forest)' : 'var(--border)',
                  color: canContinue ? '#fff' : 'var(--muted)',
                  border: 'none', borderRadius: 'var(--r-xl)',
                  fontSize: 14, fontWeight: 600,
                  cursor: canContinue ? 'pointer' : 'not-allowed',
                  transition: 'background 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                Continue
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>

              <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
                No payment required now. The retreat confirms availability within 24 hours.
              </p>
            </form>
          )}

          {/* ── STEP 2: Add-ons ─────────────────────────────────────────── */}
          {step === 'addons' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'var(--serif)', fontSize: '1.25rem', fontWeight: 400, color: 'var(--forest)', margin: '0 0 4px' }}>
                  Enhance Your Stay
                </h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                  Optional experiences arranged by {clinic.name}. You can skip these.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {availableAddOns.map(addon => {
                  const qty = selectedAddOns.get(addon.id) ?? 0
                  return (
                    <div
                      key={addon.id}
                      style={{
                        border: `1.5px solid ${qty > 0 ? 'var(--forest)' : 'var(--border)'}`,
                        borderRadius: 'var(--r-md)',
                        padding: '14px 16px',
                        background: qty > 0 ? 'rgba(30,61,47,0.03)' : '#fff',
                        transition: 'border-color 0.2s',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate)', marginBottom: 2 }}>{addon.name_en}</div>
                        {addon.description_en && (
                          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                            {addon.description_en.slice(0, 90)}{addon.description_en.length > 90 ? '…' : ''}
                          </div>
                        )}
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--forest)', marginTop: 5 }}>
                          {formatFromInr(Math.round(addon.price_inr))}
                        </div>
                      </div>
                      {/* Stepper */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => setSelectedAddOns(prev => {
                            const next = new Map(prev)
                            const cur = next.get(addon.id) ?? 0
                            if (cur <= 1) next.delete(addon.id)
                            else next.set(addon.id, cur - 1)
                            return next
                          })}
                          disabled={qty === 0}
                          style={{
                            width: 30, height: 30, borderRadius: '50%',
                            border: '1.5px solid var(--border)', background: '#fff',
                            cursor: qty === 0 ? 'not-allowed' : 'pointer',
                            fontSize: 18, lineHeight: 1, color: qty === 0 ? 'var(--border)' : 'var(--slate)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >−</button>
                        <span style={{ minWidth: 20, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--slate)' }}>{qty}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedAddOns(prev => {
                            const next = new Map(prev)
                            const cur = next.get(addon.id) ?? 0
                            if (cur < addon.max_per_booking) next.set(addon.id, cur + 1)
                            return next
                          })}
                          disabled={qty >= addon.max_per_booking}
                          style={{
                            width: 30, height: 30, borderRadius: '50%',
                            border: '1.5px solid var(--forest)',
                            background: qty >= addon.max_per_booking ? 'var(--forest-lt)' : 'var(--forest)',
                            color: qty >= addon.max_per_booking ? 'var(--forest)' : '#fff',
                            cursor: qty >= addon.max_per_booking ? 'not-allowed' : 'pointer',
                            fontSize: 18, lineHeight: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >+</button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {addOnsTotal > 0 && (
                <div style={{
                  background: 'var(--forest-lt)', border: '1px solid rgba(30,61,47,0.12)',
                  borderRadius: 'var(--r-md)', padding: '10px 16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: 13, marginBottom: 20,
                }}>
                  <span style={{ color: 'var(--muted)' }}>Add-ons total</span>
                  <span style={{ fontWeight: 700, color: 'var(--forest)' }}>{formatFromInr(addOnsTotal)}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => goToStep('details')}
                  style={{
                    flex: 1, padding: '12px 0',
                    border: '1.5px solid var(--border)', borderRadius: 'var(--r-xl)',
                    background: '#fff', fontSize: 13, cursor: 'pointer', color: 'var(--slate)', fontWeight: 500,
                  }}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => goToStep('confirm')}
                  style={{
                    flex: 2, padding: '12px 0',
                    background: 'var(--forest)', color: '#fff',
                    border: 'none', borderRadius: 'var(--r-xl)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  Review booking
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Confirm ─────────────────────────────────────────── */}
          {step === 'confirm' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'var(--serif)', fontSize: '1.25rem', fontWeight: 400, color: 'var(--forest)', margin: '0 0 4px' }}>
                  Review your booking
                </h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                  Everything look right? No payment needed until the clinic confirms.
                </p>
              </div>

              {/* Summary rows */}
              <div style={{ background: 'var(--cream)', borderRadius: 'var(--r-md)', padding: '4px 0', marginBottom: 20 }}>
                {[
                  { label: 'Retreat', value: pkg?.name ?? '—' },
                  { label: 'Clinic', value: clinic.name },
                  { label: 'Guest name', value: guestName },
                  { label: 'Email', value: email },
                  { label: 'Check-in', value: startDate ? new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                  { label: 'Check-out', value: endDate ? new Date(endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                  { label: 'Duration', value: `${duration} nights` },
                  { label: 'Guests', value: `${guestCount} guest${guestCount !== 1 ? 's' : ''}` },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--slate)', textAlign: 'right', maxWidth: '60%' }}>{row.value}</span>
                  </div>
                ))}

                {/* Add-ons */}
                {Array.from(selectedAddOns.entries()).filter(([, q]) => q > 0).map(([id, qty]) => {
                  const addon = availableAddOns.find(a => a.id === id)
                  if (!addon) return null
                  return (
                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{addon.name_en} ×{qty}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--forest)' }}>{formatFromInr(Math.round(addon.price_inr * qty))}</span>
                    </div>
                  )
                })}

                {/* Total */}
                {estimatedTotalInr > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--forest)' }}>Estimated total</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--forest)' }}>{formatFromInr(estimatedTotalInr)}</span>
                  </div>
                )}
              </div>

              {submitError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 16 }}>
                  {submitError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => goToStep(availableAddOns.length > 0 ? 'addons' : 'details')}
                  style={{
                    flex: 1, padding: '12px 0',
                    border: '1.5px solid var(--border)', borderRadius: 'var(--r-xl)',
                    background: '#fff', fontSize: 13, cursor: 'pointer', color: 'var(--slate)', fontWeight: 500,
                  }}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => void handleBookingSubmit()}
                  disabled={submitting}
                  style={{
                    flex: 2, padding: '13px 0',
                    background: submitting ? 'var(--border)' : 'var(--forest)',
                    color: submitting ? 'var(--muted)' : '#fff',
                    border: 'none', borderRadius: 'var(--r-xl)',
                    fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Sending request…' : 'Confirm booking'}
                </button>
              </div>

              <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
                No payment required now · Clinic responds within 24 hours · Free cancellation
              </p>
            </div>
          )}

        </div>
      </div>
    </main>
  )
}

// ── Tiny helper ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="booking-label" style={{ display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
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
