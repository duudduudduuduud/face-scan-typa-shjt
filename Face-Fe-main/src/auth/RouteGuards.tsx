import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function Protected() {
  const { session, checking } = useAuth();
  if (checking) return <div className="empty" role="status">Đang xác minh phiên đăng nhập…</div>;
  return session ? <Outlet/> : <Navigate to="/login" replace/>;
}
