import type React from 'react'
import { Metadata } from 'next'
import HomeClinicCard, { type ClinicSummary } from '@/components/cards/HomeClinicCard'
import ListingFilterBar from '@/components/clinics/ListingFilterBar'
import SearchBar from '@/components/search/SearchBar'

export const revalidate = 120

const API_BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const DISTRICTS = [
  'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam',
  'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram',
  'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod',
]

const SPECIALISATIONS = [
  'panchakarma', 'shirodhara', 'kizhi', 'abhyanga', 'pizhichil',
  'njavara', 'nasya', 'basti', 'virechana', 'udvartana',
]

const PRAKRITI  = ['vata', 'pitta', 'kapha']
const LANGUAGES = ['Malayalam', 'English', 'Hindi', 'Arabic', 'German', 'French']

const PAGE_SIZE = 18

interface PageProps {
  params: { lang: string }
  searchParams: Record<string, string | undefined>
}

export async function generateMetadata({ params: { lang } }: PageProps): Promise<Metadata> {
  return {
    title: 'Ayurveda Clinics in Kerala — Browse & Filter | Vaidya',
    description: 'Discover credentialed Ayurveda clinics in Kerala. Filter by treatment type, district, budget, language, and Prakriti constitution.',
    alternates: { canonical: `https://vaidya.health/${lang}/clinics` },
  }
}

async function fetchClinics(params: URLSearchParams): Promise<{ items: ClinicSummary[]; total: number }> {
  try {
    const res = await fetch(`${API_BASE}/api/clinics?${params.toString()}`, { next: { revalidate: 120 } })
    if (!res.ok) return { items: [], total: 0 }
    const data = await res.json()
    return { items: data.items ?? [], total: data.total ?? 0 }
  } catch {
    return { items: [], total: 0 }
  }
}

export default async function ClinicsPage({ params: { lang }, searchParams }: PageProps) {
  const tier           = searchParams.tier
  const specialisation = searchParams.specialisation
  const district       = searchParams.district
  const language       = searchParams.language
  const prakriti       = searchParams.prakriti
  const budgetMax      = searchParams.budget_max
  const ratingMin      = searchParams.rating_min
  const page           = Number(searchParams.page ?? '1')
  const offset         = (page - 1) * PAGE_SIZE

  const qs = new URLSearchParams()
  if (tier)           qs.set('tier', tier)
  if (specialisation) qs.set('specialisation', specialisation)
  if (district)       qs.set('district', district)
  if (language)       qs.set('language', language)
  if (prakriti)       qs.set('prakriti', prakriti)
  if (budgetMax)      qs.set('budget_max', budgetMax)
  if (ratingMin)      qs.set('rating_min', ratingMin)
  qs.set('limit', String(PAGE_SIZE))
  qs.set('offset', String(offset))

  const { items: clinics, total } = await fetchClinics(qs)

  const totalPages    = Math.ceil(total / PAGE_SIZE)
  const activeFilters = [tier, specialisation, district, language, prakriti, budgetMax, ratingMin].filter(Boolean).length

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const merged = { tier, specialisation, district, language, prakriti, budget_max: budgetMax, rating_min: ratingMin, page: String(page), ...overrides }
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== 'undefined') p.set(k, v)
    }
    return `/${lang}/clinics?${p.toString()}`
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '40px 48px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--gold)', marginBottom: 8 }}>
            Kerala, India
          </p>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 400, color: 'var(--forest)', lineHeight: 1.15, marginBottom: 8 }}>
            Ayurveda Clinics
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 540, marginBottom: 20 }}>
            {total > 0
              ? `${total} credentialed clinic${total !== 1 ? 's' : ''} — all verified by Vaidya`
              : 'Credentialed clinics — all verified by Vaidya'}
          </p>
          <SearchBar variant="compact" type="clinic" placeholder="Search clinics, treatments, districts…" />
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 48px 64px', display: 'flex', gap: 32, alignItems: 'flex-start' }}>

        {/* Sidebar */}
        <aside style={{ width: 240, flexShrink: 0, position: 'sticky', top: 24 }}>
          <ListingFilterBar
            basePath={`/${lang}/clinics`}
            current={{ tier, specialisation, district, language, prakriti, budgetMax, ratingMin }}
            options={{
              districts: DISTRICTS,
              specialisations: SPECIALISATIONS,
              prakriti: PRAKRITI,
              languages: LANGUAGES,
              budgetLabel: 'Max budget (₹/day)',
            }}
          />
        </aside>

        {/* Results */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {activeFilters > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {activeFilters} filter{activeFilters !== 1 ? 's' : ''} active
              </span>
              <a href={`/${lang}/clinics`} style={{ fontSize: 12, color: 'var(--forest)', textDecoration: 'underline' }}>
                Clear all
              </a>
            </div>
          )}

          {clinics.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24, alignItems: 'stretch' }}>
              {clinics.map((clinic) => (
                <HomeClinicCard key={clinic.id} clinic={clinic} lang={lang} />
              ))}
            </div>
          ) : (
            <div style={{ padding: '60px 24px', textAlign: 'center', border: '1px dashed var(--border2)', borderRadius: 'var(--r-md)', color: 'var(--muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--forest)', marginBottom: 8 }}>No clinics found</div>
              <div style={{ fontSize: 13 }}>Try adjusting your filters.</div>
              <a href={`/${lang}/clinics`} style={{ display: 'inline-block', marginTop: 16, fontSize: 13, color: 'var(--forest)', textDecoration: 'underline' }}>
                Clear all filters
              </a>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 48 }}>
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
