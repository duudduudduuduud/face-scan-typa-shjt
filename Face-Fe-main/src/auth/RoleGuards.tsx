import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import type { Role } from '../types';

export function homeForRole(role: Role) { return role === 'teacher' || role === 'admin' ? '/admin' : role === 'ai_service' ? '/service' : '/'; }
export function RoleGate({ roles }: { roles: Role[] }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace/>;
  return roles.includes(session.user.role) ? <Outlet/> : <Navigate to={homeForRole(session.user.role)} replace/>;
}
