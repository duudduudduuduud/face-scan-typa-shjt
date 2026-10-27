import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { CampusIcon } from './CampusIcon';

const mainLinks = [['/', 'Trang chủ', 'home'], ['/schedule', 'Lịch học', 'calendar'], ['/events', 'Lịch sử ra/vào', 'history']];
const toolLinks = [['/camera', 'Camera trực tuyến', 'camera'], ['/students', 'Sinh viên', 'users'], ['/rooms', 'Phòng', 'room']];
export function Layout() {
  const { session, signOut } = useAuth();
  const user = session!.user;
  const location = useLocation();
  const staff = user.role === 'teacher' || user.role === 'admin';
  const links = staff ? [['/admin', 'Trang qu\u1ea3n tr\u1ecb', 'home'], ['/admin/training', 'Hu\u1ea5n luy\u1ec7n AI', 'users'], ['/admin/accounts', 'C\u1ea5p t\u00e0i kho\u1ea3n', 'users'], ...toolLinks.map(([path,label,icon]) => [`/admin${path}`,label,icon]), ['/admin/events', 'L\u1ecbch s\u1eed ra/v\u00e0o', 'history']] : mainLinks;
  const title = links.find(([path]) => path === location.pathname)?.[1] || 'Trang chủ';
  const initials = user.fullName.trim().split(/\s+/).slice(-2).map(part => part[0]).join('').toUpperCase();
  return <div className="app campus-app"><aside className="campus-sidebar">
    <NavLink to="/" className="campus-brand"><span><CampusIcon name="camera"/></span><div>FaceAttend<small>SMART CAMPUS</small></div></NavLink>
    <div className="nav-label">ĐIỀU HƯỚNG</div>
    <nav aria-label="Điều hướng chính">{links.map(([path, label, icon]) => <NavLink end key={path} to={path}><CampusIcon name={icon}/><span>{label}</span><i/></NavLink>)}</nav>
    <div className="campus-account"><span className="campus-avatar">{initials}</span><div><strong title={user.fullName}>{user.fullName}</strong><small>{user.studentId ? `Sinh viên #${user.studentId}` : user.username}</small></div><button onClick={signOut} aria-label="Đăng xuất" title="Đăng xuất"><CampusIcon name="logout"/></button></div>
  </aside><div className="main">
    <header className="topbar campus-topbar"><div className="campus-breadcrumb"><span>FaceAttend</span><CampusIcon name="chevron"/><strong>{title}</strong></div><span className="campus-session"><i/> Đã đăng nhập</span></header>
    <main><Outlet key={user.id}/></main>
  </div></div>;
}
