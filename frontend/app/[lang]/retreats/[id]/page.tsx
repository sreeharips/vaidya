import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'

export const revalidate = 3600

const API_BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AvailabilityDay {
  date: string
  available_spots: number
  is_blocked: boolean
}

interface ClinicSummary {
  id: string
  slug: string
  name: string
  district: string | null
  tier: number
  rating: number | null
  photos: string[]
}

interface RetreatDetail {
  id: string
  name: string
  name_display_en: string | null
  description_en: string | null
  package_type: string
  wellness_categories: string[]
  duration_min_days: number
  duration_max_days: number
  price_usd: number
  price_inr: number | null
  includes_accommodation: boolean
  includes_meals: boolean
  includes_transfers: boolean
  max_guests_per_slot: number
  what_to_expect: string | null
  contraindications: string | null
  highlights: string[]
  treatments_included: string[]
  ideal_for: string[]
  prakriti_tags: string[]
  photos: string[]
  daily_schedule: string | null
  cancellation_policy: string | null
  language_of_instruction: string[]
  min_age: number | null
  clinic: ClinicSummary
  availability: AvailabilityDay[]
}

// ── Data fetch ────────────────────────────────────────────────────────────────

async function fetchRetreat(id: string): Promise<RetreatDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/api/retreats/${id}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { lang: string; id: string }
}): Promise<Metadata> {
  const retreat = await fetchRetreat(params.id)
  if (!retreat) return { title: 'Retreat not found | AyuRetreats' }
  const duration =
    retreat.duration_min_days === retreat.duration_max_days
      ? `${retreat.duration_min_days}-day`
      : `${retreat.duration_min_days}–${retreat.duration_max_days}-day`
  return {
    title: `${retreat.name} — ${duration} Ayurveda retreat at ${retreat.clinic.name} | AyuRetreats`,
    description:
      retreat.description_en?.slice(0, 160) ??
      `${retreat.name} at ${retreat.clinic.name}, ${retreat.clinic.district ?? 'Kerala'}. Book online.`,
    alternates: {
      canonical: `https://ayuretreats.com/${params.lang}/retreats/${params.id}`,
    },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function RetreatPage({
  params,
}: {
  params: { lang: string; id: string }
}) {
  const retreat = await fetchRetreat(params.id)
  if (!retreat) notFound()

  const { lang } = params
  const tierLabel = retreat.clinic.tier === 2 ? 'Certified Authentic' : 'Verified'
  const durationLabel =
    retreat.duration_min_days === retreat.duration_max_days
      ? `${retreat.duration_min_days} days`
      : `${retreat.duration_min_days}–${retreat.duration_max_days} days`

  const includes: string[] = []
  if (retreat.includes_accommodation) includes.push('Accommodation')
  if (retreat.includes_meals) includes.push('Meals')
  if (retreat.includes_transfers) includes.push('Transfers')

  const availableSlots = retreat.availability.filter(
    (a) => !a.is_blocked && a.available_spots > 0,
  )
  const nextAvailable = availableSlots[0]

  return (
    <>
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
          <Link
            href={`/${lang}/clinics/${retreat.clinic.slug}`}
            style={{
              color: 'rgba(255,255,255,0.55)',
              fontSize: 13,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 28,
            }}
          >
            ← Back to {retreat.clinic.name}
          </Link>

          {/* Eyebrow badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <span
              style={{
                background: 'rgba(184,134,44,0.2)',
                color: 'var(--gold)',
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: 99,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {capitalize(retreat.package_type)}
            </span>
            <span
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.75)',
                fontSize: 11,
                fontWeight: 500,
                padding: '4px 12px',
                borderRadius: 99,
              }}
            >
              {durationLabel}
            </span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
              fontWeight: 400,
              color: '#fff',
              lineHeight: 1.2,
              marginBottom: 12,
            }}
          >
            {retreat.name}
          </h1>

          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 32 }}>
            at{' '}
            <Link
              href={`/${lang}/clinics/${retreat.clinic.slug}`}
              style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              {retreat.clinic.name}
            </Link>
            {retreat.clinic.district ? ` · ${retreat.clinic.district}, Kerala` : ' · Kerala'}
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32 }}>
            <div>
              <div
                style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, color: 'var(--gold)' }}
              >
                ${retreat.price_usd.toLocaleString()}
              </div>
              <div
                style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}
              >
                Total price
              </div>
            </div>
            {nextAvailable && (
              <div>
                <div
                  style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, color: '#fff' }}
                >
                  {new Date(nextAvailable.date + 'T00:00:00').toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </div>
                <div
                  style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}
                >
                  Next available
                </div>
              </div>
            )}
            <div>
              <div
                style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, color: '#fff' }}
              >
                {retreat.max_guests_per_slot}
              </div>
              <div
                style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}
              >
                Max guests / slot
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: '40px 24px 80px',
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap: 40,
          alignItems: 'start',
        }}
      >
        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div>
          {/* About */}
          {retreat.description_en && (
            <section style={{ marginBottom: 48 }}>
              <h2
                style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, color: 'var(--forest)', marginBottom: 16 }}
              >
                About this retreat
              </h2>
              <p
                style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--slate)', whiteSpace: 'pre-wrap' }}
              >
                {retreat.description_en}
              </p>
            </section>
          )}

          {/* What to expect */}
          {retreat.what_to_expect && (
            <section style={{ marginBottom: 48 }}>
              <h2
                style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, color: 'var(--forest)', marginBottom: 16 }}
              >
                What to expect
              </h2>
              <p
                style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--slate)', whiteSpace: 'pre-wrap' }}
              >
                {retreat.what_to_expect}
              </p>
            </section>
          )}

          {/* Photo gallery */}
          {(retreat.photos?.length ?? 0) > 0 && (
            <section style={{ marginBottom: 48 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: (retreat.photos?.length ?? 0) === 1 ? '1fr' : 'repeat(2, 1fr)',
                  gap: 8,
                  borderRadius: 'var(--r-md)',
                  overflow: 'hidden',
                }}
              >
                {(retreat.photos ?? []).slice(0, 4).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt={`${retreat.name} photo ${i + 1}`}
                    style={{
                      width: '100%',
                      height: i === 0 && retreat.photos.length > 1 ? 280 : 180,
                      objectFit: 'cover',
                      gridColumn: i === 0 && retreat.photos.length > 1 ? '1 / -1' : 'auto',
                      display: 'block',
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Highlights */}
          {(retreat.highlights?.length ?? 0) > 0 && (
            <section style={{ marginBottom: 48 }}>
              <h2
                style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, color: 'var(--forest)', marginBottom: 16 }}
              >
                Highlights
              </h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {retreat.highlights.map((h, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 15, color: 'var(--slate)', lineHeight: 1.6 }}>
                    <span style={{ color: 'var(--gold)', fontSize: 16, flexShrink: 0, marginTop: 1 }}>✦</span>
                    {h}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Includes */}
          {includes.length > 0 && (
            <section style={{ marginBottom: 48 }}>
              <h2
                style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, color: 'var(--forest)', marginBottom: 16 }}
              >
                What&apos;s included
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {includes.map((item) => (
                  <span
                    key={item}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 14,
                      color: 'var(--forest)',
                      background: 'var(--forest-lt)',
                      padding: '8px 18px',
                      borderRadius: 99,
                    }}
                  >
                    ✓ {item}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Treatments included */}
          {(retreat.treatments_included?.length ?? 0) > 0 && (
            <section style={{ marginBottom: 48 }}>
              <h2
                style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, color: 'var(--forest)', marginBottom: 16 }}
              >
                Treatments included
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {retreat.treatments_included.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 13, fontWeight: 500,
                      padding: '6px 16px', borderRadius: 99,
                      background: 'rgba(184,134,44,0.1)', color: 'var(--bark, #6b5a2e)',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Ideal for */}
          {(retreat.ideal_for?.length ?? 0) > 0 && (
            <section style={{ marginBottom: 48 }}>
              <h2
                style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, color: 'var(--forest)', marginBottom: 16 }}
              >
                Ideal for
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {retreat.ideal_for.map((item) => (
                  <span
                    key={item}
                    style={{ fontSize: 13, padding: '6px 16px', borderRadius: 99, background: 'var(--cream2)', color: 'var(--slate)' }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Wellness categories */}
          {retreat.wellness_categories.length > 0 && (
            <section style={{ marginBottom: 48 }}>
              <h2
                style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, color: 'var(--forest)', marginBottom: 16 }}
              >
                Wellness areas
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {retreat.wellness_categories.map((cat) => (
                  <span
                    key={cat}
                    style={{ fontSize: 13, padding: '6px 16px', borderRadius: 99, background: 'var(--cream2)', color: 'var(--slate)' }}
                  >
                    {capitalize(cat)}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Daily schedule */}
          {retreat.daily_schedule && (
            <section style={{ marginBottom: 48 }}>
              <h2
                style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, color: 'var(--forest)', marginBottom: 16 }}
              >
                A typical day
              </h2>
              <p
                style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--slate)', whiteSpace: 'pre-wrap' }}
              >
                {retreat.daily_schedule}
              </p>
            </section>
          )}

          {/* Prakriti compatibility */}
          {(retreat.prakriti_tags?.length ?? 0) > 0 && (
            <section style={{ marginBottom: 48 }}>
              <h2
                style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, color: 'var(--forest)', marginBottom: 8 }}
              >
                Prakriti compatibility
              </h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
                This retreat is particularly suited for these Ayurvedic body types.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                {retreat.prakriti_tags.map((tag) => {
                  const colors: Record<string, { bg: string; color: string }> = {
                    vata: { bg: 'rgba(100,120,200,0.1)', color: '#3a4a8c' },
                    pitta: { bg: 'rgba(200,80,40,0.1)', color: '#8c2a10' },
                    kapha: { bg: 'rgba(40,140,80,0.1)', color: '#1e5c38' },
                  }
                  const style = colors[tag.toLowerCase()] ?? { bg: 'var(--cream2)', color: 'var(--slate)' }
                  return (
                    <span
                      key={tag}
                      style={{
                        fontSize: 13, fontWeight: 600,
                        padding: '6px 20px', borderRadius: 99,
                        background: style.bg, color: style.color,
                        textTransform: 'capitalize',
                      }}
                    >
                      {tag}
                    </span>
                  )
                })}
              </div>
            </section>
          )}

          {/* Cancellation policy */}
          {retreat.cancellation_policy && (
            <section style={{ marginBottom: 48 }}>
              <h2
                style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, color: 'var(--forest)', marginBottom: 12 }}
              >
                Cancellation policy
              </h2>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate)', whiteSpace: 'pre-wrap' }}>
                {retreat.cancellation_policy}
              </p>
            </section>
          )}

          {/* Contraindications */}
          {retreat.contraindications && (
            <section
              style={{
                marginBottom: 48,
                background: 'rgba(197,48,48,0.04)',
                border: '1px solid rgba(197,48,48,0.15)',
                borderRadius: 'var(--r-md)',
                padding: '20px 24px',
              }}
            >
              <h2
                style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, color: '#9b2c2c', marginBottom: 10 }}
              >
                Important: Contraindications
              </h2>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate)' }}>
                {retreat.contraindications}
              </p>
            </section>
          )}

          {/* Availability */}
          {retreat.availability.length > 0 && (
            <section style={{ marginBottom: 48 }}>
              <h2
                style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, color: 'var(--forest)', marginBottom: 16 }}
              >
                Availability
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {retreat.availability.slice(0, 30).map((a) => {
                  const d = new Date(a.date + 'T00:00:00')
                  const open = !a.is_blocked && a.available_spots > 0
                  return (
                    <div
                      key={a.date}
                      style={{
                        width: 54,
                        textAlign: 'center',
                        borderRadius: 'var(--r-sm)',
                        padding: '8px 4px',
                        background: a.is_blocked
                          ? 'rgba(197,48,48,0.05)'
                          : open
                          ? 'rgba(30,61,47,0.06)'
                          : 'rgba(100,100,100,0.05)',
                        border: a.is_blocked
                          ? '1px solid rgba(197,48,48,0.18)'
                          : open
                          ? '1px solid rgba(30,61,47,0.18)'
                          : '1px solid var(--border)',
                      }}
                    >
                      <div
                        style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}
                      >
                        {d.toLocaleDateString('en-GB', { weekday: 'short' })}
                      </div>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 600,
                          color: a.is_blocked ? '#c53030' : open ? 'var(--forest)' : 'var(--muted)',
                          lineHeight: 1.2,
                        }}
                      >
                        {d.getDate()}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          marginTop: 2,
                          color: a.is_blocked ? '#c53030' : open ? 'var(--forest2)' : 'var(--muted)',
                          fontWeight: 500,
                        }}
                      >
                        {a.is_blocked ? 'Blocked' : open ? `${a.available_spots} left` : 'Full'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        {/* ── Right column — booking card ──────────────────────────────────── */}
        <div style={{ position: 'sticky', top: 80 }}>
          <div
            style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 24 }}
          >
            <div
              style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 500, color: 'var(--forest)', marginBottom: 4 }}
            >
              ${retreat.price_usd.toLocaleString()}
            </div>
            {retreat.price_inr && (
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
                ≈ ₹{retreat.price_inr.toLocaleString()} INR
              </div>
            )}
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              {durationLabel} · up to {retreat.max_guests_per_slot} guest
              {retreat.max_guests_per_slot !== 1 ? 's' : ''} per slot
            </div>

            {/* Quick facts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, padding: '14px 16px', background: 'var(--cream)', borderRadius: 'var(--r-sm)' }}>
              {retreat.min_age != null && (
                <div style={{ fontSize: 12, color: 'var(--slate)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Minimum age</span>
                  <span style={{ fontWeight: 500 }}>{retreat.min_age}+</span>
                </div>
              )}
              {(retreat.language_of_instruction?.length ?? 0) > 0 && (
                <div style={{ fontSize: 12, color: 'var(--slate)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Language</span>
                  <span style={{ fontWeight: 500 }}>{retreat.language_of_instruction.join(', ')}</span>
                </div>
              )}
              {nextAvailable && (
                <div style={{ fontSize: 12, color: 'var(--slate)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Next available</span>
                  <span style={{ fontWeight: 500 }}>
                    {new Date(nextAvailable.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              )}
            </div>

            <Link
              href={`/${lang}/booking?clinic=${retreat.clinic.slug}&retreat=${retreat.id}`}
              style={{
                display: 'block',
                textAlign: 'center',
                background: 'var(--forest)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                padding: '13px 24px',
                borderRadius: 'var(--r-xl)',
                textDecoration: 'none',
                marginBottom: 12,
              }}
            >
              Book this retreat
            </Link>

            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
              Free cancellation · Clinic confirms within 24h
            </div>

            {/* Hosted by */}
            <div
              style={{ borderTop: '1px solid var(--border)', marginTop: 24, paddingTop: 20 }}
            >
              <div
                style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}
              >
                Hosted by
              </div>
              <Link
                href={`/${lang}/clinics/${retreat.clinic.slug}`}
                style={{ textDecoration: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 'var(--r-sm)',
                      background: 'var(--forest-lt)',
                      overflow: 'hidden',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {retreat.clinic.photos?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={retreat.clinic.photos[0]}
                        alt={retreat.clinic.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--forest)', opacity: 0.4 }}>
                        ✦
                      </span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate)' }}>
                      {retreat.clinic.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {tierLabel}
                      {retreat.clinic.district ? ` · ${retreat.clinic.district}` : ''}
                    </div>
                    {retreat.clinic.rating != null && (
                      <div style={{ fontSize: 12, color: 'var(--gold)', marginTop: 2 }}>
                        ★ {retreat.clinic.rating.toFixed(1)}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
