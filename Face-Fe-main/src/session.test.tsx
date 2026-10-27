import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { configureAuth } from './api/client';

const key = 'faceattend.session';
const user = {id:1,username:'demo_teacher',fullName:'Demo',role:'teacher' as const};
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); localStorage.clear(); configureAuth(null); vi.unstubAllGlobals(); });
function Probe() {
  const auth = useAuth();
  return <><span>{auth.checking ? 'checking' : auth.session?.user.username || 'signed-out'}</span><button onClick={() => void auth.signIn({accessToken:'test-token',expiresIn:3600,tokenType:'Bearer',user})}>login</button><button onClick={auth.signOut}>logout</button></>;
}
const mount = () => render(<StrictMode><AuthProvider><Probe/></AuthProvider></StrictMode>);
it('persists login and restores a verified session without extending expiry', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify(user)));
  vi.stubGlobal('fetch',fetch);
  const first = mount();
  fireEvent.click(screen.getByText('login'));
  await screen.findByText('demo_teacher');
  const stored = localStorage.getItem(key)!;
  first.unmount();
  mount();
  await screen.findByText('demo_teacher');
  expect(localStorage.getItem(key)).toBe(stored);
  expect(fetch.mock.calls.length).toBeGreaterThan(1);
  fireEvent.click(screen.getByText('logout'));
  expect(localStorage.getItem(key)).toBeNull();
  expect(screen.getByText('signed-out')).toBeTruthy();
});
it('discards expired sessions without requesting the API', () => {
  localStorage.setItem(key,JSON.stringify({accessToken:'old',expiresAt:Date.now()-1000}));
  const fetch = vi.fn(); vi.stubGlobal('fetch',fetch);
  mount();
  expect(screen.getByText('signed-out')).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBeNull();
});
it('clears a stored session rejected by the backend', async () => {
  localStorage.setItem(key,JSON.stringify({accessToken:'invalid',expiresAt:Date.now()+60000}));
  vi.stubGlobal('fetch',vi.fn(async () => new Response('{}',{status:401})));
  mount();
  await waitFor(() => expect(screen.getByText('signed-out')).toBeTruthy());
  expect(localStorage.getItem(key)).toBeNull();
});
