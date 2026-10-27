import { useRef, useState, type FormEvent } from 'react';
import { createEvent, getRooms, getStudents } from '../api';
import { ApiError } from '../api/client';
import { Alert, errorMessage, formatTime, PageHeading, useList, vietnamISO } from '../components/Common';
import type { EventResult, ManualPayload } from '../types';

export function Manual() {
  const students = useList(getStudents); const rooms = useList(getRooms);
  const [payload, setPayload] = useState<ManualPayload | null>(null);
  const pending = useRef<ManualPayload | null>(null); const lock = useRef(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false); const [result, setResult] = useState<EventResult | null>(null);
  async function send(body: ManualPayload) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const response = await createEvent(body);
      setResult(response); pending.current = null; setPayload(null); setUncertain(false);
    } catch (err) {
      setError(errorMessage(err));
      if (!(err instanceof ApiError) || err.status === 0 || err.status >= 500) setUncertain(true);
    } finally { lock.current = false; setBusy(false); }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (lock.current || pending.current) return;
    const data = new FormData(e.currentTarget);
    const studentId = Number(data.get('studentId')); const roomId = Number(data.get('roomId'));
    const direction = data.get('direction');
    if (!Number.isSafeInteger(studentId) || studentId <= 0 || !students.data.some(s => s.id === studentId)
      || !Number.isSafeInteger(roomId) || roomId <= 0 || !rooms.data.some(r => r.id === roomId)
      || (direction !== 'in' && direction !== 'out')) { setError('Vui lòng chọn sinh viên, phòng và hướng hợp lệ.'); return; }
    const time = String(data.get('occurredAt'));
    const body: ManualPayload = { studentId, roomId, direction, ...(time ? { occurredAt: vietnamISO(time) } : {}), source: 'manual', eventKey: crypto.randomUUID() };
    pending.current = body; setPayload(body); setResult(null); setUncertain(false); void send(body);
  }
  const unavailable = students.loading || rooms.loading || !!students.error || !!rooms.error || !students.data.length || !rooms.data.length;
  return <>
    <PageHeading label="THAO TÁC" title="Ghi sự kiện thủ công" description="Bổ sung một lượt ra hoặc vào cho sinh viên tại phòng cụ thể."/>
    <div className="columns"><section className="card"><h2>Thông tin sự kiện</h2>
      <Alert message={students.error || rooms.error}/>
      {(students.error || rooms.error) && <button onClick={() => { void students.refresh(); void rooms.refresh(); }}>Tải lại danh sách</button>}
      {(students.loading || rooms.loading) && <p role="status">Đang tải sinh viên và phòng…</p>}
      {!students.loading && !rooms.loading && !students.error && !rooms.error && (!students.data.length || !rooms.data.length) && <div className="alert">Hãy thêm sinh viên và phòng trước khi ghi sự kiện.</div>}
      <form onSubmit={submit}><fieldset disabled={busy || !!payload || unavailable}>
        <label>Sinh viên<select name="studentId" required defaultValue=""><option value="" disabled>Chọn sinh viên</option>{students.data.map(s => <option key={s.id} value={s.id}>{s.studentCode} · {s.fullName}</option>)}</select></label>
        <label>Phòng<select name="roomId" required defaultValue=""><option value="" disabled>Chọn phòng</option>{rooms.data.map(r => <option key={r.id} value={r.id}>{r.roomCode} · {r.name}</option>)}</select></label>
        <label>Hướng<select name="direction" defaultValue="in"><option value="in">Vào phòng</option><option value="out">Ra khỏi phòng</option></select></label>
        <label>Thời gian (Việt Nam, UTC+07:00)<input name="occurredAt" type="datetime-local" step="1"/></label>
        <p className="hint">Để trống để dùng thời gian của máy chủ. Khi thử lại, giữ nguyên lựa chọn thời gian.</p>
        <button className="primary full" disabled={busy}>{busy ? 'Đang ghi nhận…' : 'Ghi nhận sự kiện'}</button>
      </fieldset></form>
      <Alert message={error}/>
      {payload && (error || busy) && <div className="retry">
        <p>{busy ? 'Đang gửi sự kiện. Vui lòng chờ phản hồi máy chủ.' : uncertain ? 'Chưa biết máy chủ đã lưu sự kiện hay chưa. Giữ nguyên payload và mã sự kiện khi thử lại.' : 'Máy chủ từ chối yêu cầu. Kiểm tra thông báo lỗi trước khi thử lại hoặc hủy thao tác để sửa.'}</p>
        <button className="primary" disabled={busy} onClick={() => void send(payload)}>{busy ? 'Đang xử lý…' : 'Thử lại cùng sự kiện'}</button>
        {!uncertain && <button disabled={busy} onClick={() => { pending.current = null; setPayload(null); setError(''); }}>Hủy thao tác để sửa</button>}
      </div>}
      {result && <Alert success message={`${result.duplicate ? 'Sự kiện đã tồn tại; không tạo trùng.' : 'Đã ghi nhận sự kiện.'} ${result.event.direction === 'in' ? 'Vào' : 'Ra'} · ${formatTime(result.event.occurredAt)}`}/>}
    </section><section className="card info-card">
      <span className="big-icon">↔</span><h2>Ghi nhận chính xác</h2>
      <p>Mỗi thao tác có một mã sự kiện riêng. Máy chủ dùng mã này để xử lý những lần gửi lại.</p>
      <div className="info-row"><span>Nguồn sự kiện</span><strong>Thủ công · manual</strong></div>
      <div className="info-row"><span>Múi giờ</span><strong>Asia/Ho_Chi_Minh</strong></div>
      <p className="hint">AI Python gửi sự kiện camera trực tiếp lên máy chủ. Lịch sử ra vào không phải điểm danh theo buổi học.</p>
    </section></div>
  </>;
}
