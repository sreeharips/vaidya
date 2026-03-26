'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, Suspense, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

// ── Inner form (uses useSearchParams — needs Suspense boundary) ────────────────

function LoginForm() {
  const { login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams()
  const lang = (params?.lang as string) || 'en'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoDismissed, setInfoDismissed] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      const redirect = searchParams?.get('redirect')
      router.push(redirect && redirect.startsWith('/') ? redirect : `/${lang}`)
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--cream)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link
            href={`/${lang}`}
            style={{
              fontFamily: 'var(--serif)',
              fontSize: '32px',
              fontWeight: 600,
              color: 'var(--forest)',
              letterSpacing: '-0.02em',
              textDecoration: 'none',
            }}
          >
            <span style={{ color: 'var(--gold)' }}>✦</span> AyuRetreats
          </Link>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
            Authentic Ayurveda — Kerala
          </p>
        </div>

        {/* Info banner — guest-first framing */}
        {!infoDismissed && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              background: 'var(--forest-lt)',
              border: '1px solid rgba(30,61,47,0.12)',
              borderRadius: 'var(--r-md)',
              marginBottom: '24px',
            }}
          >
            <span style={{ fontSize: '15px', marginTop: '1px' }}>ℹ️</span>
            <p style={{ flex: 1, fontSize: '13px', color: 'var(--forest2)', lineHeight: 1.55, margin: 0 }}>
              You can browse retreats and book without signing in.{' '}
              Sign in to save your bookings across devices.
            </p>
            <button
              onClick={() => setInfoDismissed(true)}
              aria-label="Dismiss"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                fontSize: '16px',
                lineHeight: 1,
                padding: '0 2px',
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Card */}
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            padding: '32px 32px 28px',
            boxShadow: 'var(--shadow)',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontSize: '24px',
              fontWeight: 500,
              color: 'var(--forest)',
              letterSpacing: '-0.01em',
              marginBottom: '24px',
            }}
          >
            Sign in
          </h1>

          {/* Error banner */}
          {error && (
            <div
              role="alert"
              style={{
                padding: '10px 14px',
                background: '#fef2f2',
                border: '1px solid rgba(220,38,38,0.2)',
                borderRadius: 'var(--r-sm)',
                marginBottom: '20px',
                fontSize: '13px',
                color: '#dc2626',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: 'var(--muted)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  fontFamily: 'var(--sans)',
                  fontSize: '14px',
                  color: 'var(--slate)',
                  border: '1px solid var(--border2)',
                  borderRadius: 'var(--r-sm)',
                  padding: '10px 14px',
                  background: '#fff',
                  outline: 'none',
                  transition: 'border-color var(--transition)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--forest)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border2)')}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '8px' }}>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: 'var(--muted)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  fontFamily: 'var(--sans)',
                  fontSize: '14px',
                  color: 'var(--slate)',
                  border: '1px solid var(--border2)',
                  borderRadius: 'var(--r-sm)',
                  padding: '10px 14px',
                  background: '#fff',
                  outline: 'none',
                  transition: 'border-color var(--transition)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--forest)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border2)')}
              />
            </div>

            {/* Forgot password */}
            <div style={{ textAlign: 'right', marginBottom: '24px' }}>
              <Link
                href={`/${lang}/forgot-password`}
                style={{ fontSize: '12px', color: 'var(--gold)', textDecoration: 'none' }}
              >
                Forgot password?
              </Link>
            </div>

            {/* Sign-in button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                fontFamily: 'var(--sans)',
                fontSize: '15px',
                fontWeight: 500,
                padding: '13px',
                borderRadius: 'var(--r-xl)',
                border: 'none',
                background: loading ? 'var(--forest2)' : 'var(--forest)',
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all var(--transition)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '20px',
              }}
            >
              {loading && <Spinner />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>or continue with</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>

          {/* SSO — disabled placeholders */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '4px' }}>
            {(['Google', 'Apple'] as const).map((provider) => (
              <div key={provider} style={{ flex: 1, position: 'relative' }}>
                <button
                  disabled
                  title="Coming soon"
                  style={{
                    width: '100%',
                    fontFamily: 'var(--sans)',
                    fontSize: '13px',
                    fontWeight: 500,
                    padding: '10px',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--border2)',
                    background: '#fff',
                    color: 'var(--muted)',
                    cursor: 'not-allowed',
                    opacity: 0.6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '7px',
                  }}
                >
                  {provider === 'Google' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                  )}
                  {provider}
                  <span
                    style={{
                      fontSize: '10px',
                      background: 'var(--cream2)',
                      color: 'var(--muted)',
                      padding: '1px 6px',
                      borderRadius: '8px',
                    }}
                  >
                    Soon
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Register link */}
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--muted)' }}>
          Don&apos;t have an account?{' '}
          <Link
            href={`/${lang}/register`}
            style={{ color: 'var(--forest)', fontWeight: 500, textDecoration: 'none' }}
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}

// ── Spinner ────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      style={{ animation: 'spin 0.7s linear infinite' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
    </svg>
  )
}

// ── Page export with Suspense for useSearchParams ─────────────────────────────

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
