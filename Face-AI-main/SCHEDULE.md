# Lịch học và điểm danh khuôn mặt

Khởi động lại BE để tạo các bảng mới trên MySQL/SQLite, không xóa dữ liệu cũ.
Chạy AI, BE và FE như trong WEB_CAMERA.md. Mở Lịch học trên FE.

Ngày có buổi học được đánh dấu xanh. Chọn ngày để xem môn, giáo viên, giờ,
phòng và trạng thái. Điểm danh mở từ 15 phút trước giờ bắt đầu tới hết buổi.
Ngoài khoảng này nút bị khóa và BE cũng từ chối request. Qua giờ kết thúc,
buổi chưa có điểm danh hiện Vắng mặt; buổi đã điểm danh hiện Đã điểm danh.

Nhấn Điểm danh để mở camera. Xác nhận chụp một ảnh gửi AI nhận diện; BE
đối chiếu mặt với sinh viên liên kết tài khoản và danh sách của buổi học.
Kết quả lưu trong lesson_attendance, riêng với lịch sử ra/vào room_events.
Không suy ra điểm danh buổi học từ lịch sử ra/vào. Mỗi sinh viên/buổi có
UNIQUE constraint; retry hoặc nhiều request đồng thời không tạo bản ghi trùng.
BE dùng giờ máy chủ để ghi điểm danh, không nhận thời gian do FE tự đặt.

## Tạo lịch thật

BE chưa có role/admin quản lý lịch. Để tránh cho người đăng ký công khai
tự nhận mã sinh viên, hiện chỉ cấp liên kết tài khoản và lịch bằng CLI trên
máy BE. Cần tài khoản, sinh viên và phòng đã được tạo trước. CLI chạy
transaction, không ghi đè liên kết đang có. Lặp lại cùng buổi không tạo thêm
lịch; dùng username/studentCode khác để thêm sinh viên vào cùng buổi.
s
Trong terminal tại FaceId-Sv-be:

```cmd
npm.cmd run schedule:setup -- student01 SV001 LAB01 IT101 "Lap trinh Web" "Nguyen Van An" "2026-10-12T14:00:00+07:00" "2026-10-12T16:00:00+07:00"
```

Các giá trị trên là ví dụ, không tự tạo dữ liệu. Thay student01 bằng username
thực sự của tài khoản sinh viên; thay ngày giờ bằng buổi học thực tế. Nên
dùng tài khoản sinh viên riêng, không liên kết tài khoản giáo viên với sinh
viên chỉ để thử. Để test camera ngay, tạo buổi có giờ bắt đầu gần hiện tại
và giờ kết thúc trong tương lai.

CLI không có mật khẩu/token trong tham số. Nó sử dụng cấu hình database
BE trong .env. Chạy xong, đăng xuất và đăng nhập lại FE để GET /auth/me
cập nhật studentId. Đăng ký khuôn mặt với đúng mã sinh viên trước khi điểm
danh; trang /camera hiện vẫn truy cập trực tiếp được dù menu đã được ẩn.

## API mới

- GET /schedule?month=YYYY-MM: trả `{student, items}` của người đăng nhập.
  Không có studentId đầu vào. Tài khoản chưa liên kết trả student=null,
  items=[]. Tháng và ngày được tính theo Asia/Ho_Chi_Minh.
- POST /schedule/:id/attendance: `{ticket}` từ POST /camera/recognize;
  trả `{attendance, duplicate}`; 201 mới, 200 đã có.
- GET /auth/me và login.user có studentId nếu tài khoản đã liên kết.

Schema mới: student_accounts, learning_sessions, session_students,
lesson_attendance. Liên kết user/student là một-một. Bảng attendance có
foreign key tới enrollment. Lịch tháng lọc theo enrollment của sinh viên,
không tải toàn bộ rồi lọc phía trình duyệt.

Luồng camera chưa có liveness/chống ảnh giả. Vai trò giáo viên/admin cho
các API cũ chưa được bổ sung trong phạm vi này. Chưa có học kỳ, lịch lặp,
thống kê chuyên cần hoặc API quản trị lịch. Các cảnh báo tỷ lệ vắng trong
ảnh mẫu chưa hiển thị vì chưa có định nghĩa/tổng số buổi học tương ứng.
