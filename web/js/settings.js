/* VIGO — màn hình Cài đặt + luồng thêm thiết bị (chọn loại → hãng → bộ mã, thử trực tiếp) + mã tùy chỉnh + sao lưu. */
(function () {
  'use strict';
  var UI = window.VigoUI, h = UI.h, Store = window.VigoStore, Bridge = window.IRBridge, Lib = window.VigoLib, AC = window.VigoAC, IR = window.VigoIR;
  var root = null;
  var CORE = ['power', 'mute', 'vol_up', 'vol_down', 'up', 'down', 'left', 'right', 'ok', 'back', 'home', 'exit'];
  var CORE_LABEL = { power: 'Nguồn', mute: 'Tắt tiếng', vol_up: 'Âm lượng +', vol_down: 'Âm lượng −', up: 'Lên', down: 'Xuống', left: 'Trái', right: 'Phải', ok: 'OK', back: 'Quay lại', home: 'Trang chủ', exit: 'Thoát' };
  var EXTRA_KEYS = [['menu', 'Menu'], ['source', 'Nguồn tín hiệu'], ['ch_up', 'Kênh +'], ['ch_down', 'Kênh −'], ['info', 'Thông tin'], ['src_hdmi', 'HDMI'], ['src_tv', 'TV'], ['src_av', 'AV']];
  var ALIAS = { vol_plus: 'vol_up', volume_up: 'vol_up', vol_dn: 'vol_down', vol_minus: 'vol_down', volume_down: 'vol_down', ch_next: 'ch_up', ch_prev: 'ch_down', channel_up: 'ch_up', channel_down: 'ch_down',
    enter: 'ok', enter_ok: 'ok', select: 'ok', center: 'ok', return: 'back', input: 'source', smart_hub: 'home', hub: 'home', on_off: 'power', arrow_up: 'up', arrow_down: 'down', arrow_left: 'left', arrow_right: 'right' };
  function normKey(name) { var s = String(name).toLowerCase().replace(/\+/g, '_plus').replace(/-/g, '_minus').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); return ALIAS[s] || s || 'khac'; }
  function pct(n, t) { return n + '/' + t; }

  function save() { /* tránh vòng lặp: chỉ render lại phần này */ render(); }

  function row(icon, title, sub, onClick, right) {
    return h('button', { type: 'button', class: 'row tap', onclick: function () { UI.haptic('nav'); onClick(); } },
      icon ? h('span', { class: 'ri' }, UI.icon(icon)) : null,
      h('span', { class: 'row-main' }, h('span', { class: 'row-title', text: title }), sub ? h('span', { class: 'row-sub', text: sub }) : null),
      right || UI.icon('chevr', 'dim'));
  }

  /* ================= Cài đặt ================= */
  function render() {
    if (!root) return;
    var top = root.scrollTop;
    root.replaceChildren();
    root.appendChild(h('h1', { class: 'title', text: 'Cài đặt' }));

    root.appendChild(UI.sectionTitle('Thiết bị'));
    var card = h('div', { class: 'card' });
    var devs = Store.devices();
    devs.forEach(function (d) {
      var act = Store.active();
      card.appendChild(row(d.type === 'tv' ? 'tv' : 'ac', d.name, ((d.type === 'tv' ? 'TV' : 'Điều hòa') + ' · ' + d.brand + ' ' + d.model).trim(), function () { devicePage(d.id); },
        act && act.id === d.id ? h('span', { class: 'badge', text: 'Đang dùng' }) : null));
    });
    if (!devs.length) card.appendChild(h('p', { class: 'muted pad-s', text: 'Chưa có thiết bị. Thêm TV hoặc điều hòa để bắt đầu.' }));
    card.appendChild(h('button', { class: 'btn primary block', onclick: function () { UI.haptic('nav'); addDevice(); } }, UI.icon('plus'), h('span', { text: 'Thêm thiết bị' })));
    root.appendChild(card);

    root.appendChild(UI.sectionTitle('Phản hồi & chuyển động'));
    var fb = h('div', { class: 'card' });
    fb.appendChild(UI.toggleRow('Rung khi bấm nút', 'Rung nhẹ mỗi lần chạm, rung kép khi có lỗi', Store.setting('haptics'), function (v) { Store.set('haptics', v); if (v) UI.haptic('press'); save(); }));
    if (Store.setting('haptics')) {
      var seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Cường độ rung' });
      [['light', 'Nhẹ'], ['medium', 'Vừa'], ['strong', 'Mạnh']].forEach(function (o) {
        seg.appendChild(h('button', { type: 'button', role: 'radio', 'aria-checked': String(Store.setting('hapticLevel') === o[0]), class: Store.setting('hapticLevel') === o[0] ? 'on' : '', text: o[1], onclick: function () { Store.set('hapticLevel', o[0]); UI.haptic('press'); save(); } }));
      });
      fb.appendChild(h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title', text: 'Cường độ rung' })), seg));
    }
    fb.appendChild(UI.toggleRow('Giữ để lặp', 'Giữ nút âm lượng, mũi tên hoặc nhiệt độ để gửi liên tục', Store.setting('repeat'), function (v) { Store.set('repeat', v); save(); }));
    fb.appendChild(UI.toggleRow('Giảm chuyển động', 'Tắt hiệu ứng mở app và chuyển tab', Store.setting('reduceMotion'), function (v) { Store.set('reduceMotion', v); window.VigoApp.applyPrefs(); save(); }));
    root.appendChild(fb);

    root.appendChild(UI.sectionTitle('Khi điều khiển'));
    var ct = h('div', { class: 'card' });
    ct.appendChild(UI.toggleRow('Giữ màn hình sáng', 'Màn hình không tự tắt khi đang ở tab Điều khiển', Store.setting('keepAwake'), function (v) { Store.set('keepAwake', v); window.VigoControl.sync(); save(); }));
    ct.appendChild(UI.toggleRow('Phím âm lượng của máy chỉnh TV', 'Bấm phím vật lý để gửi Âm lượng +/− tới TV (chỉ khi đang ở tab Điều khiển)', Store.setting('volumeKeys'), function (v) { Store.set('volumeKeys', v); window.VigoControl.sync(); save(); }));
    root.appendChild(ct);

    root.appendChild(UI.sectionTitle('Mắt phát hồng ngoại'));
    var c = Bridge.capabilities();
    var ir = h('div', { class: 'card' });
    ir.appendChild(h('div', { class: 'row' }, h('span', { class: 'row-main' },
      h('span', { class: 'row-title', text: c.mode === 'demo' ? 'Chế độ Demo' : c.hasEmitter ? 'Sẵn sàng' : 'Không có mắt phát IR' }),
      h('span', { class: 'row-sub', text: c.mode === 'demo' ? 'Đang chạy ngoài ứng dụng Android — không phát IR thật.' : c.hasEmitter ? 'Dải tần: ' + (c.ranges.length ? c.ranges.map(function (r) { return Math.round(r[0] / 1000) + '–' + Math.round(r[1] / 1000) + ' kHz'; }).join(', ') : 'không báo') : (c.error || 'Máy này không có IR blaster.') }))));
    ir.appendChild(row('wave', 'Kiểm tra mắt phát IR', 'Gửi xung thử (không điều khiển thiết bị nào)', function () {
      var r = Bridge.selfTest(); UI.toast(r.status === 'sent' ? 'ok' : r.status === 'demo' ? 'warn' : 'err', r.message); UI.haptic(r.status === 'error' ? 'error' : 'press');
    }));
    ir.appendChild(h('p', { class: 'row-sub pad-s', text: 'Mẹo: mở camera trước của một điện thoại khác, hướng vào cạnh trên máy này rồi bấm Kiểm tra — mắt phát IR sẽ hiện chấm sáng tím.' }));
    root.appendChild(ir);

    root.appendChild(UI.sectionTitle('Dữ liệu'));
    var dt = h('div', { class: 'card' });
    dt.appendChild(row('save', 'Sao lưu / Khôi phục', 'Lưu thiết bị và cài đặt ra văn bản', backupPage));
    dt.appendChild(row('trash', 'Xóa toàn bộ dữ liệu', 'Xóa thiết bị và cài đặt trên máy này', function () {
      UI.confirmBox('Xóa toàn bộ dữ liệu?', 'Mọi thiết bị và cài đặt sẽ bị xóa. Không thể hoàn tác.', 'Xóa hết', function () { Store.wipe(); window.VigoApp.applyPrefs(); UI.toast('ok', 'Đã xóa dữ liệu'); window.VigoApp.showTab('control'); }, true);
    }));
    root.appendChild(dt);

    root.appendChild(UI.sectionTitle('Giới thiệu'));
    var ab = h('div', { class: 'card' });
    ab.appendChild(row('shield', 'Quyền riêng tư', 'Không quảng cáo, không đăng nhập, không máy chủ, không xin quyền Internet.', function () { aboutPage('privacy'); }));
    ab.appendChild(row('info', 'Nguồn mã IR & giấy phép', 'Flipper-IRDB (CC0) · SmartIR (MIT)', function () { aboutPage('sources'); }));
    ab.appendChild(h('p', { class: 'row-sub pad-s', text: 'VIGO Remote 2.0.0' }));
    root.appendChild(ab);
    root.appendChild(h('div', { class: 'tail' }));
    root.scrollTop = top;
  }

  function aboutPage(which) {
    UI.openPage(which === 'privacy' ? 'Quyền riêng tư' : 'Nguồn mã IR', function (b) {
      if (which === 'privacy') {
        b.appendChild(h('div', { class: 'card pad' },
          h('p', { text: 'VIGO chạy hoàn toàn ngoại tuyến. Ứng dụng không khai báo quyền Internet, không có quảng cáo, không thu thập dữ liệu, không đăng nhập.' }),
          h('p', { text: 'Thiết bị và cài đặt chỉ lưu trên máy này. Ứng dụng không ghi lịch sử thao tác.' }),
          h('p', { class: 'muted', text: 'Quyền sử dụng: phát hồng ngoại (TRANSMIT_IR) và rung (VIBRATE).' })));
      } else {
        var card = h('div', { class: 'card pad' });
        Lib.sources().forEach(function (s) { card.appendChild(h('p', null, h('b', { text: s.name + ' — ' + s.what }), h('br'), h('span', { class: 'muted', text: 'Giấy phép ' + s.license + ' · ' + s.url }))); });
        card.appendChild(h('p', { class: 'muted', text: 'Mã là dữ liệu cộng đồng, lấy nguyên văn từ nguồn; app không tự tạo mã. Chưa được kiểm chứng trên mọi model — hãy dùng nút Thử trước khi chọn. Điều hòa dùng khung Broadlink giải mã sang xung IR, giả định sóng mang 38 kHz.' }));
        b.appendChild(card);
      }
    });
  }

  /* ================= Sao lưu ================= */
  function backupPage() {
    UI.openPage('Sao lưu / Khôi phục', function (b) {
      var ta = h('textarea', { class: 'code', rows: '10', 'aria-label': 'Nội dung sao lưu', spellcheck: 'false' });
      ta.value = Store.exportJson();
      b.appendChild(h('div', { class: 'card pad' },
        h('p', { class: 'muted', text: 'Sao chép toàn bộ văn bản bên dưới và dán vào ghi chú để lưu. Để khôi phục, dán lại vào đây rồi bấm Khôi phục.' }), ta,
        h('div', { class: 'row-btns' },
          h('button', { class: 'btn ghost', text: 'Sao chép', onclick: function () {
            UI.haptic('nav'); ta.select();
            var done = function (ok) { UI.toast(ok ? 'ok' : 'err', ok ? 'Đã sao chép' : 'Hãy giữ ngón tay trên ô để chọn và sao chép'); };
            try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(function () { done(true); }, function () { done(document.execCommand('copy')); }); else done(document.execCommand('copy')); } catch (e) { done(false); }
          } }),
          h('button', { class: 'btn primary', text: 'Khôi phục', onclick: function () {
            UI.confirmBox('Khôi phục từ văn bản?', 'Thiết bị và cài đặt hiện tại sẽ được thay thế.', 'Khôi phục', function () {
              try { var n = Store.importJson(ta.value); window.VigoApp.applyPrefs(); UI.toast('ok', 'Đã khôi phục ' + n + ' thiết bị'); UI.closePage(); } catch (e) { UI.haptic('error'); UI.toast('err', e.message); }
            });
          } }))));
    });
  }

  /* ================= Thêm thiết bị ================= */
  function addDevice() {
    UI.openPage('Thêm thiết bị', function (b) {
      b.appendChild(h('p', { class: 'muted', text: 'Bạn muốn điều khiển thiết bị nào?' }));
      [['tv', 'tv', 'TV', 'Samsung, LG, Sony, TCL, Xiaomi, Panasonic…'], ['ac', 'ac', 'Điều hòa', 'Daikin, Panasonic, LG, Samsung, Midea, Gree, Casper…']].forEach(function (o) {
        b.appendChild(h('button', { type: 'button', class: 'bigcard', onclick: function () { UI.haptic('nav'); brandPage(o[0]); } },
          h('span', { class: 'bico' }, UI.icon(o[1])), h('span', { class: 'row-main' }, h('span', { class: 'row-title', text: o[2] }), h('span', { class: 'row-sub', text: o[3] })), UI.icon('chevr', 'dim')));
      });
    });
  }

  function brandPage(type) {
    UI.openPage(type === 'tv' ? 'Chọn hãng TV' : 'Chọn hãng điều hòa', function (b) {
      var q = h('input', { type: 'search', class: 'search', placeholder: 'Tìm hãng…', 'aria-label': 'Tìm hãng', autocomplete: 'off' });
      var list = h('div', { class: 'card' });
      b.appendChild(q); b.appendChild(list);
      list.appendChild(h('div', { class: 'loading' }, h('i'), h('span', { text: 'Đang nạp danh sách hãng…' })));
      var brands = [];
      function paint() {
        var t = q.value.trim().toLowerCase();
        list.replaceChildren();
        brands.filter(function (x) { return !t || x.name.toLowerCase().indexOf(t) >= 0; }).forEach(function (x) {
          list.appendChild(row(null, x.name, x.n + ' bộ mã', function () { type === 'tv' ? tvSetPage(x.name) : acSetPage(x.name); }));
        });
        if (type === 'tv' && !t) list.appendChild(row(null, 'Hãng khác / tự nhập mã', 'Tạo TV trống rồi gán mã từ tệp .ir, Pronto, raw', function () { customTv(); }));
        if (!list.children.length) list.appendChild(h('p', { class: 'muted pad-s', text: 'Không thấy hãng “' + q.value + '”.' }));
      }
      q.addEventListener('input', paint);
      (type === 'tv' ? Lib.tvIndex().then(function (i) { return i.brands; }) : Lib.acIndex().then(function (i) { return i.brands.map(function (x) { return { name: x.name, n: x.sets.length }; }); }))
        .then(function (bs) { brands = bs; paint(); }, function (e) { list.replaceChildren(h('p', { class: 'muted pad-s', text: e.message })); });
    });
  }

  function customTv() {
    var input = h('input', { class: 'search', value: 'TV của tôi', 'aria-label': 'Tên thiết bị' });
    UI.openSheet(h('div', null, h('h3', { text: 'TV tự nhập mã' }), input,
      h('button', { class: 'btn primary block', text: 'Tạo', onclick: function () {
        var d = Store.add({ name: input.value.trim() || 'TV của tôi', type: 'tv', codes: {}, source: 'Tự nhập' });
        UI.closeSheet(); while (UI.hasPage()) UI.closePage(); UI.toast('ok', 'Đã tạo. Hãy gán mã cho các phím.'); window.VigoApp.showTab('settings'); devicePage(d.id);
      } })));
  }

  /* Trang chọn bộ mã: thử trực tiếp, dò tuần tự, bỏ qua bộ trùng mã đã thử. */
  function tvSetPage(brand) {
    UI.openPage('TV ' + brand, function (b) {
      b.appendChild(h('div', { class: 'loading' }, h('i'), h('span', { text: 'Đang nạp mã ' + brand + '…' })));
      Lib.tvBrand(brand).then(function (entries) {
        b.replaceChildren();
        var i = 0, tried = {};
        var testKeys = ['power', 'vol_up', 'mute', 'menu', 'ok'];
        function testKey(e) { return testKeys.filter(function (k) { return e.codes[k]; })[0]; }
        function sig(e) { var k = testKey(e); return k ? k + JSON.stringify(e.codes[k].spec) : null; }
        var card = h('div', { class: 'card pad' }), counter = h('div', { class: 'counter' });
        var title = h('h3', { class: 'setname' }), cover = h('p', { class: 'row-sub' }), keysEl = h('div', { class: 'cover' });
        var testBtn = h('button', { class: 'btn ghost big block' }), useBtn = h('button', { class: 'btn primary big block', text: 'Dùng bộ mã này' });
        var prev = h('button', { class: 'btn ghost', text: '◀ Trước' }), next = h('button', { class: 'btn ghost', text: 'Sau ▶' });
        function paint() {
          var e = entries[i], tk = testKey(e);
          counter.textContent = 'Bộ ' + (i + 1) + ' / ' + entries.length;
          title.textContent = e.model;
          var n = e.core; cover.textContent = 'Đủ ' + pct(n, CORE.length) + ' phím chính · ' + Object.keys(e.codes).length + ' phím tổng';
          keysEl.replaceChildren();
          CORE.forEach(function (k) { keysEl.appendChild(h('span', { class: 'ck' + (e.codes[k] ? ' has' : ''), text: CORE_LABEL[k] })); });
          testBtn.replaceChildren(UI.icon('wave'), h('span', { text: tk ? 'Thử phím ' + (CORE_LABEL[tk] || tk) : 'Bộ này không có phím để thử' }));
          testBtn.disabled = !tk; testBtn.classList.toggle('tried', !!(tk && tried[sig(e)]));
          prev.disabled = i === 0; next.disabled = i === entries.length - 1;
        }
        testBtn.addEventListener('click', function () {
          var e = entries[i], k = testKey(e); if (!k) return;
          tried[sig(e)] = true; var r = Bridge.send(e.codes[k].spec);
          UI.haptic(r.status === 'error' ? 'error' : 'press');
          UI.toast(r.status === 'sent' ? 'ok' : r.status === 'demo' ? 'warn' : 'err', r.status === 'sent' ? 'Đã gửi. TV có phản hồi không?' : r.message);
          testBtn.classList.add('tried');
        });
        function go(dir) {
          var j = i + dir;
          while (j >= 0 && j < entries.length && sig(entries[j]) && tried[sig(entries[j])]) j += dir; /* bỏ bộ có cùng mã đã thử */
          if (j < 0 || j >= entries.length) { j = Math.max(0, Math.min(entries.length - 1, i + dir)); if (j !== i) UI.toast('warn', 'Các bộ còn lại trùng mã bạn đã thử'); }
          i = j; UI.haptic('nav'); paint();
        }
        prev.addEventListener('click', function () { go(-1); }); next.addEventListener('click', function () { go(1); });
        useBtn.addEventListener('click', function () {
          var e = entries[i];
          askName('TV ' + brand, function (name) {
            var codes = {}; Object.keys(e.codes).forEach(function (k) { codes[k] = e.codes[k]; });
            Store.add({ name: name, type: 'tv', brand: brand, model: e.models[0], codes: codes, source: 'Flipper-IRDB (CC0)' });
            finishAdd();
          });
        });
        var listBtn = h('button', { class: 'btn link', text: 'Xem tất cả bộ mã', onclick: function () {
          var l = h('div', { class: 'devlist' });
          entries.forEach(function (e, idx) { l.appendChild(h('button', { class: 'devrow' + (idx === i ? ' on' : ''), onclick: function () { i = idx; UI.closeSheet(); paint(); } }, h('span', { class: 'dtxt' }, h('b', { text: e.model }), h('small', { text: pct(e.core, CORE.length) + ' phím chính' })))); });
          UI.openSheet(h('div', null, h('h3', { text: 'Tất cả bộ mã ' + brand }), l));
        } });
        card.appendChild(counter); card.appendChild(title); card.appendChild(cover); card.appendChild(keysEl);
        b.appendChild(h('p', { class: 'muted', text: 'Hướng mắt phát IR (cạnh trên điện thoại) về TV rồi bấm Thử. TV phản hồi thì chọn “Dùng bộ mã này”, không thì bấm Sau.' }));
        b.appendChild(card); b.appendChild(testBtn); b.appendChild(h('div', { class: 'row-btns' }, prev, next)); b.appendChild(useBtn); b.appendChild(listBtn);
        paint();
      }, function (e) { b.replaceChildren(h('p', { class: 'muted pad', text: e.message })); });
    });
  }

  function acSetPage(brand) {
    UI.openPage('Điều hòa ' + brand, function (b) {
      b.appendChild(h('div', { class: 'loading' }, h('i'), h('span', { text: 'Đang nạp mã ' + brand + '…' })));
      Lib.acIndex().then(function (idx) {
        var bd = idx.brands.filter(function (x) { return x.name === brand; })[0];
        var sets = bd.sets, i = 0, tried = {};
        b.replaceChildren();
        var card = h('div', { class: 'card pad' }), counter = h('div', { class: 'counter' }), title = h('h3', { class: 'setname' }), info = h('p', { class: 'row-sub' });
        var onBtn = h('button', { class: 'btn ghost big block' }), offBtn = h('button', { class: 'btn ghost big block' });
        var useBtn = h('button', { class: 'btn primary big block', text: 'Dùng bộ mã này' });
        var prev = h('button', { class: 'btn ghost', text: '◀ Trước' }), next = h('button', { class: 'btn ghost', text: 'Sau ▶' });
        function paint() {
          var s = sets[i];
          counter.textContent = 'Bộ ' + (i + 1) + ' / ' + sets.length;
          var m = s.models.slice(0, 4).join(', ') + (s.models.length > 4 ? ' (+' + (s.models.length - 4) + ')' : '');
          title.textContent = m;
          info.textContent = s.modes.map(AC.modeLabel).filter(function (x, k, a) { return a.indexOf(x) === k; }).join(' · ') + ' · ' + s.tmin + '–' + s.tmax + '°C' + (s.swings.length ? ' · có đảo gió' : '');
          onBtn.replaceChildren(UI.icon('snow'), h('span', { text: 'Thử BẬT (Lạnh 24°)' })); offBtn.replaceChildren(UI.icon('power'), h('span', { text: 'Thử TẮT' }));
          prev.disabled = i === 0; next.disabled = i === sets.length - 1;
        }
        function report(r) { UI.haptic(r.status === 'error' ? 'error' : 'press'); UI.toast(r.status === 'sent' ? 'ok' : r.status === 'demo' ? 'warn' : 'err', r.status === 'sent' ? 'Đã gửi. Điều hòa có phản hồi không?' : r.message); }
        offBtn.addEventListener('click', function () { tried[sets[i].off] = true; report(Bridge.send({ protocol: 'broadlink', data: sets[i].off })); });
        onBtn.addEventListener('click', function () {
          var s = sets[i]; onBtn.disabled = true;
          Lib.acSet(s.id).then(function (full) {
            onBtn.disabled = false;
            var st = AC.normalize(full, { power: true, mode: 'cool', fan: 'auto', swing: 'off', temp: 24 });
            tried[s.off] = true; report(Bridge.send(AC.spec(full, st)));
          }, function (e) { onBtn.disabled = false; UI.toast('err', e.message); });
        });
        function go(dir) {
          var j = i + dir;
          while (j >= 0 && j < sets.length && tried[sets[j].off]) j += dir;
          if (j < 0 || j >= sets.length) { j = Math.max(0, Math.min(sets.length - 1, i + dir)); if (j !== i) UI.toast('warn', 'Các bộ còn lại trùng mã bạn đã thử'); }
          i = j; UI.haptic('nav'); paint();
        }
        prev.addEventListener('click', function () { go(-1); }); next.addEventListener('click', function () { go(1); });
        useBtn.addEventListener('click', function () {
          var s = sets[i];
          askName('Điều hòa ' + brand, function (name) {
            useBtn.disabled = true;
            Lib.acSet(s.id).then(function (full) {
              Store.add({ name: name, type: 'ac', brand: brand, model: s.models[0], ac: { setId: s.id }, state: AC.defaults(full) });
              finishAdd();
            }, function (e) { useBtn.disabled = false; UI.toast('err', e.message); });
          });
        });
        card.appendChild(counter); card.appendChild(title); card.appendChild(info);
        b.appendChild(h('p', { class: 'muted', text: 'Hướng mắt phát IR về điều hòa rồi bấm Thử BẬT hoặc Thử TẮT. Điều hòa kêu “bíp” là đúng bộ mã. Điều hòa dùng khung Broadlink nên một số model có thể không khớp.' }));
        b.appendChild(card); b.appendChild(onBtn); b.appendChild(offBtn); b.appendChild(h('div', { class: 'row-btns' }, prev, next)); b.appendChild(useBtn);
        paint();
      }, function (e) { b.replaceChildren(h('p', { class: 'muted pad', text: e.message })); });
    });
  }

  function askName(def, cb) {
    var input = h('input', { class: 'search', value: def, 'aria-label': 'Tên thiết bị', maxlength: '40' });
    UI.openSheet(h('div', null, h('h3', { text: 'Đặt tên thiết bị' }), input,
      h('button', { class: 'btn primary block', text: 'Lưu', onclick: function () { var v = input.value.trim() || def; UI.closeSheet(); cb(v); } })), { modal: true });
    setTimeout(function () { try { input.select(); } catch (e) { /* bỏ qua */ } }, 280);
  }

  function finishAdd() {
    UI.haptic('press'); while (UI.hasPage()) UI.closePage();
    window.VigoApp.showTab('control'); UI.toast('ok', 'Đã thêm thiết bị');
  }

  /* ================= Chi tiết thiết bị ================= */
  function devicePage(id) {
    var d = Store.get(id); if (!d) return;
    UI.openPage(d.name, function (b, page) {
      function paint() {
        var dev = Store.get(id); if (!dev) { UI.closePage(); return; }
        b.replaceChildren();
        b.appendChild(h('div', { class: 'card pad' }, h('b', { text: dev.name }), h('p', { class: 'muted', text: (dev.type === 'tv' ? 'TV' : 'Điều hòa') + ' · ' + (dev.brand + ' ' + dev.model).trim() + (dev.source ? ' · ' + dev.source : '') })));
        var act = h('div', { class: 'card' });
        act.appendChild(row('remote', 'Dùng thiết bị này', 'Mở ở tab Điều khiển', function () { Store.setActive(id); while (UI.hasPage()) UI.closePage(); window.VigoApp.showTab('control'); }));
        act.appendChild(row('edit', 'Đổi tên', null, function () { askName(dev.name, function (n) { Store.update(id, { name: n }); page.querySelector('h2').textContent = n; paint(); }); }));
        if (dev.type === 'tv') act.appendChild(row('plus', 'Gán mã tùy chỉnh', 'Thêm hoặc thay mã cho từng phím', function () { customCodePage(id, paint); }));
        act.appendChild(row('search', dev.type === 'tv' ? 'Đổi bộ mã khác' : 'Đổi bộ mã khác', 'Chọn lại hãng và thử bộ mã khác', function () { UI.confirmBox('Thêm bộ mã khác?', 'Thiết bị mới sẽ được thêm cùng lúc; thiết bị này không bị xóa.', 'Tiếp tục', function () { addDevice(); }); }));
        act.appendChild(row('trash', 'Xóa thiết bị', null, function () { UI.confirmBox('Xóa “' + dev.name + '”?', 'Không thể hoàn tác.', 'Xóa', function () { Store.remove(id); UI.closePage(); UI.toast('ok', 'Đã xóa'); }, true); }));
        b.appendChild(act);
        if (dev.type === 'tv') {
          b.appendChild(UI.sectionTitle('Bảng phím — bấm để thử'));
          var g = h('div', { class: 'xgrid' }); var keys = Object.keys(dev.codes);
          CORE.concat(keys.filter(function (k) { return CORE.indexOf(k) < 0; })).forEach(function (k) {
            var has = !!dev.codes[k]; var lbl = CORE_LABEL[k] || (dev.codes[k] && dev.codes[k].label) || k;
            var btn = h('button', { type: 'button', class: 'xkey' + (has ? '' : ' na'), 'aria-disabled': has ? null : 'true', 'data-key': k }, h('span', { text: lbl }));
            UI.pressable(btn, { onPress: function (dis) { if (dis) { UI.haptic('error'); return; } var r = Bridge.send(dev.codes[k].spec); UI.haptic(r.status === 'error' ? 'error' : 'press'); UI.toast(r.status === 'sent' ? 'ok' : r.status === 'demo' ? 'warn' : 'err', r.status === 'sent' ? '✓ ' + lbl : r.message); } });
            g.appendChild(btn);
          });
          b.appendChild(g);
        }
      }
      paint();
    });
  }

  /* ================= Mã tùy chỉnh (TV) ================= */
  function customCodePage(id, done) {
    UI.openPage('Gán mã tùy chỉnh', function (b) {
      var dev = Store.get(id);
      var sel = h('select', { class: 'search', 'aria-label': 'Phím cần gán' });
      CORE.concat(EXTRA_KEYS.map(function (x) { return x[0]; })).forEach(function (k) { sel.appendChild(h('option', { value: k, text: CORE_LABEL[k] || EXTRA_KEYS.filter(function (x) { return x[0] === k; })[0][1] })); });
      var mode = h('select', { class: 'search', 'aria-label': 'Định dạng' },
        h('option', { value: 'pronto', text: 'Pronto hex (0000…)' }), h('option', { value: 'raw', text: 'Raw (µs)' }), h('option', { value: 'proto', text: 'Giao thức + địa chỉ + lệnh' }));
      var ta = h('textarea', { class: 'code', rows: '4', placeholder: '0000 006D …', spellcheck: 'false', 'aria-label': 'Mã' });
      var proto = h('select', { class: 'search', 'aria-label': 'Giao thức' }, Object.keys(IR.PROTOCOLS).map(function (k) { return h('option', { value: k, text: IR.PROTOCOLS[k].label || k }); }));
      var addr = h('input', { class: 'search', placeholder: 'Địa chỉ hex, vd 07', autocapitalize: 'off' }), cmd = h('input', { class: 'search', placeholder: 'Lệnh hex, vd 02', autocapitalize: 'off' });
      var freq = h('input', { class: 'search', value: '38000', inputmode: 'numeric', 'aria-label': 'Tần số' });
      var protoBox = h('div', null, proto, addr, cmd), rawBox = h('div', null, freq);
      function sync() { var m = mode.value; ta.hidden = m === 'proto'; protoBox.hidden = m !== 'proto'; rawBox.hidden = m !== 'raw'; ta.placeholder = m === 'raw' ? '9000 4500 560 560 …' : '0000 006D …'; }
      mode.addEventListener('change', sync); sync();
      var card = h('div', { class: 'card pad' }, h('label', { class: 'fl', text: 'Phím' }), sel, h('label', { class: 'fl', text: 'Định dạng mã' }), mode, rawBox, ta, protoBox,
        h('div', { class: 'row-btns' },
          h('button', { class: 'btn ghost', text: 'Thử gửi', onclick: function () { try { var s = build(); var r = Bridge.send(s); UI.toast(r.status === 'sent' ? 'ok' : r.status === 'demo' ? 'warn' : 'err', r.status === 'sent' ? 'Đã gửi' : r.message); } catch (e) { UI.haptic('error'); UI.toast('err', e.message); } } }),
          h('button', { class: 'btn primary', text: 'Lưu cho phím', onclick: function () { try { var s = build(); IR.encode(s); var cur = Store.get(id); var codes = Object.assign({}, cur.codes); codes[sel.value] = { spec: s }; Store.update(id, { codes: codes }); UI.haptic('press'); UI.toast('ok', 'Đã lưu'); done(); } catch (e) { UI.haptic('error'); UI.toast('err', e.message); } } })));
      function build() {
        var m = mode.value;
        if (m === 'pronto') return IR.parseProntoHex(ta.value);
        if (m === 'raw') return { protocol: 'raw', freq: parseInt(freq.value, 10), pattern: IR.parseRawPattern(ta.value) };
        return { protocol: proto.value, address: IR.hexInt(addr.value), command: IR.hexInt(cmd.value) };
      }
      b.appendChild(h('p', { class: 'muted', text: 'Chỉ nhập mã bạn lấy từ nguồn đáng tin hoặc tự học được. App không tự đoán mã.' }));
      b.appendChild(card);

      var fta = h('textarea', { class: 'code', rows: '4', placeholder: 'Dán nội dung tệp Flipper .ir', spellcheck: 'false', 'aria-label': 'Nội dung tệp .ir' });
      var file = h('input', { type: 'file', accept: '.ir,.txt,text/plain', 'aria-label': 'Chọn tệp .ir', onchange: function () {
        var f = file.files && file.files[0]; if (!f) return; var rd = new FileReader();
        rd.onload = function () { fta.value = String(rd.result); UI.toast('ok', 'Đã đọc ' + f.name); }; rd.onerror = function () { UI.toast('err', 'Không đọc được tệp'); }; rd.readAsText(f);
      } });
      b.appendChild(UI.sectionTitle('Nhập cả tệp Flipper .ir'));
      b.appendChild(h('div', { class: 'card pad' }, file, fta, h('button', { class: 'btn primary block', text: 'Nhập mã từ tệp', onclick: function () {
        try {
          if (!fta.value.trim()) throw new Error('Chưa có nội dung');
          var r = IR.parseFlipperIr(fta.value), cur = Store.get(id), codes = Object.assign({}, cur.codes), n = 0;
          r.ok.forEach(function (it) { var k = normKey(it.name); codes[k] = { spec: it.spec }; if (CORE.indexOf(k) < 0 && !EXTRA_KEYS.some(function (x) { return x[0] === k; })) codes[k].label = it.name; n++; });
          if (!n) throw new Error('Không nhập được mã nào' + (r.skipped.length ? ': ' + r.skipped.slice(0, 3).join('; ') : ''));
          Store.update(id, { codes: codes }); UI.haptic('press'); UI.toast('ok', 'Đã nhập ' + n + ' mã' + (r.skipped.length ? ', bỏ qua ' + r.skipped.length : '')); done();
        } catch (e) { UI.haptic('error'); UI.toast('err', e.message); }
      } })));
    });
  }

  window.VigoSettings = {
    mount: function (el) { root = el; Store.onChange(function () { if (root && !root.hidden) render(); }); render(); },
    render: render, addDevice: addDevice, devicePage: devicePage, _normKey: normKey
  };
})();
