'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

// ── Static dosha data (mirrors assessment/page.tsx) ────────────────────────────

const DOSHA_INFO: Record<string, {
  bar: string; bg: string; textColor: string; border: string
  tagline: string; desc: string
  tendencies: string[]; treatments: string[]; retreatFocus: string
}> = {
  vata: {
    bar: '#8B6E5A', bg: 'var(--bark-lt)', textColor: 'var(--bark)', border: 'rgba(107,79,58,.2)',
    tagline: 'Creative · Quick · Light',
    desc: 'Vata types are creative, energetic, and quick-thinking. When balanced, you are enthusiastic and vital. When imbalanced, you may experience anxiety, dry skin, and digestive irregularity.',
    tendencies: ['Dry skin and hair', 'Variable digestion, bloating, gas', 'Irregular sleep patterns', 'Anxiety and restlessness', 'Cold hands and feet', 'Joint discomfort'],
    treatments: ['Abhyanga', 'Shirodhara', 'Pizhichil', 'Kati Basti', 'Njavara Kizhi'],
    retreatFocus: 'Warm, nourishing, grounding therapies',
  },
  pitta: {
    bar: '#2D5440', bg: 'var(--forest-lt)', textColor: 'var(--forest2)', border: 'rgba(30,61,47,.15)',
    tagline: 'Focused · Driven · Analytical',
    desc: 'Pitta types are focused, driven, and analytical. When balanced, you are confident and decisive. When imbalanced, you may experience inflammation, acidity, and irritability.',
    tendencies: ['Sensitive skin prone to rashes', 'Strong digestion but prone to acidity', 'Light but quality sleep', 'Tendency toward perfectionism and irritability', 'Heat sensitivity', 'Eye strain'],
    treatments: ['Shirodhara', 'Takradhara', 'Nasya', 'Pizhichil', 'Lepa'],
    retreatFocus: 'Cooling, calming, anti-inflammatory therapies',
  },
  kapha: {
    bar: '#B8862C', bg: 'var(--gold-lt)', textColor: 'var(--bark)', border: 'rgba(184,134,44,.2)',
    tagline: 'Steady · Compassionate · Resilient',
    desc: 'Kapha types are steady, compassionate, and resilient. When balanced, you are calm and nurturing. When imbalanced, you may experience sluggishness, weight gain, and congestion.',
    tendencies: ['Tendency to gain weight', 'Slow digestion, feeling heavy after meals', 'Deep but excessive sleep', 'Congestion and mucus buildup', 'Attachment and resistance to change', 'Low motivation in the morning'],
    treatments: ['Udvartana', 'Panchakarma', 'Kizhi', 'Nasya', 'Virechana'],
    retreatFocus: 'Stimulating, cleansing, energising therapies',
  },
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AssessmentResultsPage() {
  const params = useParams()
  const lang = (params?.lang as string) || 'en'
  const { preferences, isLoading } = useAuth()

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="assessment-wrap" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <div style={{ fontSize: '14px', color: 'var(--muted)' }}>Loading your profile…</div>
      </div>
    )
  }

  // ── No prakriti on file ───────────────────────────────────────────────────

  if (!preferences?.primary_type) {
    return (
      <main style={{ background: 'var(--cream)', minHeight: '100vh' }}>
        <div
          style={{
            maxWidth: 560,
            margin: '0 auto',
            padding: '100px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '52px', marginBottom: '24px' }}>🌿</div>
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontSize: '28px',
              fontWeight: 400,
              color: 'var(--forest)',
              marginBottom: '12px',
              letterSpacing: '-0.01em',
            }}
          >
            No Prakriti profile yet
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.7, marginBottom: '36px', maxWidth: 400 }}>
            Take the 22-question Prakriti assessment to discover your Ayurvedic constitution
            and get personalised clinic and doctor recommendations.
          </p>
          <Link
            href={`/${lang}/assessment`}
            style={{
              background: 'var(--forest)',
              color: '#fff',
              padding: '13px 32px',
              borderRadius: 'var(--r-xl)',
              fontWeight: 500,
              fontSize: '15px',
              textDecoration: 'none',
              display: 'inline-block',
              marginBottom: '16px',
            }}
          >
            Take the Prakriti assessment →
          </Link>
          <Link href={`/${lang}`} style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>
            ← Back to homepage
          </Link>
        </div>
      </main>
    )
  }

  // ── Results ───────────────────────────────────────────────────────────────

  const primary = preferences.primary_type.toLowerCase()
  const secondary = preferences.secondary_type?.toLowerCase() ?? null
  const info = DOSHA_INFO[primary] ?? DOSHA_INFO.vata

  const vataPct = preferences.vata_pct ?? 0
  const pittaPct = preferences.pitta_pct ?? 0
  const kaphaPct = preferences.kapha_pct ?? 0

  const bars = [
    { label: 'Vata',  pct: vataPct,  color: DOSHA_INFO.vata.bar },
    { label: 'Pitta', pct: pittaPct, color: DOSHA_INFO.pitta.bar },
    { label: 'Kapha', pct: kaphaPct, color: DOSHA_INFO.kapha.bar },
  ]

  const doshaLabel = secondary
    ? `${capitalize(primary)} — ${capitalize(secondary)}`
    : capitalize(primary)

  return (
    <main style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(135deg, #1a3c2e 0%, #2d5a3d 100%)',
          color: '#fff',
          padding: '2.5rem 1.5rem 2rem',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <p style={{ fontSize: '0.75rem', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Your Prakriti
          </p>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 400, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
            {doshaLabel}
          </h1>
          <p style={{ marginTop: '8px', fontSize: '15px', color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>
            {info.tagline}
          </p>
        </div>
      </section>

      <div className="assessment-wrap" style={{ paddingTop: '32px', paddingBottom: '60px' }}>

        {/* ── Dosha bars ───────────────────────────────────────── */}
        <div
          style={{
            padding: '28px',
            borderRadius: 'var(--r-lg)',
            background: info.bg,
            border: `1px solid ${info.border}`,
            marginBottom: '28px',
          }}
        >
          <p style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '18px' }}>
            Constitution breakdown
          </p>
          <div style={{ maxWidth: '400px' }}>
            {bars.map((b) => (
              <div key={b.label} className="dosha-bar-row">
                <span className="dosha-bar-label">{b.label}</span>
                <div className="dosha-bar-track">
                  <div className="dosha-bar-fill" style={{ width: `${b.pct}%`, background: b.color }} />
                </div>
                <span className="dosha-bar-pct">{b.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── What this means ───────────────────────────────────── */}
        <div className="profile-section">
          <div className="profile-section-title">What this means</div>
          <p style={{ fontSize: '15px', lineHeight: 1.8, color: 'var(--muted)' }}>
            {info.desc}
          </p>
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: 'var(--white)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
            </svg>
            <span style={{ fontSize: '13px', color: 'var(--bark)', fontWeight: 500 }}>
              Ideal retreat focus: {info.retreatFocus}
            </span>
          </div>
        </div>

        {/* ── Health tendencies ────────────────────────────────── */}
        <div className="profile-section">
          <div className="profile-section-title">Your health tendencies</div>
          <div>
            {info.tendencies.map((t, i) => (
              <div key={i} className="tendency-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* ── Recommended treatments ───────────────────────────── */}
        <div className="profile-section">
          <div className="profile-section-title">Recommended treatments</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {info.treatments.map((t) => (
              <span key={t} className="treatment-tag">{t}</span>
            ))}
          </div>
        </div>

        {/* ── CTAs ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
          <Link
            href={`/${lang}/search?prakriti=${primary}`}
            style={{
              display: 'block',
              textAlign: 'center',
              fontFamily: 'var(--sans)',
              fontSize: '15px',
              fontWeight: 500,
              padding: '14px',
              borderRadius: 'var(--r-xl)',
              background: 'var(--forest)',
              color: 'var(--white)',
              textDecoration: 'none',
            }}
          >
            Find matching doctors & clinics →
          </Link>

          <Link
            href={`/${lang}/assessment`}
            style={{
              display: 'block',
              textAlign: 'center',
              fontFamily: 'var(--sans)',
              fontSize: '14px',
              padding: '12px',
              borderRadius: 'var(--r-xl)',
              border: '1.5px solid var(--border2)',
              color: 'var(--muted)',
              textDecoration: 'none',
            }}
          >
            Retake assessment
          </Link>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginTop: '20px', lineHeight: 1.6 }}>
          Results are educational guidance only — not a medical diagnosis.
          Always consult a qualified vaidya for personalised clinical advice.
        </p>
      </div>
    </main>
  )
}
