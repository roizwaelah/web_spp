import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { fetchRoute } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  })
  const [loading, setLoading] = useState(false)

  const login = async (email, password) => {
    setLoading(true)
    try {
      const { data } = await fetchRoute('login', {
        method: 'POST',
        data: { email, password }
      })
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
      return data.user
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token || user) return
    fetchRoute('me').then(({ data }) => {
      setUser(data.user)
      localStorage.setItem('user', JSON.stringify(data.user))
    }).catch(() => logout())
  }, [])

  const value = useMemo(() => ({ user, login, logout, loading }), [user, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
