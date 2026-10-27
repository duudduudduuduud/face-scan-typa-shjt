# Huấn luyện AI trên web

## Chạy ba dịch vụ

AI (CMD tại `C:\Users\letua\FaceId-Sv`):

```cmd
.venv\Scripts\activate
python -m pip install -r requirements.txt
python -m ai.web_server
```

BE: `npm run start:dev` trong `FaceId-Sv-be`. FE: `npm run dev` trong
`face-sv-fe`. Khởi động lại các dịch vụ đang chạy sau khi cập nhật code.
BE và AI dùng cùng `AI_SERVICE_KEY`; trình duyệt chỉ gọi BE, không nhận key.

## Thu thập và huấn luyện

1. Đăng nhập giảng viên, tạo ít nhất hai hồ sơ sinh viên trên BE.
2. Vào Camera trực tuyến → Đăng ký khuôn mặt. Với mỗi sinh viên, chụp và
   lưu năm ảnh. Thay đổi góc mặt, giữ đủ ánh sáng.
3. Thực hiện thêm một lần chụp riêng cho từng sinh viên, tốt nhất ở thời điểm
   khác với ánh sáng/vị trí khác. Mỗi lần lưu năm ảnh có một mã phiên chụp.
   Ảnh capture/web cũ chưa có mã phiên được xem là một phiên `legacy`.
4. Vào Huấn luyện AI → Bắt đầu huấn luyện. Không cập nhật ảnh trong lúc train.
5. Xem accuracy, macro precision/recall/F1, ma trận nhầm lẫn và ảnh bị loại.
6. Chọn phiên bản → Áp dụng vào điểm danh. Camera nhận diện và điểm danh
   lịch học trên web đều dùng mô hình đã chọn qua `/camera/recognize`.
7. Có thể quay về so khớp đặc trưng hoặc áp dụng phiên bản trước nếu tập dữ
   liệu không đổi. Nếu thêm ảnh, mô hình cũ bị đánh dấu cần huấn luyện lại.

## Phương pháp và giới hạn đánh giá

YuNet phát hiện mặt; SFace trích xuất và chuẩn hóa vector. LinearSVC của
scikit-learn học bộ phân loại với C=1, class_weight=balanced, random_state=42.
Đây là huấn luyện bộ phân loại mới, không fine-tune mô hình SFace.

Một phiên chụp của mỗi sinh viên được giữ nguyên làm test, các phiên còn
lại làm train. Chọn phiên theo mã đã sắp xếp, tái lập được. Mỗi sinh viên cần
ít nhất 5 ảnh hợp lệ ở mỗi phía; ảnh không đọc được, không đúng một mặt
hoặc trùng byte với ảnh trước bị loại. Không huấn luyện lại trên ảnh test
sau khi đánh giá: phiên bản áp dụng chính là phiên bản được đánh giá.
Các phiên người dùng tự chụp vẫn cần khác nhau về thời điểm/bối cảnh để
tránh ảnh gần giống nhau làm kết quả cao hơn thực tế.

SVM dự đoán mã sinh viên; cosine với ảnh train của mã đó phải đạt 0.45,
nếu không trả `unknown`. Cosine không phải xác suất. Chỉ số trên web là
đánh giá closed-set trên sinh viên đã đăng ký với quy tắc từ chối; chưa đo
FAR/FRR trên tập người lạ và chưa có chống giả mạo/liveness. Không kết luận
độ chính xác thực tế chỉ từ dữ liệu nhỏ hoặc từ test vector tổng hợp.

Huấn luyện chạy nền, một job mỗi lần; tiến trình job lưu trong bộ nhớ và
dừng nếu dịch vụ AI tắt. Phiên bản hoàn tất, metrics và danh sách phiên
train/test lưu ở `data/training/<id>.json`; trọng số/ảnh đặc trưng ở NPZ,
không dùng pickle. `active.json` lưu phiên bản nhận diện và được đọc lại khi
AI khởi động. Dữ liệu và mô hình được gitignore.

CLI camera cũ vẫn dùng gallery; mô hình SVM áp dụng cho luồng camera web.

## API dành cho teacher/admin

- `GET /ai-training`: dữ liệu, job hiện tại, lịch sử, phiên bản đang áp dụng.
- `POST /ai-training/jobs` body `{}`: khởi động job.
- `POST /ai-training/activate` body `{"version":"<id>"}`: áp dụng phiên bản.
- Cùng endpoint với `{"version":null}`: quay về gallery.

API Python tương ứng là POST `/training/status`, `/training/start`,
`/training/activate`; chỉ chấp nhận key nội bộ trên loopback.

Tham khảo thuật toán và metrics:
https://scikit-learn.org/stable/modules/generated/sklearn.svm.LinearSVC.html
https://scikit-learn.org/stable/modules/generated/sklearn.metrics.classification_report.html
