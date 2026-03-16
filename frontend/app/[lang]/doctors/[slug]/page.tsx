import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import BackButton from './_components/BackButton'
import BookingCard from './_components/BookingCard'

export const revalidate = 3600

// API_URL is set in docker-compose for container-internal SSR fetches;
// falls back to NEXT_PUBLIC_API_URL for local dev outside Docker.
const API_BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// Seeded doctor slugs — fallback when API unavailable at build time
const STATIC_SLUGS = [
  'dr-suresh-krishnan-somatheeram',
  'dr-meera-nambiar-avs-kottakkal',
  'dr-rajeev-varma-mekosha',
  'dr-lakshmi-pillai-somatheeram',
  'dr-arun-menon-avs-kottakkal',
]

// ── Types ──────────────────────────────────────────────────────────────────────

interface TreatmentInline {
  id: string
  slug: string
  name: string
  duration_min_days: number | null
  duration_max_days: number | null
  price_per_day: number | null
  included_therapies: string[]
  prakriti_tags: string[]
}

interface ReviewOut {
  id: string
  rating: number
  review_text: string | null
  reviewer_location: string | null
  treatment_slug: string | null
  verified: boolean
  created_at: string
}

interface ClinicInline {
  id: string
  slug: string
  name: string
  district: string | null
}

interface DoctorDetail {
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
  patients_treated: number
  bio: string | null
  clinic: ClinicInline | null
  treatments: TreatmentInline[]
  reviews: ReviewOut[]
  next_available_date: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: 'var(--forest-lt)', color: 'var(--forest2)' },
  { bg: 'var(--gold-lt)',   color: 'var(--bark)' },
  { bg: 'var(--bark-lt)',   color: 'var(--bark)' },
]

function avatarColor(slug: string) {
  const n = slug.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[n % 3]
}

function initials(name: string): string {
  const parts = name.replace(/^Dr\.\s*/i, '').split(/\s+/)
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
}

