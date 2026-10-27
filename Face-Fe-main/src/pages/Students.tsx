import { useRef, useState, type FormEvent } from 'react';
import { createStudent, findStudent, getStudents, updateStudent } from '../api';
import { Alert, errorMessage, ListState, PageHeading, useList } from '../components/Common';
import type { Student } from '../types';

export function Students() {
  const list = useList(getStudents);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState<Student | null>(null);
  const [lookup, setLookup] = useState<Student | null>(null);
  const [finding, setFinding] = useState(false);
  const [findError, setFindError] = useState('');

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const studentCode = String(data.get('studentCode')).trim();
    const fullName = String(data.get('fullName')).trim();
    setSuccess('');
    if (!studentCode || studentCode.length > 50 || !fullName || fullName.length > 200) {
      setError('Mã sinh viên bắt buộc, tối đa 50 ký tự; họ tên bắt buộc, tối đa 200 ký tự.');
      return;
    }
    const duplicate = list.data.find(student => student.id !== editing?.id && student.studentCode.toLowerCase() === studentCode.toLowerCase());
    if (duplicate) {
      setError(`Mã ${studentCode} đã tồn tại (${duplicate.fullName}). Chọn Sửa trong danh sách để cập nhật hoặc nhập mã mới.`);
      return;
    }
    lock.current = true; setBusy(true); setError('');
    try {
      if (editing) await updateStudent(editing.id, { studentCode, fullName });
      else await createStudent({ studentCode, fullName });
      form.reset(); setEditing(null); setLookup(null);
      setSuccess('Đã lưu sinh viên.');
      await list.refresh();
    } catch (err) { setError(errorMessage(err)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (finding) return;
    const code = String(new FormData(e.currentTarget).get('code')).trim();
    if (!code) { setFindError('Vui lòng nhập mã sinh viên.'); return; }
    setFinding(true); setLookup(null); setFindError('');
    try { setLookup(await findStudent(code)); }
    catch (err) { setFindError(errorMessage(err)); }
    finally { setFinding(false); }
  }
  return <>
    <PageHeading label="HỒ SƠ SINH VIÊN" title="Sinh viên" description="Quản lý danh sách và tra cứu thông tin theo mã sinh viên."/>
    <Alert message={error}/><Alert message={success} success/>
    <div className="columns"><section className="card">
      <div className="card-heading"><h2>Danh sách sinh viên</h2><button onClick={() => void list.refresh()} disabled={list.loading}>↻ Làm mới</button></div>
      <form className="search" onSubmit={search}><input name="code" aria-label="Mã sinh viên cần tra cứu" placeholder="Nhập mã sinh viên…" maxLength={50} required/><button disabled={finding}>{finding ? 'Đang tìm…' : 'Tra cứu mã'}</button></form>
      <Alert message={findError}/>
      {lookup && <div className="lookup"><strong>{lookup.fullName}</strong><span>{lookup.studentCode} · ID {lookup.id}</span></div>}
      <ListState loading={list.loading} error={list.error} empty={!list.data.length}/>
      {!list.loading && !list.error && !!list.data.length && <div className="table-wrap"><table><thead><tr><th>Mã sinh viên</th><th>Họ và tên</th><th>Thao tác</th></tr></thead><tbody>{list.data.map(s => <tr key={s.id}><td><span className="code">{s.studentCode}</span></td><td>{s.fullName}</td><td><button disabled={busy} onClick={() => { setEditing(s); setError(''); setSuccess(''); }}>Sửa</button></td></tr>)}</tbody></table></div>}
    </section><section className="card">
      <h2>{editing ? 'Sửa sinh viên' : 'Thêm sinh viên'}</h2>
      <form key={editing?.id ?? 'new'} onSubmit={save}><fieldset disabled={busy}>
        <label>Mã sinh viên<input name="studentCode" defaultValue={editing?.studentCode} maxLength={50} required/></label>
        <label>Họ và tên<input name="fullName" defaultValue={editing?.fullName} maxLength={200} required/></label>
        <button className="primary full" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu sinh viên'}</button>
        {editing && <button type="button" onClick={() => { setEditing(null); setError(''); }}>Hủy sửa</button>}
      </fieldset></form>
    </section></div>
  </>;
}
