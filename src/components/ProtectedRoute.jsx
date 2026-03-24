import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, role }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/" replace />

  if (role) {
    const roles = Array.isArray(role) ? role : [role]
    if (!roles.includes(user.role)) {
      return <Navigate to={user.role === 'parent' ? '/orang-tua' : '/admin'} replace />
    }
  }

  return children
}
