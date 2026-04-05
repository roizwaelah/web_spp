import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { fetchRoute } from '../api'

const AuthContext = createContext(null)
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000

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
  const inactivityTimerRef = useRef(null)

  const refreshUser = async () => {
    const { data } = await fetchRoute('me')
    setUser(data.user)
    persistUser(data.user)
    return data.user
  }

  const login = async (credentials, passwordArg = '') => {
    setLoading(true)
    try {
      const payload =
        typeof credentials === 'object' && credentials !== null
          ? credentials
          : { email: credentials, password: passwordArg }
      const { data } = await fetchRoute('login', {
        method: 'POST',
        data: payload
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
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
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

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!user || !token) {
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
      return
    }

    const resetInactivityTimer = () => {
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current)
      }
      inactivityTimerRef.current = window.setTimeout(() => {
        logout()
      }, INACTIVITY_TIMEOUT_MS)
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach((eventName) =>
      window.addEventListener(eventName, resetInactivityTimer, { passive: true }),
    )
    resetInactivityTimer()

    return () => {
      events.forEach((eventName) =>
        window.removeEventListener(eventName, resetInactivityTimer),
      )
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
    }
  }, [user])

  const value = useMemo(() => ({ user, login, logout, loading, refreshUser, setUser }), [user, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
