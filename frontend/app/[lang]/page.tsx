import { getTranslations } from 'next-intl/server'
import { Metadata } from 'next'
import Link from 'next/link'
import HeroSearch from '@/components/search/HeroSearch'
import HomeClinicCard, { type ClinicSummary } from '@/components/cards/HomeClinicCard'
import WellnessGoalGrid from '@/components/home/WellnessGoalGrid'

export const revalidate = 300

const API_BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function fetchClinics(params = ''): Promise<ClinicSummary[]> {
  try {
    const res = await fetch(`${API_BASE}/api/clinics?${params}`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    return (await res.json()).items ?? []
  } catch { return [] }
}

const WELLNESS_GOALS = [
  { icon: '◈', label: 'Panchakarma',  desc: 'Full-body detox',         href: '/clinics?treatment=panchakarma' },
  { icon: '◉', label: 'Shirodhara',   desc: 'Stress & mind reset',     href: '/clinics?treatment=shirodhara' },
  { icon: '◌', label: 'Kizhi',        desc: 'Herbal pain therapy',     href: '/clinics?treatment=kizhi' },
  { icon: '◎', label: 'Abhyanga',     desc: 'Full-body oil massage',   href: '/clinics?treatment=abhyanga' },
  { icon: '◈', label: 'Skin & Hair',  desc: 'Ayurvedic beauty',        href: '/clinics?goal=skin' },
  { icon: '◉', label: 'Digestive',    desc: 'Gut health & metabolism', href: '/clinics?goal=digestive' },
  { icon: '◌', label: 'Joint Care',   desc: 'Arthritis & mobility',    href: '/clinics?goal=joints' },
  { icon: '◎', label: 'Navarakizhi',  desc: 'Rice bolus therapy',      href: '/clinics?treatment=navarakizhi' },
]

const KERALA_DISTRICTS = [
  'Thiruvananthapuram', 'Kollam', 'Kottayam', 'Ernakulam',
  'Thrissur', 'Palakkad', 'Kozhikode', 'Kannur', 'Wayanad', 'Alappuzha',
]

const CONDITIONS = [
  { label: 'Back & Spine Pain',   href: '/search?condition=back-pain' },
  { label: 'Stress & Anxiety',    href: '/search?condition=stress' },
  { label: 'Arthritis',           href: '/search?condition=arthritis' },
  { label: 'Diabetes',            href: '/search?condition=diabetes' },
  { label: 'Digestive Disorders', href: '/search?condition=digestive' },
  { label: 'Skin Conditions',     href: '/search?condition=skin' },
  { label: 'Weight Management',   href: '/search?condition=weight' },
  { label: 'Insomnia',            href: '/search?condition=insomnia' },
  { label: 'Hypertension',        href: '/search?condition=hypertension' },
  { label: 'Migraines',           href: '/search?condition=migraine' },
]

export async function generateMetadata({ params: { lang } }: { params: { lang: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: lang, namespace: 'home.meta' })
  return {
    title: t('title'),
    description: t('description'),
    openGraph: {
      title: t('ogTitle'), description: t('ogDescription'),
      url: `https://ayuretreats.com/${lang}`, siteName: 'AyuRetreats', locale: lang, type: 'website',
      images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'AyuRetreats — Authentic Ayurveda Wellness Retreats' }],
    },
    twitter: { card: 'summary_large_image', title: t('ogTitle'), description: t('ogDescription'), images: ['/og-image.jpg'] },
    alternates: {
      canonical: `https://ayuretreats.com/${lang}`,
      languages: { en: 'https://ayuretreats.com/en', ar: 'https://ayuretreats.com/ar', de: 'https://ayuretreats.com/de', fr: 'https://ayuretreats.com/fr', ml: 'https://ayuretreats.com/ml', hi: 'https://ayuretreats.com/hi' },
    },
  }
}

