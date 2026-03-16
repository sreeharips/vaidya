'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

interface Treatment {
  id: string
  name: string
  duration_min_days: number | null
  duration_max_days: number | null
  price_per_day: number | null
}

interface BookingCardProps {
  doctorId: string
  doctorName: string
  clinicId: string | null
  treatments: Treatment[]
  nextAvailableDate: string | null
  lang: string
  pricingPerDay: number | null
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function durationOptions(min: number, max: number): number[] {
  if (min === max) return [min]
  const opts: number[] = [min]
  const mid = Math.round((min + max) / 2)
  if (mid !== min && mid !== max) opts.push(mid)
  if (!opts.includes(max)) opts.push(max)
  return opts
}

function generateSlots(nextAvailable: string | null): string[] {
  const base = nextAvailable
    ? new Date(nextAvailable)
    : new Date(Date.now() + 7 * 86_400_000)
  return [0, 3, 7, 10, 14, 17].map(n => {
    const d = new Date(base)
    d.setDate(d.getDate() + n)
    return d.toISOString().split('T')[0]
  })
}

function fmtSlot(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export default function BookingCard({
  doctorId,
  doctorName,
  clinicId,
  treatments,
  nextAvailableDate,
  lang,
  pricingPerDay,
}: BookingCardProps) {
  const [selectedTreatmentIdx, setSelectedTreatmentIdx] = useState(0)
  const [selectedDays, setSelectedDays] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedTreatment = treatments[selectedTreatmentIdx] ?? null

  const durationOpts = useMemo(() => {
    if (!selectedTreatment) return [7, 14]
    const min = selectedTreatment.duration_min_days ?? 7
    const max = selectedTreatment.duration_max_days ?? min
    return durationOptions(min, max)
  }, [selectedTreatment])

  const days = selectedDays ?? durationOpts[0] ?? 7
  const ppd = selectedTreatment?.price_per_day ?? pricingPerDay ?? 0
  const total = Math.round(days * ppd)

  const slots = useMemo(() => generateSlots(nextAvailableDate), [nextAvailableDate])

  const minPrice = useMemo(() => {
    if (!treatments.length) return pricingPerDay ?? 0
    return treatments.reduce(
      (m, t) => (t.price_per_day !== null && t.price_per_day < m ? t.price_per_day : m),
      treatments[0].price_per_day ?? pricingPerDay ?? 0
    )
  }, [treatments, pricingPerDay])

  async function handleBook() {
    if (!selectedDate) { setError('Please select a start date'); return }
    if (!clinicId) { setError('Clinic information unavailable'); return }
    if (!selectedTreatment) { setError('Please select a treatment'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/bookings/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_id: doctorId,
          clinic_id: clinicId,
          treatment_id: selectedTreatment.id,
          start_date: selectedDate,
          duration_days: days,
          lang,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Booking request failed')
      }
      setSuccess(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="booking-card">
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--forest-lt)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--forest2)" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p style={{ fontFamily: 'var(--serif)', fontSize: '20px', color: 'var(--forest)', marginBottom: '8px' }}>
            Booking requested
          </p>
          <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
            Your request has been sent. {doctorName}&apos;s clinic will confirm within 24 hours.
          </p>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '16px' }}>
            Check your email for confirmation details.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="booking-card">
      {/* Price row */}
      <div className="booking-price-row">
        <div className="booking-price">from ${Math.round(minPrice as number)}</div>
        <div className="booking-price-note">per day · min. {durationOpts[0]} days</div>
      </div>

      {/* Treatment selector */}
      {treatments.length > 0 && (
        <div className="booking-field">
          <div className="booking-label">Treatment programme</div>
          <select
            className="booking-select"
            value={selectedTreatmentIdx}
            onChange={e => {
              setSelectedTreatmentIdx(Number(e.target.value))
              setSelectedDays(null)
            }}
          >
            {treatments.map((t, i) => (
              <option key={t.id} value={i}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Duration selector */}
      <div className="booking-field">
        <div className="booking-label">Duration</div>
        <select
          className="booking-select"
          value={days}
          onChange={e => setSelectedDays(Number(e.target.value))}
        >
          {durationOpts.map(d => (
            <option key={d} value={d}>
              {d} days (${Math.round(d * ppd).toLocaleString()})
            </option>
          ))}
        </select>
      </div>

      {/* Available dates */}
      <div className="booking-field">
        <div className="booking-label">Available dates</div>
        <div className="booking-availability">
          {slots.map(slot => (
            <span
              key={slot}
              className={`avail-slot${selectedDate === slot ? ' selected' : ''}`}
              onClick={() => setSelectedDate(slot)}
            >
              {fmtSlot(slot)}
            </span>
          ))}
        </div>
      </div>

      {/* Total preview */}
      {selectedDate && (
        <p style={{ fontSize: '13px', color: 'var(--forest)', marginBottom: '14px', fontWeight: 500 }}>
          Total: ${total.toLocaleString()} · {days} days starting {fmtSlot(selectedDate)}
        </p>
      )}

      {error && (
        <p style={{ fontSize: '13px', color: '#c0392b', marginBottom: '10px' }}>{error}</p>
      )}

      <button className="btn-book" onClick={handleBook} disabled={loading}>
        {loading ? 'Requesting…' : 'Request booking'}
      </button>

      <Link
        href={`/${lang}/assessment/voice?doctor_id=${doctorId}`}
        className="btn-voice"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        Speak with {doctorName}
      </Link>

      <p className="booking-note">
        No payment until clinic confirms · Free cancellation up to 72 hours before
      </p>

      <div className="prakriti-nudge">
        <p>
          Not sure which treatment fits you? Take the Prakriti assessment for a
          personalised recommendation.
        </p>
        <Link href={`/${lang}/assessment`} className="nudge-btn">
          Take 8-min Prakriti assessment
        </Link>
      </div>
    </div>
  )
}
