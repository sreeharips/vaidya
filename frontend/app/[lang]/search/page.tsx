'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import DoctorCard, { type Doctor } from '@/components/cards/DoctorCard'
import ClinicCard, { type Clinic } from '@/components/cards/ClinicCard'
import FilterSidebar from './_components/FilterSidebar'
import ConditionBanner from './_components/ConditionBanner'
import { DoctorCardSkeleton, ClinicCardSkeleton } from './_components/Skeletons'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SearchFilters {
  q: string
  tab: 'doctors' | 'clinics'
  tier: number[]
  specialisation: string
  prakriti: string
  budgetMax: number
  duration: string
  language: string
  ratingMin: number
  sort: string
}

const DEFAULT_FILTERS: SearchFilters = {
  q: '',
  tab: 'doctors',
  tier: [1, 2],
  specialisation: '',
  prakriti: '',
  budgetMax: 500,
  duration: '',
  language: '',
  ratingMin: 0,
  sort: 'best',
}

// ── Condition detection ───────────────────────────────────────────────────────

const CONDITION_MAP = [
  { slug: 'back-pain',         name: 'Back Pain',             keywords: ['back pain', 'backache', 'lower back'],       treatmentCount: 4 },
  { slug: 'stress-anxiety',    name: 'Stress & Anxiety',      keywords: ['stress', 'anxiety', 'mental'],               treatmentCount: 4 },
  { slug: 'diabetes',          name: 'Diabetes',              keywords: ['diabetes', 'blood sugar', 'prameha'],        treatmentCount: 3 },
  { slug: 'arthritis',         name: 'Arthritis',             keywords: ['arthritis', 'joint pain', 'sandhivata'],     treatmentCount: 4 },
  { slug: 'digestive-issues',  name: 'Digestive Disorders',   keywords: ['digestive', 'digestion', 'stomach', 'gut'],  treatmentCount: 3 },
  { slug: 'weight-management', name: 'Weight Management',     keywords: ['weight', 'obesity', 'fat loss'],             treatmentCount: 3 },
  { slug: 'skin-conditions',   name: 'Skin Diseases',         keywords: ['skin', 'eczema', 'psoriasis'],               treatmentCount: 4 },
  { slug: 'insomnia',          name: 'Insomnia',              keywords: ['insomnia', 'sleep'],                         treatmentCount: 3 },
]

function matchCondition(q: string) {
  if (!q) return null
  const lower = q.toLowerCase()
  return CONDITION_MAP.find(c =>
    c.keywords.some(k => lower.includes(k)) ||
    c.slug.replace(/-/g, ' ') === lower ||
    c.name.toLowerCase() === lower
  ) ?? null
}

// ── API config ────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
const LIMIT = 20

// ── Mapping helpers ───────────────────────────────────────────────────────────

// DoctorSummary from /api/doctors → DoctorCard Doctor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDoctor(d: any): Doctor {
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    qualification: d.qualification ?? '',
    years_exp: d.years_exp ?? 0,
    tier: (d.tier ?? 1) as 1 | 2,
    rating: d.rating ?? null,
    review_count: d.review_count ?? 0,
    specialisations: d.specialisations ?? [],
    prakriti_affinities: d.prakriti_affinities ?? [],
    languages: d.languages ?? [],
    photo_url: d.photo_url ?? null,
    pricing_per_day: d.pricing_per_day ?? null,
    location_address: d.district ? `${d.district}, Kerala` : null,
    available_dates: [],
  }
}

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
    prakriti_affinities: c.prakriti_affinities ?? [],
    languages: c.languages ?? [],
    pricing_min: c.pricing_min ?? null,
    pricing_max: c.pricing_max ?? null,
    certifications: c.certifications ?? [],
    outcome_enrolled: c.outcome_enrolled ?? false,
    accommodation_available: c.accommodation_available ?? false,
    photos: c.photos ?? [],
  }
}

