/* VIGO — tiện ích giao diện: dựng DOM, biểu tượng, thông báo, hộp thoại, trang con, nút bấm có rung/lặp. */
(function () {
  'use strict';
  var Store = window.VigoStore, Bridge = window.IRBridge;

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'html') throw new Error('html không được dùng');
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(el, x); });
    else el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }

  var SVGNS = 'http://www.w3.org/2000/svg';
  var ICONS = {
    power: 'M12 3v9M6.3 6.8a8 8 0 1 0 11.4 0',
    mute: 'M4 9v6h4l5 4V5L8 9H4zM17 9l4 6M21 9l-4 6',
    volup: 'M4 9v6h4l5 4V5L8 9H4zM17 8.5a5 5 0 0 1 0 7M19.8 6a9 9 0 0 1 0 12',
    voldown: 'M4 9v6h4l5 4V5L8 9H4zM17 9a5 5 0 0 1 0 6',
    up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6', left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6',
    back: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
    home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
    exit: 'M6 6l12 12M18 6L6 18',
    plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    chev: 'M6 9l6 6 6-6', chevr: 'M9 6l6 6-6 6',
    remote: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 6h.01M12 11h.01M12 16h.01',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    tv: 'M3 6h18v11H3zM8 21h8M12 17v4',
    ac: 'M3 5h18v7H3zM7 16c0 2-1 3-1 3M12 16c0 2-1 3-1 3M17 16c0 2-1 3-1 3M6 8.5h6',
    snow: 'M12 2v20M4.9 7l14.2 10M19.1 7L4.9 17',
    sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
    fan: 'M12 12m-1.5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M12 10.5C12 6 14 3 17 3c0 3-1.5 5.5-5 7.5zM13.5 12c4.500 0 7.500 2 7.500 5-3 0-5.500-1.500-7.500-5zM12 13.500C12 18 10 21 7 21c0-3 1.500-5.500 5-7.500zM10.500 12C6 12 3 10 3 7c3 0 5.500 1.500 7.500 5z',
    auto: 'M12 3l2.5 6.500L21 12l-6.500 2.500L12 21l-2.500-6.500L3 12l6.500-2.500z',
    swing: 'M4 8c3-3 5 3 8 0s5 3 8 0M4 15c3-3 5 3 8 0s5 3 8 0',
    timer: 'M12 8v5l3 2M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM9 2h6',
    check: 'M5 12.500l4.500 4.500L19 7.500',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
    wave: 'M5 12a10 10 0 0 1 14 0M8 15a6 6 0 0 1 8 0M11 18a2 2 0 0 1 2 0',
    shield: 'M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z',
    info: 'M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    save: 'M5 3h12l4 4v14H5zM8 3v6h8V3M8 21v-7h8v7',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
    ok: 'M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0'
  };
  function icon(name, cls) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'ico' + (cls ? ' ' + cls : ''));
    var p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', ICONS[name] || ICONS.info);
    s.appendChild(p); return s;
  }

  /* ---- Rung ---- */
  function haptic(kind) { /* kind: press | nav | error */
    if (!Store.setting('haptics')) return;
    var mode = Store.setting('hapticMode');
    if (kind === 'error') return Bridge.haptic('error', mode);
    var lvl = Store.setting('hapticLevel');
    if (kind === 'nav') return Bridge.haptic('tick', mode);
    Bridge.haptic(lvl === 'light' ? 'tick' : lvl === 'strong' ? 'heavy' : 'click', mode);
  }

  /* ---- Nút bấm: kích hoạt ngay khi chạm (pointerdown), giữ để lặp, hỗ trợ bàn phím ---- */
  function pressable(el, opts) {
    var timer = null, rep = null, active = false;
    function stop() {
      active = false; el.classList.remove('pressed');
      if (timer) clearTimeout(timer); if (rep) clearInterval(rep); timer = rep = null;
    }
    el.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button > 0) return;
      if (el.getAttribute('aria-disabled') === 'true') { opts.onPress(true); return; }
      active = true; el.classList.add('pressed');
      opts.onPress(false);
      if (opts.repeat && Store.setting('repeat')) {
        timer = setTimeout(function () {
          rep = setInterval(function () { if (active) opts.onPress(false, true); }, opts.interval || 150);
        }, 420);
      }
    });
    ['pointerup', 'pointercancel', 'pointerleave', 'blur'].forEach(function (ev) { el.addEventListener(ev, stop); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.addEventListener('click', function (e) {
      if (e.detail === 0) { /* Enter / Space từ bàn phím hoặc trình đọc màn hình */
        opts.onPress(el.getAttribute('aria-disabled') === 'true');
      }
    });
    return el;
  }

  /* ---- Thông báo ngắn ---- */
  var toastT = null;
  function toast(kind, text) {
    var el = document.getElementById('toast'); if (!el) return;
    el.textContent = text; el.className = 'toast ' + (kind || ''); el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('show'); });
    clearTimeout(toastT);
    toastT = setTimeout(function () { el.classList.remove('show'); setTimeout(function () { el.hidden = true; }, 220); }, 2600);
  }

  /* ---- Bottom sheet / hộp thoại ---- */
  var sheetStack = [];
  function openSheet(node, opts) {
    var root = document.getElementById('sheet-root');
    var back = h('div', { class: 'scrim', onclick: function () { if (!(opts && opts.modal)) closeSheet(); } });
    var box = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'grab' }), node);
    var wrap = h('div', { class: 'sheet-wrap' }, back, box);
    root.appendChild(wrap);
    sheetStack.push({ wrap: wrap, onClose: opts && opts.onClose });
    requestAnimationFrame(function () { wrap.classList.add('open'); });
    return wrap;
  }
  function closeSheet() {
    var s = sheetStack.pop(); if (!s) return false;
    s.wrap.classList.remove('open');
    var rm = function () { if (s.wrap.parentNode) s.wrap.parentNode.removeChild(s.wrap); };
    if (document.documentElement.classList.contains('calm')) rm(); else setTimeout(rm, 240);
    if (s.onClose) s.onClose();
    return true;
  }
  function hasSheet() { return sheetStack.length > 0; }
  function confirmBox(title, text, okLabel, onOk, danger) {
    openSheet(h('div', { class: 'confirm' },
      h('h3', { text: title }), text ? h('p', { class: 'muted', text: text }) : null,
      h('div', { class: 'row-btns' },
        h('button', { class: 'btn ghost', text: 'Hủy', onclick: closeSheet }),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), text: okLabel, onclick: function () { closeSheet(); onOk(); } }))), { modal: true });
  }

  /* ---- Trang con (trượt từ phải), có ngăn xếp cho nút Back ---- */
  var pageStack = [];
  function openPage(title, build, opts) {
    var root = document.getElementById('page-root');
    var body = h('div', { class: 'page-body' });
    var page = h('section', { class: 'page', role: 'region', 'aria-label': title },
      h('header', { class: 'page-head' },
        h('button', { class: 'icon-btn', 'aria-label': 'Quay lại', onclick: function () { closePage(); } }, icon('left')),
        h('h2', { text: title })),
      body);
    root.appendChild(page);
    pageStack.push({ el: page, onClose: opts && opts.onClose });
    build(body, page);
    requestAnimationFrame(function () { page.classList.add('in'); });
    return page;
  }
  function closePage() {
    var p = pageStack.pop(); if (!p) return false;
    p.el.classList.remove('in');
    var rm = function () { if (p.el.parentNode) p.el.parentNode.removeChild(p.el); };
    if (document.documentElement.classList.contains('calm')) rm(); else setTimeout(rm, 260);
    if (p.onClose) p.onClose();
    return true;
  }
  function hasPage() { return pageStack.length > 0; }


  /* ---- Thanh kéo mượt: chỉ dùng transform/clip-path (chạy trên GPU), bám ngón tay liên tục, thả thì hít vào mức gần nhất ---- */
  function slider(o) {
    var values = o.values.slice(), idx = 0, w = 0, tw = 56, dragging = false, pid = null, raf = 0, lastP = 0;
    var fill = h('div', { class: 's-fill' }), ticks = h('div', { class: 's-ticks', 'aria-hidden': 'true' });
    var thumb = h('div', { class: 's-thumb' }, h('span', { class: 's-val' }));
    var track = h('div', { class: 's-track' }, fill, ticks, thumb);
    var el = h('div', { class: 'slider ' + (o.cls || ''), role: 'slider', tabindex: '0', 'aria-label': o.label }, track);
    var valEl = thumb.firstChild;

    function fmt(v) { return o.format ? o.format(v) : String(v); }
    function nearest(v) { var b = 0; for (var i = 1; i < values.length; i++) if (Math.abs(values[i] - v) < Math.abs(values[b] - v)) b = i; return b; }
    function measure() { w = track.clientWidth; tw = thumb.offsetWidth || tw; }
    function place(p, noAnim) { /* p: 0..1 liên tục */
      lastP = p;
      if (!w) measure();
      var x = Math.max(0, Math.min(1, p)) * Math.max(0, w - tw);
      thumb.style.transform = 'translate3d(' + x + 'px,0,0)';
      fill.style.clipPath = 'inset(0 ' + Math.max(0, w - x - tw * 0.6) + 'px 0 0 round 26px)';
    }
    function pOf(i) { return values.length > 1 ? i / (values.length - 1) : 0; }
    function aria() { el.setAttribute('aria-valuemin', values[0]); el.setAttribute('aria-valuemax', values[values.length - 1]); el.setAttribute('aria-valuenow', values[idx]); el.setAttribute('aria-valuetext', fmt(values[idx])); }
    function render(anim) { el.classList.toggle('snap', !!anim && !dragging); valEl.textContent = fmt(values[idx]); aria(); place(pOf(idx)); }
    function build() {
      ticks.replaceChildren();
      var n = Math.min(values.length, 40);
      if (values.length <= 40) for (var i = 0; i < n; i++) ticks.appendChild(h('i'));
    }
    function fromX(clientX) {
      var r = track.getBoundingClientRect(); measure();
      var span = Math.max(1, w - tw);
      return Math.max(0, Math.min(1, (clientX - r.left - tw / 2) / span));
    }
    function move(clientX) {
      var p = fromX(clientX), ni = Math.round(p * (values.length - 1));
      place(p);
      if (ni !== idx) { idx = ni; valEl.textContent = fmt(values[idx]); aria(); haptic('nav'); if (o.onInput) o.onInput(values[idx]); }
    }
    track.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button > 0) return;
      dragging = true; pid = e.pointerId; el.classList.add('drag'); el.classList.remove('snap');
      try { track.setPointerCapture(pid); } catch (x) { /* bỏ qua */ }
      move(e.clientX);
    });
    track.addEventListener('pointermove', function (e) {
      if (!dragging || e.pointerId !== pid) return;
      if (raf) return; var cx = e.clientX;
      raf = requestAnimationFrame(function () { raf = 0; if (dragging) move(cx); });
    });
    function end(e) {
      if (!dragging || (e && e.pointerId !== pid)) return;
      dragging = false; el.classList.remove('drag'); if (raf) { cancelAnimationFrame(raf); raf = 0; }
      el.classList.add('snap'); render(true);
      if (o.onCommit) o.onCommit(values[idx]);
    }
    track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end);
    el.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
      if (e.key === 'Home') d = -values.length; if (e.key === 'End') d = values.length;
      if (!d) return; e.preventDefault();
      var ni = Math.max(0, Math.min(values.length - 1, idx + d));
      if (ni === idx) return; idx = ni; haptic('nav'); render(true);
      if (o.onInput) o.onInput(values[idx]); if (o.onCommit) o.onCommit(values[idx]);
    });
    if (window.ResizeObserver) new ResizeObserver(function () { measure(); place(dragging ? lastP : pOf(idx)); }).observe(track);
    build(); idx = nearest(o.value); render(false);
    requestAnimationFrame(function () { measure(); render(false); });
    return {
      el: el,
      set: function (v, newValues) {
        if (newValues && (newValues.length !== values.length || newValues[0] !== values[0] || newValues[newValues.length - 1] !== values[values.length - 1])) { values = newValues.slice(); build(); }
        if (dragging) return; idx = nearest(v); render(true);
      },
      setColors: function (c1, c2) { el.style.setProperty('--c1', c1); el.style.setProperty('--c2', c2); },
      setDisabled: function (d) { el.classList.toggle('dim', !!d); }
    };
  }

  /* ---- Thanh mức độ dạng cột to nhỏ (quạt): kéo ngang qua các cột để chọn ---- */
  function levels(o) {
    var items = o.items.slice(), idx = 0, dragging = false, pid = null;
    var bars = h('div', { class: 'lv-bars' });
    var name = h('div', { class: 'lv-name' });
    var el = h('div', { class: 'levels', role: 'slider', tabindex: '0', 'aria-label': o.label }, bars, name);
    function buildBars() {
      bars.replaceChildren();
      items.forEach(function (it, i) {
        var b = h('i', { class: 'lv-bar' }); b.style.height = (26 + (i + 1) / items.length * 74) + '%'; bars.appendChild(b);
      });
    }
    function paint() {
      var n = bars.children;
      for (var i = 0; i < n.length; i++) { n[i].classList.toggle('on', idx >= 0 && i <= idx); n[i].classList.toggle('cur', i === idx); }
      name.textContent = idx >= 0 ? items[idx].label : '';
      el.classList.toggle('none', idx < 0);
      if (idx >= 0) { el.setAttribute('aria-valuenow', idx + 1); el.setAttribute('aria-valuetext', items[idx].label); }
      el.setAttribute('aria-valuemin', 1); el.setAttribute('aria-valuemax', items.length);
    }
    function pick(clientX) {
      var r = bars.getBoundingClientRect(); var p = Math.max(0, Math.min(0.9999, (clientX - r.left) / Math.max(1, r.width)));
      var ni = Math.floor(p * items.length);
      if (ni !== idx) { idx = ni; paint(); haptic('nav'); if (o.onInput) o.onInput(items[idx].key); }
    }
    el.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button > 0) return;
      dragging = true; pid = e.pointerId; el.classList.add('drag'); try { el.setPointerCapture(pid); } catch (x) { /* bỏ qua */ } pick(e.clientX);
    });
    el.addEventListener('pointermove', function (e) { if (dragging && e.pointerId === pid) pick(e.clientX); });
    function end(e) { if (!dragging || e.pointerId !== pid) return; dragging = false; el.classList.remove('drag'); if (o.onCommit) o.onCommit(items[idx].key); }
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
      if (!d) return; e.preventDefault(); var ni = Math.max(0, Math.min(items.length - 1, (idx < 0 ? 0 : idx) + d));
      if (ni === idx) return; idx = ni; paint(); haptic('nav'); if (o.onInput) o.onInput(items[idx].key); if (o.onCommit) o.onCommit(items[idx].key);
    });
    buildBars(); idx = items.map(function (x) { return x.key; }).indexOf(o.value); paint();
    return { el: el, set: function (key, newItems) {
      if (newItems && newItems.map(function (x) { return x.key; }).join('|') !== items.map(function (x) { return x.key; }).join('|')) { items = newItems.slice(); buildBars(); }
      if (dragging) return; idx = items.map(function (x) { return x.key; }).indexOf(key); paint();
    } };
  }

  /* ---- Gợn sóng mờ dần khi chạm mọi nút ---- */
  var RIP = '.key,.btn,.chip,.xkey,.row.tap,.pill,.irchip,.icon-btn,.bigcard,.devrow,.seg button,#tabbar button,.plan';
  document.addEventListener('pointerdown', function (e) {
    if (document.documentElement.classList.contains('calm')) return;
    var t = e.target && e.target.closest ? e.target.closest(RIP) : null;
    if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true') return;
    var r = t.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2;
    t.classList.add('rip-host');
    var s = document.createElement('span'); s.className = 'rip';
    s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
    t.appendChild(s);
    var rm = function () { if (s.parentNode) s.parentNode.removeChild(s); };
    s.addEventListener('animationend', rm); setTimeout(rm, 900);
  }, true);

  function sectionTitle(t) { return h('h3', { class: 'sec', text: t }); }
  function toggleRow(title, sub, checked, onChange) {
    var input = h('input', { type: 'checkbox', role: 'switch' });
    input.checked = !!checked;
    input.addEventListener('change', function () { haptic('nav'); onChange(input.checked); });
    return h('label', { class: 'row toggle' },
      h('span', { class: 'row-main' }, h('span', { class: 'row-title', text: title }), sub ? h('span', { class: 'row-sub', text: sub }) : null),
      input, h('span', { class: 'sw', 'aria-hidden': 'true' }));
  }

  window.VigoUI = {
    h: h, add: add, icon: icon, haptic: haptic, pressable: pressable, toast: toast,
    openSheet: openSheet, closeSheet: closeSheet, hasSheet: hasSheet, confirmBox: confirmBox,
    openPage: openPage, closePage: closePage, hasPage: hasPage, sectionTitle: sectionTitle, toggleRow: toggleRow, slider: slider, levels: levels
  };
})();
