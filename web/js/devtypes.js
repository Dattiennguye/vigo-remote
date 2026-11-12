/* VIGO — danh mục loại thiết bị. TV/đầu thu/TV box/đầu đĩa/loa/quạt/đèn/máy chiếu/... đều là "thiết bị có bảng phím" (codes);
 * điều hòa là loại riêng (có trạng thái). Dùng chung cho Store, Cài đặt, Điều khiển. */
(function (root) {
  'use strict';
  var LIST = [
    { id: 'tv', icon: 'tv', label: 'TV', sample: 'TV của tôi', hint: 'Samsung, LG, Sony, TCL, Xiaomi, Panasonic…' },
    { id: 'ac', icon: 'ac', label: 'Điều hòa', sample: 'Điều hòa', hint: 'Daikin, Panasonic, LG, Samsung, Midea, Gree, Casper…' },
    { id: 'stb', icon: 'stb', label: 'Đầu thu truyền hình', sample: 'Đầu thu', hint: 'Đầu thu cáp, vệ tinh, DVB-T2, TV tuner…',
      note: 'Đầu thu của nhà mạng trong nước (VTVcab, K+, MyTV, FPT Play…) có thể chưa có sẵn. Khi đó chọn “Hãng khác / tự nhập mã”.' },
    { id: 'box', icon: 'box', label: 'TV box / thiết bị stream', sample: 'TV box', hint: 'Roku, Apple TV, Fire TV, Chromecast, Android TV box…',
      note: 'Nhiều TV box dùng Bluetooth hoặc Wi-Fi thay vì hồng ngoại, các loại đó không điều khiển được bằng app này.' },
    { id: 'disc', icon: 'disc', label: 'Đầu DVD / Blu-ray', sample: 'Đầu đĩa', hint: 'DVD, Blu-ray, CD, VCR…' },
    { id: 'audio', icon: 'speaker', label: 'Loa, soundbar, amply', sample: 'Loa', hint: 'Sony, Samsung, LG, JBL, Yamaha, Denon, Pioneer…' },
    { id: 'fan', icon: 'fan', label: 'Quạt điện', sample: 'Quạt', hint: 'Quạt đứng, quạt cây, quạt trần có điều khiển…' },
    { id: 'light', icon: 'bulb', label: 'Đèn LED', sample: 'Đèn', hint: 'Dải LED, đèn đổi màu, đèn trần có điều khiển…' },
    { id: 'proj', icon: 'proj', label: 'Máy chiếu', sample: 'Máy chiếu', hint: 'Epson, BenQ, Sony, Optoma, ViewSonic…' },
    { id: 'air', icon: 'air', label: 'Sưởi, lọc khí, tạo ẩm', sample: 'Máy sưởi', hint: 'Máy sưởi, lọc không khí, máy tạo ẩm…' },
    { id: 'other', icon: 'remote', label: 'Thiết bị khác', sample: 'Thiết bị', hint: 'Màn hình, máy chơi game, robot hút bụi, khung ảnh…' }
  ];
  var byId = {}; LIST.forEach(function (t) { byId[t.id] = t; });
  root.VigoDevTypes = {
    list: LIST,
    has: function (id) { return !!byId[id]; },
    get: function (id) { return byId[id] || byId.other; },
    label: function (id) { return (byId[id] || byId.other).label; },
    icon: function (id) { return (byId[id] || byId.other).icon; },
    keyed: function (id) { return !!byId[id] && id !== 'ac'; }   /* có bảng phím (codes) */
  };
})(typeof window !== 'undefined' ? window : globalThis);
