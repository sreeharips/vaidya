import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
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

interface Package {
  id: string
  name: string
  description: string | null
  package_type: string | null
  wellness_categories: string[]
  duration_min_days: number | null
  duration_max_days: number | null
  price_usd: number | null
  includes_accommodation: boolean
  includes_meals: boolean
  includes_transfers: boolean
  max_guests_per_slot: number | null
}

interface TeamMember {
  id: string
  name: string
  qualification: string
  years_experience: number
  bio: string | null
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
  wellness_categories: string[]
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
  packages: Package[]
  team: TeamMember[]
  reviews: Review[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
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
  if (!clinic) return { title: 'Retreat not found | AyuRetreats' }
  const tierLabel = clinic.tier === 2 ? 'Certified Authentic' : 'Verified'
  return {
    title: `${clinic.name} — ${tierLabel} Ayurveda Retreat ${clinic.district ?? 'Kerala'} | AyuRetreats`,
    description: `${clinic.name} is a ${tierLabel} Ayurvedic wellness retreat in ${clinic.district ?? 'Kerala'}. ${clinic.packages.length} packages available. Book online.`,
    alternates: {
      canonical: `https://ayuretreats.com/${params.lang}/clinics/${params.slug}`,
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
      ? `$${clinic.pricing_min.toLocaleString()} – $${clinic.pricing_max.toLocaleString()} / night`
      : `From $${clinic.pricing_min.toLocaleString()} / night`
    : null

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HealthAndBeautyBusiness',
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
              Wellness Retreat · {clinic.district ?? 'Kerala'}
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
              { value: clinic.packages.length,  label: 'Packages' },
              { value: clinic.team.length,      label: 'Team members' },
              { value: clinic.review_count,     label: 'Reviews' },
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

        {/* ── Wellness Packages ─────────────────────────────────────────── */}
        {clinic.packages.length > 0 && (
          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--forest)', marginBottom: 24 }}>
              Wellness Packages
            </h2>
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
              {clinic.packages.map((pkg, i) => {
                const durationLabel =
                  pkg.duration_min_days && pkg.duration_max_days
                    ? pkg.duration_min_days === pkg.duration_max_days
                      ? `${pkg.duration_min_days} days`
                      : `${pkg.duration_min_days}–${pkg.duration_max_days} days`
                    : pkg.duration_min_days
                      ? `From ${pkg.duration_min_days} days`
                      : pkg.duration_max_days
                        ? `Up to ${pkg.duration_max_days} days`
                        : null

                const pricePerNight =
                  pkg.price_usd && pkg.duration_min_days
                    ? Math.round(pkg.price_usd / pkg.duration_min_days)
                    : null

                const includes: string[] = []
                if (pkg.includes_accommodation) includes.push('Accommodation')
                if (pkg.includes_meals) includes.push('Meals')
                if (pkg.includes_transfers) includes.push('Transfers')

                return (
                  <div
                    key={pkg.id}
                    style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)', padding: '20px 20px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--slate)' }}>{pkg.name}</div>
                          {pkg.package_type && (
                            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--forest-lt)', color: 'var(--forest2)', padding: '2px 8px', borderRadius: 99 }}>
                              {pkg.package_type}
                            </span>
                          )}
                        </div>

                        {pkg.description && (
                          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5 }}>
                            {pkg.description.length > 120 ? pkg.description.slice(0, 120) + '…' : pkg.description}
                          </div>
                        )}

                        {/* Duration */}
                        {durationLabel && (
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                            {durationLabel}
                          </div>
                        )}

                        {/* Wellness categories */}
                        {pkg.wellness_categories.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                            {pkg.wellness_categories.map((cat) => (
                              <span key={cat} style={{ fontSize: 10, background: 'var(--gold-lt)', color: 'var(--bark)', padding: '2px 8px', borderRadius: 99 }}>
                                {capitalize(cat)}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Includes */}
                        {includes.length > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            Includes: {includes.join(', ')}
                          </div>
                        )}

                        {/* Max guests */}
                        {pkg.max_guests_per_slot && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                            Max {pkg.max_guests_per_slot} guest{pkg.max_guests_per_slot !== 1 ? 's' : ''} per slot
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {pkg.price_usd ? (
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--forest)' }}>
                              ${pkg.price_usd.toLocaleString()}
                            </div>
                            {pricePerNight && (
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                ~${pricePerNight}/night
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Price on request</div>
                        )}
                        <Link
                          href={`/${params.lang}/booking?clinic=${clinic.slug}&package=${pkg.id}`}
                          style={{ display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--forest)', background: 'var(--forest-lt)', padding: '6px 14px', borderRadius: 99, textDecoration: 'none' }}
                        >
                          Book
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Our Team ──────────────────────────────────────────────────────── */}
        {clinic.team.length > 0 && (
          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--forest)', marginBottom: 24 }}>
              Our Team
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {clinic.team.map((member) => (
                <div
                  key={member.id}
                  style={{
                    background: '#fff',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    padding: '20px',
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                  }}
                >
                  {/* Photo or placeholder */}
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      background: 'var(--forest-lt)',
                      flexShrink: 0,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {member.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.photo_url}
                        alt={member.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: 18, color: 'var(--forest2)' }}>
                        {member.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate)', marginBottom: 2 }}>
                      {member.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                      {member.qualification} · {member.years_experience} yrs experience
                    </div>
                    {member.bio && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                        {member.bio.length > 100 ? member.bio.slice(0, 100) + '…' : member.bio}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
              Guest Reviews
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
                      Package: {capitalize(r.treatment_slug)}
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
