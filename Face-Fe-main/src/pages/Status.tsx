import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
export function Status() {
  const { session } = useAuth();
  return <section className="card"><h1>404</h1><p>Không tìm thấy trang yêu cầu.</p><Link to={session ? '/events' : '/login'}>Về trang chính</Link></section>;
}
