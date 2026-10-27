import { homeForRole } from '../auth/RoleGuards';
import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { login } from '../api';
import { useAuth } from '../auth/AuthProvider';
import { Alert, errorMessage } from '../components/Common';
import { PasswordInput } from '../components/PasswordInput';
import { AuthLayout } from '../components/AuthLayout';

export function Login() {
  const { session, checking, reason, signIn } = useAuth();
  const location = useLocation();
  const registered = location.state?.registered === true;
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  if (session) return <Navigate to={homeForRole(session.user.role)} replace/>;
  if (checking && !busy) return <div className="empty" role="status">Đang xác minh phiên đăng nhập…</div>;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (lock.current) return;
    const form = e.currentTarget; const data = new FormData(form);
    const username = String(data.get('username')).trim();
    if (!username) { setError('Vui lòng nhập tên đăng nhập.'); return; }
    lock.current = true; setBusy(true); setError('');
    try { await signIn(await login(username, String(data.get('password')))); form.reset(); }
    catch (err) { setError(errorMessage(err)); }
    finally {
      lock.current = false; setBusy(false);
      const password = form.elements.namedItem('password');
      if (password instanceof HTMLInputElement) password.value = '';
    }
  }
  return <AuthLayout><form onSubmit={submit}>
    <span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span><h2>Đăng nhập hệ thống</h2>
    <p>Sử dụng tài khoản của bạn để tiếp tục.</p>
    {registered && <Alert success message="Đăng ký thành công. Vui lòng đăng nhập."/>}
    <Alert message={error || reason}/>
    <label>Tên đăng nhập<input name="username" autoComplete="username" required autoFocus disabled={busy}/></label>
    <PasswordInput disabled={busy} autoComplete="current-password"/>
    <button className="primary full" disabled={busy}>{busy ? 'Đang xác minh tài khoản…' : 'Đăng nhập →'}</button>
    <p className="auth-link">Chưa có tài khoản? <Link to="/register">Đăng ký</Link></p>
    <small className="hint">Phiên đăng nhập được giữ khi tải lại trang, cho đến khi hết hạn hoặc bạn đăng xuất.</small>
  </form></AuthLayout>;
}
