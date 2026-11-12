/* VIGO — màn hình Điều khiển (màn hình đầu tiên). TV tối giản đặt thấp để bấm bằng ngón cái; điều hòa theo trạng thái. */
(function () {
  'use strict';
  var UI = window.VigoUI, Online = window.VigoOnline, Voice = window.VigoVoice, h = UI.h, Store = window.VigoStore, Bridge = window.IRBridge, Lib = window.VigoLib, AC = window.VigoAC;
  var root = null, statusEl = null, statusT = null, acSets = {}, acErr = {}, tabActive = true, acPaint = null;

  var KEY_LABEL = { power: 'Nguồn', mute: 'Tắt tiếng', vol_up: 'Âm lượng +', vol_down: 'Âm lượng −', up: 'Lên', down: 'Xuống', left: 'Trái', right: 'Phải',
    ok: 'OK', back: 'Quay lại', home: 'Trang chủ', exit: 'Thoát', menu: 'Menu', source: 'Nguồn tín hiệu', ch_up: 'Kênh +', ch_down: 'Kênh −',
    info: 'Thông tin', src_tv: 'TV', src_hdmi: 'HDMI', src_av: 'AV' };
  var CORE = ['power', 'mute', 'vol_up', 'vol_down', 'up', 'down', 'left', 'right', 'ok', 'back', 'home', 'exit'];
  function keyLabel(dev, k) { return (dev.codes[k] && dev.codes[k].label) || KEY_LABEL[k] || Lib.keyLabel(k) || k; }
  var DT = window.VigoDevTypes;

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
    return transmit(c.spec, keyLabel(dev, key));
  }


  /* ================= Giọng nói =================
   * Hồng ngoại KHÔNG gõ được chữ vào TV, nên đây là điều khiển bằng giọng nói: lời nói → phím remote / thao tác điều hòa.
   * Nhận giọng nói do Android (Google) xử lý, có thể cần Internet; ngoài app hoặc khi lỗi vẫn gõ lệnh được. */
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function targetDev(type) {
    var a = Store.active();
    if (type === 'tv') { /* "tv" = thiết bị có bảng phím: ưu tiên thiết bị đang dùng, rồi TV, rồi loại khác */
      if (a && a.type !== 'ac') return a;
      var ds = Store.devices().filter(function (d) { return d.type !== 'ac'; });
      return ds.filter(function (d) { return d.type === 'tv'; })[0] || ds[0] || null;
    }
    if (a && a.type === type) return a;
    return Store.devices().filter(function (d) { return d.type === type; })[0] || null;
  }
  function pickFanKey(set, mode, want) {
    var ff = AC.fans(set, mode), g = fanGroups(ff), r = g.ranked;
    if (want === 'auto') return g.auto[0] || null;
    if (want === 'quiet') return ff.filter(function (f) { return fanRank(f) === 0; })[0] || r[0] || null;
    if (!r.length) return null;
    return want === 'high' ? r[r.length - 1] : want === 'low' ? r[0] : r[Math.floor((r.length - 1) / 2)];
  }
  function pickMode(set, want) {
    var ms = AC.modes(set);
    var cands = want === 'fan_only' ? ['fan_only', 'fan'] : want === 'auto' ? ['auto', 'heat_cool'] : [want];
    for (var i = 0; i < cands.length; i++) if (ms.indexOf(cands[i]) >= 0) return cands[i];
    return null;
  }

  async function runTv(a) {
    var dev = targetDev('tv');
    if (!dev) return { ok: false, text: 'Chưa có TV nào — hãy thêm thiết bị TV.' };
    var keys = a.digits ? a.digits.split('') : [a.key];
    var reps = a.digits ? 1 : (a.count || 1);
    var delay = a.digits ? 450 : (a.key && a.key.indexOf('vol') === 0 ? 140 : 260);
    var demo = false;
    for (var r = 0; r < reps; r++) {
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (!(dev.codes[k] && dev.codes[k].spec) && a.alt && dev.codes[a.alt] && dev.codes[a.alt].spec) k = a.alt;
        var c = dev.codes[k];
        if (!c || !c.spec) { UI.haptic('error'); return { ok: false, text: 'Bộ mã “' + dev.name + '” không có phím “' + (KEY_LABEL[k] || k) + '”.' }; }
        var res = Bridge.send(c.spec);
        if (res.status === 'demo') demo = true;
        else if (res.status !== 'sent') { UI.haptic('error'); return { ok: false, text: res.message }; }
        if (!(r === reps - 1 && i === keys.length - 1)) await sleep(delay);
      }
    }
    UI.haptic('press');
    return { ok: true, demo: demo, text: a.label + (reps > 1 ? ' ×' + reps : '') };
  }

  async function runAc(a) {
    var dev = targetDev('ac');
    if (!dev) return { ok: false, text: 'Chưa có điều hòa nào — hãy thêm thiết bị điều hòa.' };
    var set = acSets[dev.ac.setId];
    if (!set) {
      try { set = await Lib.acSet(dev.ac.setId); acSets[dev.ac.setId] = set; }
      catch (e) { return { ok: false, text: 'Không nạp được bộ mã điều hòa.' }; }
    }
    dev = Store.get(dev.id);
    var mut;
    if (a.op === 'power') mut = function (st) { st.power = !!a.on; };
    else if (a.op === 'temp') mut = function (st) { st.temp = a.value; };
    else if (a.op === 'step') mut = function (st) { var dir = a.value < 0 ? -1 : 1; for (var i = 0; i < Math.abs(a.value); i++) st.temp = AC.stepTemp(set, st, dir); };
    else if (a.op === 'mode') {
      var m = pickMode(set, a.value);
      if (!m) return { ok: false, text: 'Bộ mã này không có ' + a.label.toLowerCase() + '.' };
      mut = function (st) { st.mode = m; };
    } else if (a.op === 'fan') {
      var f = pickFanKey(set, dev.state.mode, a.value);
      if (!f) return { ok: false, text: 'Chế độ hiện tại không có mức “' + a.label.toLowerCase() + '”.' };
      mut = function (st) { st.fan = f; };
    } else return { ok: false, text: 'Lệnh không hỗ trợ.' };
    var willSend = dev.state.power || a.op === 'power';
    acChange(dev, set, mut, a.op === 'power');
    if (!willSend) return { ok: false, text: a.label + ' — đã lưu nhưng CHƯA gửi vì máy đang tắt. Hãy nói “bật điều hòa” trước.' };
    return { ok: true, demo: Bridge.capabilities().mode === 'demo', text: a.label };
  }

  function contextNow() {
    var a = Store.active();
    return { activeType: a && a.type === 'ac' ? 'ac' : 'tv', hasTv: !!targetDev('tv'), hasAc: !!targetDev('ac') };
  }

  var vui = null;
  function voiceSheet() {
    if (!Voice) { UI.toast('err', 'Thiếu mô-đun giọng nói'); return; }
    var cfg = Online.config();
    var nativeOk = Online.available() && cfg.voice !== false;
    var listening = false, busy = false;
    var tr = h('div', { class: 'v-tr', 'aria-live': 'polite', text: nativeOk ? 'Đang chuẩn bị micro…' : 'Gõ lệnh vào ô bên dưới' });
    var stat = h('div', { class: 'v-stat muted', text: nativeOk ? '' : (Online.available() ? 'Máy này chưa có dịch vụ nhận giọng nói — bạn vẫn gõ lệnh được.' : 'Nhận giọng nói chỉ có trong ứng dụng Android (đang chạy Demo) — bạn vẫn gõ lệnh được.') });
    var mic = h('button', { type: 'button', class: 'v-mic', 'aria-label': 'Nói', 'aria-disabled': nativeOk ? null : 'true' }, UI.icon('mic'));
    var chips = h('div', { class: 'chips wrap v-chips' });
    var res = h('div', { class: 'v-res' });
    var inp = h('input', { type: 'text', class: 'v-in', placeholder: 'Gõ lệnh, ví dụ: tăng âm lượng 3 lần', enterkeyhint: 'send', autocomplete: 'off', 'aria-label': 'Gõ lệnh' });
    var go = h('button', { type: 'button', class: 'btn primary', text: 'Chạy' });
    var ex = h('div', { class: 'chips wrap' });
    Voice.EXAMPLES.forEach(function (t) { ex.appendChild(h('button', { type: 'button', class: 'chip', text: t, onclick: function () { UI.haptic('nav'); inp.value = t; run(t, true); } })); });

    function setListening(v) { listening = v; mic.classList.toggle('listening', v); mic.setAttribute('aria-label', v ? 'Dừng nghe' : 'Nói'); }
    function showResults(list) {
      res.replaceChildren();
      list.forEach(function (r) { res.appendChild(h('div', { class: 'v-row ' + (r.ok ? (r.demo ? 'warn' : 'ok') : 'err'), text: (r.ok ? (r.demo ? '◐ ' : '✓ ') : '✕ ') + r.text + (r.demo ? ' (Demo — chưa phát IR thật)' : '') })); });
    }
    async function run(text, typed, alts) {
      if (busy) return;
      var ctx = contextNow(), parsed = Voice.parse(text, ctx), used = text;
      if (!parsed.actions.length && alts) {
        for (var i = 0; i < alts.length && !parsed.actions.length; i++) { var p2 = Voice.parse(alts[i], ctx); if (p2.actions.length) { parsed = p2; used = alts[i]; } }
      }
      tr.textContent = '“' + used + '”';
      chips.replaceChildren(); res.replaceChildren();
      if (!parsed.actions.length) {
        UI.haptic('error');
        stat.textContent = 'Chưa hiểu lệnh này. Thử nói ngắn gọn như các ví dụ bên dưới.';
        return;
      }
      parsed.actions.forEach(function (a) { chips.appendChild(h('span', { class: 'chip on', text: a.label + (a.count > 1 ? ' ×' + a.count : '') })); });
      stat.textContent = parsed.unknown.length ? 'Bỏ qua phần chưa hiểu: “' + parsed.unknown.join('”, “') + '”' : 'Đang gửi…';
      busy = true; go.classList.add('na');
      var out = [];
      for (var k = 0; k < parsed.actions.length; k++) {
        var a = parsed.actions[k];
        var r = a.t === 'tv' ? await runTv(a) : await runAc(a);
        out.push(r); showResults(out);
        if (!r.ok) break;
        await sleep(a.t === 'tv' ? 300 : 120);
      }
      busy = false; go.classList.remove('na');
      if (!vui) return;
      stat.textContent = out.every(function (r) { return r.ok; }) ? (out.some(function (r) { return r.demo; }) ? 'Xong (Demo).' : '“Đã gửi” = hệ điều hòa đã phát lệnh; không xác nhận thiết bị đã nhận.') : 'Có lệnh không thực hiện được.';
    }
    function startMic() {
      if (!nativeOk) { UI.haptic('error'); UI.toast('warn', stat.textContent); return; }
      UI.haptic('nav'); stat.textContent = ''; tr.textContent = 'Đang chuẩn bị micro…'; setListening(true);
      Online.call('startVoice');
    }
    UI.pressable(mic, { onPress: function () { if (listening) { Online.call('stopVoice'); setListening(false); tr.textContent = 'Đã dừng.'; } else startMic(); } });
    function submit() { var t = inp.value.trim(); if (t) { run(t, true); } }
    go.addEventListener('click', function () { UI.haptic('nav'); submit(); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });

    vui = {
      onEvent: function (ev) {
        if (ev.state === 'listening') { setListening(true); tr.textContent = 'Đang nghe… hãy nói lệnh'; stat.textContent = ''; }
        else if (ev.state === 'partial') tr.textContent = '“' + ev.text + '”';
        else if (ev.state === 'processing') { tr.textContent = tr.textContent === 'Đang nghe… hãy nói lệnh' ? 'Đang xử lý…' : tr.textContent; }
        else if (ev.state === 'final') { setListening(false); run(ev.text || '', false, ev.alts || []); }
        else if (ev.state === 'error' || ev.ok === false) { setListening(false); UI.haptic('error'); tr.textContent = 'Chưa nhận được lệnh'; stat.textContent = ev.error || 'Lỗi nhận giọng nói.'; }
      }
    };
    UI.openSheet(h('div', { class: 'vsheet' },
      h('h3', { text: 'Điều khiển bằng giọng nói' }),
      h('div', { class: 'v-stage' }, mic, tr, stat),
      chips, res,
      h('div', { class: 'v-type' }, inp, go),
      h('p', { class: 'row-sub', text: 'Ra lệnh: âm lượng, kênh, điều hướng, nhiệt độ, chế độ… Hồng ngoại không gõ chữ vào TV được, nên không có “tìm kiếm bằng giọng nói” trên TV.' }),
      ex), { onClose: function () { if (listening) Online.call('stopVoice'); vui = null; } });
    if (nativeOk) startMic();
  }
  Online.on(function (ev) { if (ev && ev.type === 'voice' && vui) vui.onEvent(ev); });

  function micKey() {
    var b = h('button', { type: 'button', class: 'key small mic', 'aria-label': 'Điều khiển bằng giọng nói' }, UI.icon('mic'));
    b.addEventListener('click', function () { UI.haptic('nav'); voiceSheet(); });
    return b;
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

  var ORDER = ['menu', 'source', 'ch_up', 'ch_down', 'info', 'src_tv', 'src_hdmi', 'src_av', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  function extrasSheet(dev, shown) {
    shown = shown || CORE;
    var keys = Object.keys(dev.codes).filter(function (k) { return shown.indexOf(k) < 0; });
    keys.sort(function (a, b) { var i = ORDER.indexOf(a), j = ORDER.indexOf(b); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || keyLabel(dev, a).localeCompare(keyLabel(dev, b), 'vi'); });
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

  function numpadSheet(dev) {
    var grid = h('div', { class: 'npad' });
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', null].forEach(function (k) {
      if (!k) { grid.appendChild(h('span')); return; }
      var has = !!(dev.codes[k] && dev.codes[k].spec);
      var b = h('button', { type: 'button', class: 'xkey nk' + (has ? '' : ' na'), 'aria-disabled': has ? null : 'true', 'data-key': k }, h('span', { text: k }));
      UI.pressable(b, { onPress: function (dis) { if (dis) { UI.haptic('error'); return; } pressTv(dev, k); } });
      grid.appendChild(b);
    });
    UI.openSheet(h('div', null, h('h3', { text: 'Bàn phím số' }), grid));
  }

  function buildTv(dev) {
    var dpad = h('div', { class: 'dpad', role: 'group', 'aria-label': 'Phím điều hướng' },
      h('span'), tvKey(dev, 'up', 'up', 'nav'), h('span'),
      tvKey(dev, 'left', 'left', 'nav'), tvKey(dev, 'ok', null, 'okk', 'OK'), tvKey(dev, 'right', 'right', 'nav'),
      h('span'), tvKey(dev, 'down', 'down', 'nav'), h('span'));
    var more = h('button', { type: 'button', class: 'key small', 'aria-label': 'Thêm phím', onclick: function () { UI.haptic('nav'); extrasSheet(dev); } }, UI.icon('more'));
    return h('div', { class: 'cpad tv' },
      h('div', { class: 'toprow' }, tvKey(dev, 'power', 'power', 'power small', 'Nguồn'), h('span', { class: 'grow' }), micKey(), more),
      dpad,
      h('div', { class: 'navrow' }, tvKey(dev, 'back', 'back', 'wide', 'Quay lại'), tvKey(dev, 'home', 'home', 'wide', 'Trang chủ'), tvKey(dev, 'exit', 'exit', 'wide', 'Thoát')),
      h('div', { class: 'volrow' }, tvKey(dev, 'vol_down', 'minus', 'vol', 'Giảm âm lượng'), tvKey(dev, 'mute', 'mute', 'mid', 'Tắt tiếng'), tvKey(dev, 'vol_up', 'plus', 'vol', 'Tăng âm lượng')));
  }

  /* ---- Điều khiển các thiết bị có bảng phím khác (đầu thu, TV box, đầu đĩa, loa, quạt, đèn, máy chiếu, ...) ----
   * Chỉ hiện phím mà bộ mã thật sự có; phím còn lại nằm trong "Thêm phím". Không tạo phím giả. */
  var KEY_ICON = { power: 'power', mute: 'mute', vol_up: 'plus', vol_down: 'minus', up: 'up', down: 'down', left: 'left', right: 'right', play: 'play', pause: 'pause', stop: 'stop',
    next: 'next', prev: 'prev', rewind: 'rew', fast_forward: 'ff', eject: 'eject', play_pause: 'playpause', swing: 'swing', timer: 'timer', auto: 'auto', bright_up: 'sun', bright_down: 'moon',
    speed: 'fan', speed_up: 'plus', speed_down: 'minus', temp_up: 'plus', temp_down: 'minus', light: 'bulb', ch_up: 'up', ch_down: 'down', zoom_in: 'plus', zoom_out: 'minus' };
  var LABELED = ['speed', 'speed_up', 'speed_down', 'temp_up', 'temp_down', 'swing', 'timer', 'auto', 'bright_up', 'bright_down', 'light', 'zoom_in', 'zoom_out', 'ch_up', 'ch_down', 'bass_up', 'bass_down', 'treble_up', 'treble_down'];
  var SWATCH = { red: '#ff4d5e', green: '#2ee66a', blue: '#4f7bff', white: '#f3f6ff', warm: '#ffb561', yellow: '#ffd84a', orange: '#ff9a3d', pink: '#ff6fb5', purple: '#a46bff', cyan: '#38e5ff' };
  var REPEAT = ['vol_up', 'vol_down', 'ch_up', 'ch_down', 'bright_up', 'bright_down', 'speed_up', 'speed_down', 'temp_up', 'temp_down', 'bass_up', 'bass_down', 'treble_up', 'treble_down', 'up', 'down', 'left', 'right'];
  var LAYOUT = {
    stb: { top: ['power'], nav: true, pad: true, rows: [['back', 'menu', 'exit'], ['guide', 'info', 'fav', 'list'], ['ch_down', 'ch_up'], ['vol_down', 'mute', 'vol_up']] },
    box: { top: ['power'], nav: true, rows: [['back', 'home', 'menu'], ['rewind', 'play_pause', 'fast_forward'], ['vol_down', 'mute', 'vol_up']] },
    disc: { top: ['power', 'eject'], nav: true, pad: true, rows: [['menu', 'top_menu', 'back'], ['prev', 'rewind', 'fast_forward', 'next'], ['play', 'pause', 'stop'], ['subtitle', 'audio', 'repeat', 'display']] },
    audio: { top: ['power'], rows: [['vol_down', 'mute', 'vol_up'], ['source', 'bluetooth', 'aux', 'optical'], ['prev', 'play_pause', 'next'], ['bass_down', 'bass_up', 'treble_down', 'treble_up'], ['eq', 'surround', 'sound_mode', 'night']] },
    fan: { top: ['power', 'on', 'off'], all: true, rows: [['speed_down', 'speed', 'speed_up'], ['swing', 'timer', 'mode'], ['night', 'auto', 'breeze', 'light', 'ion']] },
    air: { top: ['power', 'on', 'off'], all: true, rows: [['temp_down', 'temp', 'temp_up'], ['speed_down', 'speed', 'speed_up'], ['mode', 'timer', 'swing', 'auto', 'night', 'light', 'ion']] },
    light: { top: ['power', 'on', 'off'], all: true, rows: [['bright_down', 'bright_up'], ['red', 'green', 'blue', 'white'], ['warm', 'yellow', 'orange', 'pink', 'purple', 'cyan'], ['flash', 'strobe', 'fade', 'smooth', 'auto', 'mode'], ['speed_down', 'speed_up']] },
    proj: { top: ['power', 'on', 'off'], nav: true, rows: [['menu', 'back', 'source'], ['vol_down', 'mute', 'vol_up'], ['freeze', 'blank', 'aspect', 'auto'], ['keystone_up', 'keystone_down', 'zoom_in', 'zoom_out'], ['focus', 'pip', 'picture']] },
    other: { top: ['power', 'on', 'off'], all: true }
  };

  function gKey(dev, k, shown) {
    shown.push(k);
    var ic = KEY_ICON[k], sw = SWATCH[k], label = keyLabel(dev, k);
    var wordy = LABELED.indexOf(k) >= 0; /* biểu tượng dễ nhầm (+/−, đảo, hẹn giờ...) thì kèm chữ */
    var b = h('button', { type: 'button', class: 'key gk' + (ic && !wordy ? ' ik' : '') + (wordy && ic ? ' lk' : '') + (sw ? ' sw' : ''), 'aria-label': label, 'data-key': k },
      ic && !sw ? UI.icon(ic) : null, ic && !sw && !wordy ? null : h('span', { text: label }));
    if (sw) b.style.setProperty('--sw', sw);
    UI.pressable(b, { repeat: REPEAT.indexOf(k) >= 0, interval: /^(vol|bass|treble)/.test(k) ? 130 : 180, onPress: function () { pressTv(dev, k); } });
    return b;
  }

  function buildKeyed(dev) {
    var L = LAYOUT[dev.type] || LAYOUT.other, shown = [], has = function (k) { return !!(dev.codes[k] && dev.codes[k].spec); };
    var top = h('div', { class: 'toprow' });
    var tops = L.top.filter(has);
    if (tops.indexOf('power') >= 0) tops = ['power'].concat(tops.filter(function (k) { return k !== 'power'; })); /* có nút nguồn thì ẩn Bật/Tắt: dồn vào Thêm phím */
    if (tops.indexOf('power') >= 0) tops = tops.filter(function (k) { return k === 'power' || k === 'eject'; });
    tops.forEach(function (k) {
      if (k === 'power') { shown.push(k); var p = tvKey(dev, 'power', 'power', 'power small', 'Nguồn'); top.appendChild(p); }
      else { var g = gKey(dev, k, shown); g.classList.add('small-pill'); top.appendChild(g); }
    });
    if (!tops.length) top.appendChild(h('span', { class: 'muted', text: 'Bộ mã này không có nút nguồn' }));
    top.appendChild(h('span', { class: 'grow' }));
    var digits = '0123456789'.split('').filter(has).length;
    if (L.pad && digits >= 6) { var np = h('button', { type: 'button', class: 'key small', 'aria-label': 'Bàn phím số', onclick: function () { UI.haptic('nav'); numpadSheet(dev); } }, h('span', { text: '123' })); top.appendChild(np); '0123456789'.split('').forEach(function (d) { shown.push(d); }); }
    top.appendChild(micKey());
    var blocks = [top];
    if (L.nav && ['up', 'down', 'left', 'right', 'ok'].some(has)) {
      ['up', 'down', 'left', 'right', 'ok'].forEach(function (k) { shown.push(k); });
      blocks.push(h('div', { class: 'dpad', role: 'group', 'aria-label': 'Phím điều hướng' },
        h('span'), tvKey(dev, 'up', 'up', 'nav'), h('span'),
        tvKey(dev, 'left', 'left', 'nav'), tvKey(dev, 'ok', null, 'okk', 'OK'), tvKey(dev, 'right', 'right', 'nav'),
        h('span'), tvKey(dev, 'down', 'down', 'nav'), h('span')));
    }
    (L.rows || []).forEach(function (r) {
      var ks = r.filter(function (k) { return has(k) && shown.indexOf(k) < 0; });
      if (!ks.length) return;
      var row = h('div', { class: 'krow', 'data-n': String(Math.min(ks.length, 4)) });
      ks.forEach(function (k) { row.appendChild(gKey(dev, k, shown)); });
      blocks.push(row);
    });
    var rest = Object.keys(dev.codes).filter(function (k) { return shown.indexOf(k) < 0; });
    var mainCount = shown.filter(function (k) { return k !== 'power' && k !== 'eject' && !/^\d$/.test(k); }).length;
    if (L.all || mainCount < 8) { /* bố cục không đoán được / ít phím nhận diện: cho thấy toàn bộ phím còn lại ngay trên màn hình */
      var grid = h('div', { class: 'krow', 'data-n': '3' });
      rest.sort(function (a, b) { return keyLabel(dev, a).localeCompare(keyLabel(dev, b), 'vi'); }).forEach(function (k) { grid.appendChild(gKey(dev, k, shown)); });
      if (grid.children.length) blocks.push(grid);
      rest = [];
    }
    if (rest.length) {
      var more = h('button', { type: 'button', class: 'btn ghost block moreKeys', onclick: function () { UI.haptic('nav'); extrasSheet(dev, shown); } }, UI.icon('more'), h('span', { text: 'Thêm phím (' + rest.length + ')' }));
      blocks.push(more);
    }
    return h.apply(null, ['div', { class: 'cpad gen' }].concat(blocks));
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

  var MODE_COLORS = { cool: ['#2EE6C5', '#4F9BFF'], heat: ['#FFC857', '#FF5C6C'], dry: ['#6C7CFF', '#B07BFF'], fan_only: ['#8E96AA', '#D5DAE8'], fan: ['#8E96AA', '#D5DAE8'] };
  var FAN_RANK = { silent: 0, silence: 0, quiet: 0, mute: 0, ultralow: 1, lowest: 1, min: 1, low: 2, lo: 2, lowmedium: 3, mediumlow: 3, mid: 4, middle: 4, medium: 4, med: 4, normal: 4,
    mediumhigh: 5, high: 6, hight: 6, highest: 7, max: 7, maximum: 7, superhigh: 7, 'super high': 7, turbo: 8, powerful: 8, hi_power: 8 };
  function fanRank(k) {
    var l = String(k).toLowerCase().trim();
    if (l in FAN_RANK) return FAN_RANK[l];
    var m = /^(?:level|l)?\s*(\d+)$/.exec(l);
    return m ? 100 + Number(m[1]) : null;
  }
  /* Tách quạt thành: Tự động | các mức xếp từ nhỏ đến lớn | chế độ đặc biệt */
  function fanGroups(fans) {
    var auto = [], ranked = [], special = [];
    fans.forEach(function (f) { var l = String(f).toLowerCase().trim(); if (l === 'auto') auto.push(f); else if (fanRank(f) !== null) ranked.push(f); else special.push(f); });
    ranked.sort(function (x, y) { return fanRank(x) - fanRank(y); });
    return { auto: auto, ranked: ranked, special: special };
  }

  function buildAc(dev, set) {
    var tempNum = h('div', { class: 'big-temp' }), tempUnit = h('span', { class: 'deg', text: '°C' });
    var modeTxt = h('div', { class: 'ac-mode' }), subTxt = h('div', { class: 'ac-sub' });
    var disp = h('div', { class: 'ac-display' }, h('div', { class: 'tline' }, tempNum, tempUnit), modeTxt, subTxt);

    var minus = h('button', { type: 'button', class: 'key round', 'aria-label': 'Giảm nhiệt độ' }, UI.icon('minus'));
    var plus = h('button', { type: 'button', class: 'key round', 'aria-label': 'Tăng nhiệt độ' }, UI.icon('plus'));
    function step(dir) { return function () { acChange(dev, set, function (st) { st.temp = AC.stepTemp(set, st, dir); }); }; }
    UI.pressable(minus, { repeat: true, interval: 200, onPress: function () { step(-1)(); } });
    UI.pressable(plus, { repeat: true, interval: 200, onPress: function () { step(1)(); } });

    /* Thanh kéo nhiệt độ: kéo thấy số đổi ngay, thả tay mới gửi 1 lệnh IR (không bắn liên tục khi kéo). */
    var tslider = UI.slider({ label: 'Nhiệt độ', values: AC.temps(set, dev.state).length ? AC.temps(set, dev.state) : [25], value: dev.state.temp, cls: 'temp',
      format: function (v) { return v + '°'; },
      onInput: function (v) { tempNum.textContent = String(v); },
      onCommit: function (v) { acChange(Store.get(dev.id) ? dev : dev, set, function (st) { st.temp = v; }); } });

    var power = h('button', { type: 'button', class: 'key power small', 'aria-label': 'Bật hoặc tắt máy' }, UI.icon('power'));
    UI.pressable(power, { onPress: function () { acChange(dev, set, function (st) { st.power = !st.power; }, true); } });
    var timerBtn = h('button', { type: 'button', class: 'chip timer', onclick: function () { UI.haptic('nav'); timerSheet(Store.get(dev.id), set); } });

    var modes = chipGroup(), fanSpecial = chipGroup(), swings = chipGroup();
    var fanLv = null, fanLvHost = h('div', { class: 'lvhost' });
    var fanRow = h('div', { class: 'fanrow' }, h('span', { class: 'cl', text: 'Quạt' }), h('div', { class: 'fanbody' }, fanSpecial, fanLvHost));
    var swRow = h('div', { class: 'chiprow' }, h('span', { class: 'cl', text: 'Đảo gió' }), swings);
    var modeRow = h('div', { class: 'chiprow' }, h('span', { class: 'cl', text: 'Chế độ' }), modes);

    function fill(box, items, cur, labelFn, onPick) {
      box.replaceChildren();
      items.forEach(function (it) {
        box.appendChild(h('button', { type: 'button', class: 'chip' + (it === cur ? ' on' : ''), 'aria-pressed': it === cur ? 'true' : 'false', text: labelFn(it), onclick: function () { UI.haptic('press'); onPick(it); } }));
      });
    }
    function pickFan(f) { acChange(dev, set, function (s) { s.fan = f; }); }

    acPaint = function () {
      var d = Store.get(dev.id); if (!d) return; dev = d;
      var st = d.state;
      disp.classList.toggle('off', !st.power);
      tempNum.textContent = String(st.temp);
      modeTxt.textContent = (st.power ? '' : 'Đang tắt · ') + AC.modeLabel(st.mode);
      subTxt.textContent = 'Quạt ' + AC.fanLabel(st.fan).toLowerCase() + (st.swing ? ' · Đảo gió ' + AC.swingLabel(st.swing).toLowerCase() : '');
      power.classList.toggle('lit', st.power);
      var ts = AC.temps(set, st);
      tslider.set(st.temp, ts.length ? ts : [st.temp]);
      var col = MODE_COLORS[st.mode] || ['#2EE6C5', '#6C7CFF']; tslider.setColors(col[0], col[1]);
      tslider.setDisabled(!st.power);
      minus.classList.toggle('na', !ts.length || st.temp <= ts[0]); plus.classList.toggle('na', !ts.length || st.temp >= ts[ts.length - 1]);
      var mm = AC.modes(set);
      fill(modes, mm, st.mode, AC.modeLabel, function (m) { acChange(dev, set, function (s) { s.mode = m; }); });
      var ff = AC.fans(set, st.mode), g = fanGroups(ff);
      fanRow.hidden = ff.length < 2;
      var useLv = g.ranked.length >= 2;
      fill(fanSpecial, useLv ? g.auto.concat(g.special) : ff, st.fan, AC.fanLabel, pickFan);
      fanSpecial.hidden = !fanSpecial.children.length;
      fanLvHost.hidden = !useLv;
      if (useLv) {
        var items = g.ranked.map(function (k) { return { key: k, label: AC.fanLabel(k) }; });
        if (!fanLv) { fanLv = UI.levels({ label: 'Tốc độ quạt', items: items, value: st.fan, onCommit: pickFan }); fanLvHost.appendChild(fanLv.el); }
        fanLv.set(st.fan, items);
      }
      var sw = AC.swings(set, st.mode, st.fan); swRow.hidden = sw.length < 2;
      fill(swings, sw, st.swing, AC.swingLabel, function (v) { acChange(dev, set, function (s) { s.swing = v; }); });
      modeRow.hidden = mm.length < 2;
      timerBtn.replaceChildren(UI.icon('timer'), h('span', { text: d.timer ? 'Tắt sau ' + remain(d.timer.at) : 'Hẹn giờ tắt' }));
      timerBtn.classList.toggle('on', !!d.timer);
    };
    var el = h('div', { class: 'cpad ac' },
      disp,
      h('div', { class: 'toprow' }, power, h('span', { class: 'grow' }), micKey(), timerBtn),
      h('div', { class: 'tempctl' }, minus, tslider.el, plus),
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
        h('span', { class: 'dico' }, UI.icon(DT.icon(d.type))),
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
      h('p', { class: 'muted', text: 'Chọn thiết bị của bạn (TV, điều hòa, đầu thu, loa, quạt, đèn, máy chiếu…) để dùng ngay. Mọi thứ chạy ngoại tuyến, không cần đăng nhập.' }),
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
      UI.icon(DT.icon(dev.type)), h('span', { class: 'pname' }, h('b', { text: dev.name }), h('small', { text: (dev.brand + ' ' + dev.model).trim() })), UI.icon('chev'));
    root.appendChild(h('div', { class: 'topbar' }, pill, h('span', { class: 'grow' }), irChip()));
    root.appendChild(statusEl);
    var stage = h('div', { class: 'stage' });
    root.appendChild(stage);
    if (dev.type === 'tv') root.appendChild(buildTv(dev));
    else if (dev.type !== 'ac') root.appendChild(buildKeyed(dev));
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
    Bridge.setVolumeKeys(on && Store.setting('volumeKeys') && !!dev && dev.type !== 'ac' && !!(dev.codes.vol_up || dev.codes.vol_down));
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
    if (!tabActive || !dev || dev.type === 'ac' || UI.hasSheet() || UI.hasPage()) return false;
    pressTv(dev, key); return true;
  };

  window.VigoControl = {
    mount: function (el) { root = el; Store.onChange(function () { render(); }); render(); },
    render: render, sync: sync,
    setTabActive: function (v) { tabActive = v; sync(); },
    _press: pressTv
  };
})();
