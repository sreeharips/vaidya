import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import ClinicDoctorCard from '@/components/cards/ClinicDoctorCard'
import AvailabilityStrip from '@/components/clinics/AvailabilityStrip'

export const revalidate = 3600

const API_BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const STATIC_SLUGS = [
  'somatheeram-ayurveda-village',
  'arya-vaidya-sala-kottakkal',
  'mekosha-ayurveda-retreat',
  'vaidyaratnam-thrissur',
  'kairali-ayurvedic-health-village',
]

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProductVariant {
  id: string
  label: string
  sku: string | null
  price: number
  stock_qty: number
}

interface Product {
  id: string
  slug: string
  name: string
  description: string | null
  category: string | null
  prakriti_tags: string[]
  base_price: number | null
  currency: string
  photos: string[]
  is_gmp_certified: boolean
  variants: ProductVariant[]
}

interface Treatment {
  id: string
  slug: string
  name: string
  duration_min_days: number | null
  duration_max_days: number | null
  price_per_day: number | null
  included_therapies: string[]
  prakriti_tags: string[]
  doctors: string[]
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
  specialisations: string[]
  prakriti_affinities: string[]
  languages: string[]
  photo_url: string | null
}

interface Review {
  id: string
  rating: number
  review_text: string | null
  reviewer_location: string | null
  treatment_slug: string | null
  verified: boolean
  created_at: string
}

