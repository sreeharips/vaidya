'use client'

import TierBadge from './TierBadge'
import StarRating from './StarRating'

export interface Doctor {
  id: string
  slug: string
  name: string
  qualification: string
  years_exp: number
  tier: 1 | 2
  rating: number | null
  review_count: number
  specialisations: string[]
  prakriti_affinities: string[]
  languages: string[]
  photo_url: string | null
  pricing_per_day: number | null
  location_address: string | null
  available_dates: string[]
}

interface DoctorCardProps {
  doctor: Doctor
  onClick: (doctor: Doctor) => void
}

// Initials avatar color variants cycle from the design
const AVATAR_VARIANTS = ['', 'gold', 'bark'] as const

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

function avatarVariant(id: string): string {
  const n = parseInt(id.replace(/-/g, '').slice(-4), 16) % 3
  return AVATAR_VARIANTS[n]
}

export default function DoctorCard({ doctor, onClick }: DoctorCardProps) {
  const variant = avatarVariant(doctor.id)

  const avatarBg =
    variant === 'gold'
      ? 'var(--gold-lt)'
      : variant === 'bark'
      ? 'var(--bark-lt)'
      : 'var(--forest-lt)'
  const avatarColor =
    variant === 'gold' || variant === 'bark' ? 'var(--bark)' : 'var(--forest2)'

  const nextSlot = doctor.available_dates?.find(d => d >= new Date().toISOString().slice(0, 10))
  const nextSlotLabel = nextSlot
    ? new Date(nextSlot).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null

  const doshaTagStyle = (dosha: string): React.CSSProperties => {
    const d = dosha.toLowerCase()
    if (d.includes('vata'))  return { background: 'rgba(107,79,58,.1)',  color: 'var(--bark)' }
    if (d.includes('pitta')) return { background: 'rgba(30,61,47,.08)',  color: 'var(--forest2)' }
    if (d.includes('kapha')) return { background: 'rgba(184,134,44,.1)', color: 'var(--gold)' }
    return { background: 'var(--cream2)', color: 'var(--slate)' }
  }

  return (
    <div
      onClick={() => onClick(doctor)}
      style={{
        background: 'var(--white)',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)',
        padding: '24px',
        display: 'flex',
        gap: '20px',
        transition: 'box-shadow var(--transition), transform var(--transition)',
        cursor: 'pointer',
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
      {/* Avatar */}
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: 'var(--r-md)',
          flexShrink: 0,
          background: avatarBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--serif)',
          fontSize: '28px',
          fontWeight: 600,
          color: avatarColor,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {doctor.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doctor.photo_url} alt={doctor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          initials(doctor.name)
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row: name + tier badge */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '20px', fontWeight: 500, color: 'var(--forest)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              {doctor.name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
              {doctor.qualification} · {doctor.years_exp} years experience
            </div>
          </div>
          <div style={{ marginLeft: '12px', flexShrink: 0 }}>
            <TierBadge tier={doctor.tier} />
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {doctor.location_address && (
            <span style={metaItemStyle}>
              <LocationIcon />
              {doctor.location_address}
            </span>
          )}
          {nextSlotLabel && (
            <span style={metaItemStyle}>
              <ClockIcon />
              Next slot: {nextSlotLabel}
            </span>
          )}
          {doctor.languages.length > 0 && (
            <span style={metaItemStyle}>
              <ChatIcon />
              {doctor.languages.map(l => l.toUpperCase()).join(' · ')}
            </span>
          )}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {doctor.specialisations.slice(0, 3).map(s => (
            <span key={s} style={{ ...tagStyle }}>
              {s}
            </span>
          ))}
          {doctor.prakriti_affinities.slice(0, 2).map(d => (
            <span key={d} style={{ ...tagStyle, ...doshaTagStyle(d) }}>
              {d.charAt(0).toUpperCase() + d.slice(1)} specialist
            </span>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {doctor.pricing_per_day != null && (
              <div style={{ fontFamily: 'var(--serif)', fontSize: '18px', fontWeight: 500, color: 'var(--forest)' }}>
                ${doctor.pricing_per_day}{' '}
                <span style={{ fontFamily: 'var(--sans)', fontSize: '12px', fontWeight: 300, color: 'var(--muted)' }}>
                  / day · 7-day min
                </span>
              </div>
            )}
            {doctor.rating != null && (
              <div style={{ marginTop: '8px' }}>
                <StarRating rating={doctor.rating} count={doctor.review_count} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              style={btnOutlineStyle}
              onClick={e => { e.stopPropagation(); onClick(doctor) }}
            >
              View profile
            </button>
            <button
              style={btnPrimaryStyle}
              onClick={e => { e.stopPropagation(); onClick(doctor) }}
            >
              Book now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const metaItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  fontSize: '13px',
  color: 'var(--muted)',
}

const tagStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  padding: '4px 10px',
  borderRadius: '10px',
  background: 'var(--cream2)',
  color: 'var(--slate)',
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

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
