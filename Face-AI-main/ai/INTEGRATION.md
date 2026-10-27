# Kết nối backend NestJS

Không cần thêm thư viện Python. Cấu hình bằng biến môi trường PowerShell;
chương trình không tự đọc `.env`. BE cần có sẵn tài khoản, sinh viên và phòng.

```powershell
$env:BACKEND_URL = 'http://localhost:3000'
$env:BACKEND_USERNAME = 'ai_service'
$credential = Get-Credential -UserName 'ai_service' -Message 'Nhập mật khẩu tài khoản BE'
$env:BACKEND_PASSWORD = $credential.GetNetworkCredential().Password
python -m ai backend-check --student-id BIT230396
```

Lệnh kiểm tra in danh sách phòng và ID sinh viên. Nếu AI khác máy BE,
dùng URL LAN thực tế của BE. Có thể dùng `BACKEND_TOKEN` thay tài khoản;
token hết hạn chỉ tự cấp lại khi có username/password.

```powershell
python -m ai camera --send-events --room-id 1 --direction in --camera-id camera-01
```

Chọn ID phòng từ danh sách BE. Camera phải hiển thị đúng một khuôn mặt
đã nhận diện; nhấn Space một lần để xác nhận một lượt. Nhấn R để thử gửi
lại hàng đợi, Q/Esc để thoát. Mỗi lần Space tạo một lượt mới, nên không
nhấn liên tiếp cho cùng lượt. Chiều được cấu hình cố định bằng --direction;
chưa có tracking cửa hoặc tự xác định chiều. Chế độ camera thông thường
không gửi dữ liệu. Gửi HTTP đồng bộ có thể làm hình camera dừng tạm thời.

Sự kiện được ghi vào `data/event-outbox.sqlite3` trước khi tra sinh viên
và gửi. ID tra được cũng được lưu trước POST. Lỗi mạng/5xx/401 giữ lại
hàng đợi; thử lại bằng R hoặc sau khi khởi động lại:

```powershell
python -m ai sync-events
```

Retry giữ nguyên eventKey, ID và thời gian UTC có mili giây. Thành công
200/201 được xóa khỏi hàng đợi. Lỗi 400/403/404/409 được giữ với trường
`error`, bỏ qua trong các lần sync sau để không tự gửi vô hạn; xem và xử
lý bản ghi bằng công cụ SQLite. Sau khi sửa nguyên nhân, có thể đặt error
về NULL để retry; giữ key/payload khi chưa xác định BE đã lưu hay chưa.
`sync-events` trả exit code 1 nếu còn sự kiện chờ hoặc bị chặn.

Không tự tạo tài khoản, sinh viên hoặc phòng. Không lưu token/mật khẩu
trong hàng đợi. Khi xong, xóa mật khẩu khỏi môi trường terminal:

```powershell
Remove-Item Env:BACKEND_PASSWORD
```
