const base = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
let token: string | null = null;
let unauthorized: (() => void) | undefined;
export function configureAuth(value: string | null, callback?: () => void) { token = value; unauthorized = callback; }
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
const messages: Record<number, string> = { 403: 'Your account cannot access this operation.', 400: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.', 401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 404: 'Không tìm thấy dữ liệu yêu cầu.', 409: 'Dữ liệu bị trùng hoặc xung đột.' };
export async function request<T>(path: string, options: RequestInit = {}, protectedApi = true): Promise<T> {
  const requestToken = token;
  let response: Response;
  try { response = await fetch(`${base}${path}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(protectedApi && token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } }); }
  catch { throw new ApiError(0, 'Không kết nối được máy chủ. Kiểm tra mạng, địa chỉ BE và cấu hình CORS.'); }
  if (response.status === 401 && protectedApi && requestToken === token) unauthorized?.();
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    let detail = '';
    if (body && typeof body === 'object' && 'message' in body) { const message = body.message; detail = typeof message === 'string' ? message : Array.isArray(message) ? message.filter(v => typeof v === 'string').join(' · ') : ''; }
    const message = response.status === 401 && !protectedApi && path === '/auth/login'
      ? 'Tên đăng nhập hoặc mật khẩu không đúng.'
      : messages[response.status] || 'Máy chủ không thể xử lý yêu cầu.';
    const translated: Record<string, string> = {
      'studentCode already exists': 'Mã sinh viên đã tồn tại. Chọn Sửa để cập nhật hoặc nhập mã mới.',
      'Student already has an account': 'Sinh viên đã được cấp tài khoản. Hãy sử dụng tài khoản hiện có.',
      'Username or student account already exists': 'Tên đăng nhập đã tồn tại hoặc sinh viên đã có tài khoản.',
    };
    throw new ApiError(response.status, translated[detail] || `${message}${detail ? ` ${detail}` : ''}`);
  }
  return body as T;
}
export const post = <T>(path: string, body: unknown, protectedApi = true) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }, protectedApi);
