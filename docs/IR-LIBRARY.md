# Thư viện mã IR

## Nguồn và giấy phép
Thư viện dựng sẵn (`web/data/ir-library.js`, hiện 190 bộ mã TV) được **tạo tự động** từ [Flipper-IRDB](https://github.com/logickworkshop/Flipper-IRDB), giấy phép **CC0-1.0** (công khai, dùng thương mại được, không bắt buộc ghi nguồn; app vẫn ghi nguồn cho từng bộ). Mỗi mục trong thư viện ghi rõ tệp nguồn (`source.files`) và commit đã dùng. App **không tự tạo mã**.

Hãng có sẵn: Samsung, LG, Sony, TCL, Hisense, Xiaomi, Panasonic, Sharp, Toshiba, cùng Philips, Sanyo, Hitachi, Haier, JVC, Daewoo, Akai, Android (tùy hãng, số bộ mã khác nhau).

## Cách app dùng thư viện
- **Thêm thiết bị**: chọn hãng, rồi chọn dòng/remote (bộ phổ biến nhất được chọn sẵn). Lưu xong là điều khiển được ngay.
- **IR Setup → mục 3**: nạp bộ mã khác, hoặc **Dò tự động**: app gửi lần lượt lệnh Nguồn của từng bộ mã trong hãng; khi TV phản ứng, bạn bấm "TV đã phản ứng" và app nạp bộ mã đó.
- Thư viện **đánh số theo remote** (ví dụ `BN59-01315B`), không theo tên model TV (ví dụ `UA55AU7000`), vì nguồn dữ liệu là remote. Vì vậy dò tự động hữu ích khi bạn không biết remote nào.

## Giới hạn cần biết
- Mã do cộng đồng đóng góp, **chưa được kiểm chứng trên TV của bạn**: luôn thử từng nút.
- Chưa hỗ trợ các giao thức RC5, RC6, RC5X, RCA: các nút dùng giao thức này bị bỏ qua khi tạo thư viện (ảnh hưởng chính: Philips, một số TCL/Toshiba/Hitachi/JVC).
- Bộ Xiaomi TV trong nguồn **không có nút Nguồn** (nên không dò tự động được); các nút khác dùng bình thường.
- Chưa có thư viện điều hòa (mã điều hòa là khung trạng thái theo hãng, phức tạp hơn). Điều hòa vẫn nhập mã thủ công được.
- Casper không có trong nhóm TV của nguồn.

## Tạo lại thư viện
```bash
git clone --depth 1 https://github.com/logickworkshop/Flipper-IRDB.git
python3 -I tools/build-library.py ./Flipper-IRDB web/data/ir-library.js "$(git -C Flipper-IRDB rev-parse HEAD)"
node tests/library.test.js     # kiểm tra mọi mã đều mã hóa được
bash tools/sync-web.sh
```
Muốn thêm hãng: thêm tên vào `BRANDS` trong `tools/build-library.py`. Muốn thêm giao thức: xem `NATIVE-BRIDGE.md` mục "Thêm giao thức mới".

## Cấu trúc một mục
```json
{
  "brand": "Samsung", "model": "tên remote", "models": ["tên remote", "..."], "type": "tv",
  "source": { "name": "Flipper-IRDB", "license": "CC0-1.0", "url": "...", "files": ["..."] },
  "codes": {
    "power": { "spec": { "protocol": "samsung32", "address": 7, "command": 2 } },
    "netflix": { "label": "Netflix", "spec": { "protocol": "raw", "freq": 38000, "pattern": [4500, 4500] } }
  }
}
```
Giao thức: `nec, necext, samsung32, sirc12, sirc15, sirc20, kaseikyo, raw`.
Khóa chuẩn TV: `power, vol_up, vol_down, mute, ch_up, ch_down, up, down, left, right, ok, back, home, menu, source, 0–9, src_hdmi, src_av, src_tv`. Khóa khác hiện ở mục "Lệnh đã nhập" của remote.

## Mã riêng của bạn
Import trong IR Setup mục 4 (Flipper `.ir`, Pronto, giao thức, raw, JSON) và thử từng nút. Mã bạn đã xác nhận (✓) được lưu cùng thiết bị.
