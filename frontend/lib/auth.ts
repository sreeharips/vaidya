/**
 * lib/auth.ts — Auth utilities for Vaidya frontend.
 *
 * Token strategy:
 *   - Access token:   React ref (memory only). Lost on page refresh — re-acquired via refresh token.
 *   - Refresh token:  localStorage. Persists across refreshes.
 *   - Session cookie: Set by backend middleware on every request. httpOnly=false so JS can read it.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  full_name: string | null
  preferred_language: string
  role: string
}

export interface Preferences {
  vata_pct: number | null
  pitta_pct: number | null
  kapha_pct: number | null
  primary_type: string | null
  secondary_type: string | null
  assessment_id: string | null
  updated_at: string
}

export type PreferencesInput = {
  vata_pct: number
  pitta_pct: number
  kapha_pct: number
  primary_type: string
  secondary_type?: string
  assessment_id?: string
}

// ── Token storage ──────────────────────────────────────────────────────────────

const REFRESH_KEY = 'vaidya_refresh_token'

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_KEY)
}

export function setStoredRefreshToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(REFRESH_KEY, token)
}

export function clearStoredRefreshToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(REFRESH_KEY)
}

/** Read the guest session UUID from the vaidya_session cookie (httpOnly=false). */
export function getSessionId(): string | null {
  if (typeof window === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)vaidya_session=([^;]+)/)
  return match ? match[1] : null
}

// ── API calls ──────────────────────────────────────────────────────────────────

export async function apiLogin(
  email: string,
  password: string,
): Promise<{ access_token: string; refresh_token: string; user: AuthUser; session_claimed: boolean }> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? 'Login failed')
  }
  return res.json()
}

export async function apiRefresh(
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string }> {
  const res = await fetch(`${API}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok) throw new Error('Token refresh failed')
  return res.json()
}

export async function apiGetMe(accessToken: string): Promise<AuthUser> {
  const res = await fetch(`${API}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Not authenticated')
  return res.json()
}

export async function apiLogout(): Promise<void> {
  await fetch(`${API}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
}

export async function apiGetPreferences(
  accessToken?: string | null,
): Promise<Preferences | null> {
  const headers: HeadersInit = {}
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
  const res = await fetch(`${API}/api/users/me/preferences`, {
    headers,
    credentials: 'include',
  })
  if (!res.ok || res.status === 204) return null
  return res.json()
}

export async function apiUpdatePreferences(
  prefs: PreferencesInput,
  accessToken?: string | null,
): Promise<Preferences> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
  const res = await fetch(`${API}/api/users/me/preferences`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(prefs),
  })
  if (!res.ok) throw new Error('Failed to save preferences')
  return res.json()
}
