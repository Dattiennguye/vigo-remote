# VIGO Remote 2.0

Ứng dụng điều khiển từ xa hồng ngoại cho Android: giao diện HTML/CSS/JS thuần (tiếng Việt, nền tối, ngoại tuyến, không tài khoản, không quảng cáo) + lớp Android Native Bridge để phát IR thật.

## Trải nghiệm
- Mở app → vào ngay **Điều khiển**. Menu chỉ có 2 mục: **Điều khiển** và **Cài đặt**.
- Điều khiển TV tối giản, đặt thấp cho ngón cái: lên/xuống/trái/phải + OK, Quay lại / Trang chủ / Thoát, Âm lượng ± và Tắt tiếng, Nguồn. Phím phụ (Menu, Kênh, số…) nằm sau nút “⋯”.
- Điều hòa: nhiệt độ ±, chế độ, quạt, đảo gió, nguồn, hẹn giờ tắt; mã thật từ 373 bộ mã / 137 hãng.
- Rung khi bấm (bật/tắt + 3 mức), giữ để lặp, giảm chuyển động, giữ màn hình sáng, dùng phím âm lượng của máy chỉnh TV.
- Điều hòa: thanh kéo nhiệt độ mượt (thả tay mới gửi 1 lệnh) và thanh mức quạt dạng cột to nhỏ.
- Hiệu ứng: mở app ≈2,7 s, gợn sóng/mờ dần mọi nút, công tắc chuyển mờ; chỉ dùng transform/opacity (GPU), yêu cầu màn hình tần số quét cao nhất.
- Trực tuyến (tùy chọn, native): đăng nhập Google, gói Pro 6 tháng/1 năm, quảng cáo AdMob — xem `docs/ONLINE-SERVICES.md`.
- Không ghi lịch sử thao tác.

## Cấu trúc
```
web/                 Giao diện (nguồn duy nhất): index.html, css/, js/, data/
  js/ir-protocols.js   NEC, NECext, Samsung32, SIRC, Kaseikyo, Broadlink, Pronto, Raw, parser Flipper .ir
  js/ir-bridge.js      IR Bridge: Native hoặc Demo (không bao giờ giả lập phát)
  js/library.js        Nạp thư viện mã theo hãng (lazy)
  js/ac-engine.js      Máy trạng thái điều hòa
  js/store.js          Thiết bị + cài đặt (localStorage)
  js/ui.js, control.js, settings.js, app.js
  data/tv, data/ac     Thư viện mã (tạo tự động, xem docs/IR-LIBRARY.md)
android/             Dự án Gradle: WebView + ConsumerIrManager (IrBridge.java)
tests/               protocols + library (Node, chạy trong CI); ui-browser (Chromium/playwright, chạy cục bộ)
tools/               sync-web.sh, build-library.py, build-ac-library.py, native-probe.html
docs/                STATUS, NATIVE-BRIDGE, BUILD-APK, XIAOMI14-TEST, IR-LIBRARY
```

## Bắt đầu nhanh
- Tạo APK: `docs/BUILD-APK.md` (GitHub Actions → artifact **VIGO-Remote-apk**).
- Thử giao diện trên máy tính: mở `web/index.html` (chế độ Demo, không phát IR).
- Kiểm thử: `node tests/protocols.test.js && node tests/library.test.js`; giao diện: `NODE_PATH=$(npm root -g) node tests/ui-browser.test.js`.

## Đọc trước
`docs/STATUS.md`: chức năng nào chạy thật, chức năng nào chỉ là Demo, và những gì **chưa được kiểm chứng trên phần cứng**.

## Giọng nói
Nút micro ở màn hình Điều khiển: ra lệnh tiếng Việt (âm lượng, kênh, điều hướng, nhiệt độ, chế độ, quạt) hoặc gõ lệnh. Hồng ngoại không gõ chữ vào TV được nên không có tìm kiếm bằng giọng nói trên TV. Xem docs/STATUS.md.

## Thiết bị hỗ trợ
TV, điều hòa, đầu thu truyền hình, TV box, đầu DVD/Blu-ray, loa/soundbar/amply, quạt, sưởi/lọc khí/tạo ẩm, đèn LED, máy chiếu và thiết bị khác (hoặc tự nhập mã). Xem docs/IR-LIBRARY.md.
