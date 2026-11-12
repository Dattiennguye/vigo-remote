# Thư viện mã IR

App **không tự tạo mã**. Mọi mã trong thư viện được chuyển nguyên văn từ hai dự án mở; mỗi bộ mã ghi rõ tệp nguồn (`source.files`) và giấy phép.

| Loại | Nguồn | Giấy phép | Quy mô |
|---|---|---|---|
| TV | [Flipper-IRDB](https://github.com/logickworkshop/Flipper-IRDB) (commit `d126fb1b`) | CC0-1.0 | 189 bộ mã, 17 hãng, ~5.600 mã |
| Đầu thu truyền hình (cáp, vệ tinh, DVB-T) | Flipper-IRDB (cùng commit) | CC0-1.0 | 64 bộ, 50 hãng |
| TV box / thiết bị stream | Flipper-IRDB | CC0-1.0 | 34 bộ, 20 hãng |
| Đầu DVD / Blu-ray / CD / VCR | Flipper-IRDB | CC0-1.0 | 148 bộ, 38 hãng |
| Loa, soundbar, amply | Flipper-IRDB | CC0-1.0 | 266 bộ, 98 hãng |
| Quạt điện | Flipper-IRDB | CC0-1.0 | 155 bộ, 93 hãng |
| Sưởi, lọc khí, tạo ẩm | Flipper-IRDB | CC0-1.0 | 85 bộ, 60 hãng |
| Đèn LED | Flipper-IRDB | CC0-1.0 | 165 bộ, 112 hãng |
| Máy chiếu | Flipper-IRDB | CC0-1.0 | 119 bộ, 54 hãng |
| Thiết bị khác (màn hình, game, robot hút bụi…) | Flipper-IRDB | CC0-1.0 | 260 bộ, 168 hãng |
| Điều hòa | [SmartIR](https://github.com/smartHomeHub/SmartIR) `codes/climate` | MIT | 373 bộ mã, 137 hãng, ~141.000 mã |

Giấy phép MIT của SmartIR yêu cầu giữ thông báo bản quyền: xem `THIRD-PARTY-LICENSES.md`.

## TV (`web/data/tv/`)
- `index.js` (nhẹ, có sẵn khi mở app) + một tệp cho mỗi hãng, nạp khi bạn chọn hãng.
- Mỗi bộ: `{brand, model, models[], core, source, codes{khóa → {spec, label?}}}`.
- Tên nút được chuẩn hóa về khóa chuẩn: `power, mute, vol_up, vol_down, up, down, left, right, ok, back, home, exit, menu, source, ch_up, ch_down, 0–9…` (xử lý các biến thể như `Enter_OK`, `Vol_plus`, `Chan_up`).
- `core` = số phím chính (trong 12 phím của màn hình điều khiển) mà bộ mã có. Bộ đủ 12/12 và có nhiều remote cùng mã Nguồn được xếp lên đầu.
- Bộ ít hơn 4 phím bị loại; giao thức app chưa mã hóa được bị bỏ qua (bộ TV hiện tại được dựng trước khi có RC5/RC6 nên chưa gồm các mã đó).
- Dựng lại: `python3 -I tools/build-library.py <Flipper-IRDB> web/data/tv <commit>`.

## Các loại thiết bị khác (`web/data/<loại>/`, loại = stb, box, disc, audio, fan, air, light, proj, other)
- Cùng cấu trúc như TV: `index.js` (hãng, phím chính `core`, phím dùng để thử `test`) + một tệp mỗi hãng nạp khi chọn. `data/keys.js` chứa nhãn tiếng Việt cho khóa phím chuẩn.
- Giao thức hỗ trợ thêm (viết theo bộ phát của Flipper, có kiểm thử giải ngược): **RC5/RC5X, RC6, NEC42, Pioneer**. RC5/RC6 có bit toggle: app đổi bit này sau mỗi lần bấm. Mã RC5 vượt dải 5 bit địa chỉ/6 bit lệnh bị loại (bộ phát sẽ cắt ngầm), không đoán.
- Tên nút chuẩn hóa về khóa chuẩn (power/on/off, vol_*, play, pause, speed, bright_up, keystone_up…); khóa lạ giữ nguyên tên, có nhãn tiếng Việt nếu có trong từ điển, còn lại hiển thị tên gốc (tiếng Anh).
- Hãng cùng tên ở nhiều thư mục (vd Sony ở soundbar và amply) được gộp; mỗi bộ ghi “kiểu” (Soundbar, Amply, DVD, Blu-ray…) và tệp nguồn.
- Bỏ qua: 59 nút máy chiếu SIRC15 (Sony 15-bit, bộ mã chưa dùng) và vài mã raw quá dài/hỏng.
- Chưa có sẵn: đầu thu/TV box của nhà mạng trong nước (VTVcab, K+, MyTV, FPT Play, Viettel…) — dùng “Hãng khác / tự nhập mã”.
- Dựng lại: `python3 -I tools/build-devices.py <Flipper-IRDB> web/data <commit>`.

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
