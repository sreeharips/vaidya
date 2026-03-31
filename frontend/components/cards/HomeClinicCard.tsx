'use client'

import Link from 'next/link'
import { useDisplayCurrency } from '@/contexts/DisplayCurrencyContext'

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
  retreat_count: number
  cheapest_price: number | null
  certifications: string[]
  outcome_enrolled: boolean
  accommodation_available: boolean
  photos: string[]
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
}

export default function HomeClinicCard({
  clinic,
  lang,
  compact,
  featured,
}: {
  clinic: ClinicSummary
  lang: string
  /** Shorter image + tighter body for homepage above-the-fold */
  compact?: boolean
  /** Taller image + gold accent border for featured section */
  featured?: boolean
}) {
  const { formatFromInr } = useDisplayCurrency()
  const tierLabel = clinic.tier === 2 ? 'Certified Authentic' : 'Verified'
  const tierBg    = clinic.tier === 2 ? 'rgba(184,134,44,0.85)' : 'rgba(30,61,47,0.85)'
  const imgH = featured ? 200 : compact ? 120 : 180

  return (
    <Link href={`/${lang}/clinics/${clinic.slug}`} style={{ textDecoration: 'none', display: 'flex', height: '100%' }}>
      <div
        style={{
          background: '#fff', borderRadius: 'var(--r-lg)', border: featured ? '1px solid rgba(184,134,44,0.3)' : '1px solid var(--border)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column', width: '100%',
          transition: 'box-shadow var(--transition), transform var(--transition)',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow2)'; e.currentTarget.style.transform = 'translateY(-3px)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none';           e.currentTarget.style.transform = 'translateY(0)' }}
      >
        {/* Cover photo */}
        <div style={{ height: imgH, background: featured ? 'linear-gradient(135deg, #1E3D2F 0%, #2D5440 100%)' : 'linear-gradient(135deg, var(--forest-lt) 0%, var(--cream2) 100%)', position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
          {clinic.photos?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={clinic.photos[0]} alt={clinic.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: featured ? 64 : compact ? 40 : 56, color: featured ? 'var(--gold)' : 'var(--forest2)', opacity: featured ? 0.25 : 0.18 }}>✦</span>
            </div>
          )}
          <span style={{ position: 'absolute', top: compact ? 8 : 10, left: compact ? 8 : 10, background: tierBg, color: '#fff', fontSize: compact ? 9 : 10, fontWeight: 600, padding: compact ? '3px 8px' : '4px 10px', borderRadius: 99, letterSpacing: '0.04em' }}>
            {tierLabel}
          </span>
          {clinic.rating && (
            <span style={{ position: 'absolute', top: compact ? 8 : 10, right: compact ? 8 : 10, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: compact ? 11 : 12, fontWeight: 600, padding: compact ? '3px 8px' : '4px 10px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 3 }}>
              ★ {clinic.rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: compact ? '12px 14px 12px' : '16px 18px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {featured && clinic.review_count > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i < Math.round(clinic.rating ?? 0) ? 'var(--gold)' : 'var(--border2)'} stroke="none">
                  <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                </svg>
              ))}
              <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 2 }}>{clinic.review_count} review{clinic.review_count !== 1 ? 's' : ''}</span>
            </div>
          )}
          <div style={{ fontFamily: 'var(--serif)', fontSize: compact ? 16 : 19, fontWeight: 500, color: 'var(--forest)', lineHeight: 1.25, marginBottom: compact ? 2 : 3 }}>
            {clinic.name}
          </div>
          {clinic.district && (
            <div style={{ fontSize: compact ? 11 : 12, color: 'var(--muted)', marginBottom: compact ? 6 : 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {clinic.district}, Kerala
            </div>
          )}

          {(clinic.wellness_categories ?? []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: compact ? 4 : 5, marginBottom: compact ? 8 : 10 }}>
              {(clinic.wellness_categories ?? []).slice(0, compact ? 3 : 4).map((s) => (
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

          <div style={{ display: 'flex', gap: compact ? 8 : 12, marginBottom: compact ? 8 : 12, flexWrap: 'wrap' }}>
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
            {clinic.retreat_count > 0 && (
              <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
                {clinic.retreat_count} retreat{clinic.retreat_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {clinic.cheapest_price != null ? (
              <div>
                <span style={{ fontSize: compact ? 10 : 11, color: 'var(--muted)', marginRight: 4 }}>from</span>
                <span style={{ fontFamily: 'var(--serif)', fontSize: compact ? 15 : 17, color: 'var(--forest)', fontWeight: 500 }}>
                  {formatFromInr(clinic.cheapest_price)}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: compact ? 11 : 12, color: 'var(--muted)' }}>Price on request</span>
            )}
            <span style={{
              fontSize: compact ? 11 : 12, fontWeight: 600,
              color: featured ? '#fff' : 'var(--forest)',
              background: featured ? 'var(--forest)' : 'var(--forest-lt)',
              padding: compact ? '5px 11px' : '6px 14px', borderRadius: 99,
            }}>
              View retreat →
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
