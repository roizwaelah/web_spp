import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canAccessMenu, getDefaultRouteForUser } from '../access'

export default function ProtectedRoute({ children, role, menuKey }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/" replace />

  if (role) {
    const roles = Array.isArray(role) ? role : [role]
    if (!roles.includes(user.role)) {
      return <Navigate to={getDefaultRouteForUser(user)} replace />
    }
  }

  if (menuKey && user.role !== 'parent' && !canAccessMenu(user, menuKey)) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />
  }

  return children
}
