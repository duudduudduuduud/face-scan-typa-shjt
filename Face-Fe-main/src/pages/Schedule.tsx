import { useEffect, useRef, useState } from 'react';
import { post, request } from '../api/client';
import { Alert, errorMessage } from '../components/Common';
import { CampusIcon } from '../components/CampusIcon';
import type { Student } from '../types';

export interface Lesson { id: number; subjectCode: string; subjectName: string; teacherName: string; roomId: number; roomCode: string; startsAt: string; endsAt: string; attendedAt: string | null; status: 'present' | 'absent' | 'pending'; canAttend: boolean }
interface MonthSchedule { student: { studentId: number; studentCode: string; fullName: string } | null; items: Lesson[] }
function dateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
const time = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
export function Schedule() {
  const today = dateKey(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [data, setData] = useState<MonthSchedule>({ student: null, items: [] });
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0); const [active, setActive] = useState<Lesson | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setData(previous => ({ ...previous, items: [] }));
    request<MonthSchedule>(`/schedule?month=${month}`).then(result => { if (!cancelled) setData(result); }).catch(e => { if (!cancelled) setError(errorMessage(e)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month, refresh]);
  // Refresh eligibility when the attendance window opens/closes.
  useEffect(() => { const timer = window.setInterval(() => setRefresh(value => value + 1), 60000); return () => window.clearInterval(timer); }, []);
  const [year, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => new Date(Date.UTC(year, m - 1, index - offset + 1)));
  const lessons = data.items.filter(item => dateKey(new Date(item.startsAt)) === selected);
  function move(delta: number) {
    const date = new Date(Date.UTC(year, m - 1 + delta, 1));
    const value = date.toISOString().slice(0, 7);
    setMonth(value); setSelected(`${value}-01`);
  }
  const [selectedYear, selectedMonth, selectedDay] = selected.split('-').map(Number);
  return <div className="student-schedule">
    <header className="schedule-page-heading"><span>LỊCH HỌC CÁ NHÂN</span><h1>Lịch học &amp; điểm danh</h1><p>Chọn ngày để xem môn học và thực hiện điểm danh khuôn mặt.</p></header>
    <Alert message={error}/>
    {error && <button onClick={() => setRefresh(value => value + 1)}>Thử tải lại</button>}
    <div className="schedule-board"><section className="month-calendar" aria-label="Lịch tháng">
      <div className="month-toolbar"><h2>Tháng {m}, {year}</h2><div className="month-arrows"><button aria-label="Tháng trước" onClick={() => move(-1)}><CampusIcon name="chevron" style={{ transform: 'rotate(180deg)' }}/></button><button aria-label="Tháng sau" onClick={() => move(1)}><CampusIcon name="chevron"/></button></div><button className="today-button" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); }}>Hôm nay</button></div>
      <div className="weekday-row">{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="month-days">{days.map(date => {
        const key = date.toISOString().slice(0, 10);
        const current = key.slice(0, 7) === month;
        const scheduled = data.items.some(item => dateKey(new Date(item.startsAt)) === key);
        return <button key={key} className={`calendar-day ${!current ? 'outside' : ''} ${scheduled ? 'has-class' : ''} ${key === selected ? 'selected' : ''} ${key === today ? 'is-today' : ''}`} disabled={!current} aria-pressed={key === selected} aria-label={`${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}${scheduled ? ', có lịch học' : ''}`} onClick={() => setSelected(key)}><span>{date.getUTCDate()}</span>{scheduled && <i aria-hidden="true"/>}</button>;
      })}</div>
      <div className="calendar-legend"><span><i/> Có lịch học</span><span><i className="legend-selected"/> Ngày đang chọn</span></div>
      {loading && <p role="status" className="calendar-note">Đang tải lịch học…</p>}
      {!loading && !error && !data.student && <p className="calendar-note">Tài khoản chưa được liên kết với sinh viên. Liên hệ quản trị để cấp lịch học.</p>}
    </section><section className="day-detail">
      <header><span>THÔNG TIN CHI TIẾT</span><h2>Ngày {selectedDay} tháng {selectedMonth}, {selectedYear}</h2></header>
      {!loading && !error && !lessons.length && <div className="day-empty"><CampusIcon name="calendar"/><h3>Không có lịch học</h3><p>Chọn ngày được đánh dấu xanh để xem buổi học.</p></div>}
      {lessons.map(lesson => <article className={`lesson-card ${lesson.status}`} key={lesson.id}>
        <div className="lesson-heading"><h3>{lesson.subjectName} <small>{lesson.subjectCode}</small></h3><span className={`lesson-status ${lesson.status}`}>{lesson.status === 'present' ? 'ĐÃ ĐIỂM DANH' : lesson.status === 'absent' ? 'VẮNG MẶT' : 'CHƯA ĐIỂM DANH'}</span></div>
        <div className="lesson-info"><p><span className="lesson-person"><CampusIcon name="users"/></span>{lesson.teacherName}</p><p><span className="lesson-clock"><CampusIcon name="clock"/></span>{time(lesson.startsAt)} – {time(lesson.endsAt)}</p><p><span className="lesson-room"><CampusIcon name="room"/></span>{lesson.roomCode}</p></div>
        {lesson.attendedAt ? <p className="attended-time"><CampusIcon name="check"/> Đã điểm danh lúc {time(lesson.attendedAt)}</p> : <><p className="attendance-window">Điểm danh mở từ {time(new Date(Date.parse(lesson.startsAt) - 15 * 60000).toISOString())} đến {time(lesson.endsAt)}.</p><div className="lesson-actions"><button disabled={!lesson.canAttend} onClick={() => setActive(lesson)}><CampusIcon name="camera"/> Điểm danh</button></div></>}
      </article>)}
    </section></div>
    {active && data.student && <AttendanceDialog lesson={active} studentId={data.student.studentId} onClose={() => setActive(null)} onSaved={() => setRefresh(value => value + 1)}/>}
  </div>;
}

