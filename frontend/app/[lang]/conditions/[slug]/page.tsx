import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'

const API_BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const ALL_SLUGS = [
  'back-pain', 'stress-anxiety', 'diabetes', 'arthritis', 'digestive-issues',
  'weight-management', 'skin-conditions', 'insomnia', 'sinusitis', 'hypertension',
  'chronic-fatigue', 'migraine', 'joint-pain', 'fertility', 'hair-loss',
  'psoriasis', 'asthma', 'kidney-stones', 'menstrual-disorders', 'detox-cleanse',
]

// ── Interfaces (mirror backend Pydantic models) ───────────────────────────────

interface Treatment {
  id: string
  slug: string
  name: string
  description: string | null
  clinic_id: string | null
  clinic_slug: string | null
  clinic_name: string | null
  duration_min_days: number | null
  duration_max_days: number | null
  price_per_day: number | null
  included_therapies: string[]
}

interface Doctor {
  id: string
  slug: string
  name: string
  qualification: string
  years_exp: number
  tier: number
  rating: number | null
  review_count: number
  prakriti_affinities: string[]
  languages: string[]
  specialisations: string[]
}

interface Clinic {
  id: string
  slug: string
  name: string
  tier: number
  district: string | null
  rating: number | null
  pricing_min: number | null
  pricing_max: number | null
  specialisations: string[]
}

interface Product {
  id: string
  slug: string
  name: string
  description: string | null
  category: string | null
  base_price: number | null
  currency: string
  is_gmp_certified: boolean
  clinic_name: string | null
  clinic_slug: string | null
}

interface ConditionData {
  slug: string
  name: string
  explanation: string | null
  treatment_slugs: string[]
  treatments: Treatment[]
  doctors: Doctor[]
  clinics: Clinic[]
  products: Product[]
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchCondition(slug: string, lang: string): Promise<ConditionData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/search/condition/${slug}?lang=${lang}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      slug: data.condition?.slug ?? slug,
      name: data.condition?.name ?? slug,
      explanation: data.condition?.explanation ?? null,
      treatment_slugs: data.condition?.treatment_slugs ?? [],
      treatments: data.treatments ?? [],
      doctors: data.doctors ?? [],
      clinics: data.clinics ?? [],
      products: data.products ?? [],
    }
  } catch {
    return null
  }
}

