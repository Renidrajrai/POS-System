import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { isAuthenticated } from '../api/client'
import { login as apiLogin, logout as apiLogout } from '../api/auth'

interface AuthContextType {
  isAuth: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuth, setIsAuth] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setIsAuth(isAuthenticated())
    setLoading(false)

    const onUnauthorized = () => setIsAuth(false)
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [])

  const login = async (email: string, password: string) => {
    await apiLogin(email, password)
    setIsAuth(true)
  }

  const logout = () => {
    apiLogout()
    setIsAuth(false)
  }

  return (
    <AuthContext.Provider value={{ isAuth, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
