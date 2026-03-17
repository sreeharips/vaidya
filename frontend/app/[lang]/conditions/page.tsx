import type { Metadata } from 'next'
import Link from 'next/link'
import ConditionsGrid from './_components/ConditionsGrid'

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

      <ConditionsGrid conditions={CONDITIONS} lang={params.lang} />
    </main>
  )
}
