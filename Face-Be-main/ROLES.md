# Điều hướng đăng nhập theo role

BE trả role trong login.user và GET /auth/me. FE dùng /auth/me để xác minh
tài khoản trước khi điều hướng:

| Role | Trang mặc định | Chức năng |
| --- | --- | --- |
| student | / | Trang chủ, lịch cá nhân, lịch sử của chính mình |
| teacher | /admin | Quản lý sinh viên, phòng, camera và lịch sử |
| admin | /admin | Khu quản trị giống giáo viên trong phiên bản hiện tại |
| ai_service | /service | Thông báo tài khoản máy; không có giao diện quản trị |

Sinh viên không được tạo/sửa sinh viên/phòng, đăng ký mặt cho người khác
hoặc tạo sự kiện thủ công. API lịch sử ép phạm vi studentId từ tài khoản,
không tin query studentId của người dùng. AI chỉ tạo source=camera.
Teacher/admin hiện quản lý toàn hệ thống, chưa có phân công lớp/phòng.

## Registration roles

POST /auth/register is public and always creates a teacher account, including
when a Bearer token is supplied. There is no first-account restriction.
The request accepts username, password and fullName; clients cannot choose role.

Teachers/admins create student accounts through POST /auth/student-accounts
or the account provisioning page under /admin. This endpoint requires a staff
token and studentId, always creates role student, and links the existing student
atomically. Students cannot provision accounts. Existing account roles remain
unchanged.

Để sửa role cho tài khoản hiện có, trong CMD tại repo BE:

```cmd
npm.cmd run auth:set-role -- teacher01 teacher
npm.cmd run auth:set-role -- student01 student
```

Thay username bằng tài khoản đã tạo. Không cần mật khẩu trong lệnh.
CLI dùng database trong .env, chỉ chạy trên máy BE bởi người có quyền
database. Không tự tạo tài khoản hoặc suy role từ tên username.

Khởi động lại BE trước để thêm role nếu database cũ chưa có cột này.
Migration kiểm tra cột trước khi ALTER, giữ nguyên role đang có; tài khoản
cũ chưa có role mặc định student. Trong database dùng thử hiện tại,
teacher02 đã được cấp teacher bằng CLI; các tài khoản khác giữ nguyên. Role
không hợp lệ bị từ chối đăng nhập/phiên sử dụng. Sau cấp role, đăng xuất
và đăng nhập lại FE để nhận menu/trang mới. BE đọc role từ DB mỗi request,
nên hạ role có hiệu lực với token cũ.

Tài khoản student cần liên kết studentId qua schedule:setup để có lịch và
lịch sử cá nhân. Xem SCHEDULE.md. Không liên kết tài khoản giáo viên với
sinh viên để thử. Tài khoản AI cũ cũng cần được cấp teacher hoặc ai_service
cho các API ghi sự kiện; khuyến nghị ai_service riêng.

Các API cũ chưa hỗ trợ khóa tài khoản/phân quyền theo phòng. Cấp role mới
không đồng nghĩa với triển khai các tính năng này.
