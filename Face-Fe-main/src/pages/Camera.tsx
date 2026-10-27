import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRooms, getStudents } from '../api';
import { post } from '../api/client';
import { Alert, errorMessage, PageHeading, useList } from '../components/Common';
import type { Direction, EventResult, Student } from '../types';

interface Recognition { student: Student | null; similarity: number; ticket: string | null }
interface CameraEvent { ticket: string; roomId: number; direction: Direction; occurredAt: string; eventKey: string }
export function Camera() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const lock = useRef(false);
  const students = useList(getStudents); const rooms = useList(getRooms);
  const [mode, setMode] = useState<'recognize' | 'enroll'>('recognize');
  const [active, setActive] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [studentId, setStudentId] = useState(''); const [roomId, setRoomId] = useState('');
  const [direction, setDirection] = useState<Direction>('in');
  const [photos, setPhotos] = useState<string[]>([]);
  const [recognized, setRecognized] = useState<Recognition | null>(null);
  const [pending, setPending] = useState<CameraEvent | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; };
  }, []);
  async function start() {
    if (lock.current || stream.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera cần localhost hoặc HTTPS.');
      const media = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
      if (!mounted.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
      setActive(true);
    } catch (e) { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setError(`${errorMessage(e)} Hãy cho phép trình duyệt dùng camera.`); }
    finally { lock.current = false; setBusy(false); }
  }
  function stop() {
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
    setActive(false);
  }
  function snapshot() {
    const source = video.current;
    if (!source?.videoWidth || !active) throw new Error('Bật camera và chờ hình ảnh sẵn sàng.');
    const canvas = document.createElement('canvas');
    const ratio = Math.min(1, 960 / source.videoWidth);
    canvas.width = Math.round(source.videoWidth * ratio); canvas.height = Math.round(source.videoHeight * ratio);
    canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }
  async function perform(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(errorMessage(e)); }
    finally { lock.current = false; setBusy(false); }
  }
  function capture() {
    try { setPhotos(previous => [...previous, snapshot()].slice(0, 5)); setError(''); }
    catch (e) { setError(errorMessage(e)); }
  }
  async function recognize() {
    setRecognized(null);
    const result = await post<Recognition>('/camera/recognize', { image: snapshot() });
    setRecognized(result);
    if (!result.student) setError('Chưa nhận diện được sinh viên. Đăng ký mặt hoặc thử lại với ánh sáng tốt hơn.');
  }
  async function send(body: CameraEvent) {
    const result = await post<EventResult>('/camera/events', body);
    setPending(null); setRecognized(null);
    setMessage(`${result.duplicate ? 'Sự kiện đã được lưu trước đó.' : 'Đã lưu sự kiện camera.'} ${result.event.direction === 'in' ? 'Vào' : 'Ra'} phòng · ${new Date(result.event.occurredAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
  }
  function confirm() {
    if (lock.current || !recognized?.ticket || !roomId || pending) return;
    const body: CameraEvent = { ticket: recognized.ticket, roomId: Number(roomId), direction, occurredAt: new Date().toISOString(), eventKey: `web-camera-${crypto.randomUUID()}` };
    setPending(body); void perform(() => send(body));
  }
  return <>
    <PageHeading label="CAMERA TRỰC TUYẾN" title="Nhận diện khuôn mặt" description="Đăng ký và ghi nhận lượt ra/vào ngay trên trình duyệt."/>
    <div className="camera-tabs"><button disabled={busy || !!pending} className={mode === 'recognize' ? 'primary' : ''} onClick={() => { setMode('recognize'); setMessage(''); }}>Nhận diện ra/vào</button><button disabled={busy || !!pending} className={mode === 'enroll' ? 'primary' : ''} onClick={() => { setMode('enroll'); setRecognized(null); setMessage(''); }}>Đăng ký khuôn mặt</button></div>
    <div className="columns"><section className="card">
      <div className="camera-preview"><video ref={video} autoPlay muted playsInline aria-label="Hình ảnh camera trực tiếp"/>{!active && <div>Camera đang tắt</div>}</div>
      <div className="camera-actions"><button className="primary" disabled={busy || active} onClick={() => void start()}>Bật camera</button><button disabled={busy || !active} onClick={stop}>Tắt camera</button></div>
      <p className="hint">Chỉ một người trong khung hình. Camera chỉ được bật khi bạn cho phép và tự tắt khi rời trang.</p>
    </section><section className="card">
      <Alert message={error || students.error || rooms.error}/><Alert success message={message}/>
      {mode === 'enroll' ? <>
        <h2>Đăng ký 5 ảnh</h2><label>Sinh viên<select value={studentId} disabled={busy} onChange={e => { setStudentId(e.target.value); setPhotos([]); }}><option value="">Chọn sinh viên đã tạo trên BE</option>{students.data.map(s => <option key={s.id} value={s.id}>{s.studentCode} · {s.fullName}</option>)}</select></label>
        <p>Chụp chính diện, hơi quay trái, phải, hơi ngẩng và cúi. Đây là gợi ý tư thế; hệ thống kiểm tra mỗi ảnh có đúng một khuôn mặt.</p>
        <div className="camera-photos">{photos.map((photo, i) => <img key={i} src={photo} alt={`Ảnh đăng ký ${i + 1}`}/>)}</div>
        <div className="camera-actions"><button disabled={busy || !active || !studentId || photos.length === 5} onClick={capture}>Chụp ảnh {photos.length}/5</button><button disabled={busy || !photos.length} onClick={() => setPhotos([])}>Chụp lại</button></div>
        <button className="primary full" disabled={busy || photos.length !== 5 || !studentId} onClick={() => void perform(async () => { await post('/camera/enroll', { studentId: Number(studentId), images: photos }); setPhotos([]); setMessage('Đã đăng ký 5 ảnh. Chuyển sang Nhận diện ra/vào để kiểm tra.'); })}>{busy ? 'Đang đăng ký…' : 'Lưu khuôn mặt'}</button>
        <p className="hint">Điểm tương đồng: Hệ thống so khớp theo khoảng cách vector đặc trưng khuôn mặt, không phải xác suất.</p>
      </> : <>
        <h2>Ghi nhận lượt ra/vào</h2>
        <label>Phòng<select value={roomId} disabled={busy || !!pending} onChange={e => setRoomId(e.target.value)}><option value="">Chọn phòng</option>{rooms.data.map(r => <option key={r.id} value={r.id}>{r.roomCode} · {r.name}</option>)}</select></label>
        <label>Hướng<select value={direction} disabled={busy || !!pending} onChange={e => setDirection(e.target.value as Direction)}><option value="in">Vào phòng</option><option value="out">Ra khỏi phòng</option></select></label>
        <button className="primary full" disabled={busy || !active || !!pending} onClick={() => void perform(recognize)}>{busy ? 'Đang xử lý…' : 'Nhận diện khuôn mặt'}</button>
        {recognized?.student && <div className="camera-result"><h3>{recognized.student.fullName}</h3><p>Mã: {recognized.student.studentCode}</p><button className="primary full" disabled={busy || !roomId || !!pending} onClick={confirm}>Xác nhận {direction === 'in' ? 'vào' : 'ra'} phòng</button></div>}
        {pending && <div className="retry"><p>Payload được giữ nguyên để thử lại. Không rời trang nếu chưa xác định sự kiện đã lưu.</p><button disabled={busy} onClick={() => void perform(() => send(pending))}>Thử lại cùng sự kiện</button></div>}
        <p className="hint">Hướng do bạn chọn; hệ thống chưa tự theo dõi lượt qua cửa hoặc chống giả mạo.</p><Link to="/events">Xem lịch sử ra/vào →</Link>
      </>}
    </section></div>
  </>;
}
