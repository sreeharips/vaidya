'use client'

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Static suggestions ──────────────────────────────────────────────────────

type SuggestionType = 'treatment' | 'atmosphere' | 'condition' | 'location' | 'clinic' | 'retreat'

interface Suggestion {
  id: string
  type: SuggestionType
  name: string
  subtitle?: string
}

const STATIC_SUGGESTIONS: Suggestion[] = [
  { id: 'panchakarma',        type: 'treatment',  name: 'Panchakarma',       subtitle: 'Full-body detox' },
  { id: 'shirodhara',         type: 'treatment',  name: 'Shirodhara',        subtitle: 'Stress & mind reset' },
  { id: 'kizhi',              type: 'treatment',  name: 'Kizhi',             subtitle: 'Herbal pain therapy' },
  { id: 'abhyanga',           type: 'treatment',  name: 'Abhyanga',          subtitle: 'Full-body oil massage' },
  { id: 'navarakizhi',        type: 'treatment',  name: 'Navarakizhi',       subtitle: 'Rice bolus therapy' },
  { id: 'udvartana',          type: 'treatment',  name: 'Udvartana',         subtitle: 'Powder massage detox' },
  { id: 'pizhichil',          type: 'treatment',  name: 'Pizhichil',         subtitle: 'Warm oil stream therapy' },
  { id: 'backwaters',         type: 'atmosphere', name: 'Backwaters',        subtitle: 'Serene water-based healing' },
  { id: 'hill-station',       type: 'atmosphere', name: 'Hill Stations',     subtitle: 'Cool mountain air' },
  { id: 'coastal',            type: 'atmosphere', name: 'Coastal Cliffs',    subtitle: 'Ocean energy restoration' },
  { id: 'back-pain',          type: 'condition',  name: 'Back & Spine Pain', subtitle: 'Health condition' },
  { id: 'stress',             type: 'condition',  name: 'Stress & Anxiety',  subtitle: 'Health condition' },
  { id: 'arthritis',          type: 'condition',  name: 'Arthritis',         subtitle: 'Health condition' },
  { id: 'diabetes',           type: 'condition',  name: 'Diabetes',          subtitle: 'Health condition' },
  { id: 'digestive',          type: 'condition',  name: 'Digestive Disorders', subtitle: 'Health condition' },
  { id: 'insomnia',           type: 'condition',  name: 'Insomnia',          subtitle: 'Health condition' },
  { id: 'hypertension',       type: 'condition',  name: 'Hypertension',      subtitle: 'Health condition' },
  { id: 'ernakulam',          type: 'location',   name: 'Ernakulam',         subtitle: 'Kerala, India' },
  { id: 'thiruvananthapuram', type: 'location',   name: 'Thiruvananthapuram', subtitle: 'Kerala, India' },
  { id: 'kottayam',           type: 'location',   name: 'Kottayam',          subtitle: 'Kerala, India' },
  { id: 'kozhikode',          type: 'location',   name: 'Kozhikode',         subtitle: 'Kerala, India' },
  { id: 'alappuzha',          type: 'location',   name: 'Alappuzha',         subtitle: 'Kerala, India' },
  { id: 'wayanad',            type: 'location',   name: 'Wayanad',           subtitle: 'Kerala, India' },
  { id: 'thrissur',           type: 'location',   name: 'Thrissur',          subtitle: 'Kerala, India' },
]

const TYPE_LABELS: Record<SuggestionType, string> = {
  treatment:  'Treatments & Goals',
  atmosphere: 'Atmospheres',
  condition:  'Conditions',
  location:   'Locations',
  clinic:     'Clinics',
  retreat:    'Retreats',
}

const TYPE_ORDER: SuggestionType[] = ['treatment', 'clinic', 'retreat', 'atmosphere', 'condition', 'location']

const TYPE_ICON: Record<SuggestionType, string> = {
  treatment:  '✦',
  atmosphere: '◎',
  condition:  '◈',
  location:   '◉',
  clinic:     '◌',
  retreat:    '◈',
}

