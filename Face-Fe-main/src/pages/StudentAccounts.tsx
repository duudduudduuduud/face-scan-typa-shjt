import { useRef, useState, type FormEvent } from 'react';
import { ApiError, post, request } from '../api/client';
import { Alert, errorMessage, PageHeading, useList } from '../components/Common';
import { PasswordInput } from '../components/PasswordInput';
import type { Student, User } from '../types';

const availableStudents = () => request<Student[]>('/auth/student-accounts/available-students');

export function StudentAccounts() {
  const students = useList(availableStudents);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [created, setCreated] = useState<User | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    const form = event.currentTarget; const data = new FormData(form);
    const studentId = Number(data.get('studentId'));
    const student = students.data.find(value => value.id === studentId);
    if (!student) { setError('Chọn sinh viên đã được tạo trong hệ thống.'); return; }
    lock.current = true; setBusy(true); setError(''); setCreated(null);
    try {
      const result = await post<User>('/auth/student-accounts', { studentId, username: String(data.get('username')).trim().toLowerCase(), password: String(data.get('password')), fullName: student.fullName });
      setCreated(result); form.reset(); await students.refresh();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? 'Tên đăng nhập đã tồn tại hoặc sinh viên đã có tài khoản. Chọn tên đăng nhập khác và kiểm tra lại sinh viên.' : errorMessage(e));
      if (e instanceof ApiError && e.status === 409) await students.refresh();
    }
    finally { lock.current = false; setBusy(false); const password = form.elements.namedItem('password'); if (password instanceof HTMLInputElement) password.value=''; }
  }
  return <><PageHeading label="QUẢN TRỊ" title="Cấp tài khoản sinh viên" description="Giảng viên tạo tài khoản đăng nhập và liên kết với hồ sơ sinh viên có sẵn."/>
    <div className="columns"><section className="card"><h2>Thông tin tài khoản</h2><Alert message={error || students.error}/>
      {students.error && <button onClick={() => void students.refresh()}>Tải lại sinh viên</button>}
      {!students.loading && !students.error && !students.data.length && <p>Không có sinh viên chưa được cấp tài khoản. Thêm sinh viên mới trong mục Sinh viên nếu cần cấp tài khoản mới.</p>}
      <form onSubmit={submit}><fieldset disabled={busy || students.loading || !students.data.length}>
        <label>Sinh viên<select name="studentId" required defaultValue=""><option value="" disabled>Chọn sinh viên</option>{students.data.map(student => <option key={student.id} value={student.id}>{student.studentCode} · {student.fullName}</option>)}</select></label>
        <label>Tên đăng nhập<input name="username" required minLength={3} maxLength={50} pattern="[A-Za-z0-9_]{3,50}" autoComplete="off"/></label>
        <p className="hint">3–50 ký tự: chữ không dấu, số hoặc dấu gạch dưới (_). Ví dụ: bit230396. Tên đăng nhập phải chưa được sử dụng.</p>
        <PasswordInput minLength={8} maxLength={128} autoComplete="new-password"/>
        <button className="primary full" disabled={busy}>{busy ? 'Đang cấp tài khoản…' : 'Tạo tài khoản sinh viên'}</button>
      </fieldset></form>
      {created && <Alert success message={`Đã tạo ${created.username}, role sinh viên, liên kết sinh viên #${created.studentId}.`}/>}
    </section><section className="card"><h2>Luồng sử dụng</h2><p>1. Giảng viên tạo hồ sơ sinh viên.</p><p>2. Cấp tài khoản tại đây.</p><p>3. Đăng ký khuôn mặt và cấp lịch học.</p><p>4. Sinh viên đăng nhập để xem lịch và điểm danh.</p><p className="hint">Mỗi sinh viên chỉ có một tài khoản liên kết. Form này luôn cấp role student.</p></section></div>
  </>;
}
