# Backend FaceID NestJS

Backend cho đề tài AI nhận diện khuôn mặt: quản lý sinh viên, phòng và lịch sử vào/ra. AI Python chạy ở service riêng rồi gửi sự kiện về backend; backend không chạy mô hình hoặc lưu embedding.

## Chạy backend

Yêu cầu Node.js 24+, npm. Sao chép cấu hình mẫu từ `.env.example` nếu chưa có `.env`, điền thông tin MySQL hoặc SQLite và JWT_SECRET tối thiểu 32 byte. Không ghi đè `.env` hiện tại hoặc commit mật khẩu thật.

```powershell
npm.cmd ci
npm.cmd run start:dev
```

Base URL mặc định `http://localhost:3000`, không có prefix `/api`; cổng lấy từ PORT. Swagger `/docs`, OpenAPI `/docs-json`. CORS cho React tại `http://localhost:5173`, hỗ trợ GET/POST/PATCH/PUT/OPTIONS và Authorization/Content-Type. Python gọi HTTP trực tiếp không chịu CORS trình duyệt.

MySQL: DB_TYPE=mysql, DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE; yêu cầu MySQL 8.0.16+. Backend tạo database/bảng gốc còn thiếu, không xóa dữ liệu. Sai kết nối hoặc thiếu quyền khiến khởi động thất bại, không chuyển ngầm SQLite. SQLite: DB_TYPE=sqlite, DATABASE_PATH tùy chọn, mặc định `data/attendance.sqlite`. File có sẵn giữ dữ liệu qua restart; không dùng :memory: khi cần lưu lâu dài.

## Đăng ký và đăng nhập đơn giản

Mọi tài khoản có quyền như nhau. Đăng ký công khai bằng username/password/fullName. Login trả JWT hạn 3600 giây. Sinh viên, phòng và sự kiện yêu cầu `Authorization: Bearer <ACCESS_TOKEN>`; đăng nhập lại để cấp token mới khi hết hạn. Mật khẩu băm bằng scrypt, không trả hash trong response.

Không còn role, phân công phòng, API quản trị tài khoản hay bootstrap admin. Database đã migrate phân quyền trước đây vẫn dùng được: cột/bảng dư được giữ nhưng không tham gia kiểm tra quyền. Không cần migration để chạy bản đơn giản này; tài khoản cũ dùng mật khẩu cũ.

## API

| Method | Endpoint | Body/chức năng |
|---|---|---|
| GET | / | Kiểm tra backend, trả Hello World! |
| POST | /auth/register | {username,password,fullName}, trả user (201) |
| POST | /auth/login | {username,password}, trả {accessToken,tokenType,expiresIn,user} |
| GET | /auth/me | user hiện tại: {id,username,fullName} |
| POST | /students | {studentCode,fullName} |
| PATCH | /students/:id | {studentCode,fullName}, cả hai bắt buộc |
| GET | /students | Mảng {id,studentCode,fullName} |
| GET | /students/by-code?studentCode=SV001 | Object {id,studentCode,fullName} |
| POST | /rooms | {roomCode,name} |
| PATCH | /rooms/:id | {roomCode,name}, cả hai bắt buộc |
| GET | /rooms | Mảng {id,roomCode,name} |
| POST | /room-events | {studentId,roomId,direction,occurredAt?,source,eventKey} |
| GET | /room-events | Lịch sử lọc/phân trang |

Mã sinh viên/phòng tối đa 50 ký tự, tên/eventKey tối đa 200 ký tự, trim đầu/cuối. ID là số nguyên dương, không phải mã sinh viên. Không lưu danh tính unknown. Sự kiện source camera/manual đều dùng được cho mọi tài khoản; direction in/out. occurredAt nếu có bắt buộc múi giờ, được chuẩn hóa UTC; bỏ qua để dùng giờ BE.

UNIQUE eventKey tại database chống retry trùng: 201 tạo mới, 200 cùng key/nội dung, 409 key cũ với nội dung khác. Mỗi lần vào/ra thực tế dùng key mới; khi retry giữ nguyên key và payload. Backend không chống nhiều key khác nhau cho cùng một lần nhận diện.

GET /room-events nhận studentId, roomId, direction, from, to, page, limit; kết hợp AND, gồm hai biên thời gian, sắp xếp occurredAt/id giảm dần. page mặc định 1, limit mặc định 20/tối đa 100. Response {items,total,page,limit,totalPages}. Validation 400; auth 401; không tồn tại 404; trùng/xung đột 409.

Xem [hướng dẫn đăng ký/đăng nhập](authorization.md) và [tích hợp Python với ví dụ PowerShell](ai-integration.md). Trên Swagger, login rồi nhập accessToken vào Authorize để gọi API dữ liệu.

## Kiểm tra và build

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd run test:e2e -- --runInBand
```

Test dùng SQLite bộ nhớ hoặc file tạm riêng, không sửa database đang dùng. Bao phủ đăng ký/login/JWT, validation, tài khoản bình đẳng, dữ liệu bền qua restart, retry đồng thời, UTC, phân trang, schema cũ và không lộ mật khẩu/hash.