interface ClinicDetail {
  id: string
  slug: string
  name: string
  tier: number
  district: string | null
  rating: number | null
  review_count: number
  specialisations: string[]
  prakriti_affinities: string[]
  languages: string[]
  pricing_min: number | null
  pricing_max: number | null
  certifications: string[]
  outcome_enrolled: boolean
  accommodation_available: boolean
  photos: string[]
  address: string | null
  transport_info: string | null
  description: string | null
  phone: string | null
  email: string | null
  website_url: string | null
  lat: number | null
  lng: number | null
  doctors: Doctor[]
  treatments: Treatment[]
  products: Product[]
  reviews: Review[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
}

function lowestVariantPrice(product: Product): number | null {
  if (product.variants.length > 0) {
    return Math.min(...product.variants.map(v => v.price))
  }
  return product.base_price
}

// ── Data fetch ────────────────────────────────────────────────────────────────

async function fetchClinic(slug: string, lang: string): Promise<ClinicDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/api/clinics/${slug}?lang=${lang}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ── Static params ─────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  return STATIC_SLUGS.map((slug) => ({ slug }))
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { lang: string; slug: string }
}): Promise<Metadata> {
  const clinic = await fetchClinic(params.slug, params.lang)
  if (!clinic) return { title: 'Clinic not found | Vaidya' }
  const tierLabel = clinic.tier === 2 ? 'Certified Authentic' : 'Verified'
  return {
    title: `${clinic.name} — ${tierLabel} Ayurveda ${clinic.district ?? 'Kerala'} | Vaidya`,
    description: `${clinic.name} is a ${tierLabel} Ayurvedic clinic in ${clinic.district ?? 'Kerala'}. ${clinic.treatments.length} treatments, ${clinic.doctors.length} doctors. Book online.`,
    alternates: {
      canonical: `https://vaidya.com/${params.lang}/clinics/${params.slug}`,
    },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClinicPage({
  params,
}: {
  params: { lang: string; slug: string }
}) {
  const clinic = await fetchClinic(params.slug, params.lang)
  if (!clinic) notFound()

  const tierLabel    = clinic.tier === 2 ? 'Certified Authentic' : 'Verified'
  const tierColor    = clinic.tier === 2 ? 'var(--gold)' : 'var(--forest2)'
  const tierBg       = clinic.tier === 2 ? 'var(--gold-lt)' : 'var(--forest-lt)'
  const priceDisplay = clinic.pricing_min
    ? clinic.pricing_max
      ? `₹${clinic.pricing_min.toLocaleString()} – ₹${clinic.pricing_max.toLocaleString()} / day`
      : `From ₹${clinic.pricing_min.toLocaleString()} / day`
    : null

  // Group products by category for the shop section
  const productsByCategory = clinic.products.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category ?? 'Other'
    ;(acc[cat] ??= []).push(p)
    return acc
  }, {})

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalBusiness',
    name: clinic.name,
    address: clinic.address ?? undefined,
    geo: clinic.lat && clinic.lng ? { '@type': 'GeoCoordinates', latitude: clinic.lat, longitude: clinic.lng } : undefined,
    aggregateRating: clinic.rating
      ? { '@type': 'AggregateRating', ratingValue: clinic.rating, reviewCount: clinic.review_count }
      : undefined,
    medicalSpecialty: 'Ayurveda',
  }

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section
        style={{
          background: 'linear-gradient(135deg, var(--forest) 0%, var(--forest2) 100%)',
          padding: '64px 24px 56px',
          position: 'relative',
          overflow: 'hidden',
        }}
        className="hero-mandala"
      >
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {/* Back link */}
          <Link
            href={`/${params.lang}/search`}
            style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 28 }}
          >
            ← Back to search
          </Link>

          {/* Eyebrow */}
          <div className="hero-eyebrow-line" style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 500 }}>
              Ayurveda Clinic · {clinic.district ?? 'Kerala'}
            </span>
          </div>

          {/* Name */}
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 400,
              color: '#fff',
              lineHeight: 1.2,
              marginBottom: 16,
            }}
          >
            {clinic.name}
          </h1>

          {/* Tier badge + certifications */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            <span style={{ background: tierBg, color: tierColor, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99, letterSpacing: '0.04em' }}>
              {tierLabel}
            </span>
            {clinic.certifications.map((cert) => (
              <span key={cert} style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 500, padding: '4px 12px', borderRadius: 99 }}>
                {cert}
              </span>
            ))}
            {clinic.outcome_enrolled && (
              <span style={{ background: 'rgba(184,134,44,0.2)', color: 'var(--gold)', fontSize: 11, fontWeight: 500, padding: '4px 12px', borderRadius: 99 }}>
                Outcome Enrolled
              </span>
            )}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32 }}>
            {[
              { value: clinic.doctors.length,    label: 'Doctors' },
              { value: clinic.treatments.length, label: 'Treatments' },
              { value: clinic.products.length,   label: 'Products' },
              { value: clinic.review_count,      label: 'Reviews' },
              ...(clinic.rating ? [{ value: `${clinic.rating.toFixed(1)} ★`, label: 'Rating' }] : []),
              ...(priceDisplay ? [{ value: priceDisplay, label: 'Retreat pricing' }] : []),
            ].map(({ value, label }) => (
              <div key={label}>
                <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--gold)', fontFamily: 'var(--serif)' }}>{value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* ── About / Description ──────────────────────────────────────── */}
        {clinic.description && (
          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--forest)', marginBottom: 16 }}>
              About {clinic.name}
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--slate)', whiteSpace: 'pre-wrap' }}>
              {clinic.description}
            </p>
          </section>
        )}

        {/* ── Doctors ─────────────────────────────────────────────────────── */}
        {clinic.doctors.length > 0 && (
          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--forest)', marginBottom: 24 }}>
              Our Doctors
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {clinic.doctors.map((doc) => (
                <ClinicDoctorCard key={doc.id} doc={doc} lang={params.lang} />
              ))}
            </div>
          </section>
        )}

        {/* ── Treatments ──────────────────────────────────────────────────── */}
        {clinic.treatments.length > 0 && (
          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--forest)', marginBottom: 24 }}>
              Treatment Programmes
            </h2>
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
              {clinic.treatments.map((t, i) => (
                <div
                  key={t.id}
                  className="treatment-row"
                  style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)', padding: '18px 20px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--slate)', marginBottom: 4 }}>{t.name}</div>
                      {/* Duration */}
                      {(t.duration_min_days || t.duration_max_days) && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                          {t.duration_min_days === t.duration_max_days
                            ? `${t.duration_min_days} days`
                            : `${t.duration_min_days ?? '?'}–${t.duration_max_days ?? '?'} days`}
                        </div>
                      )}
                      {/* Prakriti tags */}
                      {t.prakriti_tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                          {t.prakriti_tags.map((tag) => (
                            <span key={tag} style={{ fontSize: 10, background: 'var(--gold-lt)', color: 'var(--bark)', padding: '2px 8px', borderRadius: 99 }}>
                              {capitalize(tag)}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Doctors delivering this treatment */}
                      {t.doctors.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                          By {t.doctors.join(', ')}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {t.price_per_day ? (
                        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--forest)' }}>
                          ₹{t.price_per_day.toLocaleString()}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)' }}>/day</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Price on request</div>
                      )}
                      <Link
                        href={`/${params.lang}/booking?clinic=${clinic.slug}&treatment=${t.slug}`}
                        style={{ display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--forest)', background: 'var(--forest-lt)', padding: '6px 14px', borderRadius: 99, textDecoration: 'none' }}
                      >
                        Book
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Herbal Products Shop ─────────────────────────────────────────── */}
        {clinic.products.length > 0 && (
          <section style={{ marginBottom: 56 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--forest)' }}>
                Herbal Products
              </h2>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Ships directly from {clinic.name}</span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24 }}>
              Authentic Ayurvedic formulations prepared by the clinic's own vaidyas.
            </p>

            {Object.entries(productsByCategory).map(([category, products]) => (
              <div key={category} style={{ marginBottom: 32 }}>
                {/* Category heading */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>
                    {capitalize(category)}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                  {products.map((product) => {
                    const fromPrice = lowestVariantPrice(product)
                    return (
                      <div
                        key={product.id}
                        style={{
                          background: '#fff',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--r-md)',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        {/* Product photo or placeholder */}
                        <div
                          style={{
                            height: 140,
                            background: 'var(--forest-lt)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          {product.photos[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.photos[0]}
                              alt={product.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <span style={{ fontSize: 36 }}>🌿</span>
                          )}
                        </div>

                        <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate)', marginBottom: 4 }}>
                            {product.name}
                          </div>

                          {product.description && (
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5 }}>
                              {product.description.length > 90 ? product.description.slice(0, 90) + '…' : product.description}
                            </div>
                          )}

                          {/* Prakriti tags */}
                          {product.prakriti_tags.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                              {product.prakriti_tags.map((tag) => (
                                <span key={tag} style={{ fontSize: 10, background: 'var(--gold-lt)', color: 'var(--bark)', padding: '2px 7px', borderRadius: 99 }}>
                                  {capitalize(tag)}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* GMP badge */}
                          {product.is_gmp_certified && (
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--forest2)', background: 'var(--forest-lt)', padding: '2px 8px', borderRadius: 99, display: 'inline-block', marginBottom: 8, width: 'fit-content' }}>
                              GMP Certified
                            </div>
                          )}

                          {/* Variants */}
                          {product.variants.length > 1 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                              {product.variants.map((v) => (
                                <span
                                  key={v.id}
                                  style={{
                                    fontSize: 11,
                                    border: '1px solid var(--border2)',
                                    borderRadius: 6,
                                    padding: '2px 8px',
                                    color: v.stock_qty > 0 ? 'var(--slate)' : 'var(--muted)',
                                    background: v.stock_qty > 0 ? '#fff' : 'var(--cream2)',
                                    textDecoration: v.stock_qty === 0 ? 'line-through' : 'none',
                                  }}
                                >
                                  {v.label} · ₹{v.price.toLocaleString()}
                                </span>
                              ))}
                            </div>
                          )}

                          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              {fromPrice != null ? (
                                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--forest)' }}>
                                  {product.variants.length > 1 ? 'From ' : ''}
                                  ₹{fromPrice.toLocaleString()}
                                  <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)', marginLeft: 2 }}>{product.currency}</span>
                                </span>
                              ) : (
                                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Price on request</span>
                              )}
                            </div>
                            <button
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: '#fff',
                                background: 'var(--forest)',
                                border: 'none',
                                padding: '7px 16px',
                                borderRadius: 99,
                                cursor: 'pointer',
                              }}
                            >
                              Add to cart
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ── Info strip (address / transport / accommodation) ──────────────── */}
        {(clinic.address || clinic.transport_info || clinic.accommodation_available) && (
          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--forest)', marginBottom: 20 }}>
              Getting Here
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {clinic.address && (
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 6 }}>Address</div>
                  <div style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.6 }}>{clinic.address}</div>
                </div>
              )}
              {clinic.transport_info && (
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 6 }}>Transport</div>
                  <div style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.6 }}>{clinic.transport_info}</div>
                </div>
              )}
              {clinic.accommodation_available && (
                <div style={{ background: 'var(--forest-lt)', border: '1px solid rgba(30,61,47,0.12)', borderRadius: 'var(--r-md)', padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--forest2)', marginBottom: 6 }}>Accommodation</div>
                  <div style={{ fontSize: 14, color: 'var(--forest)', lineHeight: 1.6 }}>On-site accommodation available for retreat guests.</div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Contact Information ──────────────────────────────────────── */}
        {(clinic.phone || clinic.email || clinic.website_url) && (
          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--forest)', marginBottom: 20 }}>
              Get in Touch
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {clinic.phone && (
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 6 }}>Phone</div>
                  <a href={`tel:${clinic.phone}`} style={{ fontSize: 14, color: 'var(--forest)', textDecoration: 'none', fontWeight: 500 }}>
                    {clinic.phone}
                  </a>
                </div>
              )}
              {clinic.email && (
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 6 }}>Email</div>
                  <a href={`mailto:${clinic.email}`} style={{ fontSize: 14, color: 'var(--forest)', textDecoration: 'none', fontWeight: 500 }}>
                    {clinic.email}
                  </a>
                </div>
              )}
              {clinic.website_url && (
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 6 }}>Website</div>
                  <a href={clinic.website_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--forest)', textDecoration: 'none', fontWeight: 500 }}>
                    Visit website →
                  </a>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Reviews ──────────────────────────────────────────────────────── */}
        {clinic.reviews.length > 0 && (
          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--forest)', marginBottom: 20 }}>
              Patient Reviews
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {clinic.reviews.map((r) => (
                <div key={r.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} style={{ color: i < r.rating ? 'var(--gold)' : 'var(--border2)', fontSize: 14 }}>★</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {r.reviewer_location && `${r.reviewer_location} · `}
                      {new Date(r.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  {r.review_text && (
                    <p style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.65, margin: 0 }}>{r.review_text}</p>
                  )}
                  {r.treatment_slug && (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
                      Treatment: {capitalize(r.treatment_slug)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Availability ─────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--forest)', marginBottom: 8 }}>
            Availability
          </h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Next 3 weeks — live slot availability</p>
          <AvailabilityStrip slug={clinic.slug} />
        </section>

        {/* ── CTA bar ──────────────────────────────────────────────────────── */}
        <section
          style={{
            background: 'linear-gradient(135deg, var(--forest) 0%, var(--forest2) 100%)',
            borderRadius: 'var(--r-lg)',
            padding: '36px 32px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, color: '#fff', fontWeight: 400, marginBottom: 4 }}>
              Ready to begin your retreat?
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              Book directly with {clinic.name}. No hidden fees.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link
              href={`/${params.lang}/booking?clinic=${clinic.slug}`}
              style={{ display: 'inline-block', background: 'var(--gold)', color: '#fff', fontSize: 14, fontWeight: 600, padding: '12px 24px', borderRadius: 99, textDecoration: 'none' }}
            >
              Book a retreat
            </Link>
            <Link
              href={`/${params.lang}/assessment`}
              style={{ display: 'inline-block', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 14, fontWeight: 500, padding: '12px 24px', borderRadius: 99, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              Get personalised matches
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}