export async function generateStaticParams() {
  return ALL_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: { lang: string; slug: string }
}): Promise<Metadata> {
  const condition = await fetchCondition(params.slug, params.lang)
  if (!condition) return { title: 'Condition | Vaidya' }

  const title = `${condition.name} — Ayurveda Treatment Kerala | Vaidya`
  const description =
    condition.explanation ??
    `Discover authentic Ayurveda treatments for ${condition.name} in Kerala. Find verified vaidyas and clinics.`

  return {
    title,
    description,
    alternates: { canonical: `https://vaidya.com/${params.lang}/conditions/${params.slug}` },
    openGraph: { title, description, type: 'website' },
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function avatarColor(slug: string) {
  const colors = [
    { bg: '#e8f5e9', text: '#2e7d32' },
    { bg: '#e3f2fd', text: '#1565c0' },
    { bg: '#fce4ec', text: '#880e4f' },
    { bg: '#fff3e0', text: '#e65100' },
    { bg: '#f3e5f5', text: '#6a1b9a' },
  ]
  let hash = 0
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) & 0xffff
  return colors[hash % colors.length]
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
}

function stars(rating: number | null) {
  if (!rating) return null
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return `${'★'.repeat(full)}${half ? '½' : ''}${'☆'.repeat(5 - full - (half ? 1 : 0))}`
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  oils:       { bg: '#fff8e1', text: '#f57f17' },
  churnas:    { bg: '#e8f5e9', text: '#2e7d32' },
  lehyas:     { bg: '#fce4ec', text: '#880e4f' },
  capsules:   { bg: '#e3f2fd', text: '#1565c0' },
  decoctions: { bg: '#f3e5f5', text: '#6a1b9a' },
  external:   { bg: '#e0f2f1', text: '#004d40' },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ConditionPage({
  params,
}: {
  params: { lang: string; slug: string }
}) {
  const condition = await fetchCondition(params.slug, params.lang)
  if (!condition) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalCondition',
    name: condition.name,
    description: condition.explanation ?? undefined,
    possibleTreatment: condition.treatments.map((t) => ({
      '@type': 'MedicalTherapy',
      name: t.name,
    })),
  }

  const statItems = [
    { val: condition.treatments.length, label: 'Treatments' },
    { val: condition.doctors.length, label: 'Vaidyas' },
    { val: condition.clinics.length, label: 'Clinics' },
    { val: condition.products.length, label: 'Medicines' },
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main style={{ background: 'var(--cream)', minHeight: '100vh' }}>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section
          style={{
            background: 'linear-gradient(135deg, #1a3c2e 0%, #2d5a3d 100%)',
            color: '#fff',
            padding: '3rem 1.5rem 2.5rem',
          }}
        >
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            <Link
              href={`/${params.lang}/conditions`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: 'rgba(255,255,255,0.65)',
                fontSize: '0.85rem',
                textDecoration: 'none',
                marginBottom: '1.5rem',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              All conditions
            </Link>

            <p style={{ fontSize: '0.75rem', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
              Ayurveda treatment for
            </p>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(2rem, 5vw, 3rem)',
                fontWeight: 700,
                lineHeight: 1.15,
                marginBottom: '1.5rem',
              }}
            >
              {condition.name}
            </h1>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
              {statItems.map(({ val, label }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.9rem', fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--gold)', lineHeight: 1 }}>
                    {val}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.2rem' }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {/* Therapy tags */}
            {condition.treatment_slugs.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {condition.treatment_slugs.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 20,
                      padding: '0.25rem 0.85rem',
                      fontSize: '0.8rem',
                      color: 'rgba(255,255,255,0.88)',
                    }}
                  >
                    {capitalize(tag)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <div style={{ maxWidth: 960, margin: '0 auto', padding: '2.5rem 1.5rem' }}>

          {/* ── Explanation ─────────────────────────────────────────────── */}
          {condition.explanation && (
            <section
              style={{
                background: '#fff',
                border: '1px solid var(--border)',
                borderLeft: '4px solid var(--forest)',
                borderRadius: 12,
                padding: '1.75rem 2rem',
                marginBottom: '3rem',
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.25rem',
                  color: 'var(--forest)',
                  marginBottom: '0.85rem',
                }}
              >
                How Ayurveda treats {condition.name}
              </h2>
              <p style={{ fontSize: '1rem', color: '#444', lineHeight: 1.8 }}>
                {condition.explanation}
              </p>
            </section>
          )}

          {/* ── Recommended Treatments ──────────────────────────────────── */}
          {condition.treatments.length > 0 && (
            <section style={{ marginBottom: '3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.25rem' }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--forest)' }}>
                  Recommended Treatment Programmes
                </h2>
                {condition.treatments.length > 4 && (
                  <Link
                    href={`/${params.lang}/search?q=${encodeURIComponent(condition.name)}`}
                    style={{ fontSize: '0.85rem', color: 'var(--forest)', fontWeight: 600, textDecoration: 'none' }}
                  >
                    View all {condition.treatments.length} →
                  </Link>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {condition.treatments.slice(0, 4).map((t) => (
                  <div
                    key={t.id}
                    style={{
                      background: '#fff',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: '1.25rem 1.5rem',
                      display: 'flex',
                      gap: '1.25rem',
                      alignItems: 'flex-start',
                    }}
                  >
                    {/* Icon placeholder */}
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: 'var(--cream)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem',
                        flexShrink: 0,
                      }}
                    >
                      🌿
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--forest)', fontSize: '1rem' }}>
                          {t.name}
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0, alignItems: 'center' }}>
                          {(t.duration_min_days || t.duration_max_days) && (
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              {t.duration_min_days}
                              {t.duration_max_days && t.duration_max_days !== t.duration_min_days
                                ? `–${t.duration_max_days}`
                                : ''}{' '}
                              days
                            </span>
                          )}
                          {t.price_per_day && (
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--gold-dark)' }}>
                              ₹{t.price_per_day.toLocaleString()}/day
                            </span>
                          )}
                        </div>
                      </div>

                      {t.description && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '0.6rem' }}>
                          {t.description.length > 160 ? t.description.slice(0, 160) + '…' : t.description}
                        </p>
                      )}

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                        {t.included_therapies.slice(0, 4).map((th) => (
                          <span
                            key={th}
                            style={{
                              background: '#f0f7f4',
                              border: '1px solid #c8e6c9',
                              borderRadius: 10,
                              padding: '0.1rem 0.6rem',
                              fontSize: '0.72rem',
                              color: '#2e7d32',
                            }}
                          >
                            {capitalize(th)}
                          </span>
                        ))}
                        {t.clinic_name && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                            {t.clinic_slug ? (
                              <Link href={`/${params.lang}/clinics/${t.clinic_slug}`} style={{ color: 'var(--forest)', textDecoration: 'none', fontWeight: 600 }}>
                                {t.clinic_name}
                              </Link>
                            ) : t.clinic_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Doctors + Clinics (two-column) ──────────────────────────── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '2.5rem',
              marginBottom: '3rem',
            }}
          >
            {/* Doctors */}
            {condition.doctors.length > 0 && (
              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', color: 'var(--forest)' }}>
                    Specialist Vaidyas
                  </h2>
                  {condition.doctors.length > 3 && (
                    <Link
                      href={`/${params.lang}/doctors`}
                      style={{ fontSize: '0.82rem', color: 'var(--forest)', fontWeight: 600, textDecoration: 'none' }}
                    >
                      View all {condition.doctors.length} →
                    </Link>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {condition.doctors.slice(0, 3).map((doc) => {
                    const col = avatarColor(doc.slug)
                    return (
                      <Link
                        key={doc.id}
                        href={`/${params.lang}/doctors/${doc.slug}`}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '1rem',
                          background: '#fff',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          padding: '1rem',
                          textDecoration: 'none',
                        }}
                      >
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            background: col.bg,
                            color: col.text,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '1rem',
                            flexShrink: 0,
                          }}
                        >
                          {initials(doc.name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ fontWeight: 700, color: 'var(--forest)', fontSize: '0.95rem' }}>
                              {doc.name}
                            </div>
                            <span
                              style={{
                                background: doc.tier === 2 ? 'var(--gold)' : 'var(--forest)',
                                color: '#fff',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                borderRadius: 4,
                                padding: '0.15rem 0.45rem',
                                flexShrink: 0,
                                marginLeft: '0.5rem',
                              }}
                            >
                              Tier {doc.tier}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                            {doc.qualification} · {doc.years_exp}y exp
                            {doc.rating && (
                              <span style={{ marginLeft: '0.5rem', color: '#f59e0b' }}>
                                ★ {doc.rating.toFixed(1)}
                                <span style={{ color: 'var(--text-muted)', marginLeft: '0.2rem' }}>
                                  ({doc.review_count})
                                </span>
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                            {doc.specialisations.slice(0, 2).map((s) => (
                              <span
                                key={s}
                                style={{
                                  background: 'var(--cream)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 10,
                                  padding: '0.1rem 0.5rem',
                                  fontSize: '0.7rem',
                                  color: 'var(--forest)',
                                }}
                              >
                                {capitalize(s)}
                              </span>
                            ))}
                            {doc.languages.slice(0, 2).map((l) => (
                              <span
                                key={l}
                                style={{
                                  background: '#e8f5e9',
                                  border: '1px solid #c8e6c9',
                                  borderRadius: 10,
                                  padding: '0.1rem 0.5rem',
                                  fontSize: '0.7rem',
                                  color: '#2e7d32',
                                }}
                              >
                                {l}
                              </span>
                            ))}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Clinics */}
            {condition.clinics.length > 0 && (
              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', color: 'var(--forest)' }}>
                    Verified Clinics
                  </h2>
                  {condition.clinics.length > 3 && (
                    <Link
                      href={`/${params.lang}/clinics`}
                      style={{ fontSize: '0.82rem', color: 'var(--forest)', fontWeight: 600, textDecoration: 'none' }}
                    >
                      View all {condition.clinics.length} →
                    </Link>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {condition.clinics.slice(0, 3).map((clinic) => (
                    <Link
                      key={clinic.id}
                      href={`/${params.lang}/clinics/${clinic.slug}`}
                      style={{
                        display: 'block',
                        background: '#fff',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        padding: '1rem',
                        textDecoration: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--forest)', fontSize: '0.95rem' }}>
                          {clinic.name}
                        </div>
                        <span
                          style={{
                            background: clinic.tier === 2 ? 'var(--gold)' : 'var(--forest)',
                            color: '#fff',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            borderRadius: 4,
                            padding: '0.15rem 0.45rem',
                            flexShrink: 0,
                            marginLeft: '0.5rem',
                          }}
                        >
                          {clinic.tier === 2 ? 'Certified Authentic' : 'Verified'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span>{clinic.district}, Kerala</span>
                        {clinic.rating && (
                          <span style={{ color: '#f59e0b' }}>
                            ★ {clinic.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                      {(clinic.pricing_min || clinic.pricing_max) && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--gold-dark)', fontWeight: 700, marginBottom: '0.4rem' }}>
                          ₹{clinic.pricing_min?.toLocaleString()}–₹{clinic.pricing_max?.toLocaleString()} / day
                        </div>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {clinic.specialisations.slice(0, 3).map((s) => (
                          <span
                            key={s}
                            style={{
                              background: 'var(--cream)',
                              border: '1px solid var(--border)',
                              borderRadius: 10,
                              padding: '0.1rem 0.5rem',
                              fontSize: '0.7rem',
                              color: 'var(--forest)',
                            }}
                          >
                            {capitalize(s)}
                          </span>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── Medicines & Products ────────────────────────────────────── */}
          <section style={{ marginBottom: '3rem' }}>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.5rem',
                color: 'var(--forest)',
                marginBottom: '0.4rem',
              }}
            >
              Herbal Medicines & Products
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Authentic Ayurvedic medicines prepared by our verified clinics. GMP-certified preparations only.
            </p>

            {condition.products.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '0.85rem',
                }}
              >
                {condition.products.map((p) => {
                  const catStyle = p.category ? (CATEGORY_COLORS[p.category.toLowerCase()] ?? { bg: '#f5f5f5', text: '#555' }) : { bg: '#f5f5f5', text: '#555' }
                  return (
                    <div
                      key={p.id}
                      style={{
                        background: '#fff',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        padding: '1.1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      {/* Category + GMP badges */}
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {p.category && (
                          <span
                            style={{
                              background: catStyle.bg,
                              color: catStyle.text,
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              borderRadius: 6,
                              padding: '0.15rem 0.5rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {p.category}
                          </span>
                        )}
                        {p.is_gmp_certified && (
                          <span
                            style={{
                              background: '#e8f5e9',
                              color: '#2e7d32',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              borderRadius: 6,
                              padding: '0.15rem 0.5rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            GMP ✓
                          </span>
                        )}
                      </div>

                      <div style={{ fontWeight: 700, color: 'var(--forest)', fontSize: '0.92rem', lineHeight: 1.3 }}>
                        {p.name}
                      </div>

                      {p.description && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                          {p.description.length > 80 ? p.description.slice(0, 80) + '…' : p.description}
                        </div>
                      )}

                      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {p.base_price ? (
                          <div style={{ fontWeight: 700, color: 'var(--gold-dark)', fontSize: '0.95rem' }}>
                            {p.currency === 'INR' ? '₹' : p.currency}{p.base_price.toLocaleString()}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Price on enquiry</div>
                        )}
                        {p.clinic_name && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', maxWidth: '55%', lineHeight: 1.3 }}>
                            {p.clinic_slug ? (
                              <Link href={`/${params.lang}/clinics/${p.clinic_slug}`} style={{ color: 'var(--forest)', textDecoration: 'none' }}>
                                {p.clinic_name}
                              </Link>
                            ) : p.clinic_name}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div
                style={{
                  background: '#fff',
                  border: '1px dashed var(--border)',
                  borderRadius: 12,
                  padding: '2rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.88rem',
                }}
              >
                Medicine listings coming soon — clinics are currently uploading their product catalogues.
                <br />
                <Link
                  href={`/${params.lang}/clinics`}
                  style={{ color: 'var(--forest)', fontWeight: 600, textDecoration: 'none', marginTop: '0.5rem', display: 'inline-block' }}
                >
                  Browse verified clinics →
                </Link>
              </div>
            )}
          </section>

          {/* ── CTA bar ─────────────────────────────────────────────────── */}
          <section
            style={{
              background: 'linear-gradient(135deg, #1a3c2e 0%, #2d5a3d 100%)',
              borderRadius: 16,
              padding: '2.5rem',
              textAlign: 'center',
              color: '#fff',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.75rem',
                marginBottom: '0.75rem',
              }}
            >
              Find the right vaidya for {condition.name}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', marginBottom: '1.5rem', lineHeight: 1.6, maxWidth: 540, margin: '0 auto 1.5rem' }}>
              Take the Prakriti assessment to get personalised clinic and doctor recommendations based on your body constitution.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                href={`/${params.lang}/assessment`}
                style={{
                  background: 'var(--gold)',
                  color: '#fff',
                  padding: '0.85rem 2rem',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  textDecoration: 'none',
                }}
              >
                Get personalised matches →
              </Link>
              <Link
                href={`/${params.lang}/search?q=${encodeURIComponent(condition.name)}`}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  color: '#fff',
                  padding: '0.85rem 2rem',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  textDecoration: 'none',
                  border: '1px solid rgba(255,255,255,0.25)',
                }}
              >
                Browse all clinics
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
