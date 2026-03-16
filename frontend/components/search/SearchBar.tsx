'use client'

import { useState, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface SearchBarProps {
  variant?: 'hero' | 'inline'
  initialValue?: string
  placeholder?: string
  onSearch?: (query: string) => void
}

export default function SearchBar({
  variant = 'hero',
  initialValue = '',
  placeholder = 'Search by doctor, hospital, or condition…',
  onSearch,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialValue)
  const router = useRouter()
  const params = useParams()
  const lang = (params?.lang as string) || 'en'

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    const q = query.trim()
    if (!q) return
    if (onSearch) {
      onSearch(q)
    } else {
      router.push(`/${lang}/search?q=${encodeURIComponent(q)}`)
    }
  }

  if (variant === 'inline') {
    return (
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'var(--white)',
          border: '1px solid var(--border2)',
          borderRadius: 'var(--r-xl)',
          padding: '8px 16px',
          transition: 'border-color var(--transition)',
        }}
      >
        <SearchIcon size={16} />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
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
      </form>
    )
  }

  // hero variant
  return (
    <form
      onSubmit={handleSubmit}
      style={{
        width: '100%',
        maxWidth: '680px',
        background: 'var(--white)',
        borderRadius: 'var(--r-xl)',
        boxShadow: 'var(--shadow2), 0 0 0 1px var(--border)',
        padding: '6px 6px 6px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        transition: 'box-shadow var(--transition)',
        marginBottom: '20px',
      }}
    >
      <SearchIcon size={20} />
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: 'var(--sans)',
          fontSize: '16px',
          fontWeight: 300,
          color: 'var(--slate)',
          minWidth: 0,
        }}
      />
      <button
        type="submit"
        style={{
          background: 'var(--forest)',
          color: 'var(--white)',
          fontFamily: 'var(--sans)',
          fontSize: '14px',
          fontWeight: 500,
          padding: '13px 28px',
          borderRadius: 'var(--r-xl)',
          border: 'none',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'background var(--transition), transform var(--transition)',
        }}
      >
        Search
      </button>
    </form>
  )
}

function SearchIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      style={{ color: 'var(--muted)', flexShrink: 0 }}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}
