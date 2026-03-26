'use client'

import Link from 'next/link'

export interface ClinicSummary {
  id: string
  slug: string
  name: string
  tier: number
  district: string | null
  rating: number | null
  review_count: number
  wellness_categories: string[]
  languages: string[]
  pricing_min: number | null
  package_count: number
  cheapest_price: number | null
  certifications: string[]
  outcome_enrolled: boolean
  accommodation_available: boolean
  photos: string[]
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
}

export default function HomeClinicCard({ clinic, lang }: { clinic: ClinicSummary; lang: string }) {
  const tierLabel = clinic.tier === 2 ? 'Certified Authentic' : 'Verified'
  const tierBg    = clinic.tier === 2 ? 'rgba(184,134,44,0.85)' : 'rgba(30,61,47,0.85)'

  return (
    <Link href={`/${lang}/clinics/${clinic.slug}`} style={{ textDecoration: 'none', display: 'flex', height: '100%' }}>
      <div
        style={{
          background: '#fff', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column', width: '100%',
          transition: 'box-shadow var(--transition), transform var(--transition)',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow2)'; e.currentTarget.style.transform = 'translateY(-3px)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none';           e.currentTarget.style.transform = 'translateY(0)' }}
      >
        {/* Cover photo */}
        <div style={{ height: 180, background: 'linear-gradient(135deg, var(--forest-lt) 0%, var(--cream2) 100%)', position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
          {clinic.photos?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={clinic.photos[0]} alt={clinic.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 56, color: 'var(--forest2)', opacity: 0.18 }}>✦</span>
            </div>
          )}
          <span style={{ position: 'absolute', top: 12, left: 12, background: tierBg, color: '#fff', fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 99, letterSpacing: '0.04em' }}>
            {tierLabel}
          </span>
          {clinic.rating && (
            <span style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 3 }}>
              ★ {clinic.rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '20px 20px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, color: 'var(--forest)', lineHeight: 1.25, marginBottom: 4 }}>
            {clinic.name}
          </div>
          {clinic.district && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {clinic.district}, Kerala
            </div>
          )}

          {(clinic.wellness_categories ?? []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
              {(clinic.wellness_categories ?? []).slice(0, 3).map((s) => (
                <span key={s} style={{ fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 99, background: 'var(--cream2)', color: 'var(--slate)' }}>
                  {capitalize(s)}
                </span>
              ))}
              {(clinic.certifications ?? []).slice(0, 1).map((c) => (
                <span key={c} style={{ fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 99, background: 'var(--forest-lt)', color: 'var(--forest2)' }}>
                  {c}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            {clinic.accommodation_available && (
              <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                Accommodation
              </span>
            )}
            {clinic.outcome_enrolled && (
              <span style={{ fontSize: 11, color: 'var(--forest2)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                Outcome tracked
              </span>
            )}
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {clinic.cheapest_price != null ? (
              <div>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--forest)', fontWeight: 500 }}>${clinic.cheapest_price.toLocaleString()}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 3 }}>/night</span>
              </div>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Price on request</span>
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--forest)', background: 'var(--forest-lt)', padding: '7px 16px', borderRadius: 99 }}>
              View clinic →
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
