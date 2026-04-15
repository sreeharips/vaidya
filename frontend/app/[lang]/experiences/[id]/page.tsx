import { notFound } from 'next/navigation'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { fetchExperienceDetail, type PlatformExperienceOut, type NearbyRetreat } from '@/lib/admin-api'

// ── Best time to visit — derived from category (no DB column needed) ─────────
const BEST_TIME: Record<string, { label: string; detail: string }> = {
  sightseeing: {
    label: 'October – March',
    detail: 'Dry season with clear skies and cool temperatures. Ideal for walking and outdoor exploration.',
  },
  adventure: {
    label: 'November – February',
    detail: 'Cooler, drier months make trekking and water activities most comfortable and safe.',
  },
  cultural: {
    label: 'October – April',
    detail: 'Festival season in Kerala — Theyyam (Nov–Apr), Thrissur Pooram (Apr/May), Onam (Aug/Sep).',
  },
  nature: {
    label: 'October – March',
    detail: 'Post-monsoon lushness peaks in October. Wildlife is most active in the cool dry months.',
  },
  wellness: {
    label: 'Year-round · Peak: June – August',
    detail: 'Ayurveda is most potent during the monsoon (Karkidakam) — Kerala practitioners consider it the ideal season for Panchakarma.',
  },
}

const CATEGORY_COLOR: Record<string, string> = {
  sightseeing: '#e6f0eb',
  adventure: '#fef3e2',
  cultural: '#f0ebfb',
  nature: '#e8f5ed',
  wellness: '#fdf8e8',
}

const CATEGORY_TEXT: Record<string, string> = {
  sightseeing: '#1e3d2f',
  adventure: '#7c3d0f',
  cultural: '#4c2888',
  nature: '#1e3d2f',
  wellness: '#78620a',
}

function formatPrice(price_inr: number, is_free: boolean): string {
  if (is_free) return 'Free entry'
  return `₹${price_inr.toLocaleString('en-IN')} per person`
}

