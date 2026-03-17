'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Sidebar from '../_components/Sidebar'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface ClinicInfo {
  id: string
  slug: string
  name: string
  tier: number
  district: string | null
  rating: number | null
  review_count: number
  specialisations: string[]
  certifications: string[]
  outcome_enrolled: boolean
}

const TIER_LABELS: Record<number, string> = {
  1: 'Tier 1 — Verified',
  2: 'Tier 2 — Certified Authentic',
}

const CERT_LABELS: Record<string, string> = {
  AYUSH: 'AYUSH Registered',
  NABH: 'NABH Accredited',
  GMP: 'GMP-Certified Medicine',
  NABH_WELLNESS: 'NABH Wellness Certified',
}

export default function ProfilePage() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()

  const [clinic, setClinic] = useState<ClinicInfo | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated || (user?.role !== 'clinic_admin' && user?.role !== 'platform_admin')) {
      router.replace('/clinic/login')
      return
    }

    const token = localStorage.getItem('vaidya_refresh_token')
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}

    Promise.all([
      fetch(`${API}/api/clinic/me`, { credentials: 'include', headers }),
      fetch(`${API}/api/clinic/bookings?limit=1&status=pending`, { credentials: 'include', headers }),
    ]).then(async ([cRes, bRes]) => {
      if (cRes.ok) setClinic(await cRes.json())
      else setError('Could not load clinic profile')
      if (bRes.ok) {
        const bd = await bRes.json()
        setPendingCount(bd.pending_count ?? 0)
      }
    }).finally(() => setDataLoading(false))
  }, [isLoading, isAuthenticated, user])

  if (isLoading || dataLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontFamily: 'var(--sans)', fontSize: 14 }}>
        Loading…
      </div>
    )
  }

  return (
    <div className="portal-shell">
      <Sidebar clinicName={clinic?.name ?? null} pendingCount={pendingCount} />

      <main className="portal-main">
        <div className="portal-topbar">
          <span className="portal-page-title">Clinic Profile</span>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            Read-only — contact Vaidya support to update
          </span>
        </div>

        <div className="portal-content">
          {error && (
            <div style={{ background: 'rgba(197,48,48,0.08)', border: '1px solid rgba(197,48,48,0.2)', borderRadius: 'var(--r-sm)', padding: '10px 14px', fontSize: 13, color: '#c53030', marginBottom: 16 }}>
              {error}
            </div>
          )}

          {clinic ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>

              {/* Main info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                <div className="detail-card">
                  <div className="detail-section-title">Clinic details</div>
                  {[
                    { label: 'Name', value: clinic.name },
                    { label: 'Slug / URL', value: `/en/clinics/${clinic.slug}` },
                    { label: 'District', value: clinic.district ?? '—' },
                    { label: 'Credentialing tier', value: TIER_LABELS[clinic.tier] ?? `Tier ${clinic.tier}` },
                    { label: 'Rating', value: clinic.rating ? `${clinic.rating.toFixed(1)} / 5.0 (${clinic.review_count} reviews)` : 'No reviews yet' },
                    { label: 'Outcome data enrolled', value: clinic.outcome_enrolled ? 'Yes — contributing to AI flywheel' : 'No' },
                  ].map(r => (
                    <div key={r.label} className="detail-row">
                      <span className="detail-row-label">{r.label}</span>
                      <span className="detail-row-value" style={{ fontFamily: r.label === 'Slug / URL' ? 'monospace' : undefined, fontSize: r.label === 'Slug / URL' ? 12 : undefined }}>
                        {r.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="detail-card">
                  <div className="detail-section-title">Specialisations</div>
                  {clinic.specialisations.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
                      {clinic.specialisations.map(s => (
                        <span key={s} style={{ background: 'var(--forest-lt)', color: 'var(--forest)', fontSize: 12, padding: '4px 12px', borderRadius: 20, fontWeight: 500 }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--muted)' }}>None on record</p>
                  )}
                </div>

                <div className="detail-card">
                  <div className="detail-section-title">Certifications</div>
                  {clinic.certifications.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {clinic.certifications.map(c => (
                        <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                          <span style={{ color: 'var(--forest)', fontSize: 16 }}>✓</span>
                          <span style={{ color: 'var(--slate)' }}>{CERT_LABELS[c] ?? c}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--muted)' }}>No certifications on record</p>
                  )}
                </div>
              </div>

              {/* Side panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Tier badge */}
                <div className="detail-card" style={{ textAlign: 'center' }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 64, height: 64, borderRadius: '50%',
                    background: clinic.tier === 2 ? 'var(--gold-lt)' : 'var(--forest-lt)',
                    marginBottom: 12,
                  }}>
                    <span style={{ fontSize: 28 }}>{clinic.tier === 2 ? '★' : '✓'}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--forest)', marginBottom: 4 }}>
                    {clinic.tier === 2 ? 'Certified Authentic' : 'Verified'}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                    {clinic.tier === 2
                      ? 'Meets all Vaidya credentialing standards including outcome data enrollment and mystery patient audit.'
                      : 'AYUSH registration and physical inspection completed. Upgrade to Tier 2 for the Certified Authentic badge.'}
                  </p>
                </div>

                {/* Support notice */}
                <div className="detail-card">
                  <div className="detail-section-title">Update your profile</div>
                  <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 16 }}>
                    To update photos, specialisations, pricing, or doctor listings, contact the Vaidya partner team.
                  </p>
                  <a
                    href="mailto:partners@vaidya.health"
                    style={{ display: 'block', textAlign: 'center', padding: '11px', background: 'var(--forest)', color: '#fff', borderRadius: 'var(--r-xl)', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}
                  >
                    Contact support
                  </a>
                </div>

                {/* Public listing link */}
                <div className="detail-card">
                  <div className="detail-section-title">Your public listing</div>
                  <a
                    href={`/en/clinics/${clinic.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'block', textAlign: 'center', padding: '11px', background: 'transparent', color: 'var(--forest)', border: '1.5px solid var(--forest)', borderRadius: 'var(--r-xl)', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}
                  >
                    View patient-facing page →
                  </a>
                </div>
              </div>
            </div>
          ) : !error && (
            <p style={{ fontSize: 14, color: 'var(--muted)' }}>No clinic linked to this account.</p>
          )}
        </div>
      </main>
    </div>
  )
}
