import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { configureAuth } from '../api/client';
import { getMe } from '../api';
import type { LoginResponse, User } from '../types';

type Session = { user: User; expiresAt: number };
const storageKey = 'faceattend.session';
type StoredSession = { accessToken: string; expiresAt: number };
function readSession(): StoredSession | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null') as StoredSession | null;
    if (value && typeof value.accessToken === 'string' && value.accessToken && Number.isFinite(value.expiresAt) && value.expiresAt > Date.now()) return value;
    localStorage.removeItem(storageKey);
  } catch { /* Storage may be unavailable or contain invalid data. */ }
  return null;
}
const Context = createContext<{
  session: Session | null;
  checking: boolean;
  reason: string;
  signIn: (data: LoginResponse) => Promise<void>;
  signOut: () => void;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(() => !!readSession());
  const [reason, setReason] = useState('');
  const generation = useRef(0);
  const clear = useCallback((message = '') => {
    generation.current++;
    try { localStorage.removeItem(storageKey); } catch { /* Keep sign-out available without storage. */ }
    configureAuth(null);
    setSession(null);
    setChecking(false);
    setReason(message);
  }, []);
  const expire = useCallback(() => clear('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'), [clear]);

  const verifySession = useCallback(async (accessToken: string, expiresAt: number) => {
    const version = ++generation.current;
    configureAuth(accessToken, expire);
    setChecking(true);
    setReason('');
    try {
      const user = await getMe();
      if (!['admin','teacher','student','ai_service'].includes(user.role)) throw new Error('Invalid account role. Restart backend and sign in again.');
      if (version !== generation.current) return;
      if (Date.now() >= expiresAt) throw new Error('Phiên đã hết hạn. Vui lòng đăng nhập lại.');
      try { localStorage.setItem(storageKey, JSON.stringify({ accessToken, expiresAt })); } catch { /* Current session still works without persistence. */ }
      setSession({ user, expiresAt });
    } catch (error) {
      if (version === generation.current) clear();
      throw error;
    } finally {
      if (version === generation.current) setChecking(false);
    }
  }, [clear, expire]);
  async function signIn(data: LoginResponse) {
    await verifySession(data.accessToken, Date.now() + data.expiresIn * 1000);
  }
  useEffect(() => {
    const stored = readSession();
    if (stored) void verifySession(stored.accessToken, stored.expiresAt).catch(error => {
      setReason(error instanceof Error ? error.message : 'Không thể khôi phục phiên đăng nhập.');
    });
    else setChecking(false);
    return () => { generation.current++; };
  }, [verifySession]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey && !event.newValue) clear();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [clear]);
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(expire, Math.max(0, session.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [session, expire]);

  return <Context.Provider value={{ session, checking, reason, signIn, signOut: () => clear() }}>{children}</Context.Provider>;
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('Thiếu AuthProvider');
  return value;
}
