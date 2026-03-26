'use client'

import Link from 'next/link'

export interface PackageSummary {
  id: string
  name: string
  package_type: string
  wellness_categories: string[]
  duration_min_days: number
  duration_max_days: number
  price_usd: number
  includes_accommodation: boolean
  includes_meals: boolean
  clinic_name: string
  clinic_slug: string
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
}

export default function PackageCard({ pkg, lang }: { pkg: PackageSummary; lang: string }) {
  const durationText = pkg.duration_min_days === pkg.duration_max_days
    ? `${pkg.duration_min_days} days`
    : `${pkg.duration_min_days}\u2013${pkg.duration_max_days} days`

  return (
    <Link
      href={`/${lang}/booking?clinic=${pkg.clinic_slug}&package=${pkg.id}`}
      style={{ textDecoration: 'none', display: 'flex', height: '100%' }}
    >
      <div
        style={{
          background: '#fff', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column', width: '100%',
          padding: '20px 20px 18px',
          transition: 'box-shadow var(--transition), transform var(--transition)',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow2)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none';           e.currentTarget.style.transform = 'translateY(0)' }}
      >
        {/* Header */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, color: 'var(--forest)', lineHeight: 1.3, marginBottom: 4 }}>
            {pkg.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {pkg.clinic_name}
          </div>
        </div>

        {/* Package type + duration */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: 'var(--gold-lt, rgba(184,134,44,0.12))', color: 'var(--bark, #6b5a2e)', letterSpacing: '0.02em' }}>
            {capitalize(pkg.package_type)}
          </span>
          <span style={{ fontSize: 12, color: 'var(--slate)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            {durationText}
          </span>
        </div>

        {/* Wellness categories */}
        {pkg.wellness_categories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
            {pkg.wellness_categories.slice(0, 3).map((cat) => (
              <span key={cat} style={{ fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 99, background: 'var(--cream2)', color: 'var(--slate)' }}>
                {capitalize(cat)}
              </span>
            ))}
          </div>
        )}

        {/* Includes badges */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          {pkg.includes_accommodation && (
            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              Accommodation
            </span>
          )}
          {pkg.includes_meals && (
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
            <span style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--forest)', fontWeight: 500 }}>${pkg.price_usd.toLocaleString()}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 3 }}>/night</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--forest)', background: 'var(--forest-lt)', padding: '7px 16px', borderRadius: 99 }}>
            View package →
          </span>
        </div>
      </div>
    </Link>
  )
}
