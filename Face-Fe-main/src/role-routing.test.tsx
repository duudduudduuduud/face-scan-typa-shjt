import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { App } from './App';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { configureAuth } from './api/client';
import type { Role } from './types';
afterEach(() => { cleanup(); localStorage.clear(); configureAuth(null); vi.unstubAllGlobals(); });
function SignIn({ role }: { role: Role }) {
  const { signIn } = useAuth(); const location = useLocation();
  return <><button onClick={() => void signIn({accessToken:'test-token',tokenType:'Bearer',expiresIn:3600,user:{id:1,username:'test',fullName:'Test User',role}})}>Sign in test</button><span data-testid="route">{location.pathname}</span></>;
}
it.each([
  ['teacher','/login','/admin'],
  ['admin','/login','/admin'],
  ['student','/login','/'],
  ['student','/admin','/'],
  ['teacher','/schedule','/admin'],
] as const)('routes %s from %s to %s', async (role, initial, expected) => {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const path=String(input);
    const body=path.endsWith('/auth/me') ? {id:1,username:'test',fullName:'Test User',role} : path.includes('/room-events') ? {items:[],total:0,page:1,limit:5,totalPages:0} : [];
    return new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
  }));
  render(<MemoryRouter initialEntries={[initial]}><AuthProvider><SignIn role={role}/><App/></AuthProvider></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Sign in test'}));
  const heading=await screen.findByRole('heading',{level:1,name:role==='student' ? /Chào/ : 'Trang quản trị'});
  expect(heading).toBeTruthy();
  expect(screen.getByTestId('route').textContent).toBe(expected);
  if(role==='student') expect(screen.queryByRole('link',{name:'Camera trực tuyến'})).toBeNull();
  else expect(screen.getByRole('link',{name:'Camera trực tuyến'}).getAttribute('href')).toBe('/admin/camera');
});
