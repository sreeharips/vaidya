'use client'

import TierBadge from './TierBadge'
import StarRating from './StarRating'

export interface Clinic {
  id: string
  slug: string
  name: string
  tier: 1 | 2
  district: string | null
  rating: number | null
  review_count: number
  specialisations: string[]
  wellness_categories: string[]
  languages: string[]
  pricing_min: number | null
  pricing_max: number | null
  certifications: string[]
  outcome_enrolled: boolean
  accommodation_available: boolean
  photos: string[]
}

interface ClinicCardProps {
  clinic: Clinic
  onClick: (clinic: Clinic) => void
}

export default function ClinicCard({ clinic, onClick }: ClinicCardProps) {
  const coverPhoto = clinic.photos?.[0]

  return (
    <div
      onClick={() => onClick(clinic)}
      style={{
        background: 'var(--white)',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        transition: 'box-shadow var(--transition), transform var(--transition)',
        cursor: 'pointer',
        display: 'flex',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.boxShadow = 'var(--shadow2)'
        el.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.boxShadow = 'none'
        el.style.transform = 'translateY(0)'
      }}
    >
      {/* Image panel */}
      <div
        style={{
          width: '200px',
          flexShrink: 0,
          background: 'linear-gradient(135deg, var(--forest-lt) 0%, var(--cream2) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {coverPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverPhoto}
            alt={clinic.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ fontFamily: 'var(--serif)', fontSize: '40px', color: 'var(--forest2)', opacity: 0.3 }}>
            ✦
          </span>
        )}
        {/* Tier badge overlay */}
        <span
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            background: 'rgba(30,61,47,0.9)',
            color: 'var(--cream)',
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '4px 10px',
            borderRadius: '10px',
          }}
        >
          {clinic.tier === 2 ? 'Certified Authentic' : 'Verified'}
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '22px 24px', minWidth: 0 }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div
            style={{
              fontFamily: 'var(--serif)',
              fontSize: '21px',
              fontWeight: 500,
              color: 'var(--forest)',
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}
          >
            {clinic.name}
          </div>
          <div style={{ marginLeft: '12px', flexShrink: 0 }}>
            <TierBadge tier={clinic.tier} />
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: '14px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {clinic.district && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--muted)' }}>
              <LocationIcon />
              {clinic.district}, Kerala
            </span>
          )}
          {clinic.accommodation_available && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--muted)' }}>
              <HotelIcon />
              Accommodation
            </span>
          )}
          {clinic.outcome_enrolled && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--forest2)' }}>
              <CheckIcon />
              Outcome tracked
            </span>
          )}
        </div>

        {/* Specialisation tags */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {clinic.specialisations.slice(0, 4).map(s => (
            <span
              key={s}
              style={{
                fontSize: '11px',
                fontWeight: 500,
                padding: '4px 10px',
                borderRadius: '10px',
                background: 'var(--cream2)',
                color: 'var(--slate)',
              }}
            >
              {s}
            </span>
          ))}
          {clinic.certifications.slice(0, 2).map(c => (
            <span
              key={c}
              style={{
                fontSize: '11px',
                fontWeight: 500,
                padding: '4px 10px',
                borderRadius: '10px',
                background: 'var(--forest-lt)',
                color: 'var(--forest2)',
              }}
            >
              {c}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {clinic.pricing_min != null && (
              <div style={{ fontFamily: 'var(--serif)', fontSize: '17px', color: 'var(--forest)' }}>
                From ${clinic.pricing_min}{' '}
                <span style={{ fontFamily: 'var(--sans)', fontSize: '12px', fontWeight: 300, color: 'var(--muted)' }}>
                  / day
                </span>
              </div>
            )}
            {clinic.rating != null && (
              <div style={{ marginTop: '6px' }}>
                <StarRating rating={clinic.rating} count={clinic.review_count} size="sm" />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              style={btnOutlineStyle}
              onClick={e => { e.stopPropagation(); onClick(clinic) }}
            >
              View clinic
            </button>
            <button
              style={btnPrimaryStyle}
              onClick={e => { e.stopPropagation(); onClick(clinic) }}
            >
              Book now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const btnOutlineStyle: React.CSSProperties = {
  fontFamily: 'var(--sans)',
  fontSize: '13px',
  fontWeight: 500,
  padding: '8px 18px',
  borderRadius: 'var(--r-xl)',
  border: '1.5px solid var(--border2)',
  color: 'var(--slate)',
  background: 'transparent',
  cursor: 'pointer',
  transition: 'all var(--transition)',
}

const btnPrimaryStyle: React.CSSProperties = {
  fontFamily: 'var(--sans)',
  fontSize: '13px',
  fontWeight: 500,
  padding: '8px 18px',
  borderRadius: 'var(--r-xl)',
  border: 'none',
  color: 'var(--white)',
  background: 'var(--forest)',
  cursor: 'pointer',
  transition: 'all var(--transition)',
}

function LocationIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function HotelIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}