export default async function HomePage({ params: { lang } }: { params: { lang: string } }) {
  const t = await getTranslations({ locale: lang, namespace: 'home' })
  const isRtl = lang === 'ar'
  const [featured, popularRetreats, popularClinics, newListings] = await Promise.all([
    fetchClinics('tier=2&limit=4'),
    fetchClinics('rating_min=4&limit=8'),
    fetchClinics('tier=1&limit=6'),
    fetchClinics('limit=6'),
  ])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }} dir={isRtl ? 'rtl' : 'ltr'}>

      {/* ── Hero (continues from dark navbar) — styles in globals.css (.home-hero) ─ */}
      <section
        className="home-hero"
        style={{
          padding: 'clamp(10px, 2.5vw, 16px) clamp(14px, 4vw, 36px) clamp(12px, 2vw, 18px)',
        }}
      >
        <div
          className="home-hero-inner"
          style={{
            maxWidth: 620,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <header style={{ textAlign: isRtl ? 'right' : 'left' }}>
            <h1
              style={{
                fontFamily: 'var(--serif)',
                fontSize: 'clamp(18px, 2.2vw, 26px)',
                fontWeight: 400,
                color: '#FDFAF6',
                lineHeight: 1.12,
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              {t('hero.h1Part1')}{' '}
              <em style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--gold)' }}>
                {t('hero.h1Italic')}
              </em>{' '}
              <span style={{ fontWeight: 300 }}>{t('hero.h1Part2')}</span>
            </h1>
            <p
              style={{
                fontSize: '11px',
                color: 'rgba(253,250,246,0.5)',
                lineHeight: 1.4,
                margin: '4px 0 0',
                maxWidth: 420,
              }}
            >
              {t('hero.subtitle')}
            </p>
          </header>

          <HeroSearch lang={lang} placeholder={t('hero.searchPlaceholder')} buttonLabel={t('hero.searchButton')} compact />
        </div>
      </section>

      {/* ── Wellness Goals (tight spacing so Featured fits in first screen) ─── */}
      <section style={{ padding: '14px clamp(16px, 4vw, 40px) 0', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <SectionHeader compact label="Find your treatment" title="Browse by Wellness Goal" cta={{ label: 'All clinics', href: `/${lang}/clinics` }} />
        <WellnessGoalGrid goals={WELLNESS_GOALS} lang={lang} compact />
      </section>

      {/* ── Featured Retreats (Tier 2 — Certified Authentic) ────────────────── */}
      <section style={{ padding: '14px clamp(16px, 4vw, 40px) 0', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <SectionHeader compact label="Certified Authentic" title="Featured Retreats" cta={{ label: 'View all', href: `/${lang}/clinics?tier=2` }} />
        {featured.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {featured.map((c) => <HomeClinicCard key={c.id} clinic={c} lang={lang} featured />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {newListings.slice(0, 4).map((c) => <HomeClinicCard key={c.id} clinic={c} lang={lang} featured />)}
          </div>
        )}
      </section>

      {/* ── Popular Retreats (top-rated, 4+ stars) ───────────────────────────── */}
      <section style={{ padding: '28px clamp(16px, 4vw, 40px) 0', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <SectionHeader compact label="Highly rated" title="Popular Retreats" cta={{ label: 'Browse retreats', href: `/${lang}/clinics` }} />
        {popularRetreats.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {popularRetreats.map((c) => <HomeClinicCard key={c.id} clinic={c} lang={lang} compact />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {newListings.map((c) => <HomeClinicCard key={c.id} clinic={c} lang={lang} compact />)}
          </div>
        )}
      </section>

      {/* ── Popular Clinics (Tier 1 Verified — day clinics & outpatient) ─────── */}
      <section style={{ padding: '28px clamp(16px, 4vw, 40px) 40px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <SectionHeader compact label="Verified clinics" title="Popular Clinics" cta={{ label: 'Browse clinics', href: `/${lang}/clinics?tier=1` }} />
        {popularClinics.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {popularClinics.map((c) => <HomeClinicCard key={c.id} clinic={c} lang={lang} compact />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {newListings.map((c) => <HomeClinicCard key={c.id} clinic={c} lang={lang} compact />)}
          </div>
        )}
      </section>

      {/* ── New Listings ─────────────────────────────────────────────────────── */}
      {newListings.length > 0 && (
        <section style={{ background: '#fff', borderTop: '1px solid var(--border)', padding: '28px clamp(16px, 4vw, 40px) 36px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <SectionHeader compact label="Recently added" title="New Retreats" cta={{ label: 'Browse all', href: `/${lang}/clinics` }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {newListings.map((c) => <HomeClinicCard key={c.id} clinic={c} lang={lang} compact />)}
            </div>
          </div>
        </section>
      )}

      {/* ── Conditions + Districts (two-col) ─────────────────────────────────── */}
      <section style={{ background: '#fff', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '48px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px' }}>

          {/* Conditions */}
          <div>
            <SectionHeader label="Search by condition" title="Conditions We Treat" cta={{ label: 'Search', href: `/${lang}/search` }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {CONDITIONS.map((c) => (
                <Link key={c.label} href={`/${lang}${c.href}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px', fontSize: '12px', color: 'var(--slate)',
                  textDecoration: 'none', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border)', background: 'var(--cream)',
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
                  {c.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Districts */}
          <div>
            <SectionHeader label="Kerala, India" title="Browse by District" cta={{ label: 'View all', href: `/${lang}/clinics` }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {KERALA_DISTRICTS.map((d) => (
                <Link key={d} href={`/${lang}/clinics?district=${d.toLowerCase()}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '6px 14px', borderRadius: '99px',
                  border: '1px solid var(--border2)', fontSize: '12px',
                  color: 'var(--slate)', textDecoration: 'none', background: 'var(--cream)',
                }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--gold)', flexShrink: 0 }}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  {d}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works + CTA (side by side) ───────────────────────────────── */}
      <section style={{ padding: '48px', maxWidth: 1200, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'start' }}>

        {/* How it works */}
        <div>
          <SectionHeader label="Simple process" title="How AyuRetreats Works" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                  background: 'var(--forest-lt)', color: 'var(--forest)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', fontFamily: 'var(--serif)',
                }}>
                  {step.icon}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: '16px', color: 'var(--forest)', fontWeight: 500, marginBottom: '3px' }}>{step.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>{step.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA cards stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'var(--gold-lt)', border: '1px solid rgba(184,134,44,0.2)', borderRadius: 'var(--r-md)', padding: '28px 28px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--bark)', marginBottom: '8px' }}>For patients</p>
            <p style={{ fontFamily: 'var(--serif)', fontSize: '20px', color: 'var(--slate)', marginBottom: '8px', lineHeight: 1.2 }}>
              Not sure which retreat is right for you?
            </p>
            <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '16px' }}>
              Browse by condition, treatment, or budget. Every clinic is credentialed before listing.
            </p>
            <Link href={`/${lang}/clinics`} style={{ display: 'inline-block', background: 'var(--bark)', color: '#fff', fontSize: '13px', fontWeight: 500, padding: '9px 22px', borderRadius: '99px', textDecoration: 'none' }}>
              Browse retreats
            </Link>
          </div>

          <div style={{ background: 'var(--forest-lt)', border: '1px solid rgba(30,61,47,0.15)', borderRadius: 'var(--r-md)', padding: '28px 28px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--forest2)', marginBottom: '8px' }}>For clinics</p>
            <p style={{ fontFamily: 'var(--serif)', fontSize: '20px', color: 'var(--slate)', marginBottom: '8px', lineHeight: 1.2 }}>
              Run an authentic Ayurveda retreat?
            </p>
            <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '16px' }}>
              Get credentialed and reach international patients looking for authentic Ayurveda care.
            </p>
            <Link href="mailto:clinics@ayuretreats.com" style={{ display: 'inline-block', background: 'var(--forest)', color: '#fff', fontSize: '13px', fontWeight: 500, padding: '9px 22px', borderRadius: '99px', textDecoration: 'none' }}>
              List your clinic
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}

function SectionHeader({
  label,
  title,
  cta,
  compact,
}: {
  label: string
  title: string
  cta?: { label: string; href: string }
  compact?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: compact ? '10px' : '20px', flexWrap: 'wrap', gap: '8px' }}>
      <div>
        <p style={{ fontSize: compact ? '9px' : '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--gold)', marginBottom: compact ? '2px' : '4px' }}>{label}</p>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: compact ? 'clamp(17px, 2vw, 22px)' : 'clamp(20px, 2.5vw, 28px)', fontWeight: 400, color: 'var(--forest)', lineHeight: 1.08 }}>{title}</h2>
      </div>
      {cta && (
        <Link href={cta.href} style={{ fontSize: '12px', fontWeight: 500, color: 'var(--forest)', textDecoration: 'none', borderBottom: '1px solid var(--gold)', paddingBottom: '1px', flexShrink: 0 }}>
          {cta.label} →
        </Link>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center', border: '1px dashed var(--border2)', borderRadius: 'var(--r-md)', color: 'var(--muted)', fontSize: '13px' }}>
      {message}
    </div>
  )
}

const HOW_IT_WORKS = [
  { icon: '◎', title: 'Search & Discover',  body: 'Browse by condition, treatment type, district, or budget.' },
  { icon: '◈', title: 'Review & Compare',   body: 'See BAMS credentials, patient reviews, programmes, and pricing.' },
  { icon: '◉', title: 'Book & Heal',        body: 'Book with secure payment. Retreat team follows up within 24 hours.' },
]
