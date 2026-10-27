import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { App } from './App';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { configureAuth, request } from './api/client';
import { createStudent, updateStudent, updateRoom } from './api';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Events } from './pages/Events';
import { Manual } from './pages/Manual';
import { Layout } from './components/Layout';
import type { User } from './types';

// Fixtures chỉ dành cho tests. Ứng dụng không dùng dữ liệu hoặc tài khoản mẫu.
const user: User = { role: 'student', id: 1, username: 'test_only', fullName: 'Người kiểm thử' };
const student = { id: 7, studentCode: 'SV007', fullName: 'Sinh viên kiểm thử' };
const room = { id: 3, roomCode: 'R3', name: 'Phòng kiểm thử' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const credentials = { accessToken: 'test-only-token', tokenType: 'Bearer', expiresIn: 3600, user };
function HistoryGate() { const {session}=useAuth(); return session ? <Events/> : null; }
function SignIn() {
  const auth = useAuth();
  return <><button onClick={() => void auth.signIn(credentials)}>Test sign in</button><button onClick={auth.signOut}>Test sign out</button><span data-testid="account">{auth.session?.user.username ?? 'signed-out'}</span><span>{auth.reason}</span></>;
}
afterEach(() => { cleanup(); localStorage.clear(); configureAuth(null); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Đăng ký và đăng nhập đơn giản', () => {
  it('đăng ký gửi đúng ba trường, không Bearer; thành công chuyển sang login', async () => {
    configureAuth('test-only-token');
    const fetcher = vi.fn(async () => json(user, 201)); vi.stubGlobal('fetch', fetcher);
    render(<MemoryRouter initialEntries={['/register']}><AuthProvider><App/></AuthProvider></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'TEST_ONLY' } });
    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: ' Người kiểm thử ' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'test-only-password' } });
    const button = screen.getByRole('button', { name: 'Đăng ký tài khoản' });
    fireEvent.click(button);
    await screen.findByText('Đăng ký thành công. Vui lòng đăng nhập.');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/auth/register');
    expect(options.method).toBe('POST');
    expect(new Headers(options.headers).has('Authorization')).toBe(false);
    expect(JSON.parse(String(options.body))).toEqual({ username: 'test_only', password: 'test-only-password', fullName: 'Người kiểm thử' });
    expect(screen.getByRole('heading', { name: 'Đăng nhập hệ thống' })).toBeTruthy();
  });
  it.each([
    ['ab', 'test-only-password', 'Tên', 'Tên đăng nhập dài'],
    ['tên_user', 'test-only-password', 'Tên', 'Tên đăng nhập dài'],
    ['a'.repeat(51), 'test-only-password', 'Tên', 'Tên đăng nhập dài'],
    ['valid_user', 'short', 'Tên', 'Mật khẩu dài'],
    ['valid_user', ' '.repeat(8), 'Tên', 'Mật khẩu dài'],
    ['valid_user', 'p'.repeat(129), 'Tên', 'Mật khẩu dài'],
    ['valid_user', 'test-only-password', '   ', 'Họ và tên bắt buộc'],
    ['valid_user', 'test-only-password', 'a'.repeat(201), 'Họ và tên bắt buộc'],
  ])('validation đăng ký không gửi API: trường hợp %s', (username, password, fullName, error) => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch',fetcher);
    render(<MemoryRouter><AuthProvider><Register/></AuthProvider></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: username } });
    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: fullName } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: password } });
    fireEvent.submit(screen.getByRole('button', { name: 'Đăng ký tài khoản' }).closest('form')!);
    expect(screen.getByRole('alert').textContent).toContain(error); expect(fetcher).not.toHaveBeenCalled();
  });
  it('username trùng 409 giữ trang đăng ký, không báo thành công', async () => {
    vi.stubGlobal('fetch',vi.fn(async () => json({ message: 'Username already exists', error: 'Conflict', statusCode:409 },409)));
    render(<MemoryRouter initialEntries={['/register']}><AuthProvider><App/></AuthProvider></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'test_only' } });
    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Tên kiểm thử' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'test-only-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký tài khoản' }));
    await screen.findByText(/Username already exists/); expect(screen.queryByText('Đăng ký thành công. Vui lòng đăng nhập.')).toBeNull();
  });
  it('mật khẩu ẩn mặc định, cho phép hiện và ẩn', () => {
    render(<MemoryRouter><AuthProvider><Register/></AuthProvider></MemoryRouter>);
    const password = screen.getByLabelText('Mật khẩu') as HTMLInputElement;
    expect(password.type).toBe('password'); fireEvent.click(screen.getByText('Hiện')); expect(password.type).toBe('text');
    fireEvent.click(screen.getByText('Ẩn')); expect(password.type).toBe('password');
  });
  it('đăng nhập chờ /auth/me, chấp nhận user chỉ có ba trường', async () => {
    let resolveMe!: (value: Response) => void;
    const fetcher = vi.fn((url: string, options?: RequestInit) => { void options; return url.endsWith('/auth/login') ? Promise.resolve(json(credentials)) : new Promise<Response>(resolve => { resolveMe = resolve; }); });
    vi.stubGlobal('fetch',fetcher);
    render(<MemoryRouter initialEntries={['/login']}><AuthProvider><Routes><Route path="/login" element={<Login/>}/><Route path="/" element={<SignIn/>}/></Routes></AuthProvider></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'test_only' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'test-only-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập →' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Đang xác minh tài khoản…')).toBeTruthy();
    const [url, options] = fetcher.mock.calls[1];
    expect(url).toBe('http://localhost:3000/auth/me'); expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer test-only-token');
    resolveMe(json({ ...user, username:'me_current' }));
    await waitFor(() => expect(screen.getByTestId('account').textContent).toBe('me_current'));
  });
  it.each(['/students','/rooms','/events','/manual'])('URL %s yêu cầu đăng nhập, không tải dữ liệu trước xác thực', path => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    render(<MemoryRouter initialEntries={[path]}><AuthProvider><App/></AuthProvider></MemoryRouter>);
    expect(screen.getByRole('heading', { name:'Đăng nhập hệ thống' })).toBeTruthy(); expect(fetcher).not.toHaveBeenCalled();
  });
  it('mọi tài khoản có cùng menu; logout xóa phiên và Bearer', async () => {
    vi.stubGlobal('fetch',vi.fn(async () => json(user)));
    function Content() { return useAuth().session ? <Layout/> : null; }
    render(<MemoryRouter><AuthProvider><SignIn/><Content/></AuthProvider></MemoryRouter>);
    fireEvent.click(screen.getByText('Test sign in')); await screen.findByRole('link', { name: /Trang chủ/ });
    expect(screen.queryByRole('link', { name: /Phòng/ })).toBeNull(); expect(screen.queryByRole('link', { name: /Ghi sự kiện/ })).toBeNull();
    expect(screen.queryByRole('link', { name:/Tài khoản/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' })); expect(screen.getByTestId('account').textContent).toBe('signed-out');
    const fetcher = vi.fn(async () => json([])); vi.stubGlobal('fetch', fetcher); await request('/students');
    const options = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]; expect(new Headers(options.headers).has('Authorization')).toBe(false);
  });
  it('401 xóa phiên và yêu cầu đăng nhập lại', async () => {
    vi.stubGlobal('fetch',vi.fn(async () => json(user)));
    render(<AuthProvider><SignIn/></AuthProvider>); fireEvent.click(screen.getByText('Test sign in'));
    await waitFor(() => expect(screen.getByTestId('account').textContent).toBe('test_only'));
    vi.stubGlobal('fetch',vi.fn(async () => json({ message:'Invalid or expired token',statusCode:401,error:'Unauthorized' },401)));
    await expect(request('/students')).rejects.toThrow('đăng nhập lại');
    await waitFor(() => expect(screen.getByTestId('account').textContent).toBe('signed-out'));
    expect(screen.getByText('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')).toBeTruthy();
  });
  it('login sai 401 hiển thị lỗi, không gọi /auth/me hoặc mở trang dữ liệu', async () => {
    const fetcher = vi.fn(async () => json({ message:'Invalid credentials',error:'Unauthorized',statusCode:401 },401)); vi.stubGlobal('fetch',fetcher);
    render(<MemoryRouter initialEntries={['/login']}><AuthProvider><App/></AuthProvider></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target:{ value:'test_only' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target:{ value:'test-only-password' } });
    fireEvent.click(screen.getByRole('button', { name:'Đăng nhập →' }));
    await screen.findByText(/Tên đăng nhập hoặc mật khẩu không đúng/);
    expect(fetcher).toHaveBeenCalledTimes(1); expect(screen.queryByRole('navigation')).toBeNull();
  });
  it('đường dẫn quản trị cũ trả 404, không gọi API', () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch',fetcher);
    render(<MemoryRouter initialEntries={['/users']}><AuthProvider><App/></AuthProvider></MemoryRouter>);
    expect(screen.getByText('404')).toBeTruthy(); expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('Dữ liệu và ghi sự kiện', () => {
  it('sinh viên chỉ yêu cầu lịch sử của mình và không có bộ lọc sinh viên', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/me')) return json({...user,studentId:7});
      if (url.endsWith('/students')) return json([student]);
      if (url.endsWith('/rooms')) return json([room]);
      return json({items:[{id:1,studentId:7,roomId:3,direction:'in',occurredAt:'2026-10-12T01:00:00.000Z',source:'camera'}],total:1,page:1,limit:20,totalPages:1});
    });
    vi.stubGlobal('fetch',fetcher);
    localStorage.setItem('faceattend.session',JSON.stringify({accessToken:'test',expiresAt:Date.now()+60000}));
    render(<AuthProvider><HistoryGate/></AuthProvider>);
    await screen.findByText('Camera');
    expect(screen.queryByLabelText('Sinh viên')).toBeNull();
    expect(screen.queryByText('Tất cả sinh viên')).toBeNull();
    const history = fetcher.mock.calls.find(([url])=>url.includes('/room-events'))![0];
    expect(new URL(history).searchParams.get('studentId')).toBe('7');
    expect(screen.queryByText('Bộ lọc sự kiện')).toBeNull();
    expect(screen.queryByText('Áp dụng bộ lọc')).toBeNull();
    fireEvent.click(screen.getByText('↻ Làm mới'));
    await waitFor(()=>expect(fetcher.mock.calls.filter(([url])=>url.includes('/room-events'))).toHaveLength(2));
    expect(new URL(fetcher.mock.calls.at(-1)![0]).searchParams.get('studentId')).toBe('7');
  });
  it('lịch sử phân trang theo metadata dù trang rỗng; lọc ISO +07:00', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/me')) return json({...user,role:'teacher'});
      if (url.endsWith('/students')) return json([student]); if (url.endsWith('/rooms')) return json([room]);
      const query = new URL(url).searchParams;
      return json({ items:[], total:61, page:Number(query.get('page')),limit:Number(query.get('limit')),totalPages:4 });
    }); vi.stubGlobal('fetch',fetcher);
    localStorage.setItem('faceattend.session', JSON.stringify({accessToken:'test',expiresAt:Date.now()+60000})); render(<AuthProvider><HistoryGate/></AuthProvider>);
    await screen.findByText('Tổng 61 · Trang 1 / 4'); fireEvent.click(screen.getByText('Sau →'));
    await screen.findByText('Tổng 61 · Trang 2 / 4');
    fireEvent.change(screen.getByLabelText('Sinh viên'), { target:{ value:'7' } });
    fireEvent.change(screen.getByLabelText('Từ (UTC+07:00)'), { target:{ value:'2026-10-12T08:00' } });
    fireEvent.click(screen.getByText('Áp dụng bộ lọc'));
    await screen.findByText('Tổng 61 · Trang 1 / 4');
    const query = new URL(fetcher.mock.calls.at(-1)![0]).searchParams;
    expect(query.get('studentId')).toBe('7'); expect(query.get('from')).toBe('2026-10-12T08:00:00+07:00'); expect(query.get('page')).toBe('1');
  });
  it('hiển thị tên sinh viên/phòng và giờ Việt Nam từ API', async () => {
    vi.stubGlobal('fetch',vi.fn(async (url:string) => url.endsWith('/auth/me') ? json({...user,role:'teacher'}) : url.endsWith('/students') ? json([student]) : url.endsWith('/rooms') ? json([room]) : json({ items:[{ id:1, studentId:7,roomId:3,direction:'in',occurredAt:'2026-10-12T01:00:00.000Z',source:'camera',eventKey:'test-key' }],total:1,page:1,limit:20,totalPages:1 })));
    localStorage.setItem('faceattend.session', JSON.stringify({accessToken:'test',expiresAt:Date.now()+60000})); render(<AuthProvider><HistoryGate/></AuthProvider>); await screen.findByText('Camera'); expect(screen.getByText('Sinh viên kiểm thử')).toBeTruthy(); expect(screen.getByText('Phòng kiểm thử')).toBeTruthy(); expect(screen.getByText(/08:00:00/)).toBeTruthy();
  });
  it('POST sinh viên và PATCH sinh viên/phòng chỉ gửi hai trường', async () => {
    const fetcher = vi.fn(async () => json({})); vi.stubGlobal('fetch',fetcher);
    await createStudent({ studentCode:'SV007',fullName:'Sinh viên kiểm thử' });
    await updateStudent(7,{ studentCode:'SV007',fullName:'Tên cập nhật' }); await updateRoom(3,{ roomCode:'R3',name:'Tên phòng cập nhật' });
    const calls = fetcher.mock.calls as unknown as [string,RequestInit][];
    expect(calls.map(([url]) => new URL(url).pathname)).toEqual(['/students','/students/7','/rooms/3']);
    expect(calls.map(([,options]) => options.method)).toEqual(['POST','PATCH','PATCH']);
    expect(Object.keys(JSON.parse(String(calls[0][1].body))).sort()).toEqual(['fullName','studentCode']);
    expect(Object.keys(JSON.parse(String(calls[1][1].body))).sort()).toEqual(['fullName','studentCode']);
    expect(Object.keys(JSON.parse(String(calls[2][1].body))).sort()).toEqual(['name','roomCode']);
  });
  it.each([true,false])('retry giữ nguyên payload/key, occurredAt có gửi: %s', async withTime => {
    const bodies:string[] = []; let finish!: (response:Response) => void;
    vi.stubGlobal('fetch',vi.fn(async (url:string,options?:RequestInit) => {
      if (url.endsWith('/students')) return json([student]); if (url.endsWith('/rooms')) return json([room]);
      bodies.push(String(options?.body)); if (bodies.length === 1) throw new TypeError('offline');
      return new Promise<Response>(resolve => { finish = resolve; });
    }));
    render(<Manual/>); await screen.findByText('SV007 · Sinh viên kiểm thử');
    fireEvent.change(screen.getByLabelText('Sinh viên'), { target:{ value:'7' } }); fireEvent.change(screen.getByLabelText('Phòng'), { target:{ value:'3' } });
    if (withTime) fireEvent.change(screen.getByLabelText('Thời gian (Việt Nam, UTC+07:00)'), { target:{ value:'2026-10-12T08:00' } });
    fireEvent.click(screen.getByText('Ghi nhận sự kiện')); await screen.findByText('Thử lại cùng sự kiện');
    expect(screen.queryByText('Hủy thao tác để sửa')).toBeNull(); fireEvent.click(screen.getByText('Thử lại cùng sự kiện'));
    await waitFor(() => expect(bodies).toHaveLength(2)); expect(bodies[1]).toBe(bodies[0]);
    const body = JSON.parse(bodies[0]); expect(body.studentId).toBe(7); expect(body.roomId).toBe(3); expect(body.source).toBe('manual'); expect(body.eventKey).toMatch(/^[0-9a-f-]{36}$/);
    if (withTime) { expect(body.occurredAt).toBe('2026-10-12T08:00:00+07:00'); expect(Object.keys(body)).toHaveLength(6); }
    else { expect('occurredAt' in body).toBe(false); expect(Object.keys(body)).toHaveLength(5); }
    const retry = screen.getByText('Đang xử lý…') as HTMLButtonElement; expect(retry.disabled).toBe(true); fireEvent.click(retry); expect(bodies).toHaveLength(2);
    finish(json({ event:{ ...body,id:1,occurredAt:'2026-10-12T01:00:00.000Z' },duplicate:true })); await screen.findByText(/Sự kiện đã tồn tại/);
  });
  it('201 created báo thành công sau phản hồi BE', async () => {
    vi.stubGlobal('fetch',vi.fn(async (url:string,options?:RequestInit) => url.endsWith('/students') ? json([student]) : url.endsWith('/rooms') ? json([room]) : json({ event:{ ...JSON.parse(String(options?.body)),id:1,occurredAt:'2026-10-12T01:00:00.000Z' },duplicate:false },201)));
    render(<Manual/>); await screen.findByText('SV007 · Sinh viên kiểm thử'); fireEvent.change(screen.getByLabelText('Sinh viên'),{ target:{ value:'7' } }); fireEvent.change(screen.getByLabelText('Phòng'),{ target:{ value:'3' } }); fireEvent.click(screen.getByText('Ghi nhận sự kiện'));
    await screen.findByText(/Đã ghi nhận sự kiện\./);
  });
  it.each([400,404,409,500])('lỗi BE %s hiển thị message chuỗi/mảng', async status => {
    vi.stubGlobal('fetch',vi.fn(async () => json({ message:['Chi tiết một','Chi tiết hai'],error:'Error',statusCode:status },status)));
    await expect(request('/students')).rejects.toThrow('Chi tiết một · Chi tiết hai');
  });
});
