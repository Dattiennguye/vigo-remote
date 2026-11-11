# Dịch vụ trực tuyến: đăng nhập Google, gói Pro, quảng cáo

Từ bản 2.1 app có khai báo quyền Internet. Mọi kết nối do **lớp native** (`PlatformBridge.java`) thực hiện; WebView vẫn chỉ nạp tệp cục bộ và bị chặn mạng (`setBlockNetworkLoads(true)`). Điều khiển TV/điều hòa vẫn chạy ngoại tuyến.

> **Trung thực:** phần này được dựng và biên dịch, nhưng **chưa thể kiểm chứng trong môi trường dựng** vì cần tài khoản/ID của bạn. Cần thử trên máy thật theo các bước dưới.

## Việc bạn cần làm (file `android/app/src/main/res/values/vigo_config.xml`)

### 1. Đăng nhập Google
1. Google Cloud Console → tạo project → *APIs & Services → OAuth consent screen* (External).
2. *Credentials → Create credentials → OAuth client ID*:
   - loại **Android**: package `vn.vigo.remote` + SHA-1 của khóa ký (bản debug của CI dùng khóa debug; bản phát hành dùng khóa của bạn / Play App Signing);
   - loại **Web application**: lấy **Client ID** dán vào `google_web_client_id`.
3. Chưa điền ID → nút Đăng nhập báo “chưa cấu hình”.
- App chỉ nhận **email + tên**; không lưu ID token. Chưa có máy chủ nên đăng nhập hiện chỉ để hiển thị tài khoản (chưa đồng bộ đám mây).

### 2. Gói Pro 6 tháng / 1 năm (Google Play Billing)
1. Cần tài khoản Google Play Console và đưa app (ít nhất bản kiểm thử nội bộ) lên.
2. *Monetize → Subscriptions* → tạo sản phẩm `vigo_pro` với **2 base plan**: `pro-6m` (gia hạn 6 tháng) và `pro-1y` (1 năm). ID khác thì sửa `pro_product_id`, `pro_plan_6m`, `pro_plan_1y`.
3. Thêm tài khoản thử vào *License testing* để mua thử không mất tiền.
- Quyền Pro được kiểm tra **trên máy** qua Play (`queryPurchases`), không có máy chủ xác thực biên nhận → có thể bị bẻ khóa. Muốn chắc chắn cần backend (Google Play Developer API / RTDN).
- Hiện Pro = **tắt quảng cáo**. Mọi chức năng điều khiển luôn miễn phí (bạn có thể đổi chính sách này).

### 3. Quảng cáo AdMob
- Mặc định dùng **ID thử nghiệm của Google** (banner hiện chữ “Test Ad”). Trước khi phát hành: tạo app trong AdMob, thay `admob_app_id` và `admob_banner_unit`.
- Tắt hẳn quảng cáo: `vigo_ads_enabled` = false.
- Banner nằm **trên cùng** (không che vùng ngón cái). Người dùng Pro không thấy quảng cáo.
- Chưa có hộp thoại đồng ý (UMP) — cần thêm nếu phát hành ở EEA/UK; khai báo **Data safety** và chính sách quyền riêng tư trên Play.

## Cầu nối `window.VigoPlatform`
| Phương thức | Ghi chú |
|---|---|
| `getConfig()` | JSON: `signIn`, `ads`, `billing`, id gói |
| `signIn()` / `signOut()` | kết quả qua `window.__vigoPlatform({type:'auth',...})` |
| `loadPlans()` / `buy(basePlanId)` | `type:'plans'` / `'purchase'` |
| `checkEntitlement()` | `type:'entitlement', active` |
| `manageSubscription()` | mở trang đăng ký Google Play |
| `setAdsEnabled(bool)` | hiện/ẩn banner |
Ngoài app Android (Demo) mọi thứ báo “chỉ có trong ứng dụng”; không bao giờ giả lập đăng nhập hay thanh toán.