// SearchResult from /api/search → Doctor or Clinic
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSearchDoctor(r: any): Doctor {
  return {
    id: r.id, slug: r.slug, name: r.name,
    qualification: r.snippet ?? '',
    years_exp: 0, tier: (r.tier ?? 1) as 1 | 2,
    rating: r.rating ?? null, review_count: 0,
    specialisations: r.specialisations ?? [],
    prakriti_affinities: [], languages: [],
    photo_url: null, pricing_per_day: null,
    location_address: r.district ? `${r.district}, Kerala` : null,
    available_dates: [],
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSearchClinic(r: any): Clinic {
  return {
    id: r.id, slug: r.slug, name: r.name,
    tier: (r.tier ?? 1) as 1 | 2, district: r.district ?? null,
    rating: r.rating ?? null, review_count: 0,
    specialisations: r.specialisations ?? [],
    prakriti_affinities: [], languages: [],
    pricing_min: null, pricing_max: null,
    certifications: [], outcome_enrolled: false,
    accommodation_available: false, photos: [],
  }
}

// ── Sort ──────────────────────────────────────────────────────────────────────

function sortDoctors(items: Doctor[], sort: string): Doctor[] {
  const arr = [...items]
  if (sort === 'rated')      return arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
  if (sort === 'price_asc')  return arr.sort((a, b) => (a.pricing_per_day ?? Infinity) - (b.pricing_per_day ?? Infinity))
  if (sort === 'price_desc') return arr.sort((a, b) => (b.pricing_per_day ?? 0) - (a.pricing_per_day ?? 0))
  if (sort === 'reviewed')   return arr.sort((a, b) => b.review_count - a.review_count)
  return arr
}

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
  const [doctors,      setDoctors]      = useState<Doctor[]>([])
  const [clinics,      setClinics]      = useState<Clinic[]>([])
  const [doctorsTotal, setDoctorsTotal] = useState(0)
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
      tab:          (sp.get('tab') as 'doctors' | 'clinics') ?? 'doctors',
      tier:         tierArr,
      specialisation: sp.get('specialisation') ?? '',
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
      if (f.tab === 'doctors') {
        const url = f.q
          ? buildSearchUrl(f.q, 'doctor', lang, fetchOffset)
          : buildDoctorUrl(f, fetchOffset)
        const res  = await fetch(url)
        if (!res.ok) throw new Error(`${res.status}`)
        const data = await res.json()

        const items: Doctor[] = f.q
          ? (data.results ?? []).map(mapSearchDoctor)
          : (data.items ?? []).map(mapDoctor)
        const total = data.total ?? items.length

        setDoctorsTotal(total)
        setDoctors(prev => append ? [...prev, ...items] : items)
        setHasMore(fetchOffset + LIMIT < total)
      } else {
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
      }
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
    const cleared = { ...DEFAULT_FILTERS, q: filters.q, tab: filters.tab }
    setFilters(cleared)
    setOffset(0)
    pushUrl(cleared)
  }

  function pushUrl(f: SearchFilters) {
    const p = new URLSearchParams()
    if (f.q)                          p.set('q', f.q)
    if (f.tab !== 'doctors')          p.set('tab', f.tab)
    if (f.tier.length === 1)          p.set('tier', String(f.tier[0]))
    if (f.specialisation)             p.set('specialisation', f.specialisation)
    if (f.prakriti)                   p.set('prakriti', f.prakriti)
    if (f.budgetMax < 500)            p.set('budget', String(f.budgetMax))
    if (f.duration)                   p.set('duration', f.duration)
    if (f.language)                   p.set('language', f.language)
    if (f.ratingMin > 0)              p.set('rating', String(f.ratingMin))
    if (f.sort !== 'best')            p.set('sort', f.sort)
    router.push(`/${lang}/search${p.toString() ? '?' + p.toString() : ''}`, { scroll: false })
  }

  function handleTabChange(tab: 'doctors' | 'clinics') {
    updateFilters({ tab })
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
  const matchedCondition = matchCondition(filters.q)
  const displayDoctors   = sortDoctors(doctors, filters.sort)
  const displayClinics   = sortClinics(clinics, filters.sort)
  const activeTotal      = filters.tab === 'doctors' ? doctorsTotal : clinicsTotal
  const activeCount      = filters.tab === 'doctors' ? doctors.length : clinics.length

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
          Take the 8-minute Prakriti assessment to see which doctors and treatments best match your constitution.
        </p>
        <Link href={`/${lang}/assessment`}>
          <button
            style={{
              fontFamily: 'var(--sans)',
              fontSize: '13px',
              fontWeight: 500,
              padding: '9px 22px',
              borderRadius: 'var(--r-xl)',
              background: 'var(--gold)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all var(--transition)',
            }}
          >
            Take assessment →
          </button>
        </Link>
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

          {/* Condition banner */}
          {matchedCondition && !loading && (
            <ConditionBanner condition={matchedCondition} lang={lang} />
          )}

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
              {loading && activeCount === 0
                ? 'Searching…'
                : `${activeTotal} result${activeTotal !== 1 ? 's' : ''}`}
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

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: '24px', borderBottom: '1px solid var(--border)' }}>
            <button
              className={`result-tab-btn ${filters.tab === 'doctors' ? 'active' : ''}`}
              onClick={() => handleTabChange('doctors')}
            >
              Doctors {!loading && filters.tab === 'doctors' && `(${doctorsTotal})`}
            </button>
            <button
              className={`result-tab-btn ${filters.tab === 'clinics' ? 'active' : ''}`}
              onClick={() => handleTabChange('clinics')}
            >
              Clinics {!loading && filters.tab === 'clinics' && `(${clinicsTotal})`}
            </button>
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
            {loading && activeCount === 0
              ? Array.from({ length: 3 }).map((_, i) =>
                  filters.tab === 'doctors'
                    ? <DoctorCardSkeleton key={i} />
                    : <ClinicCardSkeleton key={i} />
                )
              : filters.tab === 'doctors'
              ? displayDoctors.map(doc => (
                  <DoctorCard
                    key={doc.id}
                    doctor={doc}
                    onClick={d => router.push(`/${lang}/doctors/${d.slug}`)}
                  />
                ))
              : displayClinics.map(clinic => (
                  <ClinicCard
                    key={clinic.id}
                    clinic={clinic}
                    onClick={c => router.push(`/${lang}/clinics/${c.slug}`)}
                  />
                ))
            }

            {/* Empty state */}
            {!loading && activeCount === 0 && !error && (
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
          {loading && activeCount > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              {filters.tab === 'doctors'
                ? <DoctorCardSkeleton />
                : <ClinicCardSkeleton />
              }
            </div>
          )}

        </main>
      </div>
    </div>
  )
}

