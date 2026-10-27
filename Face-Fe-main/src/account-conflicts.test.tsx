import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Students } from './pages/Students';
import { StudentAccounts } from './pages/StudentAccounts';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const student = {id: 1, studentCode: 'DEMO001', fullName: 'Sinh viên Demo'};
const json = (body: unknown) => new Response(JSON.stringify(body), {headers: {'Content-Type': 'application/json'}});

it('blocks duplicate student codes before sending a create request', async () => {
  const fetch = vi.fn(async () => json([student]));
  vi.stubGlobal('fetch', fetch);
  render(<Students/>);
  await screen.findByText('Sinh viên Demo');
  fireEvent.change(screen.getByLabelText('Mã sinh viên'), {target: {value: 'demo001'}});
  fireEvent.change(screen.getByLabelText('Họ và tên'), {target: {value: 'Tên khác'}});
  fireEvent.click(screen.getByRole('button', {name: 'Lưu sinh viên'}));
  expect(screen.getByRole('alert').textContent).toContain('đã tồn tại');
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('refreshes eligible students after creating an account', async () => {
  let saved = false;
  const fetch = vi.fn(async (_url: unknown, options?: RequestInit) => {
    if (options?.method === 'POST') { saved = true; return json({id: 2, username: 'demo_sv01', studentId: 1}); }
    return json(saved ? [] : [student]);
  });
  vi.stubGlobal('fetch', fetch);
  render(<StudentAccounts/>);
  await screen.findByRole('option', {name: /DEMO001/});
  fireEvent.change(screen.getByLabelText('Sinh viên'), {target: {value: '1'}});
  fireEvent.change(screen.getByLabelText('Tên đăng nhập'), {target: {value: 'demo_sv01'}});
  const form = screen.getByRole('button', {name: 'Tạo tài khoản sinh viên'}).closest('form')!;
  fireEvent.change(form.querySelector('input[name="password"]')!, {target: {value: 'DemoTest@123'}});
  fireEvent.submit(form);
  await waitFor(() => expect(screen.queryByRole('option', {name: /DEMO001/})).toBeNull());
  expect(screen.getByText(/Không có sinh viên chưa được cấp tài khoản/)).toBeTruthy();
  expect(fetch.mock.calls[0][0]).toContain('/auth/student-accounts/available-students');
});
