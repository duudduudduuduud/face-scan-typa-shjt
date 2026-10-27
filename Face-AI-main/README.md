# Nhận diện khuôn mặt sinh viên

Bước đầu của đồ án AI: đăng ký khuôn mặt, nhận diện ảnh và chạy camera.
`ai/` chứa phần AI. Giao diện frontend được quản lý trong repo riêng.
Đã có lưu lịch sử vào/ra bằng SQLite, chưa kết nối tự động với camera.
Chưa triển khai xác định vào/ra, điểm danh, chống giả mạo hay xác nhận qua nhiều khung hình.

## Lưu lịch sử vào/ra

Không cần cài thư viện thêm, SQLite có sẵn trong Python.

```powershell
python -m backend init
python -m backend record --student-id BIT230396 --room-id LAB01 --direction in
python -m backend record --student-id BIT230396 --room-id LAB01 --direction out
python -m backend history --student-id BIT230396 --room-id LAB01
```

Dữ liệu lưu tại `data/attendance.db`, gồm mã sinh viên, phòng, hướng (`in`/`out`),
thời gian và nguồn (`manual` cho nhập thử, `camera` cho tích hợp sau).
Thời gian lưu UTC và hiển thị UTC+7. Dữ liệu giữ lại khi đóng chương trình.
Đây là lưu sự kiện, chưa phải kết quả điểm danh theo buổi học.

AI có thể gọi `EventStore().record_event(student_id, room_id, direction,
event_key=unique_crossing_id)` sau khi xác định hướng. Mỗi lượt qua cửa cần
một mã sự kiện riêng; gửi lại cùng mã không tạo dòng trùng. Không gọi hàm
cho mỗi khung hình. Không suy đoán hướng bằng cách luân phiên vào/ra.
Chỉ ghi danh tính đã xác định, không ghi `unknown`.

Kiểm thử lưu trữ: `python -m unittest tests.test_database`.

## Cài đặt (PowerShell, Python 3.10 trở lên)

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m ai.download_models
```

Mô hình YuNet phát hiện khuôn mặt và SFace trích xuất đặc trưng từ OpenCV Zoo.
Tài liệu: https://docs.opencv.org/4.12.0/d0/dd4/tutorial_dnn_face.html
Nguồn trọng số và giấy phép: https://github.com/opencv/opencv_zoo/tree/main/models

## Đăng ký sinh viên

Chụp ảnh trực tiếp từ camera (không cần venv nếu đã cài thư viện vào Python):

```powershell
python capture_photos.py --student-id SV001
```

Có thể chạy `python capture_photos.py` rồi nhập mã sinh viên. Nhấn Space
để chụp từng ảnh theo gợi ý: chính diện, hơi quay trái, phải, hơi ngẩng và cúi.
Chỉ lưu khi phát hiện đúng một khuôn mặt. Gợi ý góc chụp do người dùng thực
hiện, chương trình chưa tự kiểm tra góc đầu. Mặc định chụp 5 ảnh, lưu vào
`data/registration/SV001/`, không ghi đè ảnh cũ. Có thể dùng `--count 10`.
Sau khi đủ ảnh, chương trình tự cập nhật gallery và đóng camera. Nhấn Q/Esc
để dừng sớm; ảnh đã chụp vẫn được giữ, gallery chưa được cập nhật tự động.
Sau đó chạy `python -m ai enroll` nếu muốn đăng ký các ảnh đã chụp.

Để nhận diện sau khi đăng ký: `python -m ai camera`.

Tạo thư mục theo mã sinh viên, mỗi ảnh chỉ chứa một khuôn mặt. Nên dùng
5–10 ảnh khác góc nhìn/ánh sáng của người đồng ý tham gia thử nghiệm.

```text
data/registration/
  SV001/
    anh1.jpg
    anh2.jpg
  SV002/
    anh1.jpg
```

```powershell
.\.venv\Scripts\python.exe -m ai enroll
.\.venv\Scripts\python.exe -m ai image --image data/evaluation/test.jpg
.\.venv\Scripts\python.exe -m ai camera
```

`enroll` tạo lại gallery từ toàn bộ ảnh hiện có. Ảnh không có hoặc có nhiều
khuôn mặt sẽ bị bỏ qua và thông báo. Lệnh `image` trả danh sách JSON gồm
mã sinh viên, độ tương đồng cosine và vị trí mặt. Không thấy mặt trả `[]`.
Camera hiển thị mã sinh viên; bấm Q hoặc Esc để đóng. Dùng `--camera 1`
nếu cần camera khác. Nên dùng mã sinh viên không dấu để hiển thị trên camera.

Ngưỡng mặc định `--threshold 0.45` chỉ là điểm khởi đầu, cần hiệu chỉnh bằng
ảnh kiểm thử độc lập. Điểm tương đồng không phải xác suất. Dưới ngưỡng sẽ
trả `unknown`; vẫn có thể nhận nhầm người lạ. So khớp lấy điểm cao nhất trong
các ảnh đăng ký. Đo nhận đúng, nhận nhầm và bỏ sót trước khi dùng điểm danh.

Không đưa ảnh, vector khuôn mặt hoặc trọng số lên Git. Dữ liệu nằm trong
`data/` và đã được bỏ qua trong `.gitignore`.