// ── URL builders ──────────────────────────────────────────────────────────────

function buildDoctorUrl(f: SearchFilters, fetchOffset: number): string {
  const p = new URLSearchParams()
  if (f.tier.length === 1)  p.set('tier', String(f.tier[0]))
  if (f.specialisation)     p.set('specialisation', f.specialisation)
  if (f.prakriti)           p.set('prakriti', f.prakriti)
  if (f.language)           p.set('language', f.language)
  if (f.ratingMin > 0)      p.set('rating_min', String(f.ratingMin))
  if (f.budgetMax < 500)    p.set('budget_max', String(f.budgetMax))
  p.set('limit', String(LIMIT))
  p.set('offset', String(fetchOffset))
  return `${API_BASE}/api/doctors?${p}`
}

function buildClinicUrl(f: SearchFilters, fetchOffset: number): string {
  const p = new URLSearchParams()
  if (f.tier.length === 1)  p.set('tier', String(f.tier[0]))
  if (f.specialisation)     p.set('specialisation', f.specialisation)
  if (f.prakriti)           p.set('prakriti', f.prakriti)
  if (f.language)           p.set('language', f.language)
  if (f.ratingMin > 0)      p.set('rating_min', String(f.ratingMin))
  if (f.budgetMax < 500)    p.set('budget_max', String(f.budgetMax))
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