const TYPE_COLOUR: Record<SuggestionType, string> = {
  treatment:  '#B8862C',
  atmosphere: '#2D7A5A',
  condition:  '#6D8F7E',
  location:   '#6B5FA0',
  clinic:     '#1E3D2F',
  retreat:    '#7C6B52',
}

function getStaticMatches(q: string): Suggestion[] {
  const lower = q.toLowerCase()
  return STATIC_SUGGESTIONS.filter(s =>
    s.name.toLowerCase().includes(lower) ||
    (s.subtitle?.toLowerCase().includes(lower))
  )
}

// ── Props ───────────────────────────────────────────────────────────────────

interface HeroSearchProps {
  lang: string
  placeholder: string
  buttonLabel: string
  compact?: boolean
}

// ── Component ────────────────────────────────────────────────────────────────

export default function HeroSearch({ lang, placeholder, buttonLabel, compact }: HeroSearchProps) {
  const router = useRouter()

  // ── Form state ────────────────────────────────────────────────────────────
  const [query,    setQuery]    = useState('')
  const [checkIn,  setCheckIn]  = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests,   setGuests]   = useState(1)

  // ── Dropdown state ────────────────────────────────────────────────────────
  const [suggestions,     setSuggestions]     = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showGuests,      setShowGuests]      = useState(false)
  const [activeIdx,       setActiveIdx]       = useState(-1)
  const [fetchingApi,     setFetchingApi]     = useState(false)

  // ── Refs ──────────────────────────────────────────────────────────────────
  const wrapRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Default suggestions (shown when focused with empty query) ─────────────
  const defaultSuggestions: Suggestion[] = [
    { id: 'panchakarma',  type: 'treatment',  name: 'Panchakarma',       subtitle: 'Full-body detox' },
    { id: 'shirodhara',   type: 'treatment',  name: 'Shirodhara',        subtitle: 'Stress & mind reset' },
    { id: 'backwaters',   type: 'atmosphere', name: 'Backwaters',        subtitle: 'Serene healing' },
    { id: 'stress',       type: 'condition',  name: 'Stress & Anxiety',  subtitle: 'Health condition' },
    { id: 'ernakulam',    type: 'location',   name: 'Ernakulam',         subtitle: 'Kerala, India' },
    { id: 'kottayam',     type: 'location',   name: 'Kottayam',          subtitle: 'Kerala, India' },
  ]

  // ── Fetch suggestions from API + merge with static ────────────────────────
  const fetchSuggestions = useCallback(async (q: string) => {
    const staticMatches = getStaticMatches(q)
    setSuggestions(staticMatches.slice(0, 8))

    if (q.length < 2) return

    setFetchingApi(true)
    try {
      const res = await fetch(
        `${API_BASE}/api/search/suggestions?q=${encodeURIComponent(q)}&lang=${lang}`
      )
      if (!res.ok) return
      const dynamic = (await res.json()) as Array<{ id: string; type: string; name: string; subtitle?: string }>
      const dynamicMapped: Suggestion[] = dynamic.map(d => ({
        ...d,
        type: (d.type === 'package' ? 'retreat' : d.type) as SuggestionType,
      }))
      // Dynamic results first, then static (no duplicates by name)
      const dynamicNames = new Set(dynamicMapped.map(d => d.name.toLowerCase()))
      const merged = [
        ...dynamicMapped.slice(0, 5),
        ...staticMatches.filter(s => !dynamicNames.has(s.name.toLowerCase())).slice(0, 5),
      ]
      setSuggestions(merged)
    } catch {
      // keep static results
    } finally {
      setFetchingApi(false)
    }
  }, [lang])

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions(defaultSuggestions)
      return
    }
    const t = setTimeout(() => fetchSuggestions(query.trim()), 200)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
        setShowGuests(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // ── Keyboard navigation ───────────────────────────────────────────────────
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setActiveIdx(-1)
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      pickSuggestion(suggestions[activeIdx])
    }
  }

  function pickSuggestion(s: Suggestion) {
    setQuery(s.name)
    setShowSuggestions(false)
    setActiveIdx(-1)
    inputRef.current?.focus()
  }

  // ── Search ────────────────────────────────────────────────────────────────
  function doSearch() {
    const p = new URLSearchParams()
    if (query.trim()) p.set('q', query.trim())
    if (checkIn)      p.set('check_in',  checkIn)
    if (checkOut)     p.set('check_out', checkOut)
    if (guests > 1)   p.set('guests',    String(guests))
    router.push(`/${lang}/search?${p.toString()}`)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setShowSuggestions(false)
    doSearch()
  }

  // ── Group suggestions by type ─────────────────────────────────────────────
  const grouped = TYPE_ORDER.reduce<Record<string, Suggestion[]>>((acc, t) => {
    const items = suggestions.filter(s => s.type === t)
    if (items.length) acc[t] = items
    return acc
  }, {})

  const flatList = TYPE_ORDER.flatMap(t => grouped[t] ?? [])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]
  const divider = (
    <div aria-hidden style={{
      width: 1, alignSelf: 'stretch',
      background: 'rgba(107,79,58,0.13)',
      margin: '6px 0', flexShrink: 0,
    }} />
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>

      {/* ── Main pill ── */}
      <form
        onSubmit={onSubmit}
        style={{
          width: '100%',
          background: 'var(--white)',
          borderRadius: 'var(--r-xl)',
          boxShadow: 'var(--shadow2), 0 0 0 1px var(--border)',
          display: 'flex',
          alignItems: 'stretch',
          overflow: 'hidden',
          position: 'relative',
        }}
      >

        {/* — What (combobox) — */}
        <div
          style={{ flex: '1 1 180px', minWidth: 0, padding: '5px 10px 5px 14px', cursor: 'text' }}
          onClick={() => { setShowSuggestions(true); inputRef.current?.focus() }}
        >
          <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--forest)', margin: '0 0 2px', lineHeight: 1 }}>
            What
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: 'var(--muted)', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowSuggestions(true); setActiveIdx(-1) }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={showSuggestions}
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 400,
                color: 'var(--slate)', width: '100%', minWidth: 0,
                lineHeight: 1.35,
              }}
            />
            {fetchingApi && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--muted)', flexShrink: 0, animation: 'spin 0.8s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            )}
          </div>
        </div>

        {divider}

        {/* — Check-in — */}
        <div style={{ flex: '0 0 100px', padding: '5px 10px' }}>
          <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--forest)', margin: '0 0 2px', lineHeight: 1 }}>
            Check-in
          </p>
          <input
            type="date"
            value={checkIn}
            onChange={e => { setCheckIn(e.target.value); if (checkOut && e.target.value > checkOut) setCheckOut('') }}
            min={today}
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'var(--sans)', fontSize: 11, lineHeight: 1.35,
              color: checkIn ? 'var(--slate)' : 'var(--muted)',
              width: '100%', cursor: 'pointer', padding: 0,
            }}
          />
        </div>

        {divider}

        {/* — Check-out — */}
        <div style={{ flex: '0 0 100px', padding: '5px 10px' }}>
          <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--forest)', margin: '0 0 2px', lineHeight: 1 }}>
            Check-out
          </p>
          <input
            type="date"
            value={checkOut}
            onChange={e => setCheckOut(e.target.value)}
            min={checkIn || today}
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'var(--sans)', fontSize: 11, lineHeight: 1.35,
              color: checkOut ? 'var(--slate)' : 'var(--muted)',
              width: '100%', cursor: 'pointer', padding: 0,
            }}
          />
        </div>

        {divider}

        {/* — Guests — */}
        <button
          type="button"
          onClick={() => { setShowGuests(g => !g); setShowSuggestions(false) }}
          style={{
            flex: '0 0 80px', padding: '5px 10px', border: 'none',
            background: showGuests ? 'var(--cream)' : 'transparent',
            cursor: 'pointer', textAlign: 'left',
            transition: 'background var(--transition)',
          }}
        >
          <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--forest)', margin: '0 0 2px', lineHeight: 1 }}>
            Guests
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: 'var(--muted)', flexShrink: 0 }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--slate)', lineHeight: 1.35 }}>
              {guests} {guests === 1 ? 'guest' : 'guests'}
            </span>
          </div>
        </button>

        {/* — Search button — */}
        <div style={{ padding: '3px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <button
            type="submit"
            style={{
              background: 'var(--forest)',
              color: 'var(--white)',
              fontFamily: 'var(--sans)',
              fontSize: compact ? 11 : 12,
              fontWeight: 600,
              padding: compact ? '8px 14px' : '10px 18px',
              borderRadius: 'calc(var(--r-xl) - 4px)',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              letterSpacing: '0.01em',
              transition: 'background var(--transition), transform var(--transition)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--forest2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--forest)')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            {buttonLabel}
          </button>
        </div>
      </form>

      {/* ── Suggestions dropdown ── */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            background: 'var(--white)',
            borderRadius: 'var(--r-xl)',
            boxShadow: '0 16px 64px rgba(30,61,47,0.18), 0 0 0 1px var(--border)',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'fadeSlideDown 0.14s ease',
          }}
        >
          {/* Show grouped sections */}
          {TYPE_ORDER.map(type => {
            const items = grouped[type]
            if (!items?.length) return null
            return (
              <div key={type}>
                <div style={{
                  padding: '8px 14px 4px',
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: 'var(--muted)',
                }}>
                  {TYPE_LABELS[type]}
                </div>
                {items.map(item => {
                  const flatIdx = flatList.findIndex(f => f.id === item.id && f.type === item.type)
                  const isActive = flatIdx === activeIdx
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      role="option"
                      aria-selected={isActive}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); pickSuggestion(item) }}
                      onMouseEnter={() => setActiveIdx(flatIdx)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        gap: 10, padding: '7px 14px',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                        background: isActive ? 'var(--cream)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                    >
                      <span style={{
                        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                        background: TYPE_COLOUR[item.type] + '18',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, color: TYPE_COLOUR[item.type],
                      }}>
                        {TYPE_ICON[item.type]}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--slate)', lineHeight: 1.3 }}>
                          {item.name}
                        </div>
                        {item.subtitle && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.3, marginTop: 1 }}>
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}

          {/* Footer hint */}
          <div style={{ padding: '6px 14px 10px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>
              ↑↓ to navigate · Enter to select · Esc to close
            </span>
          </div>
        </div>
      )}

      {/* ── Guests dropdown ── */}
      {showGuests && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: 220,
          background: 'var(--white)',
          borderRadius: 'var(--r-xl)',
          boxShadow: '0 16px 64px rgba(30,61,47,0.18), 0 0 0 1px var(--border)',
          zIndex: 1001,
          padding: '16px 18px 14px',
          animation: 'fadeSlideDown 0.14s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--slate)', lineHeight: 1.2 }}>
                Guests
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Adults &amp; children</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => setGuests(g => Math.max(1, g - 1))}
                disabled={guests === 1}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: '1.5px solid var(--border2)',
                  background: 'none', cursor: guests === 1 ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--sans)', fontSize: 18, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: guests === 1 ? 'var(--muted)' : 'var(--slate)',
                  transition: 'border-color var(--transition), color var(--transition)',
                }}
              >−</button>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 600, color: 'var(--slate)', minWidth: 18, textAlign: 'center' }}>
                {guests}
              </span>
              <button
                type="button"
                onClick={() => setGuests(g => Math.min(20, g + 1))}
                disabled={guests === 20}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: '1.5px solid var(--border2)',
                  background: 'none', cursor: guests === 20 ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--sans)', fontSize: 18, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--slate)',
                  transition: 'border-color var(--transition)',
                }}
              >+</button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowGuests(false)}
            style={{
              marginTop: 12, width: '100%',
              background: 'var(--forest)',
              color: 'var(--white)',
              fontFamily: 'var(--sans)',
              fontSize: 12, fontWeight: 600,
              padding: '8px 0',
              borderRadius: 'var(--r-lg)',
              border: 'none', cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}
