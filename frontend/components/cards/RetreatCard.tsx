'use client'

import Link from 'next/link'

export interface RetreatSummary {
  id: string
  name: string
  package_type: string
  wellness_categories: string[]
  duration_min_days: number
  duration_max_days: number
  price_usd: number
  includes_accommodation: boolean
  includes_meals: boolean
  photos: string[]
  clinic_name: string
  clinic_slug: string
  clinic_photos: string[]
  clinic_tier: number
  clinic_rating: number | null
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
}

export default function RetreatCard({ retreat, lang, featured }: { retreat: RetreatSummary; lang: string; featured?: boolean }) {
  const durationText = retreat.duration_min_days === retreat.duration_max_days
    ? `${retreat.duration_min_days} days`
    : `${retreat.duration_min_days}\u2013${retreat.duration_max_days} days`

  const heroImg = retreat.photos?.[0] ?? retreat.clinic_photos?.[0] ?? null
  const tierLabel = retreat.clinic_tier === 2 ? 'Certified Authentic' : 'Verified'
  const tierBg = retreat.clinic_tier === 2 ? 'rgba(184,134,44,0.85)' : 'rgba(30,61,47,0.85)'
  const imgH = featured ? 200 : 160

  return (
    <Link
      href={`/${lang}/retreats/${retreat.id}`}
      style={{ textDecoration: 'none', display: 'flex', height: '100%' }}
    >
      <div
        style={{
          background: '#fff', borderRadius: 'var(--r-lg)',
          border: featured ? '1px solid rgba(184,134,44,0.3)' : '1px solid var(--border)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column', width: '100%',
          transition: 'box-shadow var(--transition), transform var(--transition)',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow2)'; e.currentTarget.style.transform = 'translateY(-3px)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none';           e.currentTarget.style.transform = 'translateY(0)' }}
      >
        {/* Cover photo */}
        <div style={{ height: imgH, background: 'linear-gradient(135deg, #1E3D2F 0%, #2D5440 100%)', position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
          {heroImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImg} alt={retreat.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 56, color: 'var(--gold)', opacity: 0.25 }}>✦</span>
            </div>
          )}
          {/* Tier badge */}
          <span style={{ position: 'absolute', top: 10, left: 10, background: tierBg, color: '#fff', fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 99, letterSpacing: '0.04em' }}>
            {tierLabel}
          </span>
          {/* Rating */}
          {retreat.clinic_rating != null && (
            <span style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 3 }}>
              ★ {retreat.clinic_rating.toFixed(1)}
            </span>
          )}
          {/* Duration overlay */}
          <span style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            {durationText}
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 16px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Name + clinic */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 500, color: 'var(--forest)', lineHeight: 1.25, marginBottom: 2 }}>
              {retreat.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {retreat.clinic_name}
            </div>
          </div>

          {/* Package type badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: 'var(--gold-lt, rgba(184,134,44,0.12))', color: 'var(--bark, #6b5a2e)', letterSpacing: '0.02em' }}>
              {capitalize(retreat.package_type)}
            </span>
          </div>

          {/* Wellness categories */}
          {retreat.wellness_categories.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
              {retreat.wellness_categories.slice(0, 3).map((cat) => (
                <span key={cat} style={{ fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 99, background: 'var(--cream2)', color: 'var(--slate)' }}>
                  {capitalize(cat)}
                </span>
              ))}
            </div>
          )}

          {/* Includes badges */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            {retreat.includes_accommodation && (
              <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                Accommodation
              </span>
            )}
            {retreat.includes_meals && (
              <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
                Meals included
              </span>
            )}
          </div>

          {/* Price + CTA */}
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>From </span>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--forest)', fontWeight: 500 }}>${Math.round(retreat.price_usd).toLocaleString()}</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: featured ? '#fff' : 'var(--forest)', background: featured ? 'var(--forest)' : 'var(--forest-lt)', padding: '6px 14px', borderRadius: 99 }}>
              View →
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
