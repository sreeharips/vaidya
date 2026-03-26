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
  apiLogin,
  apiLogout,
  apiRefresh,
  AuthUser,
  clearStoredRefreshToken,
  getSessionId,
  getStoredRefreshToken,
  setStoredRefreshToken,
} from '@/lib/auth'
import { showToast } from '@/lib/toast'

// ── Context shape ──────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: AuthUser | null
  sessionId: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider ───────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
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
      setIsLoading(false)
      return
    }

    apiRefresh(storedRefresh)
      .then(async ({ access_token, refresh_token }) => {
        accessTokenRef.current = access_token
        setStoredRefreshToken(refresh_token)
        const me = await apiGetMe(access_token)
        setUser(me)
      })
      .catch(() => {
        clearStoredRefreshToken()
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password)
    accessTokenRef.current = data.access_token
    setStoredRefreshToken(data.refresh_token)
    setUser(data.user)
    if (data.session_claimed) {
      showToast('Welcome back! Your saved clinics have been linked to your account.')
    }
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    accessTokenRef.current = null
    clearStoredRefreshToken()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionId,
        isLoading,
        isAuthenticated: user !== null,
        login,
        logout,
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
