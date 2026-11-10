# Trạng thái thật của VIGO Remote 2.0

## Đã kiểm thử tự động (máy dựng, không phải điện thoại)
- Bộ mã hóa NEC / NECext / Samsung32 / SIRC / Kaseikyo: đối chiếu ngược với bộ giải mã tham chiếu.
- Broadlink: giải mã đúng tick, khoảng dài; từ chối khung hỏng. Toàn bộ ~141.000 mã điều hòa và ~5.600 mã TV trong thư viện đều giải mã/mã hóa ra xung hợp lệ.
- Engine điều hòa: mọi tổ hợp chế độ/quạt/đảo gió/nhiệt độ của 373 bộ mã đều có mã; bước nhiệt độ luôn rơi vào mức có mã.
- Giao diện trong Chromium thật với Native Bridge giả lập: 22 nhóm kiểm tra (nút OK bấm được và phát mã; giữ để lặp và dừng khi thả; rung bật/tắt/cường độ; phím thiếu báo lỗi; Back; lưu bền; sao lưu/khôi phục; hẹn giờ; 5 cỡ màn hình 320×568 → 430×932 không phím nào bị che hoặc nhỏ hơn 48 px).
- Mã Java biên dịch được với bản giả lập API Android; APK dựng bằng GitHub Actions.

## CHƯA kiểm chứng trên phần cứng — cần bạn thử trên Xiaomi 14 + thiết bị thật
- Mắt phát IR thực sự phát đúng tín hiệu; TV/điều hòa có phản hồi hay không (xem `XIAOMI14-TEST.md`).
- “Đã gửi” nghĩa là hệ điều hành nhận lệnh phát — Android không cho biết thiết bị đích đã nhận.
- Mã TV/điều hòa là dữ liệu cộng đồng; model của bạn có thể cần thử vài bộ (nút Thử / Sau trong màn hình chọn bộ mã).
- Điều hòa Broadlink: tần số sóng mang giả định 38 kHz (khung không ghi tần số).
- Rung (VibrationEffect), phím âm lượng vật lý, giữ sáng màn hình: viết theo API Android, chưa chạy thử trên máy thật.

## Chế độ Demo
Mở `web/index.html` ngoài app: mọi nút báo “Demo — chưa phát IR thật”, không bao giờ báo đã gửi.

## Giới hạn đã biết
- Giao thức RC5, RC6, RCA… chưa mã hóa được: các nút dùng giao thức đó bị bỏ qua khi dựng thư viện.
- 28 tệp SmartIR dạng Xiaomi/ESPHome/LOOKin Raw chưa chuyển đổi.
- Hẹn giờ tắt điều hòa chỉ chạy khi app còn mở.
- Điều hòa không báo trạng thái ngược: nếu đổi bằng remote gốc, app có thể hiển thị lệch.
- Nâng cấp từ 1.x: giữ thiết bị TV, bỏ lịch sử và điều hòa cũ (bản cũ không có mã điều hòa).
