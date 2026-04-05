import type { ReactNode } from 'react'
import type { SearchFilters } from '../page'

interface FilterSidebarProps {
  filters: SearchFilters
  onChange: (updates: Partial<SearchFilters>) => void
  onClear: () => void
  onClose?: () => void
}

const TREATMENTS = ['Panchakarma', 'Shirodhara', 'Abhyanga', 'Basti', 'Kati Basti']
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'Arabic' },
  { code: 'de', label: 'German' },
  { code: 'ml', label: 'Malayalam' },
]
const DOSHAS = [
  { value: 'vata',  label: 'Vata',  dot: '#8B6E5A' },
  { value: 'pitta', label: 'Pitta', dot: '#1E3D2F' },
  { value: 'kapha', label: 'Kapha', dot: '#B8862C' },
]
const DURATIONS = [
  { value: '3-5',   label: '3–5 days' },
  { value: '7-10',  label: '7–10 days' },
  { value: '14-21', label: '14–21 days' },
]

export default function FilterSidebar({ filters, onChange, onClear, onClose }: FilterSidebarProps) {
  function toggleTier(tier: number) {
    const current = filters.tier
    const next = current.includes(tier)
      ? current.filter(t => t !== tier)
      : [...current, tier]
    onChange({ tier: next.length === 0 ? [1, 2] : next })
  }

  function toggleTreatment(t: string) {
    const slug = t.toLowerCase().replace(/\s+/g, '-')
    onChange({ category: filters.category === slug ? '' : slug })
  }

  function togglePrakriti(d: string) {
    onChange({ prakriti: filters.prakriti === d ? '' : d })
  }

  function toggleDuration(d: string) {
    onChange({ duration: filters.duration === d ? '' : d })
  }

  function toggleLanguage(code: string) {
    onChange({ language: filters.language === code ? '' : code })
  }

  function toggleRating(val: number) {
    onChange({ ratingMin: filters.ratingMin === val ? 0 : val })
  }

  return (
    <aside
      style={{
        width: '280px',
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        padding: '32px 24px',
        background: 'var(--white)',
        position: 'sticky',
        top: '68px',
        height: 'calc(100vh - 68px)',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          fontFamily: 'var(--serif)',
          fontSize: '18px',
          fontWeight: 500,
          color: 'var(--forest)',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <em>Filters</em>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onClear}
            style={{
              fontFamily: 'var(--sans)',
              fontSize: '12px',
              color: 'var(--gold)',
              cursor: 'pointer',
              fontWeight: 400,
              border: 'none',
              background: 'transparent',
              padding: 0,
            }}
          >
            Clear all
          </button>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close filters"
              className="mobile-close-btn"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', fontSize: 22, lineHeight: 1,
                padding: '2px 4px', display: 'none',
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── Tier ── */}
      <FilterGroup title="Credentialing tier">
        <FilterOption
          checked={filters.tier.includes(2)}
          onClick={() => toggleTier(2)}
          label="Certified Authentic"
          badge={
            <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: '10px', background: 'var(--gold-lt)', color: 'var(--bark)' }}>
              Tier 2
            </span>
          }
        />
        <FilterOption
          checked={filters.tier.includes(1)}
          onClick={() => toggleTier(1)}
          label="Verified"
          badge={
            <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: '10px', background: 'var(--forest-lt)', color: 'var(--forest2)' }}>
              Tier 1
            </span>
          }
        />
      </FilterGroup>

      {/* ── Treatment type ── */}
      <FilterGroup title="Treatment type">
        {TREATMENTS.map(t => {
          const slug = t.toLowerCase().replace(/\s+/g, '-')
          return (
            <FilterOption
              key={t}
              checked={filters.category === slug}
              onClick={() => toggleTreatment(t)}
              label={t}
            />
          )
        })}
      </FilterGroup>

      {/* ── Prakriti affinity ── */}
      <FilterGroup title="Prakriti affinity">
        {DOSHAS.map(d => (
          <FilterOption
            key={d.value}
            checked={filters.prakriti === d.value}
            onClick={() => togglePrakriti(d.value)}
            label={
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.dot, display: 'inline-block', flexShrink: 0 }} />
                {d.label}
              </span>
            }
          />
        ))}
      </FilterGroup>

      {/* ── Budget ── */}
      <FilterGroup title="Budget (per day)">
        <div style={{ padding: '4px 0' }}>
          <input
            type="range"
            min={50}
            max={500}
            value={filters.budgetMax}
            onChange={e => onChange({ budgetMax: Number(e.target.value) })}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)' }}>
            <span>$50</span>
            <span>Up to ${filters.budgetMax}</span>
          </div>
        </div>
      </FilterGroup>

      {/* ── Duration ── */}
      <FilterGroup title="Duration">
        {DURATIONS.map(d => (
          <FilterOption
            key={d.value}
            checked={filters.duration === d.value}
            onClick={() => toggleDuration(d.value)}
            label={d.label}
          />
        ))}
      </FilterGroup>

      {/* ── Language ── */}
      <FilterGroup title="Doctor language">
        {LANGUAGES.map(l => (
          <FilterOption
            key={l.code}
            checked={filters.language === l.code}
            onClick={() => toggleLanguage(l.code)}
            label={l.label}
          />
        ))}
      </FilterGroup>

      {/* ── Rating ── */}
      <FilterGroup title="Rating">
        <FilterOption
          checked={filters.ratingMin === 4.5}
          onClick={() => toggleRating(4.5)}
          label="4.5+ ★"
        />
        <FilterOption
          checked={filters.ratingMin === 4.0}
          onClick={() => toggleRating(4.0)}
          label="4.0+ ★"
        />
      </FilterGroup>
    </aside>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <p
        style={{
          fontSize: '11px',
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          marginBottom: '12px',
        }}
      >
        {title}
      </p>
      {children}
    </div>
  )
}

function FilterOption({
  checked,
  onClick,
  label,
  badge,
}: {
  checked: boolean
  onClick: () => void
  label: ReactNode
  badge?: ReactNode
}) {
  return (
    <label className="filter-option-row" onClick={onClick}>
      <div className={`filter-checkbox-custom ${checked ? 'checked' : ''}`} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge}
    </label>
  )
}
