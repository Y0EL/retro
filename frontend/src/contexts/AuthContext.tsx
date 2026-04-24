import { createContext, useContext, useState, useEffect, useCallback } from "react"

const BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001"

export interface UserProfile {
  username: string
  org:      string
  role:     string
  division: string
  loginAt?: string
  stats?: {
    totalJobs:      number
    runningJobs:    number
    completedJobs:  number
    failedJobs:     number
    totalEntities:  number
    entitiesByType: Record<string, number>
  }
}

interface AuthCtx {
  user:            UserProfile | null
  isAuthenticated: boolean
  loading:         boolean
  login:           (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout:          () => void
  refreshProfile:  () => void
}

const AuthContext = createContext<AuthCtx>({
  user:            null,
  isAuthenticated: false,
  loading:         true,
  login:           async () => ({ ok: false }),
  logout:          () => {},
  refreshProfile:  () => {},
})

const TOKEN_KEY = "retro_token"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMe = useCallback(async (token: string): Promise<boolean> => {
    try {
      const r = await fetch(`${BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) return false
      const data = await r.json() as UserProfile
      setUser(data)
      return true
    } catch {
      return false
    }
  }, [])

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) { setLoading(false); return }
    fetchMe(token).then(ok => {
      if (!ok) localStorage.removeItem(TOKEN_KEY)
      setLoading(false)
    })
  }, [fetchMe])

  const login = useCallback(async (username: string, password: string) => {
    try {
      const r = await fetch(`${BASE}/api/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username, password }),
      })
      const data = await r.json() as { token?: string; user?: UserProfile; error?: string }
      if (!r.ok || !data.token) return { ok: false, error: data.error ?? "Login gagal" }
      localStorage.setItem(TOKEN_KEY, data.token)
      if (data.user) setUser(data.user)
      return { ok: true }
    } catch {
      return { ok: false, error: "Tidak dapat menghubungi server" }
    }
  }, [])

  const logout = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      fetch(`${BASE}/api/auth/logout`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  const refreshProfile = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) fetchMe(token)
  }, [fetchMe])

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      loading,
      login,
      logout,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
export const getAuthToken = () => localStorage.getItem(TOKEN_KEY) ?? ""
