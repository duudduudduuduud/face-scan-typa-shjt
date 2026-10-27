import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { getEvents, getRooms } from '../api';
import { Alert, errorMessage, formatTime } from '../components/Common';
import { CampusIcon } from '../components/CampusIcon';
import type { RoomEvent } from '../types';

export function Home() {
  const { session } = useAuth();
  const user = session!.user;
  const [latest, setLatest] = useState<RoomEvent | null>(null);
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh' }).format(now));
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const name = user.fullName.trim().split(/\s+/).at(-1) || user.username;
  const date = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
  useEffect(() => {
    let cancelled = false;
    if (!user.studentId) return;
    setLoading(true); setError('');
    Promise.all([getEvents({ studentId: user.studentId, page: 1, limit: 1 }), getRooms()])
      .then(([page, rooms]) => { if (!cancelled) { const event = page.items[0] ?? null; setLatest(event); setRoomName(rooms.find(room => room.id === event?.roomId)?.roomCode ?? (event ? `Phòng #${event.roomId}` : '')); } })
      .catch(e => { if (!cancelled) setError(errorMessage(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user.studentId, refresh]);
  return <div className="student-home">
    <section className="welcome-banner">
      <span className="welcome-status"><i/> Bạn đã đăng nhập</span>
      <p className="welcome-date">{date}</p>
      <h1>{greeting}, {name}!</h1>
      <p>Theo dõi lịch học và các lần ghi nhận ra/vào của bạn tại đây.</p>
      <Link className="welcome-link" to="/schedule">Xem lịch hôm nay <CampusIcon name="arrow"/></Link>
      <div className="welcome-decoration" aria-hidden="true"/>
    </section>
    <div className="home-stats">
      {[{ label: 'Tỷ lệ chuyên cần', note: 'Chưa có dữ liệu điểm danh', icon: 'chart', color: 'blue' },
        { label: 'Buổi đã tham gia', note: 'Chưa có dữ liệu buổi học', icon: 'check', color: 'green' },
        { label: 'Đi muộn', note: 'Chưa có dữ liệu giờ vào lớp', icon: 'clock', color: 'amber' }].map(stat =>
        <section className="home-stat" key={stat.label}><div><span>{stat.label}</span><strong aria-label="Chưa có dữ liệu">—</strong><small>{stat.note}</small></div><span className={`stat-icon ${stat.color}`}><CampusIcon name={stat.icon}/></span></section>)}
    </div>
    <div className="home-bottom">
      <section className="home-panel schedule-panel">
        <div className="home-panel-heading"><div><h2>Lịch học hôm nay</h2><small>{date}</small></div><Link to="/schedule">Xem tất cả <CampusIcon name="chevron"/></Link></div>
        <div className="schedule-empty"><span className="empty-calendar"><CampusIcon name="calendar"/></span><h3>Lịch học sẽ xuất hiện tại đây</h3><p>Hiện chưa có lịch học được cung cấp cho tài khoản của bạn.</p><Link to="/schedule">Xem lịch học <CampusIcon name="arrow"/></Link></div>
      </section>
      <section className="home-panel recent-panel">
        <div className="home-panel-heading"><h2>Ghi nhận gần nhất</h2>{user.studentId && <button className="home-refresh" disabled={loading} aria-label="Làm mới ghi nhận" onClick={() => setRefresh(value => value + 1)}><CampusIcon name="refresh"/></button>}</div>
        <Alert message={error}/>
        {loading ? <p className="recent-empty" role="status">Đang tải ghi nhận…</p> : latest ? <>
          <div className="recent-summary"><span className="recent-check"><CampusIcon name="check"/></span><div><h3>Đã ghi nhận {latest.direction === 'in' ? 'vào phòng' : 'ra phòng'}</h3><small>{formatTime(latest.occurredAt)}</small></div></div>
          <dl className="recent-details"><div><dt>Phòng học</dt><dd>{roomName}</dd></div><div><dt>Nguồn ghi nhận</dt><dd>{latest.source === 'camera' ? 'Camera' : 'Thủ công'}</dd></div><div><dt>Trạng thái</dt><dd className="positive">Đã lưu</dd></div></dl>
        </> : <div className="recent-empty"><span className="recent-check"><CampusIcon name="history"/></span><h3>Chưa có ghi nhận</h3><p>{user.studentId ? 'Các lượt ra/vào mới sẽ xuất hiện tại đây.' : 'Tài khoản chưa được liên kết với hồ sơ sinh viên.'}</p></div>}
        {user.studentId ? <Link className="history-link" to={`/events?studentId=${user.studentId}`}>Xem lịch sử <CampusIcon name="arrow"/></Link> : <div className="home-link-note">Liên hệ quản trị để liên kết mã sinh viên</div>}
      </section>
    </div>
  </div>;
}
