/* VIGO — màn hình Điều khiển (màn hình đầu tiên). TV tối giản đặt thấp để bấm bằng ngón cái; điều hòa theo trạng thái. */
(function () {
  'use strict';
  var UI = window.VigoUI, h = UI.h, Store = window.VigoStore, Bridge = window.IRBridge, Lib = window.VigoLib, AC = window.VigoAC;
  var root = null, statusEl = null, statusT = null, acSets = {}, acErr = {}, tabActive = true, acPaint = null;

  var KEY_LABEL = { power: 'Nguồn', mute: 'Tắt tiếng', vol_up: 'Âm lượng +', vol_down: 'Âm lượng −', up: 'Lên', down: 'Xuống', left: 'Trái', right: 'Phải',
    ok: 'OK', back: 'Quay lại', home: 'Trang chủ', exit: 'Thoát', menu: 'Menu', source: 'Nguồn tín hiệu', ch_up: 'Kênh +', ch_down: 'Kênh −',
    info: 'Thông tin', src_tv: 'TV', src_hdmi: 'HDMI', src_av: 'AV' };
  var CORE = ['power', 'mute', 'vol_up', 'vol_down', 'up', 'down', 'left', 'right', 'ok', 'back', 'home', 'exit'];
  function keyLabel(dev, k) { return (dev.codes[k] && dev.codes[k].label) || KEY_LABEL[k] || (/^\d$/.test(k) ? k : k); }

  /* ---- Dòng trạng thái ---- */
  function setStatus(kind, text) {
    if (!statusEl) return;
    statusEl.textContent = text; statusEl.className = 'status show ' + kind;
    clearTimeout(statusT);
    statusT = setTimeout(function () { if (statusEl) statusEl.classList.remove('show'); }, kind === 'err' ? 4200 : 1500);
  }

  function transmit(spec, label) {
    var r = Bridge.send(spec);
    if (r.status === 'sent') { UI.haptic('press'); setStatus('ok', '✓ ' + label); }
    else if (r.status === 'demo') { UI.haptic('press'); setStatus('warn', 'Demo — chưa phát IR thật'); }
    else { UI.haptic('error'); setStatus('err', r.message); }
    return r;
  }

  function pressTv(dev, key) {
    var c = dev.codes[key];
    if (!c || !c.spec) { UI.haptic('error'); setStatus('err', 'Bộ mã này không có phím “' + (KEY_LABEL[key] || key) + '”'); return; }
    transmit(c.spec, keyLabel(dev, key));
  }

  /* ---- Điều khiển TV ---- */
  function tvKey(dev, key, ic, cls, label) {
    var has = !!(dev.codes[key] && dev.codes[key].spec);
    var b = h('button', { type: 'button', class: 'key ' + (cls || '') + (has ? '' : ' na'), 'aria-label': label || KEY_LABEL[key], 'aria-disabled': has ? null : 'true', 'data-key': key },
      ic ? UI.icon(ic) : null, ic ? null : h('span', { text: label }));
    var rep = ['up', 'down', 'left', 'right', 'vol_up', 'vol_down', 'ch_up', 'ch_down'].indexOf(key) >= 0;
    UI.pressable(b, { repeat: rep, interval: key.indexOf('vol') === 0 ? 130 : 170, onPress: function (dis) { if (dis) { UI.haptic('error'); setStatus('err', 'Bộ mã này không có phím “' + (KEY_LABEL[key] || key) + '”'); } else pressTv(dev, key); } });
    return b;
  }

  function extrasSheet(dev) {
    var keys = Object.keys(dev.codes).filter(function (k) { return CORE.indexOf(k) < 0; });
    var order = ['menu', 'source', 'ch_up', 'ch_down', 'info', 'src_tv', 'src_hdmi', 'src_av', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    keys.sort(function (a, b) { var i = order.indexOf(a), j = order.indexOf(b); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || a.localeCompare(b); });
    var grid = h('div', { class: 'xgrid' });
    keys.forEach(function (k) {
      var b = h('button', { type: 'button', class: 'xkey', 'data-key': k }, h('span', { text: keyLabel(dev, k) }));
      UI.pressable(b, { repeat: k === 'ch_up' || k === 'ch_down', onPress: function () { pressTv(dev, k); } });
      grid.appendChild(b);
    });
    UI.openSheet(h('div', null, h('h3', { text: 'Thêm phím' }),
      keys.length ? grid : h('p', { class: 'muted', text: 'Bộ mã này chỉ có các phím chính.' }),
      h('p', { class: 'row-sub', text: 'Có thể gán thêm phím riêng trong Cài đặt → Thiết bị.' })));
  }

  function buildTv(dev) {
    var dpad = h('div', { class: 'dpad', role: 'group', 'aria-label': 'Phím điều hướng' },
      h('span'), tvKey(dev, 'up', 'up', 'nav'), h('span'),
      tvKey(dev, 'left', 'left', 'nav'), tvKey(dev, 'ok', null, 'okk', 'OK'), tvKey(dev, 'right', 'right', 'nav'),
      h('span'), tvKey(dev, 'down', 'down', 'nav'), h('span'));
    var more = h('button', { type: 'button', class: 'key small', 'aria-label': 'Thêm phím', onclick: function () { UI.haptic('nav'); extrasSheet(dev); } }, UI.icon('more'));
    return h('div', { class: 'cpad tv' },
      h('div', { class: 'toprow' }, tvKey(dev, 'power', 'power', 'power small', 'Nguồn'), h('span', { class: 'grow' }), more),
      dpad,
      h('div', { class: 'navrow' }, tvKey(dev, 'back', 'back', 'wide', 'Quay lại'), tvKey(dev, 'home', 'home', 'wide', 'Trang chủ'), tvKey(dev, 'exit', 'exit', 'wide', 'Thoát')),
      h('div', { class: 'volrow' }, tvKey(dev, 'vol_down', 'minus', 'vol', 'Giảm âm lượng'), tvKey(dev, 'mute', 'mute', 'mid', 'Tắt tiếng'), tvKey(dev, 'vol_up', 'plus', 'vol', 'Tăng âm lượng')));
  }

  /* ---- Điều khiển điều hòa ---- */
  function getSet(dev) { return acSets[dev.ac.setId] || null; }

  function acSend(dev, set, quiet) {
    var st = dev.state;
    var spec = AC.spec(set, st);
    if (!spec) { UI.haptic('error'); setStatus('err', 'Bộ mã không có tổ hợp này'); return; }
    var label = st.power ? AC.modeLabel(st.mode) + ' ' + st.temp + '°' : 'Tắt máy';
    transmit(spec, label);
  }

  function acChange(dev, set, mut, forceSend) {
    var st = Object.assign({}, dev.state); mut(st);
    st = AC.normalize(set, st);
    dev = Store.update(dev.id, { state: st }, true);
    if (acPaint) acPaint();
    if (st.power || forceSend) acSend(dev, set);
    else { UI.haptic('nav'); setStatus('warn', 'Máy đang tắt — bấm Nguồn để gửi'); }
  }

  function timerSheet(dev, set) {
    var opts = [30, 60, 90, 120, 240, 480];
    var list = h('div', { class: 'chips wrap' });
    opts.forEach(function (m) {
      list.appendChild(h('button', { type: 'button', class: 'chip', text: m < 60 ? m + ' phút' : (m / 60) + ' giờ', onclick: function () {
        UI.haptic('nav'); Store.update(dev.id, { timer: { at: Date.now() + m * 60000 } }, true); UI.closeSheet(); if (acPaint) acPaint(); setStatus('ok', 'Sẽ tắt sau ' + (m < 60 ? m + ' phút' : (m / 60) + ' giờ'));
      } }));
    });
    UI.openSheet(h('div', null, h('h3', { text: 'Hẹn giờ tắt' }), list,
      dev.timer ? h('button', { class: 'btn ghost block', text: 'Hủy hẹn giờ', onclick: function () { Store.update(dev.id, { timer: null }, true); UI.closeSheet(); if (acPaint) acPaint(); } }) : null,
      h('p', { class: 'row-sub', text: 'Hẹn giờ chạy trong ứng dụng: hãy để VIGO mở (có thể khóa màn hình ở một số máy). Nếu app bị hệ thống đóng, lệnh tắt sẽ không được gửi.' })));
  }

  function chipGroup() { return h('div', { class: 'chips' }); }

  function buildAc(dev, set) {
    var tempNum = h('div', { class: 'big-temp' }), tempUnit = h('span', { class: 'deg', text: '°C' });
    var modeTxt = h('div', { class: 'ac-mode' }), subTxt = h('div', { class: 'ac-sub' });
    var disp = h('div', { class: 'ac-display' }, h('div', { class: 'tline' }, tempNum, tempUnit), modeTxt, subTxt);

    var minus = h('button', { type: 'button', class: 'key vol', 'aria-label': 'Giảm nhiệt độ' }, UI.icon('minus'));
    var plus = h('button', { type: 'button', class: 'key vol', 'aria-label': 'Tăng nhiệt độ' }, UI.icon('plus'));
    function step(dir) { return function () { acChange(dev, set, function (st) { st.temp = AC.stepTemp(set, st, dir); }); }; }
    UI.pressable(minus, { repeat: true, interval: 200, onPress: function () { step(-1)(); } });
    UI.pressable(plus, { repeat: true, interval: 200, onPress: function () { step(1)(); } });

    var power = h('button', { type: 'button', class: 'key power small', 'aria-label': 'Bật hoặc tắt máy' }, UI.icon('power'));
    UI.pressable(power, { onPress: function () { acChange(dev, set, function (st) { st.power = !st.power; }, true); } });
    var timerBtn = h('button', { type: 'button', class: 'chip timer', onclick: function () { UI.haptic('nav'); timerSheet(Store.get(dev.id), set); } });

    var modes = chipGroup(), fans = chipGroup(), swings = chipGroup();
    var fanRow = h('div', { class: 'chiprow' }, h('span', { class: 'cl', text: 'Quạt' }), fans);
    var swRow = h('div', { class: 'chiprow' }, h('span', { class: 'cl', text: 'Đảo gió' }), swings);
    var modeRow = h('div', { class: 'chiprow' }, h('span', { class: 'cl', text: 'Chế độ' }), modes);

    function fill(box, items, cur, labelFn, onPick) {
      box.replaceChildren();
      items.forEach(function (it) {
        box.appendChild(h('button', { type: 'button', class: 'chip' + (it === cur ? ' on' : ''), 'aria-pressed': it === cur ? 'true' : 'false', text: labelFn(it), onclick: function () { UI.haptic('press'); onPick(it); } }));
      });
    }

    acPaint = function () {
      var d = Store.get(dev.id); if (!d) return; dev = d;
      var st = d.state;
      disp.classList.toggle('off', !st.power);
      tempNum.textContent = st.power || true ? String(st.temp) : '--';
      modeTxt.textContent = (st.power ? '' : 'Đang tắt · ') + AC.modeLabel(st.mode);
      subTxt.textContent = 'Quạt ' + AC.fanLabel(st.fan).toLowerCase() + (st.swing ? ' · Đảo gió ' + AC.swingLabel(st.swing).toLowerCase() : '');
      power.classList.toggle('lit', st.power);
      var ts = AC.temps(set, st);
      minus.classList.toggle('na', !ts.length || st.temp <= ts[0]); plus.classList.toggle('na', !ts.length || st.temp >= ts[ts.length - 1]);
      var mm = AC.modes(set);
      fill(modes, mm, st.mode, AC.modeLabel, function (m) { acChange(dev, set, function (s) { s.mode = m; }); });
      var ff = AC.fans(set, st.mode); fanRow.hidden = ff.length < 2;
      fill(fans, ff, st.fan, AC.fanLabel, function (f) { acChange(dev, set, function (s) { s.fan = f; }); });
      var sw = AC.swings(set, st.mode, st.fan); swRow.hidden = sw.length < 2;
      fill(swings, sw, st.swing, AC.swingLabel, function (v) { acChange(dev, set, function (s) { s.swing = v; }); });
      modeRow.hidden = mm.length < 2;
      timerBtn.replaceChildren(UI.icon('timer'), h('span', { text: d.timer ? 'Tắt sau ' + remain(d.timer.at) : 'Hẹn giờ tắt' }));
      timerBtn.classList.toggle('on', !!d.timer);
    };
    var el = h('div', { class: 'cpad ac' },
      disp,
      h('div', { class: 'toprow' }, power, h('span', { class: 'grow' }), timerBtn),
      h('div', { class: 'tempctl' }, minus, h('span', { class: 'tlabel', text: 'Nhiệt độ' }), plus),
      modeRow, fanRow, swRow);
    acPaint();
    return el;
  }
  function remain(at) {
    var s = Math.max(0, Math.round((at - Date.now()) / 1000)), m = Math.floor(s / 60);
    return m >= 60 ? Math.floor(m / 60) + 'g ' + (m % 60) + 'p' : m + 'p ' + ('0' + (s % 60)).slice(-2) + 's';
  }

  /* ---- Khung màn hình ---- */
  function irChip() {
    var c = Bridge.capabilities();
    var kind = c.mode === 'demo' ? 'warn' : c.hasEmitter ? 'ok' : 'err';
    var text = c.mode === 'demo' ? 'Demo' : c.hasEmitter ? 'IR sẵn sàng' : 'Không có IR';
    var msg = c.mode === 'demo' ? 'Chế độ Demo: đang chạy ngoài ứng dụng Android nên KHÔNG phát IR thật.' :
      c.hasEmitter ? 'Mắt phát hồng ngoại hoạt động. “Đã gửi” nghĩa là hệ điều hành đã nhận lệnh phát — không xác nhận thiết bị đã nhận.' :
        (c.error || 'Máy này không có mắt phát hồng ngoại.');
    return h('button', { type: 'button', class: 'irchip ' + kind, onclick: function () { UI.haptic('nav'); UI.toast(kind, msg); } }, h('i'), h('span', { text: text }));
  }

  function switcher() {
    var list = h('div', { class: 'devlist' });
    var act = Store.active();
    Store.devices().forEach(function (d) {
      list.appendChild(h('button', { type: 'button', class: 'devrow' + (act && act.id === d.id ? ' on' : ''), onclick: function () { UI.haptic('nav'); UI.closeSheet(); Store.setActive(d.id); } },
        h('span', { class: 'dico' }, UI.icon(d.type === 'tv' ? 'tv' : 'ac')),
        h('span', { class: 'dtxt' }, h('b', { text: d.name }), h('small', { text: (d.brand + ' ' + d.model).trim() })),
        act && act.id === d.id ? UI.icon('check', 'ok') : null));
    });
    UI.openSheet(h('div', null, h('h3', { text: 'Chọn thiết bị' }), list,
      h('button', { class: 'btn primary block', text: '+ Thêm thiết bị', onclick: function () { UI.closeSheet(); window.VigoApp.addDevice(); } })));
  }

  function empty() {
    return h('div', { class: 'empty' },
      h('div', { class: 'hero-ico' }, UI.icon('wave')),
      h('h2', { text: 'Chưa có thiết bị nào' }),
      h('p', { class: 'muted', text: 'Chọn hãng TV hoặc điều hòa của bạn để dùng ngay. Mọi thứ chạy ngoại tuyến, không cần đăng nhập.' }),
      h('button', { class: 'btn primary big', onclick: function () { UI.haptic('nav'); window.VigoApp.addDevice(); } }, UI.icon('plus'), h('span', { text: 'Thêm thiết bị' })));
  }

  function render() {
    if (!root) return;
    acPaint = null;
    var dev = Store.active();
    root.replaceChildren();
    statusEl = h('div', { class: 'status', role: 'status', 'aria-live': 'polite' });
    if (!dev) { root.appendChild(h('div', { class: 'topbar' }, h('span', { class: 'grow' }), irChip())); root.appendChild(empty()); sync(); return; }
    var pill = h('button', { type: 'button', class: 'pill', 'aria-label': 'Đổi thiết bị: ' + dev.name, onclick: function () { UI.haptic('nav'); switcher(); } },
      UI.icon(dev.type === 'tv' ? 'tv' : 'ac'), h('span', { class: 'pname' }, h('b', { text: dev.name }), h('small', { text: (dev.brand + ' ' + dev.model).trim() })), UI.icon('chev'));
    root.appendChild(h('div', { class: 'topbar' }, pill, h('span', { class: 'grow' }), irChip()));
    root.appendChild(statusEl);
    var stage = h('div', { class: 'stage' });
    root.appendChild(stage);
    if (dev.type === 'tv') root.appendChild(buildTv(dev));
    else {
      var set = getSet(dev);
      if (set) root.appendChild(buildAc(dev, set));
      else {
        var holder = h('div', { class: 'cpad ac' }, acErr[dev.ac.setId] ?
          h('div', { class: 'empty' }, h('p', { class: 'muted', text: acErr[dev.ac.setId] }), h('button', { class: 'btn primary', text: 'Thử lại', onclick: function () { delete acErr[dev.ac.setId]; render(); } })) :
          h('div', { class: 'loading' }, h('i'), h('span', { text: 'Đang nạp bộ mã điều hòa…' })));
        root.appendChild(holder);
        if (!acErr[dev.ac.setId]) {
          var id = dev.ac.setId;
          Lib.acSet(id).then(function (s) { acSets[id] = s; if (Store.active() && Store.active().id === dev.id) render(); },
            function (e) { acErr[id] = e.message; render(); });
        }
      }
    }
    sync();
  }

  /* ---- Đồng bộ với Android: phím âm lượng, giữ sáng ---- */
  function sync() {
    var dev = Store.active();
    var on = tabActive && !UI.hasPage();
    Bridge.setVolumeKeys(on && Store.setting('volumeKeys') && !!dev && dev.type === 'tv');
    Bridge.keepScreenOn(on && Store.setting('keepAwake'));
  }

  /* ---- Hẹn giờ tắt điều hòa (chạy khi app mở) ---- */
  function tick() {
    var now = Date.now();
    Store.devices().forEach(function (d) {
      if (d.type !== 'ac' || !d.timer) return;
      if (now >= d.timer.at) {
        var set = acSets[d.ac.setId];
        var st = Object.assign({}, d.state, { power: false });
        Store.update(d.id, { state: st, timer: null }, true);
        if (set) { var r = Bridge.send(AC.spec(set, st)); UI.toast(r.status === 'sent' ? 'ok' : 'warn', r.status === 'sent' ? 'Đã gửi lệnh tắt điều hòa ' + d.name : 'Hẹn giờ: ' + r.message); if (r.status === 'sent') UI.haptic('press'); }
        if (acPaint) acPaint();
      } else if (acPaint && Store.active() && Store.active().id === d.id) acPaint();
    });
  }
  setInterval(tick, 1000);

  window.__vigoKey = function (key) {
    var dev = Store.active();
    if (!tabActive || !dev || dev.type !== 'tv' || UI.hasSheet() || UI.hasPage()) return false;
    pressTv(dev, key); return true;
  };

  window.VigoControl = {
    mount: function (el) { root = el; Store.onChange(function () { render(); }); render(); },
    render: render, sync: sync,
    setTabActive: function (v) { tabActive = v; sync(); },
    _press: pressTv
  };
})();
