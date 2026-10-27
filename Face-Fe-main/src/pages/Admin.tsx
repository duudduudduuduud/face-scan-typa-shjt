import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEvents, getRooms, getStudents } from '../api';
import { useAuth } from '../auth/AuthProvider';
import { Alert, errorMessage, formatTime, PageHeading } from '../components/Common';
import { CampusIcon } from '../components/CampusIcon';
import type { RoomEvent } from '../types';

export function Admin() {
  const { session } = useAuth();
  const [data, setData] = useState<{ students: number; rooms: number; total: number; events: RoomEvent[] } | null>(null);
  const [error, setError] = useState(''); const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true; setData(null); setError('');
    Promise.all([getStudents(), getRooms(), getEvents({page:1,limit:5})]).then(([students,rooms,events]) => { if (active) setData({students:students.length,rooms:rooms.length,total:events.total,events:events.items}); }).catch(e => { if (active) setError(errorMessage(e)); });
    return () => { active = false; };
  }, [refresh]);
  return <>
    <PageHeading label="KHÔNG GIAN GIÁO VIÊN" title="Trang quản trị" description={`Chào ${session!.user.fullName}, quản lý sinh viên, phòng và hoạt động nhận diện tại đây.`}/>
    <Alert message={error}/>{error && <button onClick={() => setRefresh(value => value+1)}>Thử lại</button>}
    <div className="home-stats">{[{label:'Sinh viên',value:data?.students,icon:'users',to:'/admin/students'},{label:'Phòng học',value:data?.rooms,icon:'room',to:'/admin/rooms'},{label:'Lượt ra/vào',value:data?.total,icon:'history',to:'/admin/events'}].map(item => <section className="home-stat" key={item.label}><div><span>{item.label}</span><strong>{item.value ?? '—'}</strong><Link to={item.to}>Xem danh sách →</Link></div><span className="stat-icon blue"><CampusIcon name={item.icon}/></span></section>)}</div>
    <div className="columns"><section className="card"><h2>Hoạt động gần nhất</h2>{!data && !error && <p role="status">Đang tải dữ liệu…</p>}{data && !data.events.length && <p className="hint">Chưa có sự kiện ra/vào.</p>}{data?.events.map(event => <div className="info-row" key={event.id}><span>Sinh viên #{event.studentId} · Phòng #{event.roomId} · {event.direction === 'in' ? 'Vào' : 'Ra'}</span><strong>{formatTime(event.occurredAt)}</strong></div>)}<Link to="/admin/events">Xem toàn bộ lịch sử →</Link></section><section className="card"><h2>Thao tác nhanh</h2><div className="camera-actions"><Link className="history-link" to="/admin/camera">Đăng ký &amp; nhận diện mặt</Link><Link className="history-link" to="/admin/students">Quản lý sinh viên</Link></div></section></div>
  </>;
}
export function ServiceAccount() {
  const { signOut } = useAuth();
  return <div className="empty"><h1>Tài khoản service AI</h1><p>Tài khoản này dùng để kết nối AI với backend.</p><button onClick={signOut}>Đăng xuất</button></div>;
}
