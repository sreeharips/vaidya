'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ClinicCard, { type Clinic } from '@/components/cards/ClinicCard'
import FilterSidebar from './_components/FilterSidebar'
import { ClinicCardSkeleton } from './_components/Skeletons'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SearchFilters {
  q: string
  tier: number[]
  category: string
  /** Client-side / URL only until clinic list supports dosha filter */
  prakriti: string
  budgetMax: number
  duration: string
  language: string
  ratingMin: number
  sort: string
}

const DEFAULT_FILTERS: SearchFilters = {
  q: '',
  tier: [1, 2],
  category: '',
  prakriti: '',
  budgetMax: 500,
  duration: '',
  language: '',
  ratingMin: 0,
  sort: 'best',
}

// ── API config ────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
const LIMIT = 20

// ── Mapping helpers ───────────────────────────────────────────────────────────

// ClinicSummary from /api/clinics → ClinicCard Clinic
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapClinic(c: any): Clinic {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    tier: (c.tier ?? 1) as 1 | 2,
    district: c.district ?? null,
    rating: c.rating ?? null,
    review_count: c.review_count ?? 0,
    specialisations: c.specialisations ?? [],
    wellness_categories: c.wellness_categories ?? [],
    languages: c.languages ?? [],
    pricing_min: c.pricing_min ?? null,
    pricing_max: c.pricing_max ?? null,
    certifications: c.certifications ?? [],
    outcome_enrolled: c.outcome_enrolled ?? false,
    accommodation_available: c.accommodation_available ?? false,
    photos: c.photos ?? [],
  }
}

// SearchResult from /api/search → Clinic
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSearchClinic(r: any): Clinic {
  return {
    id: r.id, slug: r.slug, name: r.name,
    tier: (r.tier ?? 1) as 1 | 2, district: r.district ?? null,
    rating: r.rating ?? null, review_count: 0,
    specialisations: r.specialisations ?? [],
    wellness_categories: r.wellness_categories ?? [], languages: [],
    pricing_min: null, pricing_max: null,
    certifications: [], outcome_enrolled: false,
    accommodation_available: false, photos: [],
  }
}

// ── Sort ──────────────────────────────────────────────────────────────────────

