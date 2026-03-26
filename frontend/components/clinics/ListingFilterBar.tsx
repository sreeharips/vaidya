'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

export interface FilterValues {
  tier?: string
  category?: string
  district?: string
  language?: string
  budgetMax?: string
  ratingMin?: string
}

interface FilterOptions {
  districts: string[]
  categories: string[]
  languages: string[]
  budgetLabel?: string
}

interface Props {
  basePath: string          // e.g. "/en/clinics"
  current: FilterValues
  options: FilterOptions
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
}

export default function ListingFilterBar({ basePath, current, options }: Props) {
  const router = useRouter()

  const apply = useCallback((updates: Partial<FilterValues>) => {
    const merged: Record<string, string | undefined> = {
      tier: current.tier,
      category: current.category,
      district: current.district,
      language: current.language,
      budget_max: current.budgetMax,
      rating_min: current.ratingMin,
      ...Object.fromEntries(
        Object.entries(updates).map(([k, v]) => {
          if (k === 'budgetMax') return ['budget_max', v]
          if (k === 'ratingMin') return ['rating_min', v]
          return [k, v]
        })
      ),
    }
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v)
    }
    router.push(`${basePath}?${params.toString()}`)
  }, [current, basePath, router])

  const toggle = (field: keyof FilterValues, currentVal: string | undefined, newVal: string) => {
    apply({ [field]: currentVal === newVal ? undefined : newVal })
  }

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Tier */}
      <FilterSection label="Certification">
        <PillGroup
          options={[{ label: 'Certified Authentic', value: '2' }, { label: 'Verified', value: '1' }]}
          active={current.tier}
          onToggle={(v) => toggle('tier', current.tier, v)}
          activeColor={{ bg: 'var(--gold-lt)', color: 'var(--bark)', border: 'var(--bark)' }}
        />
      </FilterSection>

      {/* Rating */}
      <FilterSection label="Min rating">
        <PillGroup
          options={[{ label: '★ 4.5+', value: '4.5' }, { label: '★ 4.0+', value: '4.0' }, { label: '★ 3.5+', value: '3.5' }]}
          active={current.ratingMin}
          onToggle={(v) => toggle('ratingMin', current.ratingMin, v)}
        />
      </FilterSection>

      {/* District */}
      <FilterSection label="District">
        <select value={current.district ?? ''} onChange={e => apply({ district: e.target.value || undefined })} style={selectStyle}>
          <option value="">All districts</option>
          {options.districts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </FilterSection>

      {/* Wellness category */}
      <FilterSection label="Wellness goal">
        <select value={current.category ?? ''} onChange={e => apply({ category: e.target.value || undefined })} style={selectStyle}>
          <option value="">All categories</option>
          {options.categories.map(c => <option key={c} value={c}>{capitalize(c)}</option>)}
        </select>
      </FilterSection>

      {/* Language */}
      <FilterSection label="Language spoken">
        <select value={current.language ?? ''} onChange={e => apply({ language: e.target.value || undefined })} style={selectStyle}>
          <option value="">Any language</option>
          {options.languages.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </FilterSection>

      {/* Budget */}
      <FilterSection label={options.budgetLabel ?? 'Max budget ($/night)'}>
        <PillGroup
          options={[{ label: '$50', value: '50' }, { label: '$100', value: '100' }, { label: '$200', value: '200' }]}
          active={current.budgetMax}
          onToggle={(v) => toggle('budgetMax', current.budgetMax, v)}
        />
      </FilterSection>

    </div>
  )
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 9 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function PillGroup({
  options,
  active,
  onToggle,
  activeColor = { bg: 'var(--forest)', color: '#fff', border: 'var(--forest)' },
}: {
  options: { label: string; value: string }[]
  active: string | undefined
  onToggle: (v: string) => void
  activeColor?: { bg: string; color: string; border: string }
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(opt => {
        const on = active === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onToggle(opt.value)}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 99, cursor: 'pointer',
              border: `1px solid ${on ? activeColor.border : 'var(--border)'}`,
              background: on ? activeColor.bg : '#fff',
              color: on ? activeColor.color : 'var(--slate)',
              fontWeight: on ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  width: '100%', fontSize: 12, padding: '7px 10px',
  borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
  background: '#fff', color: 'var(--slate)', outline: 'none', cursor: 'pointer',
}
