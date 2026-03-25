import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { fetchRoute } from '../api'

const AuthContext = createContext(null)

const loadStoredUser = () => {
  const raw = localStorage.getItem('user')
  if (!raw || raw === 'undefined') return null

  try {
    return JSON.parse(raw)
  } catch {
    localStorage.removeItem('user')
    return null
  }
}

const persistUser = (nextUser) => {
  if (nextUser == null) {
    localStorage.removeItem('user')
    return
  }
  localStorage.setItem('user', JSON.stringify(nextUser))
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadStoredUser)
  const [loading, setLoading] = useState(false)

  const refreshUser = async () => {
    const { data } = await fetchRoute('me')
    setUser(data.user)
    persistUser(data.user)
    return data.user
  }

  const login = async (email, password) => {
    setLoading(true)
    try {
      const { data } = await fetchRoute('login', {
        method: 'POST',
        data: { email, password }
      })
      localStorage.setItem('token', data.token)
      persistUser(data.user)
      setUser(data.user)
      return data.user
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    persistUser(null)
    setUser(null)
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    const needsRefresh = !user || (user.role !== 'parent' && user.menu_access == null)
    if (!token || !needsRefresh) return
    refreshUser().catch(() => logout())
  }, [user])

  const value = useMemo(() => ({ user, login, logout, loading, refreshUser, setUser }), [user, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
