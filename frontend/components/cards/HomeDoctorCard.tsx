'use client'

import Link from 'next/link'

export interface DoctorSummary {
  id: string
  slug: string
  name: string
  qualification: string
  years_exp: number
  tier: number
  rating: number | null
  review_count: number
  specialisations: string[]
  prakriti_affinities: string[]
  languages: string[]
  district: string | null
  pricing_per_day: number | null
  photo_url: string | null
  clinic_id: string | null
  clinic_name: string | null
  clinic_slug: string | null
}

const AVATAR_COLORS = [
  { bg: 'var(--forest-lt)', color: 'var(--forest2)' },
  { bg: 'var(--gold-lt)',   color: 'var(--bark)'    },
  { bg: 'var(--bark-lt)',   color: 'var(--bark)'    },
  { bg: '#EAF0F6',          color: '#3A5A7A'         },
  { bg: '#F0EAF6',          color: '#5A3A7A'         },
]

function avatarColor(slug: string) {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
}

export default function HomeDoctorCard({ doctor, lang }: { doctor: DoctorSummary; lang: string }) {
  const av = avatarColor(doctor.slug)

  return (
    <Link href={`/${lang}/doctors/${doctor.slug}`} style={{ textDecoration: 'none', display: 'flex', height: '100%' }}>
      <div
        style={{
          background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          padding: '18px 18px 16px', display: 'flex', gap: 14, width: '100%',
          transition: 'box-shadow var(--transition), transform var(--transition)',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow2)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none';           e.currentTarget.style.transform = 'translateY(0)' }}
      >
        {/* Avatar */}
        <div style={{ width: 52, height: 52, borderRadius: 'var(--r-md)', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, flexShrink: 0, overflow: 'hidden' }}>
          {doctor.photo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={doctor.photo_url} alt={doctor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials(doctor.name)
          }
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500, color: 'var(--forest)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {doctor.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
            {doctor.qualification} · {doctor.years_exp}y exp
          </div>

          {doctor.clinic_name && (
            <div style={{ fontSize: 11, color: 'var(--forest2)', fontWeight: 500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              {doctor.clinic_name}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {doctor.specialisations.slice(0, 2).map((s) => (
              <span key={s} style={{ fontSize: 10, background: 'var(--cream2)', color: 'var(--slate)', padding: '2px 7px', borderRadius: 99 }}>
                {capitalize(s)}
              </span>
            ))}
            <span style={{ fontSize: 10, background: doctor.tier === 2 ? 'var(--gold-lt)' : 'var(--forest-lt)', color: doctor.tier === 2 ? 'var(--bark)' : 'var(--forest2)', padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>
              {doctor.tier === 2 ? 'Certified' : 'Verified'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
