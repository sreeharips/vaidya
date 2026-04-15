import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { Metadata } from 'next'
import { fetchExperiences, type PlatformExperienceOut } from '@/lib/admin-api'

export const revalidate = 600

const CATEGORY_META: Record<string, { label: string; icon: string; desc: string }> = {
  sightseeing: { label: 'Sightseeing', icon: '🏛', desc: 'Historic temples, palaces, and scenic viewpoints' },
  adventure:   { label: 'Adventure',   icon: '🏄', desc: 'Trekking, water sports, and thrilling outdoors' },
  cultural:    { label: 'Cultural',    icon: '🎭', desc: 'Festivals, classical arts, and living traditions' },
  nature:      { label: 'Nature',      icon: '🌿', desc: 'Wildlife sanctuaries, forests, and backwaters' },
  wellness:    { label: 'Wellness',    icon: '🧘', desc: 'Yoga, meditation, and rejuvenation beyond Ayurveda' },
}

const CATEGORY_COLOR: Record<string, { bg: string; text: string }> = {
  sightseeing: { bg: '#e6f0eb', text: '#1e3d2f' },
  adventure:   { bg: '#fef3e2', text: '#7c3d0f' },
  cultural:    { bg: '#f0ebfb', text: '#4c2888' },
  nature:      { bg: '#e8f5ed', text: '#1e3d2f' },
  wellness:    { bg: '#fdf8e8', text: '#78620a' },
}

export async function generateMetadata({
  params: { lang },
}: {
  params: { lang: string }
}): Promise<Metadata> {
  return {
    title: 'Explore Kerala — Experiences | AyuRetreats',
    description: 'Discover sightseeing, adventure, cultural, nature, and wellness experiences near Ayurveda retreats across Kerala.',
    openGraph: {
      title: 'Explore Kerala — Experiences | AyuRetreats',
      description: 'Things to do in Kerala near Ayurveda retreats.',
      url: `https://ayuretreats.com/${lang}/experiences`,
    },
  }
}

