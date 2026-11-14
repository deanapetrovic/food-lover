import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="p-8 text-muted">Loading…</div>
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}
