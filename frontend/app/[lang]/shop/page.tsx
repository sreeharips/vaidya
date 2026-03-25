import type React from 'react'
import { Metadata } from 'next'
import HomeProductCard, { type ProductItem } from '@/components/cards/HomeProductCard'
import ShopFilterBar from '@/components/shop/ShopFilterBar'
import SearchBar from '@/components/search/SearchBar'

export const revalidate = 120

const API_BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const PAGE_SIZE = 24

interface PageProps {
  params: { lang: string }
  searchParams: Record<string, string | undefined>
}

export async function generateMetadata({ params: { lang } }: PageProps): Promise<Metadata> {
  return {
    title: 'Herbal Ayurvedic Products — Direct from Kerala Clinics | Vaidya',
    description: 'Shop authentic Ayurvedic oils, capsules, powders and formulations sourced directly from credentialed Kerala clinics. GMP certified where available.',
    alternates: { canonical: `https://vaidya.health/${lang}/shop` },
  }
}

async function fetchProducts(params: URLSearchParams): Promise<{ items: ProductItem[]; total: number }> {
  try {
    const res = await fetch(`${API_BASE}/api/products?${params.toString()}`, { next: { revalidate: 120 } })
    if (!res.ok) return { items: [], total: 0 }
    const data = await res.json()
    return { items: data.items ?? [], total: data.total ?? 0 }
  } catch {
    return { items: [], total: 0 }
  }
}

export default async function ShopPage({ params: { lang }, searchParams }: PageProps) {
  const category = searchParams.category
  const prakriti = searchParams.prakriti
  const gmpOnly  = searchParams.gmp_only === 'true'
  const page     = Number(searchParams.page ?? '1')
  const offset   = (page - 1) * PAGE_SIZE

  const qs = new URLSearchParams()
  if (category) qs.set('category', category)
  if (prakriti) qs.set('prakriti', prakriti)
  if (gmpOnly)  qs.set('gmp_only', 'true')
  qs.set('limit', String(PAGE_SIZE))
  qs.set('offset', String(offset))

  const { items: products, total } = await fetchProducts(qs)

  const totalPages    = Math.ceil(total / PAGE_SIZE)
  const activeFilters = [category, prakriti, gmpOnly || undefined].filter(Boolean).length

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const merged = { category, prakriti, gmp_only: gmpOnly ? 'true' : undefined, page: String(page), ...overrides }
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== 'undefined') p.set(k, v)
    }
    return `/${lang}/shop?${p.toString()}`
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

      {/* Hero header */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 48px 36px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--gold)', marginBottom: 8 }}>
            Direct from the vaidya
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
            <div>
              <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 400, color: 'var(--forest)', lineHeight: 1.15, marginBottom: 6 }}>
                Herbal Products Shop
              </h1>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                {total > 0
                  ? `${total} authentic formulation${total !== 1 ? 's' : ''} from credentialed Kerala clinics`
                  : 'Authentic Ayurvedic formulations from credentialed Kerala clinics'}
              </p>
            </div>
            {activeFilters > 0 && (
              <a href={`/${lang}/shop`} style={{ fontSize: 12, color: 'var(--forest)', textDecoration: 'underline', flexShrink: 0 }}>
                Clear {activeFilters} filter{activeFilters !== 1 ? 's' : ''}
              </a>
            )}
          </div>

          {/* Search + Filter bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <SearchBar variant="compact" type="product" placeholder="Search oils, capsules, powders…" />
            </div>
            <ShopFilterBar lang={lang} category={category} prakriti={prakriti} gmpOnly={gmpOnly} />
          </div>
        </div>
      </div>

      {/* Product grid */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 48px 64px' }}>
        {products.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 20, alignItems: 'stretch' }}>
            {products.map((product) => (
              <HomeProductCard key={product.id} product={product} lang={lang} />
            ))}
          </div>
        ) : (
          <div style={{ padding: '80px 24px', textAlign: 'center', border: '1px dashed var(--border2)', borderRadius: 'var(--r-md)', color: 'var(--muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🌿</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--forest)', marginBottom: 8 }}>No products found</div>
            <div style={{ fontSize: 13, marginBottom: 16 }}>Try a different category or clear your filters.</div>
            <a href={`/${lang}/shop`} style={{ fontSize: 13, color: 'var(--forest)', textDecoration: 'underline' }}>
              Browse all products
            </a>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 52 }}>
            {page > 1 && (
              <a href={buildUrl({ page: String(page - 1) })} style={pagStyle(false)}>← Previous</a>
            )}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | '…')[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === '…'
                  ? <span key={`e${i}`} style={{ padding: '8px 4px', color: 'var(--muted)', fontSize: 13 }}>…</span>
                  : <a key={p} href={buildUrl({ page: String(p) })} style={pagStyle(p === page)}>{p}</a>
              )}
            {page < totalPages && (
              <a href={buildUrl({ page: String(page + 1) })} style={pagStyle(false)}>Next →</a>
            )}
          </div>
        )}

        {/* Trust strip */}
        <div style={{ marginTop: 64, padding: '32px 0', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 32, justifyContent: 'center' }}>
          {[
            { icon: '🌿', text: 'Sourced directly from credentialed clinics' },
            { icon: '✦',  text: 'GMP certified formulations where available' },
            { icon: '📦', text: 'Shipped from clinic to your door' },
            { icon: '🔒', text: 'Secure payment via Stripe & Razorpay' },
          ].map(item => (
            <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function pagStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 36, height: 36, padding: '0 12px',
    borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
    fontSize: 13, textDecoration: 'none',
    background: active ? 'var(--forest)' : '#fff',
    color: active ? '#fff' : 'var(--slate)',
    fontWeight: active ? 600 : 400,
  }
}
