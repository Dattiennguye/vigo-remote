# Báo cáo trạng thái: chạy thật hay Demo

Cập nhật: 09/11/2026. Phạm vi kiểm chứng: kiểm thử tự động (Node + jsdom) và biên dịch Java với stub. **Chưa chạy trên Xiaomi 14** và **chưa build APK** (môi trường phát triển không tải được Android SDK).

## Đã kiểm chứng bằng kiểm thử tự động
| Hạng mục | Cách kiểm chứng |
|---|---|
| Bộ mã hóa NEC, NEC mở rộng, Samsung32, Sony SIRC12/15/20, Kaseikyo (Panasonic) | `tests/protocols.test.js`: so với khung xung tính tay theo đặc tả |
| Parser Pronto 0000, Raw, Flipper `.ir` | cùng tệp kiểm thử |
| Kaseikyo | mã hóa rồi giải ngược theo công thức bộ giải mã của Flipper (parity, các trường, thời gian xung) |
| Thư viện 190 bộ / 5.626 mã | `tests/library.test.js`: mọi mã đều mã hóa được, có nguồn và giấy phép |
| Chọn hãng/dòng, dò tự động | `tests/ui-smoke.test.js` với Native giả lập (gửi đúng mã, Bộ trước/tiếp, hết bộ, Demo bị khóa) |
| IR Bridge: chặn tần số ngoài dải, báo lỗi, không báo thành công giả ở Demo | `tests/ui-smoke.test.js` với Native giả lập |
| Giao diện: render đủ màn hình, tên người dùng không bị chèn HTML, AC chỉ đổi trạng thái khi gửi không lỗi | `tests/ui-smoke.test.js` |
| Mã Java `IrBridge`/`MainActivity` biên dịch được | javac với stub API Android (chỉ kiểm cú pháp và kiểu; biên dịch thật diễn ra khi build APK) |

## Chức năng và chế độ
| Chức năng | Chỉ HTML (công cụ không có bridge) | Có Android Native (dự án `android/`) |
|---|---|---|
| Giao diện, điều hướng, nút, hiệu ứng | Chạy | Chạy |
| Lưu thiết bị/lịch sử sau khi thoát app | Chạy (localStorage) nếu công cụ bật DOM storage | Chạy |
| Thêm/sửa/xóa thiết bị, chọn hãng/dòng từ thư viện, nhập mã (Flipper/Pronto/giao thức/raw/JSON) | Chạy | Chạy |
| **Dò tự động bộ mã TV** | **Không** (cần phát IR thật) | Có (chưa thử trên phần cứng) |
| Mã hóa mã IR thành mẫu xung | Chạy | Chạy |
| **Phát hồng ngoại thật** | **Không**: báo "Chế độ Demo", không giả lập | **Có**, qua `ConsumerIrManager` (chưa thử trên phần cứng) |
| Kiểm tra mắt phát, dải tần | Không (báo Demo) | Có |
| Xác nhận nút hoạt động (✓/✗), lưu cấu hình đã kiểm tra | Khóa | Mở sau khi phát thử |
| Hẹn giờ tắt điều hòa | Chạy trong app đang mở | Như bên trái; app bị đóng thì không gửi, có cảnh báo khi mở lại |
| Chọn tệp `.ir` từ bộ nhớ | Tùy công cụ | Có (`onShowFileChooser`) |

## Giới hạn cần biết
- **Mã IR dựng sẵn (TV):** 190 bộ mã từ Flipper-IRDB (CC0), có ghi nguồn từng bộ. Mã cộng đồng **chưa được kiểm chứng trên TV của bạn**: dùng "Dò tự động" hoặc thử từng nút. Giao thức RC5/RC6/RCA chưa hỗ trợ (nút dùng giao thức này bị bỏ qua); Xiaomi TV trong nguồn thiếu nút Nguồn. Chưa có thư viện điều hòa. Chi tiết: `IR-LIBRARY.md`.
- **Không "học" mã từ remote cũ:** điện thoại không có mắt thu IR.
- **"Đã gửi" nghĩa là gì:** Android không xác nhận thiết bị đích đã nhận. App chỉ báo "Đã gửi lệnh tới mắt phát"; bạn xác nhận bằng quan sát thiết bị.
- **Điều hòa:** mã điều hòa thường là khung trạng thái đầy đủ theo hãng. App hỗ trợ khóa `st_<chế độ>_<nhiệt độ>_<quạt>` (ví dụ `st_cool_24_auto`), `st_off` và các khóa chức năng (`temp_up`, `mode_cool`, `fan_high`, `swing_v`...). Thiếu mã cho trạng thái nào thì nút đó báo lỗi rõ ràng. Trạng thái hiển thị là ghi nhớ của app.
- Giao thức Flipper ngoài NEC/NECext/Samsung32/SIRC (ví dụ RC5, RC6, RCA) bị bỏ qua và được liệt kê khi import.
