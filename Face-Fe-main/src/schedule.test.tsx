import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Schedule } from './pages/Schedule';

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
const lesson = { id: 12, subjectCode: 'IT101', subjectName: 'Test Course', teacherName: 'Test Teacher', roomId: 1, roomCode: 'LAB01', startsAt: new Date().toISOString(), endsAt: new Date(Date.now()+3600000).toISOString(), status: 'pending', canAttend: true, attendedAt: null };
const schedule = { student: { studentId: 1, studentCode: 'SV001', fullName: 'Test Student' }, items: [lesson] };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('Schedule calendar and camera', () => {
  it('marks real lesson days green and renders selected lesson details', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(schedule)));
    render(<MemoryRouter><Schedule/></MemoryRouter>);
    expect(await screen.findByText('Test Course')).toBeTruthy();
    const day = screen.getByRole('button', { name: /có lịch học/ });
    expect(day.className).toContain('has-class');
    expect(screen.getByText('Test Teacher')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Điểm danh' }).hasAttribute('disabled')).toBe(false);
  });
  it('rejects wrong face in the modal and stops the webcam on close', async () => {
    const stop = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })) } });
    if (!HTMLDialogElement.prototype.showModal) HTMLDialogElement.prototype.showModal = () => {};
    vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.setAttribute('open', ''); });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(960);
    vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(720);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AAAA');
    const fetcher = vi.fn(async (url: string | URL | Request) => json(String(url).includes('/camera/recognize') ? { student: { id: 2 }, ticket: 'test-ticket' } : schedule));
    vi.stubGlobal('fetch', fetcher);
    render(<MemoryRouter><Schedule/></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Điểm danh' }));
    await screen.findByText('Camera sẵn sàng');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận điểm danh' }));
    expect(await screen.findByText(/Khuôn mặt không khớp/)).toBeTruthy();
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/attendance'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng điểm danh' }));
    await waitFor(() => expect(stop).toHaveBeenCalled());
  });
});
