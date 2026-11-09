# Hướng dẫn tạo APK

APK này là **APK có phát IR thật** (WebView + `ConsumerIrManager`). Chưa có APK dựng sẵn vì môi trường phát triển không tải được Android SDK.

## Cách A: GitHub Actions (không cần cài gì trên máy)
1. Tạo kho GitHub (riêng tư) và đẩy toàn bộ thư mục này lên nhánh `main`.
2. Vào tab **Actions**, chọn **Build VIGO Remote APK**, bấm **Run workflow** (hoặc tự chạy khi push).
3. Khi xong, mở lần chạy, tải artifact **VIGO-Remote-apk**, giải nén được `VIGO-Remote.apk`.
4. Chép sang điện thoại, cho phép "cài ứng dụng không rõ nguồn gốc", cài đặt.

Workflow chạy kiểm thử bộ mã hóa trước khi build. Bản build là `debug` (ký bằng khóa debug nên cài được ngay).

## Cách B: Android Studio
1. Cài Android Studio (kèm Android SDK 34).
2. Chạy `bash tools/sync-web.sh` (đồng bộ `web/` vào assets).
3. Mở thư mục `android/`, chờ Gradle sync (cần Internet lần đầu).
4. **Build → Build APK(s)**; APK nằm ở `android/app/build/outputs/apk/debug/app-debug.apk`.

## Cách C: dòng lệnh
Yêu cầu JDK 17, Android SDK 34 (`ANDROID_HOME`), Gradle 8.9:
```bash
bash tools/sync-web.sh
cd android && gradle assembleDebug
```

## Khi sửa giao diện
Sửa trong `web/`, rồi chạy lại `bash tools/sync-web.sh` trước khi build. `web/` là nguồn duy nhất.

## Bản phát hành (tùy chọn)
Để đưa lên cửa hàng/ký bằng khóa của bạn: tạo keystore, thêm `signingConfigs` vào `android/app/build.gradle`, build `assembleRelease`. Không đưa keystore lên kho công khai.

## Dùng công cụ HTML → APK của bạn
Đóng gói thư mục `web/` (mở `index.html`). Hoạt động ở chế độ Demo trừ khi công cụ có Native Bridge; xem `NATIVE-BRIDGE.md` (Cách 2) để kiểm tra.
