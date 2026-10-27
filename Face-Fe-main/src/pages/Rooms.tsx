import { useRef, useState, type FormEvent } from 'react';
import { createRoom, getRooms, updateRoom } from '../api';
import { Alert, errorMessage, ListState, PageHeading, useList } from '../components/Common';
import type { Room } from '../types';

export function Rooms() {
  const list = useList(getRooms);
  const [editing, setEditing] = useState<Room | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (lock.current) return;
    const form = e.currentTarget; const data = new FormData(form);
    const roomCode = String(data.get('roomCode')).trim(); const name = String(data.get('name')).trim();
    if (!roomCode || roomCode.length > 50 || !name || name.length > 200) {
      setError('Mã phòng bắt buộc, tối đa 50 ký tự; tên phòng bắt buộc, tối đa 200 ký tự.'); return;
    }
    lock.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      if (editing) await updateRoom(editing.id, { roomCode, name });
      else await createRoom({ roomCode, name });
      form.reset(); setEditing(null); setSuccess('Đã lưu phòng.'); await list.refresh();
    } catch (err) { setError(errorMessage(err)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    <PageHeading label="KHÔNG GIAN" title="Phòng" description="Danh sách các phòng được quản lý trong hệ thống."/>
    <div className="columns"><section className="card">
      <div className="card-heading"><h2>Danh sách phòng</h2><button onClick={() => void list.refresh()} disabled={list.loading}>↻ Làm mới</button></div>
      <ListState loading={list.loading} error={list.error} empty={!list.data.length}/>
      {!list.loading && !list.error && !!list.data.length && <div className="room-grid">{list.data.map(r => <article className="room" key={r.id}><span className="room-icon">▦</span><span className="code">{r.roomCode}</span><h3>{r.name}</h3><small className="muted">ID phòng: {r.id}</small><p><button disabled={busy} onClick={() => { setEditing(r); setError(''); setSuccess(''); }}>Sửa phòng</button></p></article>)}</div>}
    </section><section className="card">
      <h2>{editing ? 'Sửa phòng' : 'Thêm phòng'}</h2>
      <form key={editing?.id ?? 'new'} onSubmit={save}>
        <Alert message={error}/><Alert message={success} success/>
        <label>Mã phòng<input name="roomCode" defaultValue={editing?.roomCode} maxLength={50} required disabled={busy}/></label>
        <label>Tên phòng<input name="name" defaultValue={editing?.name} maxLength={200} required disabled={busy}/></label>
        <button className="primary full" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu phòng'}</button>
        {editing && <button type="button" disabled={busy} onClick={() => { setEditing(null); setError(''); }}>Hủy sửa</button>}
      </form>
    </section></div>
  </>;
}
