'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Sidebar from '../_components/Sidebar'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface BlockedDay {
  date: string    // YYYY-MM-DD
  reason: string | null
}

function toISO(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function AvailabilityPage() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1) // 1-based
  const [blocked, setBlocked] = useState<Set<string>>(new Set())
  const [reasons, setReasons] = useState<Record<string, string | null>>({})
  const [dataLoading, setDataLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  // Reason modal state
  const [pendingBlock, setPendingBlock] = useState<string | null>(null)
  const [reasonInput, setReasonInput] = useState('')

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated || (user?.role !== 'clinic_admin' && user?.role !== 'platform_admin')) {
      router.replace('/clinic/login')
    }
  }, [isLoading, isAuthenticated, user])

  const authHeaders = useCallback((): HeadersInit => {
    const token = localStorage.getItem('vaidya_refresh_token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  const fetchMonth = useCallback(async (year: number, month: number) => {
    setDataLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `${API}/api/clinic/availability?year=${year}&month=${month}`,
        { credentials: 'include', headers: authHeaders() }
      )
      if (!res.ok) throw new Error('Failed to load availability')
      const data = await res.json()
      const blockedSet = new Set<string>()
      const reasonMap: Record<string, string | null> = {}
      for (const item of data.blocked as BlockedDay[]) {
        blockedSet.add(item.date)
        reasonMap[item.date] = item.reason
      }
      setBlocked(blockedSet)
      setReasons(reasonMap)
    } catch {
      setError('Could not load availability data')
    } finally {
      setDataLoading(false)
    }
  }, [authHeaders])

  // Fetch pending count for sidebar badge
  useEffect(() => {
    if (!isAuthenticated) return
    fetch(`${API}/api/clinic/bookings?limit=1&status=pending`, {
      credentials: 'include', headers: authHeaders(),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPendingCount(d.pending_count ?? 0) })
  }, [isAuthenticated, authHeaders])

  useEffect(() => {
    if (isAuthenticated) fetchMonth(viewYear, viewMonth)
  }, [isAuthenticated, viewYear, viewMonth, fetchMonth])

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1) }
    else setViewMonth(m => m + 1)
  }

  function handleDayClick(iso: string) {
    if (blocked.has(iso)) {
      // Unblock immediately
      doUnblock(iso)
    } else {
      // Show reason modal before blocking
      setPendingBlock(iso)
      setReasonInput('')
    }
  }

  async function doUnblock(iso: string) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/clinic/availability/${iso}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error('Failed to unblock date')
      setBlocked(prev => { const s = new Set(prev); s.delete(iso); return s })
      setReasons(prev => { const r = { ...prev }; delete r[iso]; return r })
      flash('Date unblocked')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function confirmBlock() {
    if (!pendingBlock) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/clinic/availability/block`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ dates: [pendingBlock], reason: reasonInput || null }),
      })
      if (!res.ok) throw new Error('Failed to block date')
      const iso = pendingBlock
      const reason = reasonInput || null
      setBlocked(prev => new Set([...prev, iso]))
      setReasons(prev => ({ ...prev, [iso]: reason }))
      flash('Date blocked')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
      setPendingBlock(null)
      setReasonInput('')
    }
  }

  function flash(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay() // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate()
  const todayISO = toISO(today.getFullYear(), today.getMonth() + 1, today.getDate())

  const cells: Array<number | null> = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete the last week
  while (cells.length % 7 !== 0) cells.push(null)

  if (isLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontFamily: 'var(--sans)', fontSize: 14 }}>
        Loading…
      </div>
    )
  }

  return (
    <div className="portal-shell">
      <Sidebar clinicName={null} pendingCount={pendingCount} />

      <main className="portal-main">
        <div className="portal-topbar">
          <span className="portal-page-title">Availability</span>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            Block dates when your clinic is closed or fully booked
          </span>
        </div>

        <div className="portal-content">
          {error && (
            <div style={{ background: 'rgba(197,48,48,0.08)', border: '1px solid rgba(197,48,48,0.2)', borderRadius: 'var(--r-sm)', padding: '10px 14px', fontSize: 13, color: '#c53030', marginBottom: 16 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: 'rgba(30,61,47,0.07)', border: '1px solid rgba(30,61,47,0.2)', borderRadius: 'var(--r-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--forest)', marginBottom: 16 }}>
              {success}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 24, alignItems: 'start' }}>

            {/* Calendar */}
            <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>

              {/* Month nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                <button
                  onClick={prevMonth}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: 'var(--slate)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ‹
                </button>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--forest)' }}>
                  {MONTHS[viewMonth - 1]} {viewYear}
                </span>
                <button
                  onClick={nextMonth}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: 'var(--slate)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ›
                </button>
              </div>

              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
                {DAYS.map(d => (
                  <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              {dataLoading ? (
                <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
                  Loading…
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {cells.map((day, idx) => {
                    if (!day) {
                      return <div key={`empty-${idx}`} style={{ height: 52, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: '#faf8f5' }} />
                    }
                    const iso = toISO(viewYear, viewMonth, day)
                    const isBlocked = blocked.has(iso)
                    const isToday = iso === todayISO
                    const isPast = iso < todayISO

                    return (
                      <button
                        key={iso}
                        title={isBlocked ? (reasons[iso] ? `Blocked: ${reasons[iso]}` : 'Blocked — click to unblock') : (isPast ? 'Past date' : 'Click to block')}
                        onClick={() => !isPast && handleDayClick(iso)}
                        disabled={saving}
                        style={{
                          height: 52,
                          border: 'none',
                          borderRight: '1px solid var(--border)',
                          borderBottom: '1px solid var(--border)',
                          background: isBlocked
                            ? 'rgba(197,48,48,0.1)'
                            : isPast
                            ? '#faf8f5'
                            : 'var(--white)',
                          cursor: isPast ? 'default' : 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 2,
                          position: 'relative',
                          transition: 'background 0.15s',
                          outline: isToday ? '2px solid var(--forest)' : 'none',
                          outlineOffset: -2,
                        }}
                        onMouseEnter={e => {
                          if (!isPast && !isBlocked) (e.currentTarget as HTMLButtonElement).style.background = 'var(--forest-lt)'
                        }}
                        onMouseLeave={e => {
                          if (!isPast && !isBlocked) (e.currentTarget as HTMLButtonElement).style.background = 'var(--white)'
                        }}
                      >
                        <span style={{
                          fontSize: 14,
                          fontWeight: isToday ? 600 : 400,
                          color: isBlocked ? '#c53030' : isPast ? 'var(--muted)' : 'var(--slate)',
                        }}>
                          {day}
                        </span>
                        {isBlocked && (
                          <span style={{ fontSize: 9, color: '#c53030', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            Closed
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Legend + summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Legend */}
              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 14 }}>
                  Legend
                </div>
                {[
                  { color: 'var(--white)', border: '1px solid var(--border)', label: 'Available — patients can book' },
                  { color: 'rgba(197,48,48,0.1)', border: '1px solid rgba(197,48,48,0.2)', label: 'Blocked — booking rejected' },
                  { color: '#faf8f5', border: '1px solid var(--border)', label: 'Past date' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 'var(--r-sm)', background: item.color, border: item.border, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--slate)' }}>{item.label}</span>
                  </div>
                ))}
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, lineHeight: 1.5 }}>
                  Click any future date to block or unblock it.
                </p>
              </div>

              {/* This month summary */}
              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 14 }}>
                  This month
                </div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 32, color: blocked.size > 0 ? '#c53030' : 'var(--forest)', lineHeight: 1 }}>
                  {blocked.size}
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                  {blocked.size === 1 ? 'day blocked' : 'days blocked'}
                </div>
                {blocked.size > 0 && (
                  <div style={{ marginTop: 16, maxHeight: 180, overflowY: 'auto' }}>
                    {Array.from(blocked).sort().map(iso => (
                      <div key={iso} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                        <div>
                          <div style={{ color: 'var(--slate)', fontWeight: 500 }}>
                            {new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </div>
                          {reasons[iso] && (
                            <div style={{ color: 'var(--muted)', fontSize: 11 }}>{reasons[iso]}</div>
                          )}
                        </div>
                        <button
                          onClick={() => doUnblock(iso)}
                          disabled={saving}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c53030', fontSize: 11, fontWeight: 600, padding: '2px 6px' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Common reasons quick-block */}
              <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 14 }}>
                  Common closures
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
                  Typical reasons to block dates:
                </p>
                {['Monsoon closure (Jun–Aug)', 'Festival / public holiday', 'Full occupancy', 'Staff training', 'Renovation'].map(r => (
                  <div key={r} style={{ fontSize: 12, color: 'var(--slate)', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    {r}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Reason modal */}
      {pendingBlock && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{ background: 'var(--white)', borderRadius: 'var(--r-lg)', padding: 28, width: 360, boxShadow: 'var(--shadow2)' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--forest)', marginBottom: 8 }}>
              Block {new Date(pendingBlock + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.5 }}>
              Patients will not be able to book this date. Add a reason (optional, staff-only).
            </p>
            <input
              type="text"
              placeholder="e.g. Onam festival, Full occupancy…"
              value={reasonInput}
              onChange={e => setReasonInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmBlock()}
              style={{
                width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)',
                borderRadius: 'var(--r-sm)', fontFamily: 'var(--sans)', fontSize: 13,
                color: 'var(--slate)', outline: 'none', marginBottom: 16,
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={confirmBlock}
                disabled={saving}
                style={{ flex: 1, padding: '11px', background: 'var(--forest)', color: '#fff', border: 'none', borderRadius: 'var(--r-xl)', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                {saving ? 'Saving…' : 'Block date'}
              </button>
              <button
                onClick={() => { setPendingBlock(null); setReasonInput('') }}
                style={{ flex: 1, padding: '11px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', fontFamily: 'var(--sans)', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
