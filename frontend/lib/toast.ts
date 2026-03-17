/**
 * lib/toast.ts — Minimal event-bus toast system.
 *
 * Usage anywhere (client components, context callbacks):
 *   import { showToast } from '@/lib/toast'
 *   showToast('Done!')
 *   showToast('Note this', 'info')
 *
 * ToastContainer listens for the 'vaidya:toast' DOM event and renders the UI.
 * No React context threading needed.
 */

export type ToastType = 'success' | 'info'

export interface ToastPayload {
  id: string
  message: string
  type: ToastType
}

export function showToast(message: string, type: ToastType = 'success'): void {
  if (typeof window === 'undefined') return
  const payload: ToastPayload = {
    id: Math.random().toString(36).slice(2, 10),
    message,
    type,
  }
  window.dispatchEvent(new CustomEvent('vaidya:toast', { detail: payload }))
}