export default async function ExperiencesListPage({
  params: { lang },
  searchParams,
}: {
  params: { lang: string }
  searchParams: { category?: string }
}) {
  setRequestLocale(lang)
  const activeCategory = searchParams.category ?? ''
  const experiences = await fetchExperiences({
    category: activeCategory || undefined,
    limit: 48,
  })

  const grouped: Record<string, PlatformExperienceOut[]> = {}
  if (!activeCategory) {
    for (const exp of experiences) {
      if (!grouped[exp.category]) grouped[exp.category] = []
      grouped[exp.category].push(exp)
    }
  }

  const activeMeta = activeCategory ? CATEGORY_META[activeCategory] : null

  return (
    <div style={{ background: '#faf9f7', minHeight: '100vh' }}>

      {/* ── Hero header ───────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--forest)', padding: 'clamp(32px, 5vw, 60px) clamp(16px, 5vw, 48px) clamp(28px, 4vw, 48px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Link
            href={`/${lang}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20,
              color: 'rgba(253,250,246,0.55)', fontSize: 13, textDecoration: 'none',
            }}
          >
            ← Back to home
          </Link>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--gold)', marginBottom: 8 }}>
            Beyond the clinic
          </p>
          <h1
            style={{
              fontFamily: 'var(--serif)', fontSize: 'clamp(26px, 4vw, 42px)',
              fontWeight: 400, color: '#fdfaf6', margin: '0 0 10px', lineHeight: 1.1,
            }}
          >
            {activeMeta ? (
              <><span style={{ marginRight: 10 }}>{activeMeta.icon}</span>{activeMeta.label}</>
            ) : (
              'Explore Kerala'
            )}
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(253,250,246,0.55)', margin: 0, maxWidth: 520, lineHeight: 1.6 }}>
            {activeMeta
              ? activeMeta.desc
              : 'Sightseeing, adventure, cultural, nature and wellness experiences near Ayurveda retreats across Kerala.'}
          </p>

          {/* Category filter tabs */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 24 }}>
            <Link
              href={`/${lang}/experiences`}
              style={{
                display: 'inline-flex', alignItems: 'center', padding: '6px 16px',
                borderRadius: 99, fontSize: 12, fontWeight: 600, textDecoration: 'none',
                border: activeCategory === '' ? '1px solid var(--gold)' : '1px solid rgba(253,250,246,0.2)',
                background: activeCategory === '' ? 'var(--gold)' : 'rgba(253,250,246,0.07)',
                color: activeCategory === '' ? '#1e3d2f' : 'rgba(253,250,246,0.7)',
                flexShrink: 0,
              }}
            >
              All
            </Link>
            {Object.entries(CATEGORY_META).map(([value, meta]) => (
              <Link
                key={value}
                href={`/${lang}/experiences?category=${value}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px',
                  borderRadius: 99, fontSize: 12, fontWeight: 600, textDecoration: 'none',
                  border: activeCategory === value ? '1px solid var(--gold)' : '1px solid rgba(253,250,246,0.2)',
                  background: activeCategory === value ? 'var(--gold)' : 'rgba(253,250,246,0.07)',
                  color: activeCategory === value ? '#1e3d2f' : 'rgba(253,250,246,0.7)',
                  flexShrink: 0,
                }}
              >
                <span>{meta.icon}</span> {meta.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px clamp(16px, 4vw, 40px) 80px' }}>

        {experiences.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--muted)', fontSize: 14 }}>
            No experiences found{activeCategory ? ` for "${activeCategory}"` : ''}.
          </div>
        ) : activeCategory ? (
          // Single category: flat grid
          <div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
              {experiences.length} experience{experiences.length !== 1 ? 's' : ''}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 18 }}>
              {experiences.map(exp => (
                <ExperienceCard key={exp.id} exp={exp} lang={lang} />
              ))}
            </div>
          </div>
        ) : (
          // All categories: grouped by category
          <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
            {Object.entries(CATEGORY_META).map(([cat, meta]) => {
              const catExps = grouped[cat]
              if (!catExps?.length) return null
              return (
                <section key={cat}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 22 }}>{meta.icon}</span>
                      <div>
                        <h2
                          style={{
                            fontFamily: 'var(--serif)', fontSize: 'clamp(18px, 2vw, 22px)',
                            fontWeight: 400, color: 'var(--forest)', margin: 0,
                          }}
                        >
                          {meta.label}
                        </h2>
                        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>{meta.desc}</p>
                      </div>
                    </div>
                    {catExps.length > 4 && (
                      <Link
                        href={`/${lang}/experiences?category=${cat}`}
                        style={{ fontSize: 12, fontWeight: 500, color: 'var(--forest)', textDecoration: 'none', borderBottom: '1px solid var(--gold)', paddingBottom: 1, flexShrink: 0 }}
                      >
                        See all {catExps.length} →
                      </Link>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                    {catExps.slice(0, 6).map(exp => (
                      <ExperienceCard key={exp.id} exp={exp} lang={lang} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

function ExperienceCard({ exp, lang }: { exp: PlatformExperienceOut; lang: string }) {
  const catColor = CATEGORY_COLOR[exp.category] ?? { bg: '#f0f0f0', text: '#333' }
  return (
    <Link href={`/${lang}/experiences/${exp.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          overflow: 'hidden',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Image */}
        <div style={{ position: 'relative', height: 180, flexShrink: 0 }}>
          {exp.photos?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={exp.photos[0]}
              alt={exp.name_en}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ height: '100%', background: 'var(--cream)' }} />
          )}
          {/* Distance badge */}
          {exp.distance_km != null && (
            <div
              style={{
                position: 'absolute', top: 10, right: 10,
                background: 'rgba(0,0,0,0.55)', color: '#fff',
                fontSize: 10, fontWeight: 700, padding: '3px 9px',
                borderRadius: 99, backdropFilter: 'blur(4px)',
              }}
            >
              {exp.distance_km} km
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: '14px 16px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span
              style={{
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                background: catColor.bg, color: catColor.text,
                padding: '3px 9px', borderRadius: 99,
              }}
            >
              {exp.category}
            </span>
            {exp.typical_duration_hours != null && (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>~{exp.typical_duration_hours}h</span>
            )}
          </div>
          <div
            style={{
              fontSize: 14, fontWeight: 600, color: 'var(--slate)',
              lineHeight: 1.35, marginBottom: 4, flex: 1,
            }}
          >
            {exp.name_en}
          </div>
          {exp.region_label && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>{exp.region_label}</div>
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--forest)' }}>
            {exp.is_free ? 'Free entry' : `₹${Math.round(exp.price_inr).toLocaleString('en-IN')}`}
          </div>
        </div>
      </div>
    </Link>
  )
}
