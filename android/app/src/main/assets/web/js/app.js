/* VIGO Universal Remote — giao diện (HTML/CSS/JS thuần, chạy ngoại tuyến). */
(function () {
  'use strict';

  var IR = window.VigoIR, Bridge = window.IRBridge, Store = window.VigoStore, LIB = window.VIGO_LIBRARY;
  var app = document.getElementById('app');
  var viewTimers = [];

  /* ---------- tiện ích DOM (không dùng innerHTML với dữ liệu người dùng) ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(el, x); });
    else if (typeof c === 'string' || typeof c === 'number') el.appendChild(document.createTextNode(String(c)));
    else el.appendChild(c);
  }
  var ICONS = {
    power: '<path d="M12 3v9"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>',
    tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
    ac: '<rect x="3" y="4" width="18" height="8" rx="2"/><path d="M7 16c0 1.5-1 2-1 4M12 16c0 1.5-1 2-1 4M17 16c0 1.5-1 2-1 4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l4 6M21 9l-4 6"/>',
    back: '<path d="M15 5l-7 7 7 7"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'
  };
  function icon(name) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.innerHTML = ICONS[name] || '';
    return s;
  }
  function logo() {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 40 40');
    s.innerHTML = '<defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2EE6C5"/><stop offset="1" stop-color="#6C7CFF"/></linearGradient></defs><rect x="9" y="3" width="22" height="34" rx="8" fill="url(#lg)"/><circle cx="20" cy="12" r="3.4" fill="#0B0D12"/><circle cx="20" cy="22" r="2" fill="#0B0D12"/><circle cx="20" cy="29" r="2" fill="#0B0D12"/>';
    return h('div', { class: 'logo' }, s, h('span', { text: 'VIGO' }));
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function hhmm(t) { var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

  /* ---------- toast / sheet / xác nhận ---------- */
  var toastEl = document.getElementById('toast'), toastT = null;
  function toast(kind, text) {
    toastEl.className = 'toast ' + kind; toastEl.textContent = text; toastEl.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.hidden = true; }, kind === 'ok' ? 2200 : 5200);
  }
  var sheetEl = document.getElementById('sheet');
  function openSheet(node) {
    sheetEl.replaceChildren(h('div', { class: 'panel' }, node)); sheetEl.hidden = false;
  }
  function closeSheet() { sheetEl.hidden = true; sheetEl.replaceChildren(); }
  sheetEl.addEventListener('click', function (e) { if (e.target === sheetEl) closeSheet(); });
  function askConfirm(text, okLabel, onOk) {
    openSheet(h('div', null,
      h('h3', { text: text }),
      h('div', { class: 'row', style: 'margin-top:14px' },
        h('button', { class: 'btn grow', text: 'Hủy', onclick: closeSheet }),
        h('button', { class: 'btn danger grow', text: okLabel, onclick: function () { closeSheet(); onOk(); } }))));
  }

  /* ---------- định nghĩa nút ---------- */
  var TV_KEYS = [['power', 'Nguồn'], ['vol_up', 'Âm lượng +'], ['vol_down', 'Âm lượng −'], ['mute', 'Tắt tiếng'], ['ch_up', 'Kênh +'], ['ch_down', 'Kênh −'],
    ['up', 'Lên'], ['down', 'Xuống'], ['left', 'Trái'], ['right', 'Phải'], ['ok', 'OK'], ['back', 'Quay lại'], ['home', 'Home'], ['menu', 'Menu'],
    ['src_hdmi', 'HDMI'], ['src_av', 'AV'], ['src_tv', 'TV']];
  for (var d = 0; d <= 9; d++) TV_KEYS.push([String(d), 'Số ' + d]);
  var AC_KEYS = [['power', 'Bật/tắt (đảo trạng thái)'], ['power_on', 'Bật'], ['power_off', 'Tắt'], ['st_off', 'Khung trạng thái: Tắt'],
    ['temp_up', 'Nhiệt độ +'], ['temp_down', 'Nhiệt độ −'],
    ['mode_auto', 'Chế độ Tự động'], ['mode_cool', 'Chế độ Làm lạnh'], ['mode_dry', 'Chế độ Hút ẩm'], ['mode_fan', 'Chế độ Quạt'], ['mode_heat', 'Chế độ Sưởi'],
    ['fan_auto', 'Quạt Tự động'], ['fan_low', 'Quạt Thấp'], ['fan_mid', 'Quạt Vừa'], ['fan_high', 'Quạt Cao'],
    ['swing_v', 'Đảo gió lên/xuống'], ['swing_h', 'Đảo gió trái/phải']];
  var KEYS = { tv: TV_KEYS, ac: AC_KEYS };
  function keyLabel(dev, key) {
    var f = KEYS[dev.type].filter(function (k) { return k[0] === key; })[0];
    if (f) return f[1];
    if (/^st_/.test(key)) return 'Khung trạng thái ' + key.slice(3);
    return (dev.codes[key] && dev.codes[key].label) || key;
  }
  function isKnownKey(type, key) { return KEYS[type].some(function (k) { return k[0] === key; }) || (type === 'ac' && /^st_/.test(key)); }

  var ALIASES = { tv: {}, ac: {} };
  function aliasAdd(type, key, list) { list.forEach(function (n) { ALIASES[type][n] = key; }); }
  aliasAdd('tv', 'power', ['power', 'pwr', 'on_off', 'power_off', 'poweroff']);
  aliasAdd('tv', 'vol_up', ['vol_up', 'volume_up', 'vol_plus', 'volup', 'vol']);
  aliasAdd('tv', 'vol_down', ['vol_dn', 'vol_down', 'volume_down', 'vol_minus', 'voldown']);
  aliasAdd('tv', 'mute', ['mute']);
  aliasAdd('tv', 'ch_up', ['ch_next', 'ch_up', 'channel_up', 'ch_plus', 'chup']);
  aliasAdd('tv', 'ch_down', ['ch_prev', 'ch_down', 'channel_down', 'ch_minus', 'chdown']);
  ['up', 'down', 'left', 'right', 'home', 'menu', 'back'].forEach(function (k) { aliasAdd('tv', k, [k]); });
  aliasAdd('tv', 'ok', ['ok', 'enter', 'select']);
  aliasAdd('tv', 'src_hdmi', ['hdmi', 'hdmi1']); aliasAdd('tv', 'src_av', ['av']); aliasAdd('tv', 'src_tv', ['tv']);
  for (var n = 0; n <= 9; n++) aliasAdd('tv', String(n), [String(n), 'num_' + n, 'n' + n, 'digit_' + n]);
  aliasAdd('ac', 'power_off', ['off', 'power_off']); aliasAdd('ac', 'power', ['power']); aliasAdd('ac', 'power_on', ['on', 'power_on']);
  function normName(s) {
    return String(s).toLowerCase().replace(/\+/g, '_plus').replace(/-/g, '_minus').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'khac';
  }

  /* ---------- gửi lệnh ---------- */
  function press(dev, cands, label) {
    Bridge.vibrate(12);
    var key = cands.filter(function (k) { return dev.codes[k] && dev.codes[k].spec; })[0];
    if (!key) {
      toast('err', 'Thiết bị "' + dev.name + '" chưa có mã cho "' + label + '". Vào IR Setup để nhập mã.');
      Store.log({ dev: dev.name, label: label, status: 'error', msg: 'Chưa có mã' });
      return { ok: false, status: 'error' };
    }
    var r = Bridge.send(dev.codes[key].spec);
    Store.log({ dev: dev.name, label: label, status: r.status, msg: r.status === 'sent' ? '' : r.message });
    toast(r.status === 'sent' ? 'ok' : r.status === 'demo' ? 'demo' : 'err', r.status === 'sent' ? label + ' — ' + r.message : r.message);
    return r;
  }
  function hasCode(dev, keys) { return keys.some(function (k) { return dev.codes[k] && dev.codes[k].spec; }); }

  /* ---------- router ---------- */
  var currentSetupDev = null;
  function route() {
    var p = (location.hash.replace(/^#/, '') || 'home').split('/');
    return { name: p[0], arg: p[1] };
  }
  function refresh() { var st = app.scrollTop; render(); app.scrollTop = st; }
  function render() {
    viewTimers.forEach(clearInterval); viewTimers = [];
    var r = route();
    var views = { home: viewHome, devices: viewDevices, setup: viewSetup, device: viewDevice };
    app.replaceChildren((views[r.name] || viewHome)(r.arg));
    var tab = r.name === 'device' ? 'home' : r.name;
    Array.prototype.forEach.call(document.querySelectorAll('#nav a'), function (a) {
      a.classList.toggle('on', a.getAttribute('data-tab') === tab);
    });
  }
  window.addEventListener('hashchange', function () { render(); app.scrollTop = 0; });
  window.__vigoBack = function () {
    if (!sheetEl.hidden) { closeSheet(); return true; }
    if (route().name !== 'home') { location.hash = '#home'; return true; }
    return false;
  };

  /* ---------- Trang chủ ---------- */
  function irStatusChip() {
    var c = Bridge.check();
    if (c.mode === 'demo') return { chip: h('span', { class: 'chip demo' }, h('i', { class: 'dot' }), 'Chế độ Demo — không phát IR'), note: 'Ứng dụng chưa có Android Native Bridge nên mọi nút chỉ mô phỏng giao diện và sẽ báo rõ là chưa phát. Xem docs/NATIVE-BRIDGE.md.' };
    if (!c.hasEmitter) return { chip: h('span', { class: 'chip err' }, h('i', { class: 'dot' }), 'Máy không có mắt phát IR'), note: c.error || 'Không thể điều khiển thiết bị bằng hồng ngoại trên máy này.' };
    return { chip: h('span', { class: 'chip ok' }, h('i', { class: 'dot' }), 'Mắt phát IR sẵn sàng'), note: 'Hãy chạy kiểm tra trong IR Setup trước khi dùng lần đầu.' };
  }
  function viewHome() {
    var st = irStatusChip(), devs = Store.devices(), hist = Store.history();
    var root = h('div', null, h('div', { class: 'top' }, logo()));
    if (Store.error()) root.appendChild(h('div', { class: 'card' }, h('span', { class: 'chip err', text: 'Lỗi lưu trữ' }), h('p', { class: 'small', text: Store.error() })));
    root.appendChild(h('div', { class: 'card' }, h('div', { class: 'row wrap' }, h('b', { text: 'Trạng thái kết nối IR' }), st.chip), h('p', { class: 'muted', text: st.note })));

    devs.filter(function (x) { return x.timer && x.timer.overdue; }).forEach(function (dev) {
      root.appendChild(h('div', { class: 'card' },
        h('span', { class: 'chip warn', text: 'Hẹn giờ quá hạn' }),
        h('p', { text: 'Hẹn giờ tắt "' + dev.name + '" lúc ' + hhmm(dev.timer.deadline) + ' đã đến khi ứng dụng không chạy, nên lệnh tắt CHƯA được gửi.' }),
        h('div', { class: 'row' },
          h('button', { class: 'btn small grow', text: 'Gửi lệnh tắt ngay', onclick: function () { fireOff(dev); Store.update(dev.id, { timer: null }); refresh(); } }),
          h('button', { class: 'btn small grow', text: 'Bỏ qua', onclick: function () { Store.update(dev.id, { timer: null }); refresh(); } }))));
    });

    root.appendChild(h('div', { class: 'row', style: 'margin:18px 0 10px' }, h('h2', { style: 'margin:0;flex:1', text: 'Thiết bị đã lưu' }),
      h('button', { class: 'btn primary small', text: '+ Thêm thiết bị', onclick: function () { deviceForm(null); } })));
    if (!devs.length) root.appendChild(h('div', { class: 'card empty', text: 'Chưa có thiết bị nào. Bấm "Thêm thiết bị" để bắt đầu.' }));
    devs.forEach(function (dev) {
      var n = Object.keys(dev.codes).length;
      root.appendChild(h('div', { class: 'card dev', onclick: function () { location.hash = '#device/' + dev.id; } },
        h('div', { class: 'ic' }, icon(dev.type)),
        h('div', { class: 'meta' }, h('b', { text: dev.name }), h('span', { class: 'muted', text: (dev.type === 'tv' ? 'TV' : 'Điều hòa') + (dev.brand ? ' · ' + dev.brand : '') + (dev.model ? ' ' + dev.model : '') })),
        h('span', { class: 'chip ' + (n ? '' : 'warn'), text: n ? n + ' mã' : 'Chưa có mã' })));
    });

    root.appendChild(h('div', { class: 'row', style: 'margin:18px 0 6px' }, h('h2', { style: 'margin:0;flex:1', text: 'Lịch sử điều khiển' }),
      hist.length ? h('button', { class: 'btn small', text: 'Xóa', onclick: function () { Store.clearHistory(); refresh(); } }) : null));
    var box = h('div', { class: 'card' });
    if (!hist.length) box.appendChild(h('div', { class: 'empty', text: 'Chưa có lệnh nào.' }));
    hist.slice(0, 30).forEach(function (e) {
      var lab = e.status === 'sent' ? ['ok', 'Đã gửi lệnh tới mắt phát'] : e.status === 'demo' ? ['demo', 'Demo — không phát'] : ['err', 'Lỗi'];
      box.appendChild(h('div', { class: 'hist' }, h('div', { class: 't', text: hhmm(e.t) }),
        h('div', { class: 'm' }, h('b', { text: e.dev + ' · ' + e.label }), h('br'), h('span', { class: 'chip ' + lab[0], text: lab[1] }), e.msg ? h('div', { class: 'muted small', text: e.msg }) : null)));
    });
    root.appendChild(box);
    return root;
  }

  /* ---------- Quản lý thiết bị ---------- */
  function viewDevices() {
    var devs = Store.devices();
    var root = h('div', null, h('div', { class: 'top' }, h('div', { class: 'grow' }, h('h1', { text: 'Quản lý thiết bị' }), h('span', { class: 'muted', text: devs.length + ' thiết bị' })),
      h('button', { class: 'btn primary small', text: '+ Thêm', onclick: function () { deviceForm(null); } })));
    if (!devs.length) root.appendChild(h('div', { class: 'card empty', text: 'Chưa có thiết bị. Bấm "+ Thêm" để tạo thiết bị đầu tiên.' }));
    devs.forEach(function (dev) {
      var keys = Object.keys(dev.codes), ver = keys.filter(function (k) { return dev.codes[k].verified === true; }).length;
      root.appendChild(h('div', { class: 'card' },
        h('div', { class: 'dev' }, h('div', { class: 'ic' }, icon(dev.type)),
          h('div', { class: 'meta' }, h('b', { text: dev.name }), h('span', { class: 'muted', text: (dev.type === 'tv' ? 'TV' : 'Điều hòa') + (dev.brand ? ' · ' + dev.brand : '') + (dev.model ? ' ' + dev.model : '') }))),
        h('p', { class: 'muted small', text: keys.length + ' mã, ' + ver + ' mã đã xác nhận hoạt động' + (dev.source ? ' · nguồn: ' + dev.source : '') }),
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn small', text: 'Mở remote', onclick: function () { location.hash = '#device/' + dev.id; } }),
          h('button', { class: 'btn small', text: 'Nhập/kiểm tra mã', onclick: function () { currentSetupDev = dev.id; location.hash = '#setup'; } }),
          h('button', { class: 'btn small', text: 'Sửa', onclick: function () { deviceForm(dev); } }),
          h('button', { class: 'btn small danger', text: 'Xóa', onclick: function () { askConfirm('Xóa thiết bị "' + dev.name + '" và toàn bộ mã đã lưu?', 'Xóa', function () { Store.remove(dev.id); if (currentSetupDev === dev.id) currentSetupDev = null; refresh(); }); } }))));
    });
    return root;
  }

  function deviceForm(dev) {
    var edit = !!dev;
    var name = h('input', { value: edit ? dev.name : '', maxlength: '40', placeholder: 'Ví dụ: TV phòng khách' });
    var type = h('select', { disabled: edit }, h('option', { value: 'tv', text: 'TV' }), h('option', { value: 'ac', text: 'Điều hòa' }));
    if (edit) type.value = dev.type;
    var brandSel = h('select', null, h('option', { value: '', text: '— Chọn hãng —' }));
    LIB.brands.forEach(function (b) { brandSel.appendChild(h('option', { value: b, text: b })); });
    brandSel.appendChild(h('option', { value: '__other', text: 'Khác (tự nhập)' }));
    var brandOther = h('input', { placeholder: 'Tên hãng', style: 'display:none;margin-top:8px', maxlength: '30' });
    if (edit && dev.brand) { if (LIB.brands.indexOf(dev.brand) >= 0) brandSel.value = dev.brand; else { brandSel.value = '__other'; brandOther.value = dev.brand; brandOther.style.display = ''; } }
    brandSel.addEventListener('change', function () { brandOther.style.display = brandSel.value === '__other' ? '' : 'none'; refreshLib(); });
    var model = h('input', { value: edit ? dev.model : '', maxlength: '40', placeholder: 'Ví dụ: UA55AU7000 (tùy chọn)' });
    var libWrap = h('div');
    var libSel = null;
    function curBrand() { return brandSel.value === '__other' ? brandOther.value.trim() : brandSel.value; }
    function refreshLib() {
      libWrap.replaceChildren(); libSel = null;
      if (edit) return;
      var list = LIB.entries.filter(function (e) { return e.type === type.value && (!curBrand() || e.brand === curBrand()); });
      if (!list.length) { libWrap.appendChild(h('p', { class: 'muted small', text: 'Thư viện chưa có mã dựng sẵn cho lựa chọn này. Sau khi lưu, hãy nhập mã trong IR Setup (Flipper .ir, Pronto, giao thức hoặc raw).' })); return; }
      libSel = h('select', null, h('option', { value: '', text: '— Không dùng, tự nhập mã sau —' }));
      list.forEach(function (e, i) { libSel.appendChild(h('option', { value: String(LIB.entries.indexOf(e)), text: e.brand + ' ' + e.model })); });
      libWrap.appendChild(h('label', { text: 'Bộ mã từ thư viện' })); libWrap.appendChild(libSel);
    }
    type.addEventListener('change', refreshLib); refreshLib();
    var err = h('p', { class: 'small', style: 'color:var(--err)' });
    function save() {
      var nm = name.value.trim();
      if (!nm) { err.textContent = 'Hãy đặt tên cho thiết bị.'; return; }
      if (brandSel.value === '__other' && !brandOther.value.trim()) { err.textContent = 'Hãy nhập tên hãng.'; return; }
      var patch = { name: nm, brand: curBrand(), model: model.value.trim() };
      if (edit) { Store.update(dev.id, patch); closeSheet(); refresh(); return; }
      patch.type = type.value;
      if (libSel && libSel.value !== '') {
        var en = LIB.entries[Number(libSel.value)];
        patch.codes = clone(en.codes); patch.source = en.source && en.source.name ? en.source.name : '';
      }
      var created = Store.add(patch);
      closeSheet();
      if (Object.keys(created.codes).length) location.hash = '#device/' + created.id;
      else { currentSetupDev = created.id; location.hash = '#setup'; toast('demo', 'Đã tạo thiết bị. Hãy nhập mã IR cho thiết bị này.'); }
    }
    openSheet(h('div', null, h('h1', { text: edit ? 'Sửa thiết bị' : 'Thêm thiết bị' }),
      h('label', { text: 'Tên tùy chỉnh' }), name, h('label', { text: 'Loại thiết bị' }), type,
      h('label', { text: 'Hãng' }), brandSel, brandOther, h('label', { text: 'Model' }), model, libWrap, err,
      h('div', { class: 'row', style: 'margin-top:14px' }, h('button', { class: 'btn grow', text: 'Hủy', onclick: closeSheet }), h('button', { class: 'btn primary grow', text: 'Lưu', onclick: save }))));
  }

  /* ---------- Màn hình remote ---------- */
  function viewDevice(id) {
    var dev = Store.get(id);
    if (!dev) return h('div', { class: 'card empty' }, h('p', { text: 'Không tìm thấy thiết bị (có thể đã bị xóa).' }), h('button', { class: 'btn', text: 'Về trang chủ', onclick: function () { location.hash = '#home'; } }));
    var root = h('div', null, h('div', { class: 'top' },
      h('button', { class: 'btn small', 'aria-label': 'Quay lại', onclick: function () { location.hash = '#home'; } }, icon('back')),
      h('div', { class: 'grow' }, h('h1', { text: dev.name }), h('span', { class: 'muted', text: (dev.type === 'tv' ? 'TV' : 'Điều hòa') + (dev.brand ? ' · ' + dev.brand : '') })),
      h('button', { class: 'btn small', 'aria-label': 'Sửa thiết bị', onclick: function () { deviceForm(dev); } }, icon('gear'))));
    var m = Bridge.mode();
    if (m === 'demo') root.appendChild(h('div', { class: 'card' }, h('span', { class: 'chip demo', text: 'Chế độ Demo — các nút KHÔNG phát IR' })));
    if (!Object.keys(dev.codes).length) root.appendChild(h('div', { class: 'card' }, h('span', { class: 'chip warn', text: 'Chưa có mã IR' }), h('p', { class: 'small', text: 'Thiết bị chưa có mã nào nên mọi nút sẽ báo lỗi. Nhập mã trong IR Setup.' }),
      h('button', { class: 'btn small', text: 'Mở IR Setup', onclick: function () { currentSetupDev = dev.id; location.hash = '#setup'; } })));
    root.appendChild(dev.type === 'tv' ? tvPanel(dev) : acPanel(dev));
    return root;
  }

  function rb(dev, content, keys, label, cls) {
    var has = hasCode(dev, keys);
    return h('button', { class: 'rb ' + (cls || '') + (has ? '' : ' nocode'), 'aria-label': label, title: has ? label : label + ' — chưa có mã', onclick: function () { press(dev, keys, label); } }, content);
  }
  function extras(dev) {
    var ks = Object.keys(dev.codes).filter(function (k) { return !isKnownKey(dev.type, k); });
    if (!ks.length) return null;
    return h('div', null, h('h2', { text: 'Lệnh đã nhập' }), h('div', { class: 'pad g3' }, ks.map(function (k) { return rb(dev, keyLabel(dev, k), [k], keyLabel(dev, k), 'sm'); })));
  }

  function tvPanel(dev) {
    var P = function (k) { return [k]; };
    var wrap = h('div', null);
    wrap.appendChild(h('div', { class: 'pad g2' }, rb(dev, icon('power'), P('power'), 'Nguồn', 'pwr'), rb(dev, icon('mute'), P('mute'), 'Tắt tiếng')));
    wrap.appendChild(h('div', { style: 'display:grid;grid-template-columns:76px 1fr 76px;gap:10px;margin:14px 0;align-items:center' },
      h('div', { class: 'pair' }, rb(dev, icon('plus'), P('vol_up'), 'Âm lượng +'), h('span', { text: 'ÂM LƯỢNG' }), rb(dev, icon('minus'), P('vol_down'), 'Âm lượng −')),
      h('div', { class: 'dpad' }, h('span'), rb(dev, '▲', P('up'), 'Lên'), h('span'), rb(dev, '◀', P('left'), 'Trái'), rb(dev, 'OK', P('ok'), 'OK', 'ok'), rb(dev, '▶', P('right'), 'Phải'), h('span'), rb(dev, '▼', P('down'), 'Xuống'), h('span')),
      h('div', { class: 'pair' }, rb(dev, icon('plus'), P('ch_up'), 'Kênh +'), h('span', { text: 'KÊNH' }), rb(dev, icon('minus'), P('ch_down'), 'Kênh −'))));
    wrap.appendChild(h('div', { class: 'pad g3' }, rb(dev, 'Quay lại', P('back'), 'Quay lại', 'sm'), rb(dev, 'Home', P('home'), 'Home', 'sm'), rb(dev, 'Menu', P('menu'), 'Menu', 'sm')));
    var num = h('div', { class: 'pad g3', style: 'margin-top:14px' });
    for (var i = 1; i <= 9; i++) num.appendChild(rb(dev, String(i), P(String(i)), 'Số ' + i));
    num.appendChild(h('span')); num.appendChild(rb(dev, '0', P('0'), 'Số 0')); num.appendChild(h('span'));
    wrap.appendChild(num);
    wrap.appendChild(h('h2', { text: 'Nguồn vào' }));
    wrap.appendChild(h('div', { class: 'pad g3' }, rb(dev, 'HDMI', P('src_hdmi'), 'HDMI', 'sm'), rb(dev, 'AV', P('src_av'), 'AV', 'sm'), rb(dev, 'TV', P('src_tv'), 'TV', 'sm')));
    add(wrap, extras(dev));
    return wrap;
  }

  var AC_MODES = [['auto', 'Tự động'], ['cool', 'Làm lạnh'], ['dry', 'Hút ẩm'], ['fan', 'Quạt'], ['heat', 'Sưởi']];
  var AC_FANS = [['auto', 'Tự động'], ['low', 'Thấp'], ['mid', 'Vừa'], ['high', 'Cao']];
  function stKey(s, o) { o = o || {}; return 'st_' + (o.mode || s.mode) + '_' + (o.temp || s.temp) + '_' + (o.fan || s.fan); }

  function acPanel(dev) {
    var s = dev.state;
    function act(label, cands, commit) {
      var r = press(dev, cands, label);
      if (r.status === 'sent' || r.status === 'demo') { commit(); Store.persist(); refresh(); }
    }
    var wrap = h('div', null);

    var pwrCands = s.power ? ['st_off', 'power_off', 'power'] : [stKey(s), 'power_on', 'power'];
    wrap.appendChild(h('button', {
      class: 'rb pwr block' + (hasCode(dev, pwrCands) ? '' : ' nocode'), style: 'width:100%;grid-auto-flow:column;gap:10px;place-content:center', 'aria-label': s.power ? 'Tắt điều hòa' : 'Bật điều hòa',
      onclick: function () { act(s.power ? 'Tắt' : 'Bật', pwrCands, function () { s.power = !s.power; }); }
    }, icon('power'), h('span', { text: s.power ? 'Tắt điều hòa' : 'Bật điều hòa' })));
    wrap.appendChild(h('p', { class: 'muted small', style: 'text-align:center', text: 'Trạng thái hiển thị là ghi nhớ của ứng dụng, không đọc lại được từ điều hòa.' }));

    function temp(delta) {
      if (!s.power) { toast('err', 'Hãy bật điều hòa trước khi chỉnh nhiệt độ.'); return; }
      var t = Math.max(16, Math.min(30, s.temp + delta));
      if (t === s.temp) { toast('err', 'Nhiệt độ chỉ chỉnh trong khoảng 16–30 °C.'); return; }
      act('Nhiệt độ ' + t + '°C', [stKey(s, { temp: t }), delta > 0 ? 'temp_up' : 'temp_down'], function () { s.temp = t; });
    }
    wrap.appendChild(h('div', { class: 'card', style: 'margin-top:10px' }, h('div', { class: 'row' },
      h('button', { class: 'rb', style: 'width:72px', 'aria-label': 'Giảm nhiệt độ', onclick: function () { temp(-1); } }, icon('minus')),
      h('div', { class: 'ac-temp grow' }, h('span', { class: 'val', text: String(s.temp) }), h('span', { class: 'unit', text: ' °C' })),
      h('button', { class: 'rb', style: 'width:72px', 'aria-label': 'Tăng nhiệt độ', onclick: function () { temp(1); } }, icon('plus')))));

    function opts(title, list, cur, mk, keyFor) {
      var g = h('div', { class: 'pad', style: 'grid-template-columns:repeat(' + (list.length > 4 ? 3 : list.length) + ',1fr)' });
      list.forEach(function (o) {
        var cands = [mk(o[0]), keyFor(o[0])];
        g.appendChild(h('button', { class: 'opt' + (cur === o[0] ? ' on' : '') + (hasCode(dev, cands) ? '' : ' nocode'), onclick: function () {
          if (!s.power) { toast('err', 'Hãy bật điều hòa trước.'); return; }
          act(title + ' ' + o[1], cands, function () { if (title === 'Chế độ') s.mode = o[0]; else s.fan = o[0]; });
        }, text: o[1] }));
      });
      return h('div', null, h('h2', { text: title }), g);
    }
    wrap.appendChild(opts('Chế độ', AC_MODES, s.mode, function (m) { return stKey(s, { mode: m }); }, function (m) { return 'mode_' + m; }));
    wrap.appendChild(opts('Tốc độ quạt', AC_FANS, s.fan, function (f) { return stKey(s, { fan: f }); }, function (f) { return 'fan_' + f; }));

    wrap.appendChild(h('h2', { text: 'Hướng gió' }));
    function swing(label, key, field) {
      return h('button', { class: 'opt' + (s[field] ? ' on' : '') + (hasCode(dev, [key]) ? '' : ' nocode'), onclick: function () {
        if (!s.power) { toast('err', 'Hãy bật điều hòa trước.'); return; }
        act(label, [key], function () { s[field] = !s[field]; });
      }, text: label + (s[field] ? ': Bật' : ': Tắt') });
    }
    wrap.appendChild(h('div', { class: 'pad g2' }, swing('Đảo gió lên/xuống', 'swing_v', 'swingV'), swing('Đảo gió trái/phải', 'swing_h', 'swingH')));

    wrap.appendChild(timerCard(dev));
    add(wrap, extras(dev));
    return wrap;
  }

  function offCandidates() { return ['st_off', 'power_off', 'power']; }
  function fireOff(dev) {
    var r = press(dev, offCandidates(), 'Hẹn giờ tắt');
    if (r.status === 'sent' || r.status === 'demo') { var d = Store.get(dev.id); if (d) { d.state.power = false; Store.persist(); } }
  }
  function timerCard(dev) {
    var card = h('div', { class: 'card', style: 'margin-top:14px' }, h('h3', { text: 'Hẹn giờ tắt' }));
    var info = h('p', { class: 'muted small' });
    function paint() {
      var d = Store.get(dev.id);
      if (d && d.timer && !d.timer.overdue) {
        var left = Math.max(0, Math.round((d.timer.deadline - Date.now()) / 1000));
        info.textContent = 'Sẽ gửi lệnh tắt lúc ' + hhmm(d.timer.deadline) + ' (còn ' + Math.floor(left / 60) + ' phút ' + (left % 60) + ' giây).';
      } else info.textContent = 'Chưa đặt hẹn giờ.';
    }
    paint(); viewTimers.push(setInterval(paint, 1000));
    card.appendChild(info);
    var row = h('div', { class: 'row wrap' });
    [[30, '30 phút'], [60, '1 giờ'], [120, '2 giờ'], [240, '4 giờ'], [480, '8 giờ']].forEach(function (p) {
      row.appendChild(h('button', { class: 'btn small', text: p[1], onclick: function () {
        if (!hasCode(dev, offCandidates())) { toast('err', 'Thiết bị chưa có mã Tắt (st_off / power_off / power) nên không thể hẹn giờ tắt.'); return; }
        Store.update(dev.id, { timer: { deadline: Date.now() + p[0] * 60000, overdue: false } }); toast('ok', 'Đã đặt hẹn giờ tắt sau ' + p[1] + '.'); paint();
      } }));
    });
    row.appendChild(h('button', { class: 'btn small danger', text: 'Hủy', onclick: function () { Store.update(dev.id, { timer: null }); paint(); } }));
    card.appendChild(row);
    card.appendChild(h('p', { class: 'muted small', text: 'Hẹn giờ chạy trong ứng dụng: cần giữ ứng dụng mở. Nếu ứng dụng bị đóng, lệnh sẽ không được gửi và app sẽ báo lại ở Trang chủ.' }));
    return card;
  }

  function tickTimers() {
    var now = Date.now();
    Store.devices().forEach(function (dev) {
      if (dev.timer && !dev.timer.overdue && dev.timer.deadline <= now) {
        Store.update(dev.id, { timer: null });
        fireOff(dev);
        if (route().name === 'device' && route().arg === dev.id) refresh();
      }
    });
  }

  /* ---------- IR Setup ---------- */
  var setup = { work: null, devId: null, src: [], dirty: false, tab: 'flipper', tried: {}, hw: [] };

  function loadWork(id) {
    var dev = Store.get(id);
    setup.devId = dev ? dev.id : null;
    setup.work = dev ? clone(dev.codes) : null;
    setup.src = dev && dev.source ? [dev.source] : [];
    setup.dirty = false; setup.tried = {};
  }
  function putCode(key, spec, label, srcName) {
    IR.encode(spec);
    setup.work[key] = { spec: spec, label: label || undefined };
    if (srcName && setup.src.indexOf(srcName) < 0) setup.src.push(srcName);
    setup.dirty = true; delete setup.tried[key];
  }
  function specSummary(spec) {
    if (spec.protocol === 'raw') return 'raw · ' + spec.pattern.length + ' xung · ' + spec.freq + ' Hz';
    return spec.protocol + ' · addr ' + spec.address + ' · cmd ' + spec.command;
  }

  function viewSetup() {
    var devs = Store.devices();
    if (!setup.devId || !Store.get(setup.devId)) setup.devId = null;
    if (currentSetupDev && Store.get(currentSetupDev) && currentSetupDev !== setup.devId) { loadWork(currentSetupDev); }
    currentSetupDev = null;
    if (!setup.devId && devs.length) loadWork(devs[0].id);
    var dev = setup.devId ? Store.get(setup.devId) : null;
    var root = h('div', null, h('div', { class: 'top' }, h('div', { class: 'grow' }, h('h1', { text: 'IR Setup' }), h('span', { class: 'muted', text: 'Kiểm tra phần cứng · nhập mã · thử từng nút' }))));

    /* 1. Phần cứng */
    var hwBox = h('div');
    setup.hw.forEach(function (l) { hwBox.appendChild(h('p', { class: 'small', style: 'color:' + (l[0] === 'ok' ? 'var(--ok)' : l[0] === 'err' ? 'var(--err)' : l[0] === 'demo' ? 'var(--demo)' : 'var(--text)'), text: l[1] })); });
    root.appendChild(h('div', { class: 'card' }, h('h3', { text: '1. Kiểm tra phần cứng' }),
      h('p', { class: 'muted small', text: 'Trên Xiaomi 14, mắt phát IR thường nằm ở cạnh trên của máy. Hướng nó vào thiết bị cần điều khiển.' }),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn small', text: 'Kiểm tra mắt phát IR', onclick: function () {
          var c = Bridge.check(), L = [];
          if (c.mode === 'demo') L.push(['demo', 'Không có Android Native Bridge → chế độ Demo. Không thể kiểm tra phần cứng.']);
          else if (!c.hasEmitter) L.push(['err', c.error || 'Máy này KHÔNG có mắt phát hồng ngoại.']);
          else {
            L.push(['ok', 'Máy có mắt phát hồng ngoại.']);
            if (c.ranges.length) {
              L.push(['', 'Dải tần hỗ trợ: ' + c.ranges.map(function (r) { return r[0] + '–' + r[1] + ' Hz'; }).join(', ')]);
              [38000, 40000].forEach(function (f) { L.push([c.ranges.some(function (r) { return f >= r[0] && f <= r[1]; }) ? 'ok' : 'err', (f / 1000) + ' kHz: ' + (c.ranges.some(function (r) { return f >= r[0] && f <= r[1]; }) ? 'hỗ trợ' : 'KHÔNG hỗ trợ')]); });
            } else L.push(['err', c.error || 'Không đọc được dải tần số.']);
          }
          setup.hw = L; refresh();
        } }),
        h('button', { class: 'btn small', text: 'Kiểm tra khả năng phát', onclick: function () {
          var r = Bridge.selfTest(), L = setup.hw.slice();
          if (r.status === 'sent') L.push(['ok', 'Hệ điều hòa đã nhận lệnh phát thử (không có phản hồi từ thiết bị đích). Để chắc mắt phát hoạt động: mở camera TRƯỚC, hướng mắt phát IR vào ống kính rồi bấm lại — sẽ thấy đốm sáng tím nhạt.']);
          else L.push([r.status === 'demo' ? 'demo' : 'err', r.message]);
          setup.hw = L; refresh();
        } })),
      hwBox));

    /* 2. Chọn thiết bị */
    var card2 = h('div', { class: 'card' }, h('h3', { text: '2. Thiết bị cần cấu hình' }));
    if (!devs.length) {
      card2.appendChild(h('p', { class: 'muted', text: 'Chưa có thiết bị. Hãy thêm thiết bị trước.' }));
      card2.appendChild(h('button', { class: 'btn primary small', text: '+ Thêm thiết bị', onclick: function () { deviceForm(null); } }));
      root.appendChild(card2); return root;
    }
    var sel = h('select', null, devs.map(function (x) { return h('option', { value: x.id, text: x.name + ' (' + (x.type === 'tv' ? 'TV' : 'Điều hòa') + ')' }); }));
    sel.value = setup.devId;
    sel.addEventListener('change', function () {
      var nid = sel.value;
      function go() { loadWork(nid); refresh(); }
      if (setup.dirty) { sel.value = setup.devId; askConfirm('Bỏ các thay đổi chưa lưu của thiết bị hiện tại?', 'Bỏ thay đổi', go); } else go();
    });
    card2.appendChild(sel);
    root.appendChild(card2);

    /* 3. Nhập mã */
    var tabs = [['flipper', 'Flipper .ir'], ['proto', 'Giao thức'], ['pronto', 'Pronto'], ['raw', 'Raw'], ['json', 'JSON thư viện']];
    var seg = h('div', { class: 'seg' }, tabs.map(function (t) { return h('button', { class: setup.tab === t[0] ? 'on' : '', text: t[1], onclick: function () { setup.tab = t[0]; refresh(); } }); }));
    var msg = h('p', { class: 'small', 'aria-live': 'polite' });
    function say(ok, t) { msg.style.color = ok ? 'var(--ok)' : 'var(--err)'; msg.textContent = t; }
    function done() { refresh(); }
    var form = importForm(dev, say, done);
    root.appendChild(h('div', { class: 'card' }, h('h3', { text: '3. Nhập mã IR' }),
      h('p', { class: 'muted small', text: 'Điện thoại không có mắt thu IR nên không "học" trực tiếp từ remote. Hãy import mã từ nguồn xác thực (ví dụ tệp Flipper-IRDB) hoặc nhập mã bạn biết, rồi thử từng nút.' }), seg, form, msg));

    /* 4. Thử từng nút */
    var native = Bridge.mode() === 'native';
    var card4 = h('div', { class: 'card' }, h('h3', { text: '4. Thử từng nút' }));
    var keys = Object.keys(setup.work).sort();
    if (!keys.length) card4.appendChild(h('div', { class: 'empty', text: 'Chưa có mã nào. Hãy nhập mã ở bước 3.' }));
    else {
      if (!native) card4.appendChild(h('p', { class: 'small', style: 'color:var(--demo)', text: 'Chế độ Demo: có thể bấm "Thử" nhưng sẽ không phát IR, và không thể xác nhận nút hoạt động.' }));
      var tb = h('table');
      keys.forEach(function (k) {
        var c = setup.work[k], v = c.verified;
        tb.appendChild(h('tr', null,
          h('td', null, h('b', { text: keyLabel({ type: dev.type, codes: setup.work }, k) }), h('div', { class: 'muted small', text: k + ' · ' + specSummary(c.spec) }),
            h('span', { class: 'chip ' + (v === true ? 'ok' : v === false ? 'err' : ''), text: v === true ? 'Hoạt động' : v === false ? 'Không phản ứng' : 'Chưa thử' })),
          h('td', { style: 'text-align:right;white-space:nowrap' },
            h('button', { class: 'btn small', text: 'Thử', onclick: function () {
              var r = Bridge.send(c.spec);
              if (r.status === 'sent') { setup.tried[k] = true; toast('ok', 'Đã phát. Thiết bị có phản ứng không? Bấm ✓ hoặc ✗.'); }
              else toast(r.status === 'demo' ? 'demo' : 'err', r.message);
              refresh();
            } }), ' ',
            h('button', { class: 'btn small', text: '✓', 'aria-label': 'Nút hoạt động', disabled: !(native && setup.tried[k]), title: 'Bấm Thử trước, rồi xác nhận', onclick: function () { c.verified = true; setup.dirty = true; refresh(); } }), ' ',
            h('button', { class: 'btn small', text: '✗', 'aria-label': 'Nút không phản ứng', disabled: !(native && setup.tried[k]), onclick: function () { c.verified = false; setup.dirty = true; refresh(); } }), ' ',
            h('button', { class: 'btn small danger', text: 'Xóa', onclick: function () { delete setup.work[k]; setup.dirty = true; refresh(); } }))));
      });
      card4.appendChild(tb);
    }
    root.appendChild(card4);

    /* 5. Lưu */
    var anyOk = Object.keys(setup.work).some(function (k) { return setup.work[k].verified === true; });
    function commit() {
      var okSave = Store.update(setup.devId, { codes: clone(setup.work), source: setup.src.join('; ') });
      if (Store.error()) { toast('err', Store.error()); return; }
      if (okSave) { setup.dirty = false; toast('ok', 'Đã lưu cấu hình thiết bị.'); refresh(); }
    }
    root.appendChild(h('div', { class: 'card' }, h('h3', { text: '5. Lưu cấu hình' }),
      h('p', { class: 'muted small', text: setup.dirty ? 'Có thay đổi chưa lưu.' : 'Không có thay đổi chưa lưu.' }),
      h('button', { class: 'btn primary block', text: 'Lưu cấu hình (đã kiểm tra thành công)', disabled: !(setup.dirty && anyOk && native), onclick: commit }),
      h('p', { class: 'muted small', text: native ? 'Chỉ bật khi ít nhất một nút đã được bạn xác nhận hoạt động (✓).' : 'Cần chế độ Native và xác nhận ít nhất một nút hoạt động.' }),
      h('button', { class: 'btn block', style: 'margin-top:8px', text: 'Lưu (chưa kiểm tra)', disabled: !setup.dirty, onclick: commit })));
    return root;
  }

  function keyPicker(dev) {
    var sel = h('select', null, KEYS[dev.type].map(function (k) { return h('option', { value: k[0], text: k[1] + ' (' + k[0] + ')' }); }));
    sel.appendChild(h('option', { value: '__custom', text: 'Khác (tự đặt tên)…' }));
    var custom = h('input', { placeholder: dev.type === 'ac' ? 'vd: st_cool_24_auto hoặc ten_nut' : 'tên nút, vd: favorite', style: 'display:none;margin-top:8px', maxlength: '40' });
    sel.addEventListener('change', function () { custom.style.display = sel.value === '__custom' ? '' : 'none'; });
    return {
      el: h('div', null, h('label', { text: 'Nút / chức năng' }), sel, custom),
      get: function () {
        if (sel.value !== '__custom') return { key: sel.value, label: undefined };
        var raw = custom.value.trim(); if (!raw) throw new Error('Hãy nhập tên nút.');
        var k = normName(raw);
        return { key: k, label: raw };
      }
    };
  }

  function importForm(dev, say, done) {
    var tab = setup.tab;
    function guard(fn) { return function () { try { fn(); } catch (e) { say(false, e.message); } }; }

    if (tab === 'flipper') {
      var ta = h('textarea', { placeholder: 'Dán nội dung tệp .ir vào đây hoặc chọn tệp', 'aria-label': 'Nội dung tệp Flipper .ir' });
      var fname = '';
      var file = h('input', { type: 'file', accept: '.ir,.txt,text/plain', onchange: function () {
        var f = file.files && file.files[0]; if (!f) return;
        var rd = new FileReader();
        rd.onload = function () { ta.value = String(rd.result); fname = f.name; say(true, 'Đã đọc tệp "' + f.name + '". Bấm "Nhập mã".'); };
        rd.onerror = function () { say(false, 'Không đọc được tệp. Hãy dán nội dung vào ô bên dưới.'); };
        rd.readAsText(f);
      } });
      return h('div', null, h('p', { class: 'muted small', text: 'Hỗ trợ giao thức NEC, NECext, Samsung32, SIRC/SIRC15/SIRC20 và raw. Giao thức khác sẽ được liệt kê là bị bỏ qua.' }), file, ta,
        h('button', { class: 'btn primary block', style: 'margin-top:10px', text: 'Nhập mã', onclick: guard(function () {
          if (!ta.value.trim()) throw new Error('Chưa có nội dung để nhập.');
          var r = IR.parseFlipperIr(ta.value), cnt = 0;
          r.ok.forEach(function (it) {
            var nn = normName(it.name), k = ALIASES[dev.type][nn] || nn;
            putCode(k, it.spec, ALIASES[dev.type][nn] ? undefined : it.name, 'Flipper .ir' + (fname ? ': ' + fname : ' (dán tay)')); cnt++;
          });
          if (!cnt) throw new Error('Không nhập được mã nào.' + (r.skipped.length ? ' Bỏ qua: ' + r.skipped.slice(0, 5).join('; ') : ''));
          done();
          toast('ok', 'Đã nhập ' + cnt + ' mã' + (r.skipped.length ? ', bỏ qua ' + r.skipped.length + ' (giao thức/định dạng chưa hỗ trợ).' : '.'));
        }) }));
    }
    if (tab === 'proto') {
      var kp = keyPicker(dev);
      var proto = h('select', null, Object.keys(IR.PROTOCOLS).map(function (k) { return h('option', { value: k, text: IR.PROTOCOLS[k].label }); }));
      var addr = h('input', { placeholder: 'Địa chỉ (hex), vd 07', autocapitalize: 'off' }), cmd = h('input', { placeholder: 'Lệnh (hex), vd 02', autocapitalize: 'off' });
      return h('div', null, h('p', { class: 'muted small', text: 'Chỉ nhập mã bạn lấy từ nguồn xác thực hoặc tự biết. App không tự đoán mã.' }), kp.el, h('label', { text: 'Giao thức' }), proto,
        h('label', { text: 'Địa chỉ' }), addr, h('label', { text: 'Lệnh' }), cmd,
        h('button', { class: 'btn primary block', style: 'margin-top:12px', text: 'Thêm mã', onclick: guard(function () {
          var k = kp.get(); putCode(k.key, { protocol: proto.value, address: IR.hexInt(addr.value), command: IR.hexInt(cmd.value) }, k.label, 'Nhập tay'); done();
        }) }));
    }
    if (tab === 'pronto') {
      var kp2 = keyPicker(dev), pt = h('textarea', { placeholder: '0000 006D 0022 0000 ...' });
      return h('div', null, kp2.el, h('label', { text: 'Chuỗi Pronto hex (dạng 0000)' }), pt,
        h('button', { class: 'btn primary block', style: 'margin-top:12px', text: 'Thêm mã', onclick: guard(function () {
          var k = kp2.get(); putCode(k.key, IR.parseProntoHex(pt.value), k.label, 'Pronto'); done();
        }) }));
    }
    if (tab === 'raw') {
      var kp3 = keyPicker(dev), fr = h('input', { value: '38000', inputmode: 'numeric' }), rw = h('textarea', { placeholder: '9000 4500 560 560 560 1690 ...  (µs, xung bật/tắt xen kẽ, bắt đầu bằng xung bật)' });
      return h('div', null, kp3.el, h('label', { text: 'Tần số sóng mang (Hz)' }), fr, h('label', { text: 'Mẫu xung (µs)' }), rw,
        h('button', { class: 'btn primary block', style: 'margin-top:12px', text: 'Thêm mã', onclick: guard(function () {
          var k = kp3.get(); putCode(k.key, { protocol: 'raw', freq: parseInt(fr.value, 10), pattern: IR.parseRawPattern(rw.value) }, k.label, 'Raw nhập tay'); done();
        }) }));
    }
    /* json */
    var jt = h('textarea', { placeholder: '{ "brand": "...", "model": "...", "type": "tv", "codes": { "power": { "spec": { ... } } } }' });
    return h('div', null, h('p', { class: 'muted small', text: 'Dán một mục thư viện (hoặc mảng các mục) theo cấu trúc trong data/ir-library.js.' }), jt,
      h('button', { class: 'btn primary block', style: 'margin-top:12px', text: 'Nhập mã', onclick: guard(function () {
        var data = JSON.parse(jt.value);
        var list = Array.isArray(data) ? data : data.entries ? data.entries : [data];
        var entry = list.filter(function (e) { return e && e.codes && (!e.type || e.type === dev.type); })[0];
        if (!entry) throw new Error('Không có mục nào phù hợp loại thiết bị "' + dev.type + '" hoặc thiếu trường "codes".');
        var cnt = 0, bad = [];
        Object.keys(entry.codes).forEach(function (k) {
          try { var c = entry.codes[k]; putCode(normName(k), c.spec, c.label, (entry.source && entry.source.name) || 'JSON thư viện'); cnt++; }
          catch (e) { bad.push(k + ': ' + e.message); }
        });
        if (!cnt) throw new Error('Không nhập được mã nào. ' + bad.slice(0, 3).join('; '));
        done(); toast(bad.length ? 'err' : 'ok', 'Đã nhập ' + cnt + ' mã' + (bad.length ? ', lỗi ' + bad.length + ' mã.' : '.'));
      }) }));
  }

  /* ---------- khởi động ---------- */
  function init() {
    Store.init();
    Store.devices().forEach(function (dev) {
      if (dev.timer && !dev.timer.overdue && dev.timer.deadline <= Date.now()) Store.update(dev.id, { timer: { deadline: dev.timer.deadline, overdue: true } });
    });
    Bridge.check();
    setInterval(tickTimers, 1000);
    if (!location.hash) location.hash = '#home';
    render();
  }
  init();
})();
