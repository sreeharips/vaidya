'use client'

import { useRouter } from 'next/navigation'

const CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'Oils', value: 'oil' },
  { label: 'Capsules', value: 'capsule' },
  { label: 'Powders', value: 'powder' },
  { label: 'Tablets', value: 'tablet' },
  { label: 'Syrups', value: 'syrup' },
  { label: 'Churna', value: 'churna' },
  { label: 'Ghee', value: 'ghee' },
  { label: 'Decoctions', value: 'decoction' },
]

const PRAKRITI = [
  { label: 'All doshas', value: '' },
  { label: 'Vata', value: 'vata' },
  { label: 'Pitta', value: 'pitta' },
  { label: 'Kapha', value: 'kapha' },
]

interface Props {
  lang: string
  category: string | undefined
  prakriti: string | undefined
  gmpOnly: boolean
}

export default function ShopFilterBar({ lang, category, prakriti, gmpOnly }: Props) {
  const router = useRouter()

  const navigate = (updates: { category?: string; prakriti?: string; gmpOnly?: boolean }) => {
    const params = new URLSearchParams()
    const cat   = updates.category  !== undefined ? updates.category  : (category ?? '')
    const prak  = updates.prakriti  !== undefined ? updates.prakriti  : (prakriti ?? '')
    const gmp   = updates.gmpOnly   !== undefined ? updates.gmpOnly   : gmpOnly
    if (cat)  params.set('category', cat)
    if (prak) params.set('prakriti', prak)
    if (gmp)  params.set('gmp_only', 'true')
    router.push(`/${lang}/shop?${params.toString()}`)
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>

      {/* Category pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {CATEGORIES.map(c => {
          const active = (category ?? '') === c.value
          return (
            <button
              key={c.value}
              onClick={() => navigate({ category: c.value })}
              style={{
                fontSize: 12, padding: '6px 14px', borderRadius: 99, cursor: 'pointer',
                border: `1px solid ${active ? 'var(--forest)' : 'var(--border)'}`,
                background: active ? 'var(--forest)' : '#fff',
                color: active ? '#fff' : 'var(--slate)',
                fontWeight: active ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {c.label}
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />

      {/* Prakriti pills */}
      <div style={{ display: 'flex', gap: 6 }}>
        {PRAKRITI.map(p => {
          const active = (prakriti ?? '') === p.value
          return (
            <button
              key={p.value}
              onClick={() => navigate({ prakriti: p.value })}
              style={{
                fontSize: 12, padding: '6px 14px', borderRadius: 99, cursor: 'pointer',
                border: `1px solid ${active ? 'var(--bark)' : 'var(--border)'}`,
                background: active ? 'var(--gold-lt)' : '#fff',
                color: active ? 'var(--bark)' : 'var(--slate)',
                fontWeight: active ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />

      {/* GMP toggle */}
      <button
        onClick={() => navigate({ gmpOnly: !gmpOnly })}
        style={{
          fontSize: 12, padding: '6px 14px', borderRadius: 99, cursor: 'pointer',
          border: `1px solid ${gmpOnly ? 'var(--forest2)' : 'var(--border)'}`,
          background: gmpOnly ? 'var(--forest-lt)' : '#fff',
          color: gmpOnly ? 'var(--forest2)' : 'var(--slate)',
          fontWeight: gmpOnly ? 600 : 400,
          display: 'flex', alignItems: 'center', gap: 5,
          transition: 'all 0.15s',
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, background: gmpOnly ? 'var(--forest2)' : 'var(--muted)', color: '#fff', padding: '1px 5px', borderRadius: 3 }}>
          GMP
        </span>
        Certified only
      </button>

    </div>
  )
}
