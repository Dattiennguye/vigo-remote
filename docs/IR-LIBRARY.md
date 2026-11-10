# Thư viện mã IR

App **không tự tạo mã**. Mọi mã trong thư viện được chuyển nguyên văn từ hai dự án mở; mỗi bộ mã ghi rõ tệp nguồn (`source.files`) và giấy phép.

| Loại | Nguồn | Giấy phép | Quy mô |
|---|---|---|---|
| TV | [Flipper-IRDB](https://github.com/logickworkshop/Flipper-IRDB) (commit `d126fb1b`) | CC0-1.0 | 189 bộ mã, 17 hãng, ~5.600 mã |
| Điều hòa | [SmartIR](https://github.com/smartHomeHub/SmartIR) `codes/climate` | MIT | 373 bộ mã, 137 hãng, ~141.000 mã |

Giấy phép MIT của SmartIR yêu cầu giữ thông báo bản quyền: xem `THIRD-PARTY-LICENSES.md`.

## TV (`web/data/tv/`)
- `index.js` (nhẹ, có sẵn khi mở app) + một tệp cho mỗi hãng, nạp khi bạn chọn hãng.
- Mỗi bộ: `{brand, model, models[], core, source, codes{khóa → {spec, label?}}}`.
- Tên nút được chuẩn hóa về khóa chuẩn: `power, mute, vol_up, vol_down, up, down, left, right, ok, back, home, exit, menu, source, ch_up, ch_down, 0–9…` (xử lý các biến thể như `Enter_OK`, `Vol_plus`, `Chan_up`).
- `core` = số phím chính (trong 12 phím của màn hình điều khiển) mà bộ mã có. Bộ đủ 12/12 và có nhiều remote cùng mã Nguồn được xếp lên đầu.
- Bộ ít hơn 4 phím bị loại; giao thức app chưa mã hóa được (RC5, RC6, RCA…) bị bỏ qua.
- Dựng lại: `python3 -I tools/build-library.py <Flipper-IRDB> web/data/tv <commit>`.

## Điều hòa (`web/data/ac/`)
- Điều hòa gửi **toàn bộ trạng thái** (chế độ, nhiệt độ, quạt, đảo gió) trong mỗi lệnh. SmartIR lưu sẵn một mã cho từng tổ hợp: `commands[chế_độ][quạt]([đảo_gió])[nhiệt_độ]` và `commands.off`.
- Chỉ dùng tệp Broadlink/Base64 (396 tệp). Giải mã Broadlink → xung IR: tick = 269/8192 ms; khung không có tần số sóng mang nên app **giả định 38 kHz**.
- Mỗi mã được giải mã và kiểm tra cấu trúc khi dựng; mã cụt/hỏng (~6% trong nguồn) bị loại, không vá.
- Bỏ qua 28 tệp: Xiaomi/Raw (13), ESPHome/Raw (14), LOOKin/Raw (1) — định dạng khác, chưa chuyển đổi.
- Các tệp có bộ lệnh giống hệt được gộp (gộp danh sách model).
- `index.js` (~270 KB) nạp khi bạn chọn Điều hòa; từng bộ mã nạp riêng khi chọn/dùng (lớn nhất ~3 MB).
- Dựng lại: `python3 -I tools/build-ac-library.py <SmartIR>/codes/climate web/data/ac <commit>`.

## Giới hạn trung thực
- Mã là dữ liệu cộng đồng, **chưa được kiểm chứng trên mọi model**. Luôn dùng nút Thử trước khi chọn bộ mã.
- Mã điều hòa Casper được SmartIR ghi là tương thích Gree — chưa xác minh.
- Điều hòa không báo trạng thái ngược lại: app chỉ nhớ lệnh đã gửi cuối cùng. Nếu bạn đổi bằng remote gốc, hiển thị trong app có thể lệch.
