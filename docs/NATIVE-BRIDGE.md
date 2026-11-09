# Tích hợp Native Bridge

## Hợp đồng giữa giao diện và Android
Giao diện tìm đối tượng `window.VigoNative` (xem `web/js/ir-bridge.js`). Mọi phương thức đồng bộ, trả về **chuỗi JSON**:

| Phương thức | Trả về |
|---|---|
| `hasIrEmitter()` | `{"ok":true,"available":true}` hoặc `{"ok":false,"error":"..."}` |
| `getCarrierFrequencies()` | `{"ok":true,"ranges":[[30000,60000]]}` |
| `transmit(freqHz:int, patternJson:string)` | `{"ok":true}` hoặc `{"ok":false,"error":"..."}` |
| `vibrate(ms:int)` | không trả về (tùy chọn) |

`patternJson` là mảng số nguyên micro giây, xen kẽ bật/tắt, bắt đầu bằng xung bật. Nếu `window.VigoNative` không tồn tại, giao diện chạy chế độ Demo và không bao giờ báo đã gửi.

## Cách 1 (khuyến nghị): dùng dự án `android/` có sẵn
`android/app/src/main/java/vn/vigo/remote/IrBridge.java` đã cài đủ hợp đồng trên bằng `ConsumerIrManager`; `MainActivity.java` nạp giao diện từ assets và đăng ký bridge. Xem `BUILD-APK.md`.

## Cách 2: công cụ HTML → APK của bạn
Không được giả định công cụ có bridge. Kiểm tra:
1. Đóng gói `tools/native-probe.html` bằng công cụ, cài và mở trên máy.
2. Nếu trang báo `window.VigoNative: CÓ` kèm đủ phương thức, dùng thẳng thư mục `web/`.
3. Nếu công cụ chèn đối tượng khác tên (trang liệt kê ở mục "Thuộc tính lạ"), sửa hai hàm `native()` và `call()` trong `web/js/ir-bridge.js` cho khớp tên/chữ ký, **chỉ khi** đối tượng đó thật sự có hàm phát IR (`transmit`-tương đương với tần số và mẫu xung).
4. Nếu không có gì: công cụ không phát được IR. Dùng Cách 1, hoặc tự thêm lớp Native vào dự án Android khác như sau.

## Thêm bridge vào một dự án WebView Android bất kỳ
1. Manifest:
   ```xml
   <uses-permission android:name="android.permission.TRANSMIT_IR"/>
   <uses-feature android:name="android.hardware.consumerir" android:required="false"/>
   ```
2. Sao chép `IrBridge.java`, đổi `package` cho khớp.
3. Trong Activity: `webView.getSettings().setJavaScriptEnabled(true); setDomStorageEnabled(true); webView.addJavascriptInterface(new IrBridge(this), "VigoNative");`
4. Chỉ nạp nội dung cục bộ (`file:///android_asset/...`) vào WebView có bridge, và chặn điều hướng ra ngoài (xem `MainActivity.shouldOverrideUrlLoading`), vì mọi trang trong WebView đó đều gọi được `VigoNative`.

## Thêm giao thức mới
Thêm một mục vào `VigoIR.PROTOCOLS` trong `web/js/ir-protocols.js` với `label`, `freq` và `encode(spec)` trả về mảng micro giây; thêm test trong `tests/protocols.test.js`. Cần thêm hãng: thêm tên vào `brands` trong `web/data/ir-library.js`.

## Hẹn giờ native (tùy chọn)
Hẹn giờ hiện chạy trong JavaScript nên cần giữ app mở. Muốn hẹn giờ khi app đóng: thêm `AlarmManager` + `BroadcastReceiver` gọi `ConsumerIrManager.transmit` trực tiếp (cần quyền báo thức chính xác trên Android 12+).
