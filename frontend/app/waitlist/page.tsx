'use client'

/**
 * Pre-launch waitlist page — /waitlist
 * REMOVE after launch: delete this folder (page.tsx + styles.css),
 * remove the `waitlist` exclusion from middleware.ts matcher, and
 * remove the include_router + import lines from backend/main.py.
 */

import { useState } from 'react'
import './styles.css'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const FEATURES = [
  { icon: '✦', label: 'Retreats that truly heal',  desc: 'Every retreat is handpicked for authentic healing — not spa tourism. Real practices, real results.' },
  { icon: '◈', label: 'Matched to your needs',     desc: 'Tell us what you want to heal. We find the retreat that fits your body, your goals, and your timeline.' },
  { icon: '◎', label: 'Book in your language',     desc: 'Arabic, Malayalam, German, English — explore and book in the language you think in.' },
  { icon: '❋', label: "God's Own Country",         desc: 'The most healing corner of the world — from Thiruvananthapuram to the misty hills of Wayanad.' },
]

export default function WaitlistPage() {
  const [email, setEmail]   = useState('')
  const [state, setState]   = useState<'idle' | 'loading' | 'success' | 'duplicate' | 'error'>('idle')
  const [position, setPosition] = useState<number | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.includes('@') || state === 'loading') return
    setState('loading')

    try {
      const res  = await fetch(`${API}/api/waitlist`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, source: 'landing' }),
      })
      const data = await res.json()

      if (res.status === 201) {
        setPosition(data.position)
        setState('success')
      } else if (res.status === 409) {
        setPosition(data.detail?.position ?? null)
        setState('duplicate')
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  return (
    <div className="wl-root">

      {/* Ambient glow */}
      <div className="wl-bg-glow" />

      {/* Concentric mandala rings */}
      <div className="wl-mandala" style={{ width: 600,  height: 600,  top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
      <div className="wl-mandala" style={{ width: 800,  height: 800,  top: '50%', left: '50%', transform: 'translate(-50%,-50%)', borderColor: 'rgba(193,155,60,0.07)' }} />
      <div className="wl-mandala" style={{ width: 1060, height: 1060, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', borderColor: 'rgba(193,155,60,0.04)' }} />

      <div className="wl-inner">

        {/* Brand */}
        <div className="wl-brand">
          <svg className="wl-brand-leaf" viewBox="0 0 28 28" fill="none">
            <path d="M14 2C14 2 4 8 4 16C4 21.5 8.5 26 14 26C19.5 26 24 21.5 24 16C24 8 14 2 14 2Z"
                  fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M14 6C14 6 7 11 7 17C7 20.3 10.1 23 14 23"
                  stroke="currentColor" strokeWidth="1" strokeOpacity="0.4"/>
            <path d="M14 2L14 26" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.3"/>
          </svg>
          <span className="wl-brand-name">AyurRetreats</span>
        </div>

        {/* Badge */}
        <div className="wl-badge">
          <span className="wl-badge-dot" />
          Coming Soon · Kerala, India
        </div>

        {/* Headline */}
        <h1 className="wl-headline">
          Heal from<br /><em>the source</em>
        </h1>
        <p className="wl-headline-sub">Find the retreat that gives your life back</p>

        {/* Divider */}
        <div className="wl-divider">
          <div className="wl-divider-line" />
          <span className="wl-divider-icon">✦</span>
          <div className="wl-divider-line" />
        </div>

        {/* Copy */}
        <p className="wl-copy">
          Most of us treat the symptoms. AyurRetreats takes you to Kerala — where
          ancient healing traditions have addressed the <strong>root cause of illness</strong> for
          over 5,000 years. We find you the right retreat, the right healer, the right
          programme — in your language, at your pace.
          <br /><br />
          Not a spa. Not a resort. <strong>A place where your body remembers how to heal.</strong>
        </p>

        {/* Form or success */}
        {(state === 'success' || state === 'duplicate') ? (
          <div className="wl-success-card">
            <div className="wl-success-icon">🌿</div>
            <p className="wl-success-title">
              {state === 'success' ? "You're on the list" : 'Already with us'}
            </p>
            <p className="wl-success-body">
              {state === 'success'
                ? "We'll reach out the moment AyurRetreats opens its doors. Your healing journey starts here — and you're early."
                : "This email is already on the list. We'll be in touch when we launch."}
            </p>
            {position && (
              <span className="wl-success-position">
                #{position} in the waitlist — you&apos;re early.
              </span>
            )}
          </div>
        ) : (
          <form className="wl-form" onSubmit={handleSubmit}>
            <div className="wl-input-row">
              <input
                className="wl-input"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setState('idle') }}
                required
                autoComplete="email"
              />
              <button className="wl-btn" type="submit" disabled={state === 'loading'}>
                {state === 'loading' ? 'Joining…' : 'Get early access'}
              </button>
            </div>
            {state === 'error' && (
              <p className="wl-error-msg">Something went wrong — please try again.</p>
            )}
          </form>
        )}

        {/* Feature grid */}
        <div className="wl-features">
          {FEATURES.map((f) => (
            <div className="wl-feature" key={f.label}>
              <span className="wl-feature-icon">{f.icon}</span>
              <p className="wl-feature-label">{f.label}</p>
              <p className="wl-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="wl-footer">
          <p className="wl-footer-tagline">&ldquo;Ārogyam paramam bhāgyam&rdquo; — Health is the greatest fortune</p>
          <p className="wl-footer-note">© 2026 AyurRetreats · Kerala, India · No spam, ever</p>
        </div>

      </div>
    </div>
  )
}
