# FaceID — frontend quản lý sinh viên và lịch sử ra vào

React + TypeScript + Vite. Giao diện tiếng Việt, responsive desktop/điện thoại. Hợp đồng đã đối chiếu trực tiếp với `README.md`, `authorization.md`, `ai-integration.md` tại `C:\Users\letua\FaceId-Sv-be`. Mọi tài khoản đăng nhập có cùng chức năng.

## Cài đặt và chạy

Yêu cầu Node.js 22.12+ (khuyến nghị Node 24), npm.

```powershell
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
```

Nếu đã có `.env`, chỉnh biến dưới đây thay vì ghi đè file. macOS/Linux dùng `npm` và `cp .env.example .env`.

```dotenv
VITE_BACKEND_URL=http://localhost:3000
```

FE chạy http://localhost:5173, BE mặc định http://localhost:3000, không có prefix `/api`. Biến cũ `VITE_API_BASE_URL` không còn được đọc. Đổi `.env` cần khởi động lại Vite. `VITE_*` công khai trong bundle: không đặt mật khẩu hoặc token trong các biến này.

BE phải cho phép CORS origin `http://localhost:5173`, header `Authorization`, `Content-Type`, method GET/POST/PATCH. Nếu lỗi cổng 5173 đang dùng, dừng phiên Vite cũ bằng Ctrl+C rồi chạy lại. `strictPort` giữ đúng cổng, không tự chuyển sang cổng khác.

## Đăng ký và phiên làm việc

- `/register`: POST `/auth/register`, chỉ gửi `{username,password,fullName}`. Username trim/chuyển chữ thường, dài 3–50 ký tự a–z/0–9/_; password 8–128 ký tự, không toàn khoảng trắng; fullName trim, bắt buộc, tối đa 200 ký tự. Mật khẩu giữ nguyên, không trim. 201 thành công chuyển sang `/login`, không tự đăng nhập; 409 trùng username hiển thị lỗi BE.
- `/login`: POST `/auth/login` nhận `{accessToken,tokenType,expiresIn,user}`. User chỉ có `{id,username,fullName}`. Gọi GET `/auth/me` với Bearer để xác minh tài khoản hiện tại trước khi mở trang dữ liệu.
- Token và thời điểm hết hạn được lưu trong localStorage để giữ phiên khi tải lại hoặc mở lại trang. Không lưu mật khẩu. Khi mở ứng dụng, xác minh token qua `/auth/me` trước khi hiển thị dữ liệu. Khôi phục phiên không kéo dài thời hạn: hết `expiresIn` (BE là 3600 giây) hoặc API bảo vệ trả 401 thì xóa phiên và yêu cầu đăng nhập lại. Không gọi refresh token. Đăng xuất xóa cả phiên đã lưu.
- Đăng xuất xóa token và thông tin tài khoản; các màn hình dữ liệu được unmount. Tất cả các trang dữ liệu được bảo vệ bằng trạng thái đăng nhập, kể cả truy cập URL trực tiếp.
- Mọi tài khoản có cùng menu và chức năng. Không còn role, quản trị tài khoản, khóa tài khoản, liên kết tài khoản–sinh viên hoặc phân công phòng. Không gọi `/admin/*`. Tài khoản cũ của BE dùng mật khẩu cũ; không còn cần admin cấp tài khoản.

## Các màn hình dữ liệu

- **Sinh viên:** GET `/students` trả mảng, tra mã bằng GET `/students/by-code?studentCode=...`, thêm POST `/students`, sửa PATCH `/students/:id`. Body tạo/sửa chỉ `{studentCode,fullName}`; PATCH có đủ hai trường. Không gửi roomIds. Mã tối đa 50, tên tối đa 200 ký tự.
- **Phòng:** GET `/rooms` trả mảng, thêm POST `/rooms`, sửa PATCH `/rooms/:id` với cả `{roomCode,name}`. Mã tối đa 50, tên tối đa 200 ký tự. ID số dùng cho sự kiện, không dùng roomCode làm roomId.
- **Lịch sử:** GET `/room-events` với studentId/roomId/direction/from/to/page/limit. Wrapper chính xác `{items,total,page,limit,totalPages}`. Có loading, rỗng, lỗi, làm mới và phân trang dựa vào metadata BE; limit 20/50/100. Ánh xạ tên từ danh sách BE, fallback ID nếu không tìm thấy. Không suy tổng dữ liệu từ độ dài trang, không có thống kê giả.
- **Ghi thủ công:** POST `/room-events` với `{studentId,roomId,direction,occurredAt?,source,eventKey}`. ID là JSON number/số nguyên dương, direction in/out, source luôn manual. Sinh viên và phòng được chọn từ API. Thời gian nhập là giờ Việt Nam, chuyển thành ISO có +07:00; nếu để trống, bỏ hẳn occurredAt để BE lấy giờ hiện tại, không gửi null.
- UUID tạo một lần khi xác nhận sự kiện; retry giữ nguyên toàn bộ payload/key, gồm cả thời gian hoặc việc bỏ thời gian. Khóa gửi đồng thời. 201 created và 200 duplicate đều thành công; lỗi mạng/5xx giữ payload để thử lại, không hiện nút tạo thao tác mới khi chưa biết kết quả. 400/404/409 hiển thị chi tiết BE để kiểm tra dữ liệu.

Thời gian hiển thị theo `Asia/Ho_Chi_Minh`. Lỗi NestJS `{message,error,statusCode}` được xử lý chung, message chuỗi/mảng được hiển thị; 400/401/404/409 và lỗi mạng có thông báo tiếng Việt. Mật khẩu ẩn mặc định, có nút hiện/ẩn.

## Phạm vi

AI Python chạy riêng, dùng tài khoản thông thường để gửi source camera; FE chỉ đọc lịch sử BE và ghi source manual. Không chụp ảnh, nhận diện hoặc điều khiển camera/Python trong trình duyệt. Không tính điểm danh theo buổi học. Không có nút/API xóa hoặc đổi mật khẩu vì BE chưa hỗ trợ. Không tự deploy.

## Kiểm tra và production build

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

Vitest/Testing Library kiểm tra đăng ký/validation/409, hiện/ẩn mật khẩu, login chờ `/auth/me`, Bearer, bảo vệ URL trực tiếp, logout/401, menu chung, không có trang quản trị, phân trang/filter ISO, giờ Việt Nam, DTO tạo/sửa và retry giữ nguyên payload/key (có/không có occurredAt), khóa gửi, created/duplicate và lỗi BE.

Tests dùng HTTP giả lập riêng; ứng dụng luôn gọi API thật, không có fallback dữ liệu giả. Chưa kiểm thử đăng nhập với tài khoản thực hoặc trình duyệt thực trên điện thoại. Không tạo tài khoản/dữ liệu thử trong BE đang dùng.

Output production ở `dist/`; hosting SPA cần fallback đường dẫn frontend về `index.html`. Font Google có fallback system khi offline.

## Cấu trúc

`src/api`: client/lỗi/endpoint; `src/types`: hợp đồng; `src/auth`: phiên và bảo vệ đăng nhập; `src/pages`: màn hình; `src/components`: layout, form, trạng thái và phân trang; `src/App.tsx`: routing; `src/integration.test.tsx`: kiểm thử.
