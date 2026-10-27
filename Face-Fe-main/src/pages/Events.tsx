import { useEffect, useState, type FormEvent } from 'react';
import { getEvents, getRooms, getStudents } from '../api';
import { Alert, errorMessage, formatTime, ListState, PageHeading, useList, vietnamISO } from '../components/Common';
import { Pagination } from '../components/Pagination';
import type { Direction, EventFilters, Page, RoomEvent } from '../types';
import { useAuth } from '../auth/AuthProvider';

export function Events() {
  const { session } = useAuth();
  const user = session!.user;
  const personal = user.role === 'student';
  const students = useList(getStudents); const rooms = useList(getRooms);
  const [filters, setFilters] = useState<EventFilters>({ page: 1, limit: 20 });
  const [data, setData] = useState<Page<RoomEvent> | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [validation, setValidation] = useState(''); const [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true; setLoading(true); setError(''); setData(null);
    if (personal && !user.studentId) {
      setData({items: [], total: 0, page: filters.page, limit: filters.limit, totalPages: 0}); setLoading(false);
      return;
    }
    void getEvents(personal ? { ...filters, studentId: user.studentId! } : filters).then(value => { if (current) setData(personal ? { ...value, items: value.items.filter(event => event.studentId === user.studentId) } : value); })
      .catch(err => { if (current) setError(errorMessage(err)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [filters, reload, personal, user.studentId]);

  function apply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    const from = String(form.get('from')); const to = String(form.get('to'));
    if (from && to && from > to) { setValidation('Thời gian bắt đầu phải trước thời gian kết thúc.'); return; }
    setValidation('');
    setFilters({ studentId: Number(form.get('studentId')) || undefined, roomId: Number(form.get('roomId')) || undefined,
      direction: (String(form.get('direction')) || undefined) as Direction | undefined,
      from: from ? vietnamISO(from) : undefined, to: to ? vietnamISO(to) : undefined, page: 1, limit: Number(form.get('limit')) });
  }
  return <>
    <PageHeading label={personal ? 'HỒ SƠ SINH VIÊN' : 'THEO DÕI HOẠT ĐỘNG'} title="Lịch sử ra / vào" description={personal ? 'Tra cứu lịch sử ra vào phòng học của bạn.' : 'Theo dõi các lượt ra vào từ camera và sự kiện ghi nhận thủ công.'}/>
    {personal && <section className="card"><h2>{user.fullName}</h2><p>{students.data.find(student => student.id === user.studentId)?.studentCode || (user.studentId ? `Sinh viên #${user.studentId}` : 'Tài khoản chưa được liên kết với sinh viên.')}</p></section>}
    {!personal && <section className="card"><h2>Bộ lọc sự kiện</h2><Alert message={students.error || rooms.error}/>
      {(students.error || rooms.error) && <button onClick={() => { void students.refresh(); void rooms.refresh(); }}>Tải lại danh sách bộ lọc</button>}
      <form onSubmit={apply}><div className="filters">
        {!personal && <label>Sinh viên<select name="studentId" disabled={students.loading || !!students.error}><option value="">{students.loading ? 'Đang tải…' : 'Tất cả sinh viên'}</option>{students.data.map(s => <option key={s.id} value={s.id}>{s.studentCode} · {s.fullName}</option>)}</select></label>}
        <label>Phòng<select name="roomId" disabled={rooms.loading || !!rooms.error}><option value="">{rooms.loading ? 'Đang tải…' : 'Tất cả phòng'}</option>{rooms.data.map(r => <option key={r.id} value={r.id}>{r.roomCode} · {r.name}</option>)}</select></label>
        <label>Hướng<select name="direction"><option value="">Tất cả</option><option value="in">Vào phòng</option><option value="out">Ra khỏi phòng</option></select></label>
        <label>Từ (UTC+07:00)<input type="datetime-local" name="from" step="1"/></label>
        <label>Đến (UTC+07:00)<input type="datetime-local" name="to" step="1"/></label>
        <label>Số dòng / trang<select name="limit" defaultValue="20"><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label>
      </div><Alert message={validation}/><button className="primary" disabled={loading}>Áp dụng bộ lọc</button></form>
    </section>}
    <section className="card history"><div className="card-heading"><h2>Sự kiện ra / vào</h2><button disabled={loading} onClick={() => setReload(v => v+1)}>↻ Làm mới</button></div>
      <ListState loading={loading} error={error} empty={!!data && !data.items.length}/>
      {!loading && !error && data && <><div className="table-wrap"><table><thead><tr><th>Sinh viên</th><th>Phòng</th><th>Hướng</th><th>Thời gian Việt Nam</th><th>Nguồn</th></tr></thead><tbody>{data.items.map(event => <tr key={event.id}>
        <td>{students.data.find(s => s.id === event.studentId)?.fullName ?? `Sinh viên #${event.studentId}`}</td>
        <td>{rooms.data.find(r => r.id === event.roomId)?.name ?? `Phòng #${event.roomId}`}</td>
        <td><span className="code">{event.direction === 'in' ? 'Vào' : 'Ra'}</span></td><td>{formatTime(event.occurredAt)}</td>
        <td>{event.source === 'manual' ? 'Thủ công' : event.source === 'camera' ? 'Camera' : event.source}</td>
      </tr>)}</tbody></table></div><Pagination page={data.page} total={data.total} totalPages={data.totalPages} busy={loading} onChange={page => setFilters(old => ({ ...old, page }))}/></>}
    </section>
  </>;
}
