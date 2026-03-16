'use client'

import Link from 'next/link'

export interface ProductItem {
  id: string
  slug: string
  name: string
  description: string | null
  category: string | null
  prakriti_tags: string[]
  base_price: number | null
  lowest_price: number | null
  currency: string
  photos: string[]
  is_gmp_certified: boolean
  clinic_id: string
  clinic_name: string
  clinic_slug: string
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
}

export default function HomeProductCard({ product, lang }: { product: ProductItem; lang: string }) {
  const price = product.lowest_price ?? product.base_price

  return (
    <Link href={`/${lang}/clinics/${product.clinic_slug}`} style={{ textDecoration: 'none', display: 'flex', height: '100%' }}>
      <div
        style={{
          background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column', width: '100%',
          transition: 'box-shadow var(--transition), transform var(--transition)',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow2)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none';           e.currentTarget.style.transform = 'translateY(0)' }}
      >
        {/* Photo */}
        <div style={{ height: 130, background: 'var(--forest-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
          {product.photos[0]
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={product.photos[0]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 34 }}>🌿</span>
          }
          {product.is_gmp_certified && (
            <span style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(30,61,47,0.85)', color: '#fff', fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 99 }}>
              GMP
            </span>
          )}
          {product.category && (
            <span style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 9, fontWeight: 500, padding: '3px 8px', borderRadius: 99 }}>
              {capitalize(product.category)}
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '12px 14px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate)', marginBottom: 3, lineHeight: 1.35 }}>
            {product.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
            by {product.clinic_name}
          </div>

          {product.prakriti_tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {product.prakriti_tags.slice(0, 2).map((tag) => (
                <span key={tag} style={{ fontSize: 9, background: 'var(--gold-lt)', color: 'var(--bark)', padding: '2px 7px', borderRadius: 99 }}>
                  {capitalize(tag)}
                </span>
              ))}
            </div>
          )}

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {price != null ? (
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--forest)' }}>
                ₹{price.toLocaleString()}
                <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--muted)', marginLeft: 2 }}>{product.currency}</span>
              </span>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Price on request</span>
            )}
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--forest2)' }}>Shop →</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
