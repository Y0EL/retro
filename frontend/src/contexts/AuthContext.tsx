import { createContext, useContext, useState } from "react"

interface AuthCtx {
  operator: string
  isAuthenticated: boolean
  login: (name: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthCtx>({
  operator: "PT GSP",
  isAuthenticated: true,
  login: () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [operator] = useState("PT GSP")

  return (
    <AuthContext.Provider value={{ operator, isAuthenticated: true, login: () => {}, logout: () => {} }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
