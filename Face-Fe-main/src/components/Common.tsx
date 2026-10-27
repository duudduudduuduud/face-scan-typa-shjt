import { useCallback, useEffect, useState } from 'react';
export function Alert({ message, success = false }: { message: string; success?: boolean }) { return message ? <div className={`alert ${success ? 'success' : ''}`} role={success ? 'status' : 'alert'}>{message}</div> : null; }
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.'; }
export function useList<T>(loader: () => Promise<T[]>) {
  const [data, setData] = useState<T[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const refresh = useCallback(async () => { setLoading(true); setError(''); try { setData(await loader()); } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); } }, [loader]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}
export function ListState({ loading, error, empty }: { loading: boolean; error: string; empty: boolean }) { return loading ? <div className="empty" role="status">Đang tải dữ liệu…</div> : error ? <Alert message={error}/> : empty ? <div className="empty">Chưa có dữ liệu.</div> : null; }
export function PageHeading({ label, title, description }: { label: string; title: string; description: string }) { return <header className="page-heading"><span className="eyebrow">{label}</span><h1>{title}</h1><p>{description}</p></header>; }
export function formatTime(value: string) { return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)); }
export function vietnamISO(value: string) { return `${value.length === 16 ? `${value}:00` : value}+07:00`; }
export function vietnamNow() { const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date()); return parts.replace(' ', 'T'); }
