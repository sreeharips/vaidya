'use client'

import { type ReactNode, useState } from 'react'

export default function MobileFilterWrapper({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Backdrop — mobile only, shown when panel is open */}
      {open && (
        <div
          className="mobile-filter-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Toggle button — visible only on mobile via CSS */}
      <button className="mobile-filter-btn" onClick={() => setOpen(true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="8" y1="12" x2="20" y2="12" />
          <line x1="12" y1="17" x2="20" y2="17" />
        </svg>
        Filters
      </button>

      {/* Sidebar panel */}
      <aside className={`clinics-sidebar-panel${open ? ' open' : ''}`} style={{ width: 240, flexShrink: 0, position: 'sticky', top: 24 }}>
        {/* Mobile close button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}
             className="mobile-sidebar-header">
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--forest)', fontFamily: 'var(--serif)' }}>Filters</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close filters"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', fontSize: 20, lineHeight: 1, padding: '4px',
              display: 'none',
            }}
            className="mobile-close-btn"
          >
            ×
          </button>
        </div>
        {children}
      </aside>
    </>
  )
}
