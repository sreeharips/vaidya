'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import SoftAuthNudge from '@/components/SoftAuthNudge'
import { useAuth } from '@/contexts/AuthContext'

function BookingForm() {
  const params = useParams()
  const searchParams = useSearchParams()
  const lang = (params?.lang as string) || 'en'
  const { isAuthenticated } = useAuth()

  const [email, setEmail] = useState('')
  const [showNudge, setShowNudge] = useState(false)

  // Show nudge once the guest has entered a valid-looking email
  function handleEmailBlur() {
    if (!isAuthenticated && email.includes('@')) {
      setShowNudge(true)
    }
  }

  return (
    <main style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <section
        style={{
          background: 'linear-gradient(135deg, #1a3c2e 0%, #2d5a3d 100%)',
          color: '#fff',
          padding: '2.5rem 1.5rem 2rem',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <p style={{ fontSize: '0.75rem', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Booking
          </p>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)', fontWeight: 400, lineHeight: 1.2 }}>
            Complete your booking
          </h1>
        </div>
      </section>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            padding: '28px',
            boxShadow: 'var(--shadow)',
          }}
        >
          {/* Email — always shown, no login gate */}
          <div className="booking-field">
            <label
              htmlFor="guest-email"
              className="booking-label"
              style={{ display: 'block', marginBottom: '6px' }}
            >
              Email address{' '}
              <span style={{ fontWeight: 300, textTransform: 'none', letterSpacing: 0, color: 'var(--muted)', fontSize: '11px' }}>
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
              onBlur={handleEmailBlur}
              style={{ width: '100%' }}
            />
          </div>

          {/* Soft nudge appears after email entered — only for guests */}
          {showNudge && (
            <SoftAuthNudge
              message="Sign in to track this booking automatically in your history."
              lang={lang}
            />
          )}

          {/* Date selection */}
          <div className="booking-field" style={{ marginTop: '20px' }}>
            <label className="booking-label" style={{ display: 'block', marginBottom: '6px' }}>
              Preferred start date
            </label>
            <input
              type="date"
              className="booking-input"
              style={{ width: '100%' }}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Duration */}
          <div className="booking-field">
            <label className="booking-label" style={{ display: 'block', marginBottom: '6px' }}>
              Duration
            </label>
            <select className="booking-select">
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="21">21 days</option>
              <option value="28">28 days</option>
            </select>
          </div>

          {/* Special requests */}
          <div className="booking-field">
            <label className="booking-label" style={{ display: 'block', marginBottom: '6px' }}>
              Special requests
            </label>
            <textarea
              rows={3}
              className="booking-input"
              placeholder="Dietary restrictions, accessibility needs, language preferences…"
              style={{ width: '100%', resize: 'vertical', minHeight: '80px' }}
            />
          </div>

          {/* Submit */}
          <button
            className="btn-book"
            style={{ marginTop: '8px' }}
            disabled={!email}
          >
            Request booking
          </button>

          <p className="booking-note">
            No payment required now. The clinic will confirm availability and contact you within 24 hours.
          </p>
        </div>
      </div>
    </main>
  )
}

export default function BookingPage() {
  return (
    <Suspense fallback={null}>
      <BookingForm />
    </Suspense>
  )
}
