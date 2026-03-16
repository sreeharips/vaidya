import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Conditions Treated with Ayurveda in Kerala | Vaidya',
  description:
    'Browse 20 health conditions treated by verified Ayurvedic vaidyas in Kerala. Find personalised treatments for back pain, arthritis, stress, diabetes, and more.',
}

const CONDITIONS = [
  {
    slug: 'back-pain',
    name: 'Back Pain',
    treatments: ['Kati Basti', 'Pizhichil', 'Kizhi', 'Abhyanga'],
    icon: '🦴',
  },
  {
    slug: 'stress-anxiety',
    name: 'Stress & Anxiety',
    treatments: ['Shirodhara', 'Nasya', 'Abhyanga'],
    icon: '🧘',
  },
  {
    slug: 'diabetes',
    name: 'Diabetes (Prameha)',
    treatments: ['Panchakarma', 'Virechana', 'Udwarthanam'],
    icon: '🩸',
  },
  {
    slug: 'arthritis',
    name: 'Arthritis (Sandhivata)',
    treatments: ['Janu Basti', 'Pizhichil', 'Kizhi'],
    icon: '🦵',
  },
  {
    slug: 'digestive-issues',
    name: 'Digestive Disorders',
    treatments: ['Basti', 'Virechana', 'Deepana-Pachana'],
    icon: '🫁',
  },
  {
    slug: 'weight-management',
    name: 'Weight Management',
    treatments: ['Udvartana', 'Panchakarma', 'Virechana'],
    icon: '⚖️',
  },
  {
    slug: 'skin-conditions',
    name: 'Skin Diseases (Kushtha)',
    treatments: ['Takradhara', 'Lepa', 'Njavara Kizhi'],
    icon: '✨',
  },
  {
    slug: 'insomnia',
    name: 'Insomnia (Anidra)',
    treatments: ['Shirodhara', 'Pada Abhyanga', 'Nasya'],
    icon: '🌙',
  },
  {
    slug: 'sinusitis',
    name: 'Sinusitis (Pratishyaya)',
    treatments: ['Nasya', 'Swedana', 'Lepa'],
    icon: '👃',
  },
  {
    slug: 'hypertension',
    name: 'Hypertension',
    treatments: ['Shirodhara', 'Takradhara', 'Virechana'],
    icon: '❤️',
  },
  {
    slug: 'chronic-fatigue',
    name: 'Chronic Fatigue',
    treatments: ['Rasayana', 'Abhyanga', 'Njavara Kizhi'],
    icon: '⚡',
  },
  {
    slug: 'migraine',
    name: 'Migraine (Ardhavabhedaka)',
    treatments: ['Shirodhara', 'Nasya', 'Shirolepa'],
    icon: '🧠',
  },
  {
    slug: 'joint-pain',
    name: 'Joint Pain (Sandhishoola)',
    treatments: ['Janu Basti', 'Kizhi', 'Pizhichil'],
    icon: '🔗',
  },
  {
    slug: 'fertility',
    name: 'Fertility Support',
    treatments: ['Uttara Basti', 'Rasayana', 'Panchakarma'],
    icon: '🌱',
  },
  {
    slug: 'hair-loss',
    name: 'Hair Loss (Khalitya)',
    treatments: ['Shiro Abhyanga', 'Nasya', 'Shirolepa'],
    icon: '💆',
  },
  {
    slug: 'psoriasis',
    name: 'Psoriasis (Ekakushtha)',
    treatments: ['Takradhara', 'Virechana', 'Lepa'],
    icon: '🌿',
  },
  {
    slug: 'asthma',
    name: 'Asthma (Tamaka Shwasa)',
    treatments: ['Nasya', 'Virechana', 'Swedana'],
    icon: '💨',
  },
  {
    slug: 'kidney-stones',
    name: 'Kidney Stones (Ashmari)',
    treatments: ['Basti', 'Virechana', 'Swedana'],
    icon: '🫘',
  },
  {
    slug: 'menstrual-disorders',
    name: 'Menstrual Disorders',
    treatments: ['Uttara Basti', 'Virechana', 'Abhyanga'],
    icon: '🌸',
  },
  {
    slug: 'detox-cleanse',
    name: 'Detox & Cleanse',
    treatments: ['Panchakarma', 'Virechana', 'Basti', 'Vamana'],
    icon: '🫧',
  },
]

export default function ConditionsPage({ params }: { params: { lang: string } }) {
  return (
    <main style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(135deg, #1a3c2e 0%, #2d5a3d 100%)',
          color: '#fff',
          padding: '3rem 1.5rem 2.5rem',
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <p
            style={{
              fontSize: '0.8rem',
              letterSpacing: '0.12em',
              color: 'rgba(255,255,255,0.6)',
              textTransform: 'uppercase',
              marginBottom: '0.75rem',
            }}
          >
            Ayurveda by condition
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(1.8rem, 4vw, 2.75rem)',
              fontWeight: 700,
              lineHeight: 1.15,
              marginBottom: '1rem',
            }}
          >
            Find treatment for your condition
          </h1>
          <p
            style={{
              fontSize: '1.05rem',
              color: 'rgba(255,255,255,0.8)',
              maxWidth: 600,
              lineHeight: 1.7,
              marginBottom: '1.75rem',
            }}
          >
            Browse {CONDITIONS.length} conditions treated by verified Ayurvedic vaidyas in Kerala.
            Each condition maps to specific classical therapies — curated by qualified BAMS physicians.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link
              href={`/${params.lang}/assessment`}
              style={{
                background: 'var(--gold)',
                color: '#fff',
                padding: '0.75rem 1.75rem',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: '0.9rem',
                textDecoration: 'none',
              }}
            >
              Get personalised matches
            </Link>
            <Link
              href={`/${params.lang}/clinics`}
              style={{
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                padding: '0.75rem 1.75rem',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: '0.9rem',
                textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.25)',
              }}
            >
              Browse all clinics
            </Link>
          </div>
        </div>
      </section>

      {/* Conditions grid */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
          }}
        >
          {CONDITIONS.map((c) => (
            <Link
              key={c.slug}
              href={`/${params.lang}/conditions/${c.slug}`}
              style={{
                display: 'block',
                background: '#fff',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '1.25rem 1.25rem 1rem',
                textDecoration: 'none',
                transition: 'box-shadow 0.15s, border-color 0.15s',
              }}
            >
              <div style={{ fontSize: '1.75rem', marginBottom: '0.6rem' }}>{c.icon}</div>
              <div
                style={{
                  fontWeight: 700,
                  color: 'var(--forest)',
                  fontSize: '1rem',
                  marginBottom: '0.5rem',
                  lineHeight: 1.3,
                }}
              >
                {c.name}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {c.treatments.map((t) => (
                  <span
                    key={t}
                    style={{
                      background: 'var(--cream)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: '0.15rem 0.6rem',
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>

        <p
          style={{
            marginTop: '2.5rem',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          All condition–treatment mappings are verified by qualified BAMS physicians.
          No LLM-generated content. Evidence-based classical Ayurveda only.
        </p>
      </div>
    </main>
  )
}
