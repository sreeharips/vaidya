'use client'

import Link from 'next/link'

export interface ClinicDoctor {
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
  photo_url: string | null
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

export default function ClinicDoctorCard({ doc, lang }: { doc: ClinicDoctor; lang: string }) {
  const av = avatarColor(doc.slug)

  return (
    <Link href={`/${lang}/doctors/${doc.slug}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          padding: 20, display: 'flex', gap: 14,
          transition: 'box-shadow var(--transition), transform var(--transition)',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow2)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none';           e.currentTarget.style.transform = 'translateY(0)' }}
      >
        {/* Avatar */}
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, flexShrink: 0, overflow: 'hidden' }}>
          {doc.photo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={doc.photo_url} alt={doc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials(doc.name)
          }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--slate)', marginBottom: 2 }}>{doc.name}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
            {doc.qualification} · {doc.years_exp}y exp
          </div>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
            background: doc.tier === 2 ? 'var(--gold-lt)' : 'var(--forest-lt)',
            color:      doc.tier === 2 ? 'var(--bark)'    : 'var(--forest2)',
          }}>
            {doc.tier === 2 ? 'Certified Authentic' : 'Verified'}
          </span>
          {doc.specialisations.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {doc.specialisations.slice(0, 3).map(s => (
                <span key={s} style={{ fontSize: 10, background: 'var(--cream2)', color: 'var(--muted)', padding: '2px 8px', borderRadius: 99 }}>
                  {capitalize(s)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
