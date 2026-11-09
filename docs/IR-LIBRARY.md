# Thư viện mã IR

## Nguyên tắc
Không tự tạo mã. Chỉ lưu mã (1) trích từ nguồn xác thực có ghi nguồn và giấy phép, hoặc (2) do người dùng nhập và đã thử trên thiết bị thật. Phiên bản này **chưa kèm mã dựng sẵn**: chưa có cách xác minh nguồn trong lúc phát triển.

## Nguồn gợi ý để lấy mã
- **Flipper-IRDB** (kho tệp `.ir` do cộng đồng đóng góp, trên GitHub): tải tệp đúng hãng/model về điện thoại rồi import ở IR Setup → tab *Flipper .ir*. Kiểm tra giấy phép của kho trước khi đóng gói lại mã trong sản phẩm thương mại. Mã vẫn phải được thử thật; tệp cộng đồng có thể sai model.
- Tài liệu giao thức công khai (NEC, Samsung32, Sony SIRC) cho việc nhập tay địa chỉ/lệnh.
- Tài liệu hoặc chuỗi Pronto của chính nhà sản xuất.

## Cấu trúc mục thư viện
```json
{
  "brand": "Samsung",
  "model": "ví dụ model",
  "type": "tv",
  "source": { "name": "tên nguồn", "url": "https://...", "license": "..." },
  "codes": {
    "power":  { "spec": { "protocol": "samsung32", "address": "0x07", "command": "0x02" } },
    "custom": { "label": "Tên hiển thị", "spec": { "protocol": "raw", "freq": 38000, "pattern": [4500, 4500, 560] } }
  }
}
```
(Giá trị trên chỉ minh họa cấu trúc, không phải mã đã xác minh.)

Khóa chuẩn cho TV: `power, vol_up, vol_down, mute, ch_up, ch_down, up, down, left, right, ok, back, home, menu, 0–9, src_hdmi, src_av, src_tv`.
Khóa chuẩn cho điều hòa: `power, power_on, power_off, st_off, temp_up, temp_down, mode_auto|cool|dry|fan|heat, fan_auto|low|mid|high, swing_v, swing_h`, và khung trạng thái `st_<mode>_<temp>_<fan>` (ví dụ `st_cool_24_auto`).
Khóa khác vẫn dùng được, hiển thị ở mục "Lệnh đã nhập".

## Thêm mục vào thư viện dựng sẵn
Thêm đối tượng vào mảng `entries` trong `web/data/ir-library.js`. Khi tạo thiết bị mới đúng hãng và loại, app sẽ cho chọn bộ mã đó. Mỗi mục bắt buộc có `source`.
