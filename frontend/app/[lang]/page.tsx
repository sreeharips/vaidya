import { getTranslations } from 'next-intl/server'
import { Metadata } from 'next'
import Link from 'next/link'
import HeroSearch from '@/components/search/HeroSearch'
import HomeClinicCard, { type ClinicSummary } from '@/components/cards/HomeClinicCard'
import HomeDoctorCard, { type DoctorSummary } from '@/components/cards/HomeDoctorCard'
import HomeProductCard, { type ProductItem } from '@/components/cards/HomeProductCard'

export const revalidate = 300   // homepage refreshes every 5 minutes

const API_BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ConditionItem { slug: string; label: string }
interface TrustItem     { number: string; label: string }

// ── Data fetches ──────────────────────────────────────────────────────────────

async function fetchClinics(): Promise<ClinicSummary[]> {
  try {
    const res = await fetch(`${API_BASE}/api/clinics?limit=6`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    return (await res.json()).items ?? []
  } catch { return [] }
}

async function fetchDoctors(): Promise<DoctorSummary[]> {
  try {
    const res = await fetch(`${API_BASE}/api/doctors?limit=8`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    return (await res.json()).items ?? []
  } catch { return [] }
}

async function fetchProducts(): Promise<ProductItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/products?limit=8`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    return (await res.json()).items ?? []
  } catch { return [] }
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params: { lang } }: { params: { lang: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: lang, namespace: 'home.meta' })
  return {
    title: t('title'),
    description: t('description'),
    openGraph: {
      title: t('ogTitle'), description: t('ogDescription'),
      url: `https://vaidya.health/${lang}`, siteName: 'Vaidya', locale: lang, type: 'website',
      images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Vaidya — Authentic Ayurveda' }],
    },
    twitter: { card: 'summary_large_image', title: t('ogTitle'), description: t('ogDescription'), images: ['/og-image.jpg'] },
    alternates: {
      canonical: `https://vaidya.health/${lang}`,
      languages: { en: 'https://vaidya.health/en', ar: 'https://vaidya.health/ar', de: 'https://vaidya.health/de', fr: 'https://vaidya.health/fr', ml: 'https://vaidya.health/ml', hi: 'https://vaidya.health/hi' },
    },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HomePage({ params: { lang } }: { params: { lang: string } }) {
  const t = await getTranslations({ locale: lang, namespace: 'home' })

  const conditions = t.raw('conditions.items') as ConditionItem[]
  const trustItems = t.raw('trust.items')       as TrustItem[]
  const isRtl      = lang === 'ar'

  const [clinics, doctors, products] = await Promise.all([fetchClinics(), fetchDoctors(), fetchProducts()])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }} dir={isRtl ? 'rtl' : 'ltr'}>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section
        className="hero-mandala"
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '80px 48px 80px', position: 'relative', overflow: 'hidden',
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(184,134,44,0.07) 0%, transparent 70%)',
        }}
      >
        <p className="hero-eyebrow-line" style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '24px' }}>
          {t('hero.eyebrow')}
        </p>

        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(40px, 6vw, 76px)', fontWeight: 300, color: 'var(--forest)', textAlign: 'center', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '20px', maxWidth: '860px' }}>
          {t('hero.h1Part1')}{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--gold)', fontWeight: 300 }}>{t('hero.h1Italic')}</em>
          <br />{t('hero.h1Part2')}
        </h1>

        <p style={{ fontSize: '17px', fontWeight: 300, color: 'var(--muted)', textAlign: 'center', maxWidth: '520px', lineHeight: 1.7, marginBottom: '48px' }}>
          {t('hero.subtitle')}
        </p>

        <HeroSearch lang={lang} placeholder={t('hero.searchPlaceholder')} buttonLabel={t('hero.searchButton')} />

        <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '24px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {t('conditions.sectionLabel')}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', maxWidth: '640px', marginTop: '12px' }}>
          {conditions.map((c) => (
            <Link key={c.slug} href={`/${lang}/conditions/${c.slug}`} className="cond-pill">{c.label}</Link>
          ))}
        </div>
      </section>

      {/* ── Trust strip ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '40px', justifyContent: 'center', alignItems: 'center', padding: '28px 48px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: '#fff', flexWrap: 'wrap' }}>
        {trustItems.map((item) => (
          <div key={item.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: '26px', fontWeight: 600, color: 'var(--forest)' }}>{item.number}</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'center' }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* ── Popular Clinics ───────────────────────────────────────────────────── */}
      <section style={{ padding: '64px 48px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <SectionHeader label="Kerala's finest" title="Popular Ayurveda Clinics" cta={{ label: 'Browse all clinics', href: `/${lang}/clinics` }} />
        {clinics.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24, alignItems: 'stretch' }}>
            {clinics.map((clinic) => <HomeClinicCard key={clinic.id} clinic={clinic} lang={lang} />)}
          </div>
        ) : (
          <EmptyState message="Clinics coming soon — credentialing in progress." />
        )}
      </section>

      {/* ── Featured Doctors ──────────────────────────────────────────────────── */}
      <section style={{ padding: '0 48px 64px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <SectionHeader label="Experienced vaidyas" title="Featured Doctors" cta={{ label: 'Find a doctor', href: `/${lang}/doctors` }} />
        {doctors.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, alignItems: 'stretch' }}>
            {doctors.map((doctor) => <HomeDoctorCard key={doctor.id} doctor={doctor} lang={lang} />)}
          </div>
        ) : (
          <EmptyState message="Doctor profiles coming soon." />
        )}
      </section>

      {/* ── Herbal Products ───────────────────────────────────────────────────── */}
      <section style={{ padding: '64px 48px', background: '#fff', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <SectionHeader label="Direct from the vaidya" title="Herbal Products Shop" cta={{ label: 'Browse all products', href: `/${lang}/shop` }} />
          {products.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20, alignItems: 'stretch' }}>
              {products.map((product) => <HomeProductCard key={product.id} product={product} lang={lang} />)}
            </div>
          ) : (
            <EmptyState message="Herbal products coming soon." />
          )}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 48px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
        <SectionHeader label="Simple process" title="How Vaidya Works" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32 }}>
          {HOW_IT_WORKS.map((step, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--forest-lt)', color: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 16px' }}>
                {step.icon}
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--forest)', marginBottom: 6 }}>{step.title}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{step.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────────── */}
      <section style={{ padding: '0 48px 80px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', background: 'linear-gradient(135deg, var(--forest) 0%, var(--forest2) 100%)', borderRadius: 'var(--r-xl)', padding: '52px 48px', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(22px,3vw,32px)', color: '#fff', fontWeight: 300, marginBottom: 8 }}>
              Not sure which clinic is right for you?
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', maxWidth: 420, lineHeight: 1.6 }}>
              Take our 5-minute Prakriti assessment. We'll match you to the right clinics and treatments for your constitution.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href={`/${lang}/assessment`} style={{ display: 'inline-block', background: 'var(--gold)', color: '#fff', fontSize: 14, fontWeight: 600, padding: '13px 28px', borderRadius: 99, textDecoration: 'none' }}>
              Take free assessment
            </Link>
            <Link href={`/${lang}/clinics`} style={{ display: 'inline-block', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, fontWeight: 500, padding: '13px 28px', borderRadius: 99, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.2)' }}>
              Browse clinics
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}

// ── Server-only sub-components (no event handlers) ────────────────────────────

function SectionHeader({ label, title, cta }: { label: string; title: string; cta?: { label: string; href: string } }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--gold)', marginBottom: 6 }}>{label}</p>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(24px,3vw,36px)', fontWeight: 400, color: 'var(--forest)', lineHeight: 1.1 }}>{title}</h2>
      </div>
      {cta && (
        <Link href={cta.href} style={{ fontSize: 13, fontWeight: 500, color: 'var(--forest)', textDecoration: 'none', borderBottom: '1px solid var(--gold)', paddingBottom: 2, flexShrink: 0 }}>
          {cta.label} →
        </Link>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', border: '1px dashed var(--border2)', borderRadius: 'var(--r-md)', color: 'var(--muted)', fontSize: 14 }}>
      {message}
    </div>
  )
}

const HOW_IT_WORKS = [
  { icon: '🔍', title: 'Search & Discover',   body: 'Browse credentialed Ayurveda clinics and vaidyas by specialisation, location, or condition.' },
  { icon: '✦',  title: 'Prakriti Assessment', body: 'Take our 5-minute voice or text assessment. Get clinics matched to your unique body constitution.' },
  { icon: '📅', title: 'Book Your Retreat',   body: 'Book directly with the clinic. Secure payment, no hidden fees, international support.' },
  { icon: '🌿', title: 'Continue at Home',    body: "Order the clinic's authentic herbal formulations shipped directly to your door." },
]
