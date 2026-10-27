import { useCallback, useEffect, useRef, useState } from 'react';
import { post, request } from '../api/client';
import { Alert, errorMessage, formatTime, PageHeading } from '../components/Common';
import '../training.css';

interface Version {
  id: string; createdAt: string; algorithm: string; classes: string[]; trainCount: number; testCount: number;
  accuracy: number; precision: number; recall: number; f1: number; stale: boolean;
  confusionLabels: string[]; confusionMatrix: number[][];
  rejected: {file: string; reason: string}[];
}
interface TrainingData {
  dataset: {studentCode: string; images: number; sessions: number}[];
  versions: Version[]; activeId: string | null;
  job: {id: string; state: string; progress: number; message: string} | null;
}
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
export function Training() {
  const [data, setData] = useState<TrainingData | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(''); const alive = useRef(true); const lock = useRef(false);
  const refresh = useCallback(async () => {
    try { const result = await request<TrainingData>('/ai-training'); if (alive.current) { setData(result); setError(''); } }
    catch (e) { if (alive.current) setError(errorMessage(e)); }
  }, []);
  useEffect(() => { alive.current = true; void refresh(); const timer = window.setInterval(() => void refresh(), 3000); return () => { alive.current = false; window.clearInterval(timer); }; }, [refresh]);
  async function action(path: string, body: unknown) {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await post(`/ai-training/${path}`, body); await refresh(); }
    catch (e) { if (alive.current) setError(errorMessage(e)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const running = data?.job?.state === 'running';
  const ready = !!data && data.dataset.length >= 2 && data.dataset.every(row => row.sessions >= 2 && row.images >= 10);
  const version = data?.versions.find(row => row.id === selected) || data?.versions[0];
  return <div className="training-page">
    <PageHeading label="TRÍ TUỆ NHÂN TẠO" title="Huấn luyện AI" description="Huấn luyện bộ phân loại SVM từ đặc trưng khuôn mặt SFace và đánh giá trên lần chụp độc lập."/>
    <Alert message={error}/>
    <div className="columns">
      <section className="card"><h2>Dữ liệu khuôn mặt</h2>{!data ? <p>Đang kết nối dịch vụ AI…</p> : !data.dataset.length ? <p>Chưa có ảnh đăng ký.</p> : <div className="training-scroll"><table><thead><tr><th>Sinh viên</th><th>Ảnh</th><th>Lần chụp</th></tr></thead><tbody>{data.dataset.map(row => <tr key={row.studentCode}><td>{row.studentCode}</td><td>{row.images}</td><td>{row.sessions}</td></tr>)}</tbody></table></div>}
      <p className="hint">Ảnh lỗi, ảnh trùng và ảnh có nhiều khuôn mặt sẽ bị loại khi huấn luyện. Số ảnh trong bảng là số ảnh đầu vào.</p></section>
      <section className="card"><h2>Huấn luyện mô hình</h2><p>Linear SVM · C = 1 · cân bằng lớp · ngưỡng cosine 0.45</p><button className="primary" disabled={busy || running || !ready} onClick={() => void action('jobs', {})}>{running ? 'Đang huấn luyện…' : 'Bắt đầu huấn luyện'}</button>{!ready && <p>Cần ít nhất 2 sinh viên, mỗi người 10 ảnh từ 2 lần chụp.</p>}
      {data?.job && <div className="training-progress"><progress max={100} value={data.job.progress}/><p>{data.job.progress}% · {data.job.message}</p>{data.job.state === 'failed' && <Alert message={`Huấn luyện thất bại: ${data.job.message}`}/>}</div>}
      <p>Nhận diện hiện tại: <strong>{data?.activeId ? `SVM ${data.activeId.slice(0, 8)}` : 'So khớp đặc trưng khuôn mặt'}</strong></p>
      {data?.activeId && <button disabled={busy || running} onClick={() => void action('activate', {version: null})}>Quay về so khớp đặc trưng</button>}</section>
    </div>
    <section className="card"><div className="training-version"><h2>Phiên bản và kết quả đánh giá</h2><button disabled={busy} onClick={() => void refresh()}>Làm mới</button></div>
    {!version ? <p>Chưa có phiên bản đã huấn luyện. Kết quả sẽ xuất hiện sau khi huấn luyện thành công.</p> : <>
      <label>Phiên bản<select value={version.id} onChange={event => setSelected(event.target.value)}>{data?.versions.map(row => <option key={row.id} value={row.id}>{formatTime(row.createdAt)} · {row.id.slice(0, 8)}{data.activeId === row.id ? ' · Đang áp dụng' : ''}</option>)}</select></label>
      <div className="training-metrics">{[['Accuracy',version.accuracy],['Precision (macro)',version.precision],['Recall (macro)',version.recall],['F1 (macro)',version.f1]].map(([label,value]) => <div key={String(label)}><span>{label}</span><strong>{percent(Number(value))}</strong></div>)}</div>
      <p>{version.algorithm} · {version.classes.length} sinh viên · {version.trainCount} ảnh train · {version.testCount} ảnh test</p>
      {version.stale && <Alert message="Dữ liệu khuôn mặt đã thay đổi. Hãy huấn luyện phiên bản mới trước khi áp dụng."/>}
      <button className="primary" disabled={busy || running || version.stale || data?.activeId === version.id} onClick={() => void action('activate', {version: version.id})}>{data?.activeId === version.id ? 'Đang áp dụng' : 'Áp dụng vào điểm danh'}</button>
      <h3>Ma trận nhầm lẫn</h3><p className="hint">Hàng: nhãn thật. Cột: kết quả nhận diện. “unknown”: không đạt ngưỡng so khớp.</p>
      <div className="training-scroll"><table><thead><tr><th>Thật / Dự đoán</th>{version.confusionLabels.map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{version.confusionMatrix.map((row,index) => <tr key={version.confusionLabels[index]}><th>{version.confusionLabels[index]}</th>{row.map((value,column) => <td key={column} className={index === column ? 'training-diagonal' : ''}>{value}</td>)}</tr>)}</tbody></table></div>
      {!!version.rejected.length && <details><summary>{version.rejected.length} ảnh bị loại</summary><ul>{version.rejected.map(row => <li key={row.file}>{row.file}: {row.reason}</li>)}</ul></details>}
    </>}
    </section>
  </div>;
}