function capitalize(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function fmtLanguage(code: string): string {
  return code.toUpperCase()
}

function fmtReviewDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function reviewAvatarInitial(location: string | null): string {
  if (!location) return '★'
  return location.trim()[0]?.toUpperCase() ?? '★'
}

const DOSHA_INFO: Record<string, {
  bg: string; border: string; nameColor: string; dotClass: string; desc: string
}> = {
  vata: {
    bg: 'var(--bark-lt)',
    border: 'rgba(107,79,58,.15)',
    nameColor: 'var(--bark)',
    dotClass: 'vata-dot',
    desc: 'Anxiety, dryness, joint pain, irregular digestion, sleep issues',
  },
  pitta: {
    bg: 'var(--forest-lt)',
    border: 'rgba(30,61,47,.1)',
    nameColor: 'var(--forest2)',
    dotClass: 'pitta-dot',
    desc: 'Inflammation, acidity, skin conditions, stress-driven burnout',
  },
  kapha: {
    bg: 'var(--gold-lt)',
    border: 'rgba(184,134,44,.15)',
    nameColor: 'var(--bark)',
    dotClass: 'kapha-dot',
    desc: 'Weight gain, lethargy, congestion, slow metabolism',
  },
}

async function fetchDoctor(slug: string, lang: string): Promise<DoctorDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/api/doctors/${slug}?lang=${lang}`, {
      next: { revalidate },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ── Static params + metadata ───────────────────────────────────────────────────

export async function generateStaticParams() {
  try {
    const res = await fetch(`${API_BASE}/api/doctors?limit=100`, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      return (data.items as Array<{ slug: string }>).map(d => ({ slug: d.slug }))
    }
  } catch {}
  return STATIC_SLUGS.map(slug => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: { lang: string; slug: string }
}): Promise<Metadata> {
  const d = await fetchDoctor(params.slug, params.lang)
  if (!d) return { title: 'Doctor Profile | Vaidya' }

  const title = `${d.name} — ${d.qualification} | Vaidya`
  const description =
    d.bio
      ? d.bio.slice(0, 155) + '…'
      : `Book ${d.name}, ${d.qualification}, at ${d.clinic?.name ?? 'Kerala'} — authentic Ayurveda on Vaidya.`

  return {
    title,
    description,
    alternates: { canonical: `/${params.lang}/doctors/${params.slug}` },
    openGraph: {
      title: `${d.name} — Ayurvedic Doctor in Kerala`,
      description,
      type: 'profile',
    },
    twitter: { card: 'summary', title, description },
  }
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DoctorProfilePage({
  params,
}: {
  params: { lang: string; slug: string }
}) {
  const { lang, slug } = params
  const d = await fetchDoctor(slug, lang)
  if (!d) notFound()

  const av = avatarColor(slug)
  const ins = initials(d.name)
  const tierLabel = d.tier === 2 ? 'Certified Authentic · Tier 2' : 'Verified · Tier 1'
  const tierBadge = d.tier === 2 ? 'badge-tier2' : 'badge-tier1'

  // Unique base doshas extracted from prakriti_affinities
  const BASE_DOSHAS = ['vata', 'pitta', 'kapha']
  const doshas = Array.from(
    new Set(
      d.prakriti_affinities
        .flatMap(a => a.split('-'))
        .filter(x => BASE_DOSHAS.includes(x))
    )
  )

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name: d.name,
    ...(d.bio ? { description: d.bio } : {}),
    medicalSpecialty: 'Ayurvedic Medicine',
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://vaidya.com'}/${lang}/doctors/${slug}`,
    hasCredential: {
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'degree',
      educationalLevel: d.qualification,
    },
    ...(d.clinic
      ? {
          worksFor: {
            '@type': 'MedicalOrganization',
            name: d.clinic.name,
            address: {
              '@type': 'PostalAddress',
              addressRegion: d.clinic.district ?? 'Kerala',
              addressCountry: 'IN',
            },
          },
        }
      : {}),
    ...(d.rating != null
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: d.rating,
            reviewCount: d.review_count,
          },
        }
      : {}),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main>
        {/* ── Profile hero ──────────────────────────────────────── */}
        <div className="profile-hero">
          <BackButton />

          <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
            {/* Avatar — real photo if available, else coloured initials */}
            <div
              className="profile-avatar"
              style={{ background: av.bg, color: av.color, overflow: 'hidden' }}
            >
              {d.photo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={d.photo_url} alt={d.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : ins
              }
            </div>

            <div style={{ flex: 1 }}>
              <div className="profile-name">{d.name}</div>
              <div className="profile-qual">
                {d.qualification} · {d.years_exp} years of practice
              </div>

              <div className="profile-badges">
                <span className={`profile-badge ${tierBadge}`}>✦ {tierLabel}</span>
                {d.languages.length > 0 && (
                  <span className="profile-badge badge-lang">
                    {d.languages.map(fmtLanguage).join(' · ')}
                  </span>
                )}
                {d.specialisations.slice(0, 2).map(s => (
                  <span key={s} className="profile-badge badge-spec">
                    {capitalize(s)}
                  </span>
                ))}
              </div>

              <div className="profile-stats">
                <div className="stat-item">
                  <span className="stat-val">{d.years_exp}</span>
                  <span className="stat-label">Years experience</span>
                </div>
                {d.rating != null && (
                  <div className="stat-item">
                    <span className="stat-val">{d.rating.toFixed(1)} ★</span>
                    <span className="stat-label">{d.review_count} reviews</span>
                  </div>
                )}
                <div className="stat-item">
                  <span className="stat-val">{d.patients_treated.toLocaleString()}+</span>
                  <span className="stat-label">Patients treated</span>
                </div>
                {(d.district ?? d.clinic?.district) && (
                  <div className="stat-item">
                    <span className="stat-val">{d.district ?? d.clinic?.district}</span>
                    <span className="stat-label">Location, Kerala</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Profile body ──────────────────────────────────────── */}
        <div className="profile-body">

          {/* LEFT COLUMN */}
          <div>

            {/* About */}
            {d.bio && (
              <div className="profile-section">
                <div className="profile-section-title">About</div>
                {d.bio.split(/\n+/).map((para, i) => (
                  <p
                    key={i}
                    style={{
                      fontSize: '15px',
                      lineHeight: 1.8,
                      color: 'var(--muted)',
                      marginTop: i > 0 ? '12px' : 0,
                    }}
                  >
                    {para}
                  </p>
                ))}
              </div>
            )}

            {/* Treatment programmes */}
            {d.treatments.length > 0 && (
              <div className="profile-section">
                <div className="profile-section-title">Treatment programmes</div>
                <div className="treatment-list">
                  {d.treatments.map(t => {
                    const durLabel =
                      t.duration_min_days != null && t.duration_max_days != null
                        ? t.duration_min_days === t.duration_max_days
                          ? `${t.duration_min_days} days`
                          : `${t.duration_min_days}–${t.duration_max_days} days`
                        : null
                    const therapiesLabel =
                      t.included_therapies.length > 0
                        ? t.included_therapies.slice(0, 3).map(capitalize).join(', ')
                        : null

                    return (
                      <div key={t.id} className="treatment-row">
                        <div>
                          <div className="treatment-name">{t.name}</div>
                          {(durLabel ?? therapiesLabel) && (
                            <div className="treatment-dur">
                              {[durLabel, therapiesLabel].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                        {t.price_per_day != null && (
                          <div className="treatment-price">${t.price_per_day}/day</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Prakriti specialisation */}
            {doshas.length > 0 && (
              <div className="profile-section">
                <div className="profile-section-title">Prakriti specialisation</div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {doshas.map((dosha, idx) => {
                    const info = DOSHA_INFO[dosha]
                    if (!info) return null
                    return (
                      <div
                        key={dosha}
                        style={{
                          flex: 1,
                          minWidth: '140px',
                          padding: '16px',
                          background: info.bg,
                          borderRadius: 'var(--r-md)',
                          border: `1px solid ${info.border}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span
                            className={`prakriti-dot ${info.dotClass}`}
                            style={{ width: '10px', height: '10px' }}
                          />
                          <strong style={{ fontSize: '14px', color: info.nameColor }}>
                            {capitalize(dosha)}
                          </strong>
                          <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: 'auto' }}>
                            {idx === 0 ? 'Primary' : 'Secondary'}
                          </span>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
                          {info.desc}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Patient reviews */}
            <div className="profile-section">
              <div className="profile-section-title">Patient reviews</div>
              {d.reviews.length === 0 ? (
                <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6 }}>
                  No verified reviews yet — be the first to book and share your experience.
                </p>
              ) : (
                <div className="review-list">
                  {d.reviews.map((r, idx) => {
                    const avatarColors = [
                      { bg: 'var(--forest-lt)', color: 'var(--forest2)' },
                      { bg: 'var(--gold-lt)',   color: 'var(--bark)' },
                    ]
                    const ac = avatarColors[idx % 2]
                    const stars = '★'.repeat(r.rating) + '☆'.repeat(Math.max(0, 5 - r.rating))
                    return (
                      <div key={r.id} className="review-item">
                        <div className="review-header">
                          <div
                            className="review-avatar"
                            style={{ background: ac.bg, color: ac.color }}
                          >
                            {reviewAvatarInitial(r.reviewer_location)}
                          </div>
                          <div>
                            <div className="review-name">
                              {r.reviewer_location ?? 'Verified patient'}
                            </div>
                            <div className="review-date">
                              {fmtReviewDate(r.created_at)}
                              {' · '}
                              <span style={{ color: 'var(--gold)' }}>{stars}</span>
                            </div>
                          </div>
                        </div>
                        {r.review_text && (
                          <p className="review-text">{r.review_text}</p>
                        )}
                        {r.treatment_slug && (
                          <span className="review-treatment">
                            {capitalize(r.treatment_slug)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div>
            <BookingCard
              doctorId={d.id}
              doctorName={d.name}
              clinicId={d.clinic?.id ?? null}
              treatments={d.treatments}
              nextAvailableDate={d.next_available_date}
              lang={lang}
              pricingPerDay={d.pricing_per_day}
            />

            {/* Clinic info card */}
            {d.clinic && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '16px',
                  background: 'var(--white)',
                  borderRadius: 'var(--r-lg)',
                  border: '1px solid var(--border)',
                }}
              >
                <p style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '10px',
                }}>
                  Clinic
                </p>

                <Link href={`/${lang}/clinics/${d.clinic.slug}`} style={{ textDecoration: 'none' }}>
                  <p style={{
                    fontFamily: 'var(--serif)',
                    fontSize: '17px',
                    color: 'var(--forest)',
                    marginBottom: '4px',
                  }}>
                    {d.clinic.name}
                  </p>
                </Link>

                {d.clinic.district && (
                  <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
                    {d.clinic.district}, Kerala
                  </p>
                )}

                <div className="map-placeholder">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Map — {d.clinic.district ?? 'Kerala'}
                </div>

                <Link
                  href={`/${lang}/clinics/${d.clinic.slug}`}
                  style={{ fontSize: '13px', color: 'var(--forest2)', fontWeight: 500, textDecoration: 'none' }}
                >
                  View clinic profile →
                </Link>
              </div>
            )}
          </div>

        </div>
      </main>
    </>
  )
}
