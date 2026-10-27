import type { ReactNode } from 'react';

export function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="login-page"><section className="login-story">
    <div className="brand">◉ SV Face</div>
    <span className="eyebrow">KẾT NỐI · NHẬN DIỆN · QUẢN LÝ</span>
    <h1>Mỗi lượt ra vào.<br/>Một thông tin rõ ràng.</h1>
    <p>Không gian quản lý sinh viên, phòng và sự kiện ra vào trong một hệ thống.</p>
    <div className="face-art" aria-hidden="true"><div>◉</div><span>NHẬN DIỆN SINH VIÊN</span></div>
    <small>Dữ liệu tập trung từ máy chủ · Thời gian Việt Nam</small>
  </section><section className="login-panel">{children}</section></div>;
}
