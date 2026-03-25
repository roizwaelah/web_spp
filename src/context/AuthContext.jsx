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
    fetchRoute('me').then(({ data }) => {
      setUser(data.user)
      persistUser(data.user)
    }).catch(() => logout())
  }, [user])

  const value = useMemo(() => ({ user, login, logout, loading }), [user, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
