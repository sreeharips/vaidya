import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import AvailabilityStrip from '@/components/clinics/AvailabilityStrip'
import { formatInrForVisitor } from '@/lib/currency/server'
import { fetchExperiences, type PlatformExperienceOut } from '@/lib/admin-api'

export const revalidate = 3600

const API_BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function fetchClinicPreview(slug: string, lang: string): Promise<ClinicDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/api/clinics/${slug}?lang=${lang}&preview=true`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Retreat {
  id: string
  name: string
  description: string | null
  package_type: string | null
  wellness_categories: string[]
  duration_min_days: number | null
  duration_max_days: number | null
  price_usd: number | null
  /** Effective package price in INR (API canonical). */
  price_inr: number
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
  retreat_id: string | null
  retreat_name: string | null
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
  specialisations: string[]
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
  operating_hours: Record<string, string> | null
  social_links: Record<string, string> | null
  pickup_available: boolean
  pickup_locations: string[]
  established_year: number | null
  highlights: string[]
  accommodation_types: string[]
  meal_options: string[]
  nearest_airport: string | null
  nearest_railway: string | null
  patient_capacity: number | null
  retreats: Retreat[]
  team: TeamMember[]
  reviews: Review[]
  is_active: boolean
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

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { lang: string; slug: string }
}): Promise<Metadata> {
  setRequestLocale(params.lang)
  const clinic = await fetchClinic(params.slug, params.lang)
  if (!clinic) return { title: 'Retreat not found | AyuRetreats' }
  const tierLabel = clinic.tier === 2 ? 'Certified Authentic' : 'Verified'
  return {
    title: `${clinic.name} — ${tierLabel} Ayurveda Retreat ${clinic.district ?? 'Kerala'} | AyuRetreats`,
    description: `${clinic.name} is a ${tierLabel} Ayurvedic wellness retreat in ${clinic.district ?? 'Kerala'}. ${clinic.retreats.length} retreats available. Book online.`,
    alternates: {
      canonical: `https://ayuretreats.com/${params.lang}/clinics/${params.slug}`,
    },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClinicPage({
  params,
  searchParams,
}: {
  params: { lang: string; slug: string }
  searchParams: { preview?: string }
}) {
  setRequestLocale(params.lang)
  const isPreview = searchParams?.preview === '1'
  const clinic = isPreview
    ? await fetchClinicPreview(params.slug, params.lang)
    : await fetchClinic(params.slug, params.lang)
  if (!clinic) notFound()

  const nearbyExperiences = await fetchExperiences({
    lat: clinic.lat ?? undefined,
    lng: clinic.lng ?? undefined,
    district: (!clinic.lat && clinic.district) ? clinic.district : undefined,
    limit: 6,
  })

  const tierLabel    = clinic.tier === 2 ? 'Certified Authentic' : 'Verified'
  const tierColor    = clinic.tier === 2 ? 'var(--gold)' : 'var(--forest2)'
  const tierBg       = clinic.tier === 2 ? 'var(--gold-lt)' : 'var(--forest-lt)'
  const { lang } = params
  const priceDisplay = clinic.pricing_min
    ? clinic.pricing_max
      ? `${formatInrForVisitor(clinic.pricing_min, lang)} – ${formatInrForVisitor(clinic.pricing_max, lang)} / night`
      : `From ${formatInrForVisitor(clinic.pricing_min, lang)} / night`
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
      {/* ── Preview banner — shown when super admin previews an inactive clinic ── */}
      {isPreview && !clinic.is_active && (
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: '#dc2626',
          color: '#fff',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          fontFamily: 'var(--sans)',
          fontSize: '14px',
          fontWeight: 500,
          boxShadow: '0 2px 8px rgba(220,38,38,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg style={{ width: 18, height: 18, flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>
              <strong>Preview mode</strong> — This clinic is not yet live to the public.
              Patients cannot find or book this clinic.
            </span>
          </div>
          <a
            href="/admin/platform"
            style={{
              color: '#fff',
              textDecoration: 'none',
              fontSize: '13px',
              padding: '4px 12px',
              border: '1px solid rgba(255,255,255,0.5)',
              borderRadius: 20,
              whiteSpace: 'nowrap',
            }}
          >
            ← Back to admin
          </a>
        </div>
      )}

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section
        style={{
          background: 'linear-gradient(135deg, #143d22 0%, #1e4d2c 100%)',
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
              fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
              fontWeight: 400,
              color: '#fff',
              lineHeight: 1.2,
              marginBottom: 12,
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
              { value: clinic.retreats.length,  label: 'Retreats' },
              { value: clinic.team.length,      label: 'Team members' },
              { value: clinic.review_count,     label: 'Reviews' },
              ...(clinic.rating ? [{ value: `${clinic.rating.toFixed(1)} ★`, label: 'Rating' }] : []),
              ...(priceDisplay ? [{ value: priceDisplay, label: 'Retreat pricing' }] : []),
              ...(clinic.established_year ? [{ value: `Est. ${clinic.established_year}`, label: 'Established' }] : []),
              ...(clinic.patient_capacity ? [{ value: clinic.patient_capacity, label: 'Max guests' }] : []),
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

        {/* ── Photo gallery ────────────────────────────────────────────── */}
        {(clinic.photos?.length ?? 0) > 0 && (
          <section style={{ marginBottom: 56 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: clinic.photos.length === 1 ? '1fr' : 'repeat(3, 1fr)',
                gap: 8,
                borderRadius: 'var(--r-md)',
                overflow: 'hidden',
              }}
            >
              {clinic.photos.slice(0, 6).map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={`${clinic.name} photo ${i + 1}`}
                  style={{
                    width: '100%',
                    height: i === 0 && clinic.photos.length > 1 ? 300 : 180,
                    objectFit: 'cover',
                    gridColumn: i === 0 && clinic.photos.length > 1 ? '1 / -1' : 'auto',
                    display: 'block',
                  }}
                />
              ))}
            </div>
          </section>
        )}

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

        {/* ── Highlights ───────────────────────────────────────────────── */}
        {(clinic.highlights?.length ?? 0) > 0 && (
          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--forest)', marginBottom: 16 }}>
              Why choose us
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {clinic.highlights.map((h, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 15, color: 'var(--slate)', lineHeight: 1.6 }}>
                  <span style={{ color: 'var(--gold)', fontSize: 16, flexShrink: 0, marginTop: 2 }}>✦</span>
                  {h}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Specialisations + Languages + Wellness ───────────────────── */}
        {((clinic.specialisations?.length ?? 0) > 0 || (clinic.wellness_categories?.length ?? 0) > 0 || (clinic.languages?.length ?? 0) > 0) && (
          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--forest)', marginBottom: 20 }}>
              Expertise
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(clinic.specialisations?.length ?? 0) > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Specialisations</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {clinic.specialisations.map((s) => (
                      <span key={s} style={{ fontSize: 13, fontWeight: 500, padding: '5px 14px', borderRadius: 99, background: 'rgba(184,134,44,0.1)', color: 'var(--bark, #6b5a2e)' }}>
                        {capitalize(s)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(clinic.wellness_categories?.length ?? 0) > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Wellness areas</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {clinic.wellness_categories.map((c) => (
                      <span key={c} style={{ fontSize: 13, padding: '5px 14px', borderRadius: 99, background: 'var(--cream2)', color: 'var(--slate)' }}>
                        {capitalize(c)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(clinic.languages?.length ?? 0) > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Languages spoken</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {clinic.languages.map((l) => (
                      <span key={l} style={{ fontSize: 13, padding: '5px 14px', borderRadius: 99, background: 'var(--forest-lt)', color: 'var(--forest)' }}>
                        {capitalize(l)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Retreats ──────────────────────────────────────────────────── */}
        {clinic.retreats.length > 0 && (
          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--forest)', marginBottom: 24 }}>
              Retreats
            </h2>
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
              {clinic.retreats.map((pkg, i) => {
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
                  pkg.price_inr > 0 && pkg.duration_min_days
                    ? Math.round(pkg.price_inr / pkg.duration_min_days)
                    : null

                const includes: string[] = []
                if (pkg.includes_accommodation) includes.push('Accommodation')
                if (pkg.includes_meals) includes.push('Meals')
                if (pkg.includes_transfers) includes.push('Transfers')

                return (
                  <div
                    key={pkg.id}
                    style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)', padding: '20px 20px', position: 'relative' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <Link
                            href={`/${params.lang}/retreats/${pkg.id}`}
                            style={{ fontSize: 15, fontWeight: 600, color: 'var(--forest)', textDecoration: 'none' }}
                          >
                            {pkg.name}
                          </Link>
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
                        {pkg.price_inr > 0 ? (
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--forest)' }}>
                              {formatInrForVisitor(Math.round(pkg.price_inr), lang)}
                            </div>
                            {pricePerNight != null && pricePerNight > 0 && (
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                ~{formatInrForVisitor(pricePerNight, lang)}/night
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Price on request</div>
                        )}
                        <Link
                          href={`/${params.lang}/booking?clinic=${clinic.slug}&retreat=${pkg.id}`}
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

        {/* ── Stay & Dining ────────────────────────────────────────────── */}
        {((clinic.accommodation_types?.length ?? 0) > 0 || (clinic.meal_options?.length ?? 0) > 0 || clinic.accommodation_available) && (
          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--forest)', marginBottom: 20 }}>
              Stay &amp; Dining
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {(clinic.accommodation_types?.length ?? 0) > 0 && (
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 10 }}>Accommodation types</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {clinic.accommodation_types.map((t) => (
                      <span key={t} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 99, background: 'var(--forest-lt)', color: 'var(--forest)' }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {(clinic.meal_options?.length ?? 0) > 0 && (
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 10 }}>Dining options</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {clinic.meal_options.map((m) => (
                      <span key={m} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 99, background: 'rgba(184,134,44,0.1)', color: 'var(--bark, #6b5a2e)' }}>{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Getting Here ─────────────────────────────────────────────── */}
        {(clinic.address || clinic.transport_info || clinic.nearest_airport || clinic.nearest_railway || clinic.pickup_available) && (
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
              {clinic.nearest_airport && (
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 6 }}>Nearest airport</div>
                  <div style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.6 }}>{clinic.nearest_airport}</div>
                </div>
              )}
              {clinic.nearest_railway && (
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 6 }}>Nearest railway</div>
                  <div style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.6 }}>{clinic.nearest_railway}</div>
                </div>
              )}
              {clinic.transport_info && (
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 6 }}>Transport notes</div>
                  <div style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.6 }}>{clinic.transport_info}</div>
                </div>
              )}
              {clinic.pickup_available && (
                <div style={{ background: 'var(--forest-lt)', border: '1px solid rgba(30,61,47,0.12)', borderRadius: 'var(--r-md)', padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--forest2)', marginBottom: 6 }}>Airport pickup</div>
                  <div style={{ fontSize: 14, color: 'var(--forest)', lineHeight: 1.6 }}>
                    Pickup available
                    {(clinic.pickup_locations?.length ?? 0) > 0 && ` from: ${clinic.pickup_locations.join(', ')}`}.
                  </div>
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
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--forest)', margin: 0 }}>
                Guest Reviews
              </h2>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                {clinic.reviews.length} review{clinic.reviews.length !== 1 ? 's' : ''} across all retreats
              </span>
            </div>
            {/* Rating summary bar */}
            {clinic.rating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, background: 'var(--cream)', padding: '12px 16px', borderRadius: 'var(--r-md)' }}>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--forest)', lineHeight: 1 }}>{clinic.rating.toFixed(1)}</span>
                <div>
                  <div style={{ display: 'flex', gap: 2, marginBottom: 3 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} style={{ color: i < Math.round(clinic.rating!) ? 'var(--gold)' : 'var(--border2)', fontSize: 16 }}>★</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{clinic.review_count} verified reviews</div>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {clinic.reviews.map((r) => (
                <div key={r.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} style={{ color: i < r.rating ? 'var(--gold)' : 'var(--border2)', fontSize: 14 }}>★</span>
                        ))}
                      </div>
                      {/* Retreat name badge */}
                      {r.retreat_name && (
                        <span style={{
                          display: 'inline-block', fontSize: 10, fontWeight: 600,
                          background: 'var(--forest-lt)', color: 'var(--forest)',
                          padding: '2px 8px', borderRadius: 99,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>
                          {r.retreat_name}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', flexShrink: 0 }}>
                      {r.reviewer_location && <div>{r.reviewer_location}</div>}
                      <div>{new Date(r.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</div>
                    </div>
                  </div>
                  {r.review_text && (
                    <p style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.65, margin: 0 }}>{r.review_text}</p>
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

        {/* ── Operating hours + Social links ───────────────────────────── */}
        {(clinic.operating_hours || clinic.social_links) && (
          <section style={{ marginBottom: 56, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {clinic.operating_hours && Object.keys(clinic.operating_hours).length > 0 && (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 12 }}>Opening hours</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(clinic.operating_hours).map(([day, hours]) => (
                    <div key={day} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--slate)' }}>
                      <span style={{ color: 'var(--muted)' }}>{day}</span>
                      <span style={{ fontWeight: 500 }}>{hours}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {clinic.social_links && Object.keys(clinic.social_links).length > 0 && (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 12 }}>Follow us</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(clinic.social_links).map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 14, color: 'var(--forest)', textDecoration: 'none', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 72, textTransform: 'capitalize' }}>{platform}</span>
                      <span style={{ color: 'var(--forest2)' }}>→</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Nearby Experiences ───────────────────────────────────────────── */}
        {nearbyExperiences.length > 0 && (
          <section style={{ marginBottom: 56 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--gold)', marginBottom: 3 }}>
                  Things to do nearby
                </p>
                <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(18px, 2.5vw, 24px)', fontWeight: 400, color: 'var(--forest)' }}>
                  Explore {clinic.district ?? 'the area'}
                </h2>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
              {nearbyExperiences.map((exp: PlatformExperienceOut) => (
                <Link key={exp.id} href={`/${lang}/experiences/${exp.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', background: '#fff', height: '100%' }}>
                    {exp.photos?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={exp.photos[0]} alt={exp.name_en} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ height: 130, background: 'var(--cream)' }} />
                    )}
                    <div style={{ padding: '10px 12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', background: 'var(--forest-lt)', color: 'var(--forest)', padding: '2px 7px', borderRadius: 99 }}>
                          {exp.category}
                        </span>
                        {exp.distance_km != null && (
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>{exp.distance_km} km</span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate)', lineHeight: 1.3, marginBottom: 3 }}>{exp.name_en}</div>
                      {exp.region_label && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>{exp.region_label}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--forest)' }}>
                          {exp.is_free ? 'Free' : formatInrForVisitor(Math.round(exp.price_inr), lang)}
                        </span>
                        {exp.typical_duration_hours != null && (
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>~{exp.typical_duration_hours}h</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

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
            {/*<Link
              href={`/${params.lang}/assessment`}
              style={{ display: 'inline-block', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 14, fontWeight: 500, padding: '12px 24px', borderRadius: 99, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              Get personalised matches
            </Link>*/}
          </div>
        </section>
      </div>
    </>
  )
}
