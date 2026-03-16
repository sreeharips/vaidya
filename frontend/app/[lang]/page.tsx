import { getTranslations } from 'next-intl/server'
import { Metadata } from 'next'
import Link from 'next/link'
import HeroSearch from '@/components/search/HeroSearch'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConditionItem {
  slug: string
  label: string
}

interface TrustItem {
  number: string
  label: string
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params: { lang },
}: {
  params: { lang: string }
}): Promise<Metadata> {
  const t = await getTranslations({ locale: lang, namespace: 'home.meta' })

  return {
    title: t('title'),
    description: t('description'),
    openGraph: {
      title: t('ogTitle'),
      description: t('ogDescription'),
      url: `https://vaidya.health/${lang}`,
      siteName: 'Vaidya',
      locale: lang,
      type: 'website',
      images: [
        {
          url: '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: 'Vaidya — Authentic Ayurveda',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('ogTitle'),
      description: t('ogDescription'),
      images: ['/og-image.jpg'],
    },
    alternates: {
      canonical: `https://vaidya.health/${lang}`,
      languages: {
        en: 'https://vaidya.health/en',
        ar: 'https://vaidya.health/ar',
        de: 'https://vaidya.health/de',
        fr: 'https://vaidya.health/fr',
        ml: 'https://vaidya.health/ml',
        hi: 'https://vaidya.health/hi',
      },
    },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HomePage({
  params: { lang },
}: {
  params: { lang: string }
}) {
  const t = await getTranslations({ locale: lang, namespace: 'home' })

  const conditions = t.raw('conditions.items') as ConditionItem[]
  const trustItems = t.raw('trust.items') as TrustItem[]

  const isRtl = lang === 'ar'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }} dir={isRtl ? 'rtl' : 'ltr'}>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section
        className="hero-mandala"
        style={{
          minHeight: 'calc(100vh - 68px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 48px 120px',
          position: 'relative',
          overflow: 'hidden',
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(184,134,44,0.07) 0%, transparent 70%)',
        }}
      >
        {/* Eyebrow */}
        <p
          className="hero-eyebrow-line"
          style={{
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
            marginBottom: '24px',
          }}
        >
          {t('hero.eyebrow')}
        </p>

        {/* H1 */}
        <h1
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 'clamp(44px, 6vw, 80px)',
            fontWeight: 300,
            color: 'var(--forest)',
            textAlign: 'center',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            marginBottom: '20px',
            maxWidth: '860px',
          }}
        >
          {t('hero.h1Part1')}{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--gold)', fontWeight: 300 }}>
            {t('hero.h1Italic')}
          </em>
          <br />
          {t('hero.h1Part2')}
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '17px',
            fontWeight: 300,
            color: 'var(--muted)',
            textAlign: 'center',
            maxWidth: '520px',
            lineHeight: 1.7,
            marginBottom: '56px',
          }}
        >
          {t('hero.subtitle')}
        </p>

        {/* Search bar + quick tags (client component for interaction) */}
        <HeroSearch
          lang={lang}
          placeholder={t('hero.searchPlaceholder')}
          buttonLabel={t('hero.searchButton')}
        />

        {/* Condition section label */}
        <p
          style={{
            fontSize: '12px',
            color: 'var(--muted)',
            marginTop: '24px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {t('conditions.sectionLabel')}
        </p>

        {/* Condition pills */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '8px',
            maxWidth: '640px',
            marginTop: '12px',
          }}
        >
          {conditions.map((c: ConditionItem) => (
            <Link
              key={c.slug}
              href={`/${lang}/conditions/${c.slug}`}
              className="cond-pill"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Trust row ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '40px',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '32px 48px',
          borderTop: '1px solid var(--border)',
        }}
      >
        {trustItems.map((item: TrustItem) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--serif)',
                fontSize: '28px',
                fontWeight: 600,
                color: 'var(--forest)',
              }}
            >
              {item.number}
            </span>
            <span
              style={{
                fontSize: '12px',
                color: 'var(--muted)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                textAlign: 'center',
              }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
