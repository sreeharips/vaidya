'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  apiGetMe,
  apiGetPreferences,
  apiLogin,
  apiLogout,
  apiRefresh,
  apiUpdatePreferences,
  AuthUser,
  clearStoredRefreshToken,
  getSessionId,
  getStoredRefreshToken,
  Preferences,
  PreferencesInput,
  setStoredRefreshToken,
} from '@/lib/auth'
import { showToast } from '@/lib/toast'

// ── Context shape ──────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: AuthUser | null
  preferences: Preferences | null
  sessionId: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updatePreferences: (prefs: PreferencesInput) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider ───────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Access token lives in a ref — never stored to localStorage or state.
  // It is re-acquired via the refresh token on every page load.
  const accessTokenRef = useRef<string | null>(null)

  // On mount: restore session from stored refresh token (if any)
  useEffect(() => {
    setSessionId(getSessionId())

    const storedRefresh = getStoredRefreshToken()

    if (!storedRefresh) {
      // Guest — still load their preferences (stored against session cookie)
      apiGetPreferences(null)
        .then((p) => setPreferences(p))
        .catch(() => null)
        .finally(() => setIsLoading(false))
      return
    }

    apiRefresh(storedRefresh)
      .then(async ({ access_token, refresh_token }) => {
        accessTokenRef.current = access_token
        setStoredRefreshToken(refresh_token)
        const [me, prefs] = await Promise.all([
          apiGetMe(access_token),
          apiGetPreferences(access_token),
        ])
        setUser(me)
        setPreferences(prefs)
      })
      .catch(() => {
        // Refresh token expired — back to guest
        clearStoredRefreshToken()
        return apiGetPreferences(null)
          .then((p) => setPreferences(p))
          .catch(() => null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password)
    accessTokenRef.current = data.access_token
    setStoredRefreshToken(data.refresh_token)
    setUser(data.user)
    // Reload preferences — session claiming may have migrated guest prefs to user
    const prefs = await apiGetPreferences(data.access_token)
    setPreferences(prefs)
    if (data.session_claimed) {
      showToast('Welcome back! Your saved clinics and Prakriti profile have been linked to your account.')
    }
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    accessTokenRef.current = null
    clearStoredRefreshToken()
    setUser(null)
    // Reload guest preferences (session cookie still present, data preserved)
    const prefs = await apiGetPreferences(null).catch(() => null)
    setPreferences(prefs)
  }, [])

  const updatePreferences = useCallback(async (prefs: PreferencesInput) => {
    const result = await apiUpdatePreferences(prefs, accessTokenRef.current)
    setPreferences(result)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        preferences,
        sessionId,
        isLoading,
        isAuthenticated: user !== null,
        login,
        logout,
        updatePreferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
