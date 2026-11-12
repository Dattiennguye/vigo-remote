# Tích hợp Native Bridge

## Hợp đồng giữa giao diện và Android
Giao diện tìm đối tượng `window.VigoNative` (xem `web/js/ir-bridge.js`). Mọi phương thức đồng bộ, trả về **chuỗi JSON**:

| Phương thức | Trả về |
|---|---|
| `hasIrEmitter()` | `{"ok":true,"available":true}` hoặc `{"ok":false,"error":"..."}` |
| `getCarrierFrequencies()` | `{"ok":true,"ranges":[[30000,60000]]}` |
| `transmit(freqHz:int, patternJson:string)` | `{"ok":true}` hoặc `{"ok":false,"error":"..."}` |
| `haptic(kind, mode)` | không trả về. kind: `tick`/`click`/`heavy`/`error`; chỉ dùng `performHapticFeedback` (rung hệ thống), `mode` bị bỏ qua |
| `hapticTest()` | JSON `{ok, sdk, system}` rồi rung thử bằng rung hệ thống |
| `setVolumeKeys(enabled:bool)` | `{"ok":true}`. Bật thì phím âm lượng vật lý được chặn và gửi `window.__vigoKey('vol_up'\|'vol_down')` |
| `keepScreenOn(enabled:bool)` | `{"ok":true}`. Giữ màn hình sáng (FLAG_KEEP_SCREEN_ON) |
| `vibrate(ms:int)` | không trả về (cũ, còn giữ để tương thích) |

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
3. Trong Activity: `webView.getSettings().setJavaScriptEnabled(true); setDomStorageEnabled(true); webView.addJavascriptInterface(new IrBridge(this, host), "VigoNative")` (`host` cài `IrBridge.Host` — xem `MainActivity` cho `setVolumeKeys`/`setKeepScreenOn`/`onKeyDown`) `;`
4. Chỉ nạp nội dung cục bộ (`file:///android_asset/...`) vào WebView có bridge, và chặn điều hướng ra ngoài (xem `MainActivity.shouldOverrideUrlLoading`), vì mọi trang trong WebView đó đều gọi được `VigoNative`.

## Thêm giao thức mới
Thêm một mục vào `VigoIR.PROTOCOLS` trong `web/js/ir-protocols.js` với `label`, `freq` và `encode(spec)` trả về mảng micro giây; thêm test trong `tests/protocols.test.js`. Thêm hãng TV: sửa danh sách `BRANDS` trong `tools/build-library.py` rồi chạy lại (xem `IR-LIBRARY.md`). Mã điều hòa dạng Broadlink dùng giao thức `{protocol:'broadlink', data:'<Base64>'}`.

## Hẹn giờ native (tùy chọn)
Hẹn giờ tắt điều hòa hiện chạy trong JavaScript nên cần giữ app mở (có thể khóa màn hình ở một số máy, nhưng nếu hệ thống đóng app thì lệnh không được gửi). Muốn hẹn giờ khi app đóng: thêm `AlarmManager` + `BroadcastReceiver` gọi `ConsumerIrManager.transmit` trực tiếp (cần quyền báo thức chính xác trên Android 12+).

## Cầu nối thứ hai: `window.VigoPlatform`
Đăng nhập Google, Google Play Billing, AdMob — xem `ONLINE-SERVICES.md`.

### Giọng nói (VigoPlatform)
- `startVoice()` / `stopVoice()`: dùng `SpeechRecognizer` (vi-VN, có kết quả tạm). Tự xin quyền `RECORD_AUDIO` lần đầu (MainActivity chuyển kết quả vào `PlatformBridge.onPermissionResult`).
- Sự kiện đẩy về: `{type:'voice', ok, state:'listening'|'partial'|'final'|'processing'|'error', text, alts, error}`. `getConfig().voice` cho biết máy có dịch vụ nhận giọng nói không.
