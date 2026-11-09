# VIGO Universal Remote

Ứng dụng điều khiển từ xa hồng ngoại cho Android: giao diện HTML/CSS/JS thuần (tiếng Việt, nền tối, ngoại tuyến, không tài khoản) + lớp Android Native Bridge để phát IR thật.

## Cấu trúc
```
web/                 Giao diện (nguồn duy nhất): index.html, css/, js/, data/
  js/ir-protocols.js   Bộ mã hóa NEC, NECext, Samsung32, SIRC, Pronto, Raw, parser Flipper .ir
  js/ir-bridge.js      IR Bridge: Native hoặc Demo (không bao giờ giả lập phát)
  js/store.js          Lưu thiết bị và lịch sử (localStorage)
  js/app.js            Các màn hình
  data/ir-library.js   Thư viện mã (cấu trúc + danh sách hãng, chưa có mã dựng sẵn)
android/             Dự án Gradle: WebView + ConsumerIrManager (IrBridge.java)
tests/               Kiểm thử bộ mã hóa và giao diện (Node)
tools/               sync-web.sh, native-probe.html
docs/                STATUS, NATIVE-BRIDGE, BUILD-APK, XIAOMI14-TEST, IR-LIBRARY
.github/workflows/   build-apk.yml
```

## Bắt đầu nhanh
- Tạo APK: xem `docs/BUILD-APK.md` (GitHub Actions là cách nhanh nhất).
- Chạy thử giao diện trên máy tính: mở `web/index.html` (chế độ Demo, không phát IR).
- Kiểm thử: `node tests/protocols.test.js`.

## Đọc trước
`docs/STATUS.md` nói rõ chức năng nào chạy thật, chức năng nào là Demo, và những gì **chưa được kiểm chứng trên phần cứng**.