function sortClinics(items: Clinic[], sort: string): Clinic[] {
  const arr = [...items]
  if (sort === 'rated')      return arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
  if (sort === 'price_asc')  return arr.sort((a, b) => (a.pricing_min ?? Infinity) - (b.pricing_min ?? Infinity))
  if (sort === 'price_desc') return arr.sort((a, b) => (b.pricing_min ?? 0) - (a.pricing_min ?? 0))
  if (sort === 'reviewed')   return arr.sort((a, b) => b.review_count - a.review_count)
  return arr
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const params   = useParams()
  const router   = useRouter()
  const sp       = useSearchParams()
  const lang     = (params?.lang as string) || 'en'

  // ── Filter state ────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS)
  const [refineQuery, setRefineQuery] = useState('')
  const initialized = useRef(false)

  // ── Results state ────────────────────────────────────────────────────────────
  const [clinics,      setClinics]      = useState<Clinic[]>([])
  const [clinicsTotal, setClinicsTotal] = useState(0)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [offset,       setOffset]       = useState(0)
  const [hasMore,      setHasMore]      = useState(false)

  // ── Init filters from URL on first render ────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const tierParam = sp.get('tier')
    const tierArr = tierParam
      ? tierParam.split(',').map(Number).filter(n => n === 1 || n === 2)
      : [1, 2]

    const init: SearchFilters = {
      q:            sp.get('q') ?? '',
      tier:         tierArr,
      category:     sp.get('category') ?? '',
      prakriti:     sp.get('prakriti') ?? '',
      budgetMax:    sp.get('budget') ? Number(sp.get('budget')) : 500,
      duration:     sp.get('duration') ?? '',
      language:     sp.get('language') ?? '',
      ratingMin:    sp.get('rating') ? Number(sp.get('rating')) : 0,
      sort:         sp.get('sort') ?? 'best',
    }
    setFilters(init)
    setRefineQuery(init.q)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Fetch data when filters change ──────────────────────────────────────────
  useEffect(() => {
    if (!initialized.current) return
    fetchResults(filters, 0, false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  async function fetchResults(f: SearchFilters, fetchOffset: number, append: boolean) {
    setLoading(true)
    setError(null)
    try {
      const url = f.q
        ? buildSearchUrl(f.q, 'clinic', lang, fetchOffset)
        : buildClinicUrl(f, fetchOffset)
      const res  = await fetch(url)
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()

      const items: Clinic[] = f.q
        ? (data.results ?? []).map(mapSearchClinic)
        : (data.items ?? []).map(mapClinic)
      const total = data.total ?? items.length

      setClinicsTotal(total)
      setClinics(prev => append ? [...prev, ...items] : items)
      setHasMore(fetchOffset + LIMIT < total)
    } catch (e) {
      setError('Could not load results. Is the backend running?')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ── Filter change handler ────────────────────────────────────────────────────
  function updateFilters(updates: Partial<SearchFilters>) {
    const next = { ...filters, ...updates }
    setFilters(next)
    setOffset(0)
    pushUrl(next)
  }

  function clearFilters() {
    const cleared = { ...DEFAULT_FILTERS, q: filters.q }
    setFilters(cleared)
    setOffset(0)
    pushUrl(cleared)
  }

  function pushUrl(f: SearchFilters) {
    const p = new URLSearchParams()
    if (f.q)                          p.set('q', f.q)
    if (f.tier.length === 1)          p.set('tier', String(f.tier[0]))
    if (f.category)                   p.set('category', f.category)
    if (f.prakriti)                   p.set('prakriti', f.prakriti)
    if (f.budgetMax < 500)            p.set('budget', String(f.budgetMax))
    if (f.duration)                   p.set('duration', f.duration)
    if (f.language)                   p.set('language', f.language)
    if (f.ratingMin > 0)              p.set('rating', String(f.ratingMin))
    if (f.sort !== 'best')            p.set('sort', f.sort)
    router.push(`/${lang}/search${p.toString() ? '?' + p.toString() : ''}`, { scroll: false })
  }

  function handleRefineSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateFilters({ q: refineQuery.trim() })
  }

  async function handleLoadMore() {
    const next = offset + LIMIT
    setOffset(next)
    await fetchResults(filters, next, true)
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const displayClinics   = sortClinics(clinics, filters.sort)

  return (
    <div style={{ minHeight: 'calc(100vh - 68px)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Assessment nudge bar ──────────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--forest)',
          padding: '14px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
        }}
      >
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,.8)', maxWidth: '500px', margin: 0 }}>
          <strong style={{ color: '#fff' }}>Get personalised matches.</strong>{' '}
          
        </p>
 
      </div>

      {/* ── Results layout ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1 }}>

        <FilterSidebar filters={filters} onChange={updateFilters} onClear={clearFilters} />

        {/* ── Main ──────────────────────────────────────────────────────────── */}
        <main style={{ flex: 1, padding: '32px 40px', minWidth: 0 }}>

          {/* Inline refine search bar */}
          <form
            onSubmit={handleRefineSubmit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'var(--white)',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--r-xl)',
              padding: '8px 16px',
              marginBottom: '24px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--muted)', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={refineQuery}
              onChange={e => setRefineQuery(e.target.value)}
              placeholder="Refine your search…"
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: 'var(--sans)', fontSize: '14px', color: 'var(--slate)',
              }}
            />
          </form>

          {/* Results header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
              paddingBottom: '20px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ fontFamily: 'var(--serif)', fontSize: '22px', fontWeight: 400, color: 'var(--forest)' }}>
              {loading && clinics?.length === 0
                ? 'Searching…'
                : `${clinicsTotal} result${clinicsTotal !== 1 ? 's' : ''}`}
              {filters.q && (
                <span style={{ color: 'var(--muted)', fontSize: '15px', fontFamily: 'var(--sans)', fontWeight: 300 }}>
                  {' '}for &ldquo;{filters.q}&rdquo;
                </span>
              )}
            </div>

            <select
              value={filters.sort}
              onChange={e => updateFilters({ sort: e.target.value })}
              style={{
                fontFamily: 'var(--sans)',
                fontSize: '13px',
                color: 'var(--slate)',
                border: '1px solid var(--border2)',
                borderRadius: 'var(--r-sm)',
                padding: '8px 14px',
                background: 'var(--white)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="best">Best match</option>
              <option value="rated">Highest rated</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="reviewed">Most reviewed</option>
            </select>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                padding: '16px 20px',
                background: 'var(--bark-lt)',
                border: '1px solid rgba(107,79,58,0.2)',
                borderRadius: 'var(--r-md)',
                color: 'var(--bark)',
                fontSize: '14px',
                marginBottom: '20px',
              }}
            >
              {error}
            </div>
          )}

          {/* Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {loading && clinics?.length === 0
              ? Array.from({ length: 3 }).map((_, i) =>
                  <ClinicCardSkeleton key={i} />
                )
              : displayClinics.map(clinic => (
                  <ClinicCard
                    key={clinic.id}
                    clinic={clinic}
                    onClick={c => router.push(`/${lang}/clinics/${c.slug}`)}
                  />
                ))
            }

            {/* Empty state */}
            {!loading && clinics.length === 0 && !error && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
                <p style={{ fontFamily: 'var(--serif)', fontSize: '22px', color: 'var(--forest)', marginBottom: '8px' }}>
                  No results found
                </p>
                <p style={{ fontSize: '14px' }}>
                  Try adjusting your filters or{' '}
                  <button
                    onClick={clearFilters}
                    style={{ color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}
                  >
                    clearing all filters
                  </button>
                </p>
              </div>
            )}
          </div>

          {/* Load more */}
          {!loading && hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}>
              <button
                onClick={handleLoadMore}
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: '14px',
                  fontWeight: 500,
                  padding: '12px 32px',
                  borderRadius: 'var(--r-xl)',
                  border: '1.5px solid var(--border2)',
                  color: 'var(--slate)',
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'all var(--transition)',
                }}
              >
                Load more
              </button>
            </div>
          )}

          {/* Inline loading indicator for load-more */}
          {loading && clinics.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <ClinicCardSkeleton />
            </div>
          )}

        </main>
      </div>
    </div>
  )
}

// ── URL builders ──────────────────────────────────────────────────────────────

function buildClinicUrl(f: SearchFilters, fetchOffset: number): string {
  const p = new URLSearchParams()
  if (f.tier.length === 1)  p.set('tier', String(f.tier[0]))
  if (f.category)           p.set('wellness_category', f.category)
  if (f.language)           p.set('language', f.language)
  if (f.ratingMin > 0)      p.set('rating_min', String(f.ratingMin))
  if (f.budgetMax < 500)    p.set('budget_max', String(f.budgetMax))
  if (f.duration)           p.set('duration', f.duration)
  p.set('limit', String(LIMIT))
  p.set('offset', String(fetchOffset))
  return `${API_BASE}/api/clinics?${p}`
}

function buildSearchUrl(q: string, type: string, lang: string, fetchOffset: number): string {
  const p = new URLSearchParams({ q, type, lang })
  p.set('limit', String(LIMIT))
  p.set('offset', String(fetchOffset))
  return `${API_BASE}/api/search?${p}`
}
