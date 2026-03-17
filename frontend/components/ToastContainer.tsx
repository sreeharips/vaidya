'use client'

import { useEffect, useState } from 'react'
import type { ToastPayload } from '@/lib/toast'

const DURATION = 4500

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastPayload[]>([])

  useEffect(() => {
    function handleToast(e: Event) {
      const payload = (e as CustomEvent<ToastPayload>).detail
      setToasts((prev) => [...prev, payload])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== payload.id))
      }, DURATION)
    }
    window.addEventListener('vaidya:toast', handleToast)
    return () => window.removeEventListener('vaidya:toast', handleToast)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '360px',
        width: 'calc(100vw - 48px)',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: toast.type === 'success' ? 'var(--forest)' : '#1a1a2e',
            color: '#fff',
            padding: '14px 18px',
            borderRadius: 'var(--r-lg)',
            fontSize: '14px',
            lineHeight: 1.5,
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            animation: 'toastIn 0.25s ease',
          }}
        >
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              fontSize: '16px',
              lineHeight: 1,
              padding: '0',
              flexShrink: 0,
              marginTop: '1px',
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