function AttendanceDialog({ lesson, studentId, onClose, onSaved }: { lesson: Lesson; studentId: number; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null); const lock = useRef(false);
  const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    dialog.current?.showModal();
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera yêu cầu localhost hoặc HTTPS.');
        const media = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
        if (cancelled) { media.getTracks().forEach(track => track.stop()); return; }
        stream.current = media;
        if (video.current) { video.current.srcObject = media; await video.current.play(); }
        if (!cancelled) setReady(true);
      } catch (e) { if (!cancelled) setError(`${errorMessage(e)} Hãy kiểm tra quyền camera.`); }
    }
    void start();
    return () => { cancelled = true; stream.current?.getTracks().forEach(track => track.stop()); };
  }, []);
  async function confirm() {
    if (lock.current || saved) return;
    lock.current = true; setBusy(true); setError('');
    try {
      let currentTicket = ticket;
      if (!currentTicket) {
        const source = video.current;
        if (!source?.videoWidth) throw new Error('Chờ camera hiển thị hình ảnh.');
        const canvas = document.createElement('canvas'); const scale = Math.min(1, 960 / source.videoWidth);
        canvas.width = Math.round(source.videoWidth * scale); canvas.height = Math.round(source.videoHeight * scale);
        canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
        const result = await post<{ student: Student | null; ticket: string | null }>('/camera/recognize', { image: canvas.toDataURL('image/jpeg', 0.85) });
        if (!result.student || !result.ticket) throw new Error('Chưa nhận diện được khuôn mặt. Đảm bảo đủ ánh sáng và đã đăng ký mặt.');
        if (result.student.id !== studentId) throw new Error('Khuôn mặt không khớp với sinh viên của tài khoản đang đăng nhập.');
        currentTicket = result.ticket; setTicket(currentTicket);
      }
      await post(`/schedule/${lesson.id}/attendance`, { ticket: currentTicket });
      setSaved(true); stream.current?.getTracks().forEach(track => track.stop()); setReady(false); onSaved();
    } catch (e) { setError(errorMessage(e)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} className="attendance-dialog" onCancel={event => { event.preventDefault(); if (!lock.current) onClose(); }} aria-labelledby="attendance-dialog-title">
    <header><div><h2 id="attendance-dialog-title">Điểm danh khuôn mặt</h2><small>{lesson.subjectName} · {lesson.roomCode}</small></div><button aria-label="Đóng điểm danh" disabled={busy} onClick={onClose}>×</button></header>
    <div className="attendance-dialog-body"><div className={`attendance-camera ${saved ? 'saved' : ''}`}><video ref={video} autoPlay muted playsInline aria-label="Camera điểm danh"/>{!saved && <div className="face-guide" aria-hidden="true"/>}{saved && <div className="attendance-success"><CampusIcon name="check"/><strong>Điểm danh thành công</strong></div>}<span className="camera-state"><i/>{saved ? 'Đã lưu điểm danh' : busy ? 'Đang kiểm tra khuôn mặt…' : ready ? 'Camera sẵn sàng' : 'Đang mở camera…'}</span></div>
      <p className="camera-guidance">Giữ một khuôn mặt trong khung hình và đảm bảo đủ ánh sáng.</p><Alert message={error}/>
      {saved ? <button className="primary full" onClick={onClose}>Hoàn tất</button> : <button className="primary full" disabled={busy || !ready} onClick={() => void confirm()}><CampusIcon name="check"/>{busy ? 'Đang điểm danh…' : ticket ? 'Thử lại điểm danh' : 'Xác nhận điểm danh'}</button>}
      {ticket && error && <button className="recognize-again" disabled={busy} onClick={() => { setTicket(null); setError(''); }}>Nhận diện lại khuôn mặt</button>}
    </div>
  </dialog>;
}
