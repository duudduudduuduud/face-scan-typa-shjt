# Camera trên web

Ba tiến trình chạy cùng máy, mỗi tiến trình một terminal. Khóa AI_SERVICE_KEY
đã được cấu hình chung trong `.env` của AI và BE, không đưa khóa vào FE/Git.
BE chưa có role hoặc phân công phòng trong source hiện tại; các chức năng
camera dùng AuthGuard đăng nhập hiện có. Cần bổ sung phân quyền trước khi
cho nhiều giáo viên/sinh viên sử dụng. Chưa có chống giả mạo khuôn mặt.

## Khởi động trong CMD

Terminal AI, tại FaceId-Sv:

```cmd
.venv\Scripts\activate.bat
python -m ai.web_server
```

Terminal BE, tại FaceId-Sv-be (khởi động lại nếu đang chạy để đọc khóa mới):

```cmd
npm.cmd run start:dev
```

Terminal FE, tại face-sv-fe:

```cmd
npm.cmd run dev
```

Mở http://localhost:5173, đăng nhập và chọn **Camera trực tuyến**.
Không chạy camera OpenCV đồng thời vì có thể chiếm thiết bị camera.

## Đăng ký

Tạo sinh viên trên BE trước. Trên trang Camera, chọn Đăng ký khuôn mặt,
chọn sinh viên, bật camera và cho phép trình duyệt truy cập. Chụp 5 ảnh,
sau đó Lưu khuôn mặt. BE lấy studentCode chính thức, AI kiểm tra đúng
một mặt trong từng ảnh và thay 5 vector của mã đó trong gallery; không
cần chạy enroll lại hoặc tự đổi tên folder. Ảnh gốc được giữ trên máy AI.
Đăng ký lại cùng mã thay vector gallery nhưng giữ ảnh cũ.

## Nhận diện

Chọn Nhận diện ra/vào, chọn phòng và chiều. Bật camera, nhấn Nhận diện
khuôn mặt. Kiểm tra tên/mã trả về rồi Xác nhận vào/ra phòng. Xem trang
Lịch sử để kiểm tra bản ghi source=camera.

Nhận diện không tự ghi sự kiện. Chiều do người dùng chọn; chưa có tracking
qua cửa. Không gửi mỗi frame. Khi lỗi mạng, Thử lại cùng sự kiện giữ nguyên
key, thời gian và vé nhận diện. Vé thuộc tài khoản hiện tại, hết hạn sau
15 phút. Payload retry chỉ giữ trong trang, không tồn tại sau reload;
nếu hết hạn/rời trang sau mất phản hồi, kiểm tra lịch sử trước khi tạo
lượt mới để tránh trùng. Camera tự tắt khi rời trang.

## API

Tất cả endpoint camera cần Bearer token:

- POST /camera/enroll: `{studentId: number, images: string[5]}`.
- POST /camera/recognize: `{image: string}`; trả student hoặc null,
  similarity và ticket có chữ ký. Không gửi studentId tùy ý từ FE.
- POST /camera/events: `{ticket, roomId, direction, occurredAt, eventKey}`;
  BE suy ra studentId và source=camera. Response giống /room-events.

Ảnh là JPEG data URL, FE resize tối đa chiều rộng 960 px. BE giới hạn JSON
12 MB; AI giới hạn từng ảnh 2 triệu ký tự và kích thước tối đa 1920 px.
AI chỉ nghe 127.0.0.1:8001 và yêu cầu X-AI-Key. FE chỉ gọi BE.

Các lỗi thường gặp: AI 503 → khởi động Python/kiểm tra khóa; 400 → kiểm tra
ảnh chỉ có một mặt; 404 sinh viên → mã gallery chưa có trên BE; camera
không mở → cấp quyền hoặc đóng ứng dụng khác dùng camera. Máy khác truy
cập FE qua LAN cần HTTPS cho camera, cùng cấu hình CORS/URL BE phù hợp.