export default async function ExperiencePage({
  params,
}: {
  params: { lang: string; id: string }
}) {
  setRequestLocale(params.lang)
  const exp = await fetchExperienceDetail(params.id)
  if (!exp) notFound()

  const bestTime = BEST_TIME[exp.category] ?? BEST_TIME['sightseeing']
  const categoryBg = CATEGORY_COLOR[exp.category] ?? '#f5f5f5'
  const categoryFg = CATEGORY_TEXT[exp.category] ?? '#1e3d2f'
  const heroPhoto = exp.photos[0] ?? null
  const galleryPhotos = exp.photos.slice(1)

  return (
    <div style={{ background: '#faf9f7', minHeight: '100vh' }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', height: 420, background: '#1e3d2f', overflow: 'hidden' }}>
        {heroPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroPhoto}
            alt={exp.name_en}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75, display: 'block' }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.65) 100%)',
          }}
        />
        {/* Back link */}
        <div style={{ position: 'absolute', top: 20, left: 24 }}>
          <Link
            href={`/${params.lang}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#fff',
              fontSize: 13,
              textDecoration: 'none',
              background: 'rgba(0,0,0,0.3)',
              padding: '6px 14px',
              borderRadius: 99,
              backdropFilter: 'blur(4px)',
            }}
          >
            ← Retreats
          </Link>
        </div>
        {/* Title overlay */}
        <div style={{ position: 'absolute', bottom: 32, left: 0, right: 0, padding: '0 32px' }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              background: categoryBg,
              color: categoryFg,
              padding: '3px 12px',
              borderRadius: 99,
              marginBottom: 10,
            }}
          >
            {exp.category}
          </span>
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
              fontWeight: 400,
              color: '#fff',
              margin: '0 0 6px',
              lineHeight: 1.2,
              textShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            {exp.name_en}
          </h1>
          {exp.region_label && (
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, margin: 0 }}>
              {exp.region_label}{exp.district ? ` · ${exp.district}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 40, alignItems: 'start' }}>

          {/* LEFT — description + gallery + nearby */}
          <div>

            {/* Description */}
            {exp.description_en && (
              <section style={{ marginBottom: 40 }}>
                <p
                  style={{
                    fontSize: 16,
                    lineHeight: 1.8,
                    color: 'var(--slate)',
                    margin: 0,
                  }}
                >
                  {exp.description_en}
                </p>
              </section>
            )}

            {/* Photo gallery */}
            {galleryPhotos.length > 0 && (
              <section style={{ marginBottom: 40 }}>
                <h2
                  style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 20,
                    fontWeight: 400,
                    color: 'var(--forest)',
                    marginBottom: 16,
                  }}
                >
                  Gallery
                </h2>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 10,
                  }}
                >
                  {galleryPhotos.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={src}
                      alt={`${exp.name_en} photo ${i + 2}`}
                      style={{
                        width: '100%',
                        height: 180,
                        objectFit: 'cover',
                        borderRadius: 'var(--r-md)',
                        display: 'block',
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Nearby experiences */}
            {exp.nearby_experiences.length > 0 && (
              <section style={{ marginBottom: 40 }}>
                <h2
                  style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 22,
                    fontWeight: 400,
                    color: 'var(--forest)',
                    marginBottom: 6,
                  }}
                >
                  Nearby Experiences
                </h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
                  More things to do in {exp.district ?? 'the area'}.
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                    gap: 14,
                  }}
                >
                  {exp.nearby_experiences.map((near: PlatformExperienceOut) => (
                    <Link
                      key={near.id}
                      href={`/${params.lang}/experiences/${near.id}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <div
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--r-md)',
                          overflow: 'hidden',
                          background: '#fff',
                          transition: 'box-shadow 0.15s',
                        }}
                      >
                        {near.photos?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={near.photos[0]}
                            alt={near.name_en}
                            style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}
                          />
                        ) : (
                          <div style={{ height: 110, background: 'var(--cream)' }} />
                        )}
                        <div style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                background: CATEGORY_COLOR[near.category] ?? '#f5f5f5',
                                color: CATEGORY_TEXT[near.category] ?? '#333',
                                padding: '2px 7px',
                                borderRadius: 99,
                              }}
                            >
                              {near.category}
                            </span>
                            {near.distance_km != null && (
                              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{near.distance_km} km</span>
                            )}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate)', lineHeight: 1.3, marginBottom: 4 }}>
                            {near.name_en}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--forest)' }}>
                            {near.is_free ? 'Free' : `₹${Math.round(near.price_inr).toLocaleString('en-IN')}`}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

          </div>

          {/* RIGHT — info card */}
          <div style={{ position: 'sticky', top: 24 }}>
            <div
              style={{
                background: '#fff',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-lg)',
                padding: '24px',
                boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: 'var(--forest)',
                  fontFamily: 'var(--serif)',
                  marginBottom: 4,
                }}
              >
                {formatPrice(exp.price_inr, exp.is_free)}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />

              {/* Data points */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {exp.typical_duration_hours != null && (
                  <DataRow
                    icon="⏱"
                    label="Duration"
                    value={`~${exp.typical_duration_hours} hour${exp.typical_duration_hours !== 1 ? 's' : ''}`}
                  />
                )}

                <DataRow
                  icon="🗺"
                  label="Category"
                  value={exp.category.charAt(0).toUpperCase() + exp.category.slice(1)}
                />

                {exp.district && (
                  <DataRow icon="📍" label="Location" value={exp.region_label ?? exp.district} />
                )}

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>🌤</span>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
                      Best time to visit
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate)', marginBottom: 4 }}>
                    {bestTime.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                    {bestTime.detail}
                  </div>
                </div>

              </div>

              <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />

              {exp.external_url && (
                <a
                  href={exp.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '11px 0',
                    textAlign: 'center',
                    background: 'var(--forest)',
                    color: '#fff',
                    borderRadius: 'var(--r-xl)',
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: 'none',
                    marginBottom: 10,
                  }}
                >
                  View on Maps →
                </a>
              )}

              <Link
                href={`/${params.lang}#search`}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '11px 0',
                  textAlign: 'center',
                  background: 'transparent',
                  color: 'var(--forest)',
                  border: '1px solid var(--forest)',
                  borderRadius: 'var(--r-xl)',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Find retreats nearby
              </Link>
            </div>
          </div>

        </div>

        {/* ── Nearby retreats ─────────────────────────────────────────────── */}
        {exp.nearby_retreats.length > 0 && (
          <section style={{ marginTop: 56 }}>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 40 }}>
              <h2
                style={{
                  fontFamily: 'var(--serif)',
                  fontSize: 26,
                  fontWeight: 400,
                  color: 'var(--forest)',
                  marginBottom: 6,
                }}
              >
                Ayurveda Retreats Nearby
              </h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
                Stay at one of these authentic retreats and visit {exp.name_en} during your wellness journey.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: 20,
                }}
              >
                {exp.nearby_retreats.map((r: NearbyRetreat) => (
                  <Link
                    key={r.id}
                    href={`/${params.lang}/retreats/${r.id}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div
                      style={{
                        background: '#fff',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-md)',
                        overflow: 'hidden',
                      }}
                    >
                      {r.photos?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.photos[0]}
                          alt={r.clinic_name}
                          style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <div style={{ height: 160, background: 'var(--cream)' }} />
                      )}
                      <div style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          {r.rating != null && (
                            <span style={{ fontSize: 12, color: 'var(--forest)', fontWeight: 600 }}>
                              ★ {r.rating.toFixed(1)}
                              <span style={{ color: 'var(--muted)', fontWeight: 400 }}> ({r.review_count})</span>
                            </span>
                          )}
                          {r.distance_km != null && (
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{r.distance_km} km away</span>
                          )}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--slate)', marginBottom: 2, lineHeight: 1.3 }}>
                          {r.clinic_name}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
                          {r.name} · {r.duration_min_days}–{r.duration_max_days} days
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--forest)' }}>
                              {r.price_inr
                                ? `₹${Math.round(r.price_inr).toLocaleString('en-IN')}`
                                : `$${Math.round(r.price_usd)}`}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>/night</span>
                          </div>
                          <span
                            style={{
                              fontSize: 12,
                              color: 'var(--forest)',
                              fontWeight: 600,
                              textDecoration: 'underline',
                            }}
                          >
                            View retreat →
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  )
}

function DataRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ fontSize: 16, lineHeight: 1.4 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 14, color: 'var(--slate)', fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  )
}
