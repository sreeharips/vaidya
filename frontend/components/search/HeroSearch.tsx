'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

interface HeroSearchProps {
  lang: string
  placeholder: string
  buttonLabel: string
}

export default function HeroSearch({ lang, placeholder, buttonLabel }: HeroSearchProps) {
  const [query, setQuery] = useState('')
  const router = useRouter()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q) router.push(`/${lang}/search?q=${encodeURIComponent(q)}`)
  }

  function handleTagSearch(tag: string) {
    router.push(`/${lang}/search?q=${encodeURIComponent(tag)}`)
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="search-hero-wrap"
        style={{
          width: '100%',
          maxWidth: '620px',
          background: 'var(--white)',
          borderRadius: 'var(--r-xl)',
          boxShadow: 'var(--shadow2), 0 0 0 1px var(--border)',
          padding: '4px 4px 4px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          transition: 'box-shadow var(--transition)',
          marginBottom: '10px',
        }}
      >
        {/* Search icon */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          style={{ color: 'var(--muted)', flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>

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
            fontSize: '15px',
            fontWeight: 400,
            color: 'var(--slate)',
            minWidth: 0,
          }}
        />

        <button
          type="submit"
          className="search-submit-btn"
          style={{
            background: 'var(--forest)',
            color: 'var(--white)',
            fontFamily: 'var(--sans)',
            fontSize: '13px',
            fontWeight: 500,
            padding: '11px 22px',
            borderRadius: 'var(--r-xl)',
            border: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background var(--transition), transform var(--transition)',
          }}
        >
          {buttonLabel}
        </button>
      </form>

      {/* Treatment quick-tags — one tap to search */}
      <div
        className="hero-search-tags"
        style={{
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
          justifyContent: 'flex-start',
        }}
      >
        {/*['Panchakarma', 'Shirodhara', 'Abhyanga', 'Virechana', 'Basti'].map(tag => (
          <button
            key={tag}
            onClick={() => handleTagSearch(tag)}
            className="search-tag-pill"
          >
            {tag}
          </button>
        ))*/}
      </div>
    </>
  )
}
