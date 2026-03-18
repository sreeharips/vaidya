'use client'

import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface Slot {
  date: string
  available_slots: number
  total_slots: number
  is_closed: boolean
  treatment_names: string[]
}

export default function AvailabilityStrip({ slug }: { slug: string }) {
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/clinics/${slug}/availability?days=21`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setSlots(data.slots ?? [])
      })
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return (
    <div style={{ padding: '16px 0', fontSize: 13, color: 'var(--muted)' }}>
      Checking availability…
    </div>
  )

  if (slots.length === 0) return (
    <div style={{ padding: '16px 0', fontSize: 13, color: 'var(--muted)' }}>
      Availability not configured — contact clinic directly.
    </div>
  )

  const openSlots = slots.filter(s => !s.is_closed && s.available_slots > 0)
  const nextOpen = openSlots[0]

  return (
    <div>
      {/* Next available highlight */}
      {nextOpen && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(30,61,47,0.06)', borderRadius: 'var(--r-md)', border: '1px solid rgba(30,61,47,0.12)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Next available
          </span>
          <div style={{ fontSize: 16, color: 'var(--slate)', marginTop: 4 }}>
            {new Date(nextOpen.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8 }}>
              {nextOpen.available_slots} slot{nextOpen.available_slots !== 1 ? 's' : ''} available
            </span>
          </div>
        </div>
      )}

      {/* 21-day grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {slots.map(s => {
          const date = new Date(s.date + 'T00:00:00')
          const day = date.toLocaleDateString('en-GB', { weekday: 'short' })
          const num = date.getDate()

          let bg = 'var(--white)'
          let color = 'var(--slate)'
          let border = '1px solid var(--border)'
          let label = ''

          if (s.is_closed) {
            bg = 'rgba(197,48,48,0.06)'
            color = '#c53030'
            border = '1px solid rgba(197,48,48,0.15)'
            label = 'Closed'
          } else if (s.available_slots === 0) {
            bg = 'rgba(100,100,100,0.06)'
            color = 'var(--muted)'
            label = 'Full'
          } else {
            const pct = s.available_slots / s.total_slots
            if (pct > 0.5) {
              bg = 'rgba(30,61,47,0.06)'
              color = 'var(--forest)'
              border = '1px solid rgba(30,61,47,0.15)'
            } else {
              bg = 'rgba(245,158,11,0.06)'
              color = '#b45309'
              border = '1px solid rgba(245,158,11,0.2)'
            }
            label = `${s.available_slots} left`
          }

          return (
            <div key={s.date} style={{ width: 56, textAlign: 'center', background: bg, border, borderRadius: 'var(--r-sm)', padding: '8px 4px' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{day}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color, lineHeight: 1.2 }}>{num}</div>
              <div style={{ fontSize: 9, color, marginTop: 2, fontWeight: 500 }}>{label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
