/* VIGO — thư viện mã IR (có thể mở rộng).
 *
 * QUY TẮC: không tự tạo mã. Một mục (entries[]) chỉ được thêm khi có nguồn xác thực
 * (ví dụ tệp Flipper-IRDB) hoặc do người dùng nhập và đã kiểm tra thực tế.
 * Phiên bản này chưa kèm mã dựng sẵn vì chưa có cách xác minh nguồn trong lúc phát triển;
 * dùng IR Setup để import (Flipper .ir / Pronto / giao thức / raw / JSON thư viện).
 *
 * Cấu trúc một mục:
 * {
 *   brand: "Samsung", model: "UA55...", type: "tv" | "ac",
 *   source: { name: "Flipper-IRDB", url: "https://...", license: "..." },
 *   codes: {
 *     "power":   { "spec": { "protocol": "samsung32", "address": "0x07", "command": "0x02" } },
 *     "vol_up":  { "spec": { "protocol": "raw", "freq": 38000, "pattern": [4500, 4500, 560, ...] } }
 *   }
 * }
 * Giao thức hỗ trợ: nec, necext, samsung32, sirc12, sirc15, sirc20, raw (xem js/ir-protocols.js).
 * Thêm giao thức mới: thêm một mục vào VigoIR.PROTOCOLS với hàm encode(spec).
 */
window.VIGO_LIBRARY = {
  version: 1,
  brands: ['Samsung', 'LG', 'Sony', 'TCL', 'Hisense', 'Xiaomi', 'Panasonic', 'Sharp', 'Toshiba', 'Casper', 'Daikin', 'Mitsubishi'],
  entries: []
};
