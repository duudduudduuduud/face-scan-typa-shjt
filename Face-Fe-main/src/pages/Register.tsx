import { homeForRole } from '../auth/RoleGuards';
import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { register } from '../api';
import { useAuth } from '../auth/AuthProvider';
import { Alert, errorMessage } from '../components/Common';
import { PasswordInput } from '../components/PasswordInput';
import { AuthLayout } from '../components/AuthLayout';

export function Register() {
  const { session } = useAuth(); const navigate = useNavigate();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  if (session) return <Navigate to={homeForRole(session.user.role)} replace/>;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (lock.current) return;
    const form = e.currentTarget; const data = new FormData(form);
    const username = String(data.get('username')).trim().toLowerCase();
    const password = String(data.get('password')); const fullName = String(data.get('fullName')).trim();
    if (!/^[a-z0-9_]{3,50}$/.test(username)) {
      setError('Tên đăng nhập dài 3–50 ký tự, chỉ dùng chữ cái a–z, số và dấu gạch dưới.'); return;
    }
    if (password.length < 8 || password.length > 128 || !password.trim()) {
      setError('Mật khẩu dài 8–128 ký tự và không được toàn khoảng trắng.'); return;
    }
    if (!fullName || fullName.length > 200) { setError('Họ và tên bắt buộc, tối đa 200 ký tự.'); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      await register({ username, password, fullName });
      form.reset();
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (err) { setError(errorMessage(err)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <AuthLayout><form onSubmit={submit}>
    <span className="eyebrow">BẮT ĐẦU CÙNG SV FACE</span><h2>Đăng ký tài khoản</h2>
    <p>Đăng ký tài khoản giảng viên. Sinh viên nhận tài khoản do giảng viên cấp.</p><Alert message={error}/>
    <label>Tên đăng nhập<input name="username" autoComplete="username" minLength={3} maxLength={50} pattern="[A-Za-z0-9_]{3,50}" required autoFocus disabled={busy} aria-describedby="username-hint"/></label>
    <small id="username-hint" className="hint">3–50 ký tự a–z, số hoặc dấu gạch dưới; được chuyển thành chữ thường.</small>
    <label>Họ và tên<input name="fullName" autoComplete="name" maxLength={200} required disabled={busy}/></label>
    <PasswordInput disabled={busy} minLength={8} maxLength={128}/>
    <small className="hint">8–128 ký tự, không toàn khoảng trắng.</small>
    <button className="primary full" disabled={busy}>{busy ? 'Đang tạo tài khoản…' : 'Đăng ký tài khoản'}</button>
    <p className="auth-link">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
  </form></AuthLayout>;
}
