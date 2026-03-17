'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Condition {
  slug: string
  name: string
  treatments: string[]
  icon: string
}

export default function ConditionsGrid({
  conditions,
  lang,
}: {
  conditions: Condition[]
  lang: string
}) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? conditions.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.treatments.some((t) => t.toLowerCase().includes(query.toLowerCase()))
      )
    : conditions

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
      {/* Search bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#fff',
          border: '1px solid var(--border2)',
          borderRadius: 'var(--r-xl)',
          padding: '10px 10px 10px 18px',
          marginBottom: '1.75rem',
          maxWidth: 480,
          boxShadow: 'var(--shadow)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--muted)', flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conditions or treatments…"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--sans)',
            fontSize: '14px',
            color: 'var(--slate)',
          }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              fontSize: '18px',
              lineHeight: 1,
              padding: '0 4px',
              flexShrink: 0,
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* Results count when filtering */}
      {query && (
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: '1rem' }}>
          {filtered.length === 0
            ? 'No conditions match your search.'
            : `${filtered.length} condition${filtered.length !== 1 ? 's' : ''} found`}
        </p>
      )}

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        {filtered.map((c) => (
          <Link
            key={c.slug}
            href={`/${lang}/conditions/${c.slug}`}
            style={{
              display: 'block',
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '1.25rem 1.25rem 1rem',
              textDecoration: 'none',
              transition: 'box-shadow 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = 'var(--shadow2)'
              e.currentTarget.style.borderColor = 'var(--border2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            <div style={{ fontSize: '1.75rem', marginBottom: '0.6rem' }}>{c.icon}</div>
            <div
              style={{
                fontWeight: 700,
                color: 'var(--forest)',
                fontSize: '1rem',
                marginBottom: '0.5rem',
                lineHeight: 1.3,
              }}
            >
              {c.name}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {c.treatments.map((t) => (
                <span
                  key={t}
                  style={{
                    background: 'var(--cream)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '0.15rem 0.6rem',
                    fontSize: '0.72rem',
                    color: 'var(--muted)',
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>

      <p
        style={{
          marginTop: '2.5rem',
          fontSize: '0.8rem',
          color: 'var(--muted)',
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        All condition–treatment mappings are verified by qualified BAMS physicians.
        No LLM-generated content. Evidence-based classical Ayurveda only.
      </p>
    </div>
  )
}
