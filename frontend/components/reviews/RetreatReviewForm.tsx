'use client'

import { useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface Props {
  retreatName: string
}

type Step = 'idle' | 'submitting' | 'success' | 'error'

export default function RetreatReviewForm({ retreatName }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('idle')
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [location, setLocation] = useState('')
  const [bookingId, setBookingId] = useState('')
  const [email, setEmail] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === 0) { setErrorMsg('Please select a star rating.'); return }
    if (!bookingId.trim()) { setErrorMsg('Booking ID is required.'); return }
    if (!email.trim()) { setErrorMsg('Email is required.'); return }
    setErrorMsg('')
    setStep('submitting')
    try {
      const res = await fetch(`${API_BASE}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId.trim(),
          guest_email: email.trim(),
          rating,
          review_text: reviewText.trim() || null,
          reviewer_location: location.trim() || null,
        }),
      })
      if (res.status === 409) {
        setErrorMsg('A review for this booking has already been submitted.')
        setStep('error')
        return
      }
      if (res.status === 403) {
        setErrorMsg('Email does not match the booking.')
        setStep('error')
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data.detail ?? 'Something went wrong. Please try again.')
        setStep('error')
        return
      }
      setStep('success')
    } catch {
      setErrorMsg('Network error. Please try again.')
      setStep('error')
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '9px 20px', borderRadius: 99,
          border: '1px solid var(--forest)', background: 'transparent',
          color: 'var(--forest)', fontSize: 13, fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        ✏ Write a review
      </button>
    )
  }

  if (step === 'success') {
    return (
      <div style={{ background: 'var(--forest-lt)', border: '1px solid rgba(30,61,47,0.2)', borderRadius: 'var(--r-md)', padding: '20px 24px' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--forest)', marginBottom: 6 }}>Thank you for your review!</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
          Your review is pending verification and will appear once approved. This usually takes 1–2 business days.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '24px' }}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 400, color: 'var(--forest)', marginBottom: 4 }}>
        Review: {retreatName}
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
        Your booking ID and email are used to verify your stay. Reviews are published after moderation.
      </p>

      {/* Star rating */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Your rating *</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                fontSize: 28, color: n <= (hover || rating) ? 'var(--gold)' : 'var(--border2)',
                lineHeight: 1,
              }}
              aria-label={`${n} star${n !== 1 ? 's' : ''}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {/* Review text */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Your experience</label>
        <textarea
          value={reviewText}
          onChange={e => setReviewText(e.target.value)}
          rows={4}
          placeholder="Share what made your stay memorable — the treatments, team, food, surroundings..."
          style={inputStyle as React.CSSProperties}
        />
      </div>

      {/* Location */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Your location <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
        <input
          type="text"
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="e.g. Dubai, UAE"
          style={inputStyle as React.CSSProperties}
        />
      </div>

      {/* Booking ID */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Booking ID *</label>
        <input
          type="text"
          value={bookingId}
          onChange={e => setBookingId(e.target.value)}
          placeholder="Found in your booking confirmation email"
          style={inputStyle as React.CSSProperties}
        />
      </div>

      {/* Email */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Email used for booking *</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          style={inputStyle as React.CSSProperties}
        />
      </div>

      {errorMsg && (
        <div style={{ fontSize: 13, color: '#c0392b', marginBottom: 14, padding: '8px 12px', background: '#fdf0ee', borderRadius: 6 }}>
          {errorMsg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          type="submit"
          disabled={step === 'submitting'}
          style={{
            padding: '10px 24px', borderRadius: 99, border: 'none',
            background: 'var(--forest)', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: step === 'submitting' ? 'not-allowed' : 'pointer',
            opacity: step === 'submitting' ? 0.7 : 1,
          }}
        >
          {step === 'submitting' ? 'Submitting…' : 'Submit review'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setStep('idle'); setErrorMsg('') }}
          style={{
            padding: '10px 16px', borderRadius: 99,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--muted)', fontSize: 13, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.07em',
  color: 'var(--muted)',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)',
  fontSize: 13,
  color: 'var(--slate)',
  background: '#fafafa',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  resize: 'vertical' as const,
}
