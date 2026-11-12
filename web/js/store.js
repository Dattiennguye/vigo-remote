/* VIGO — lưu trữ cục bộ (localStorage), hoạt động ngoại tuyến. Không ghi lịch sử thao tác. */
(function () {
  'use strict';
  var KEY = 'vigo.remote.v2', OLD = 'vigo.remote.v1';
  var DEFAULTS = { haptics: true, hapticLevel: 'medium', reduceMotion: false, repeat: true, keepAwake: false, volumeKeys: false };
  var state, storageError = null, listeners = [];

  function fresh() { return { v: 2, devices: [], activeId: null, account: null, pro: { active: false, checkedAt: 0 }, settings: Object.assign({}, DEFAULTS) }; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) { /* bỏ qua */ } }); }

  function sanitize(p) {
    var s = fresh();
    if (!p || typeof p !== 'object') return s;
    if (Array.isArray(p.devices)) {
      s.devices = p.devices.filter(function (d) {
        return d && typeof d.id === 'string' && window.VigoDevTypes.has(d.type) && typeof d.name === 'string' &&
          (d.type !== 'ac' ? d.codes && typeof d.codes === 'object' : d.ac && typeof d.ac.setId === 'string');
      });
    }
    if (p.settings && typeof p.settings === 'object') {
      Object.keys(DEFAULTS).forEach(function (k) {
        if (typeof p.settings[k] === typeof DEFAULTS[k]) s.settings[k] = p.settings[k];
      });
      if (['light', 'medium', 'strong'].indexOf(s.settings.hapticLevel) < 0) s.settings.hapticLevel = 'medium';
    }
    if (p.account && typeof p.account.email === 'string') s.account = { email: p.account.email.slice(0, 120), name: String(p.account.name || '').slice(0, 80) };
    if (p.pro && typeof p.pro === 'object') s.pro = { active: !!p.pro.active, checkedAt: Number(p.pro.checkedAt) || 0 };
    s.activeId = s.devices.some(function (d) { return d.id === p.activeId; }) ? p.activeId : (s.devices[0] ? s.devices[0].id : null);
    return s;
  }

  function load() {
    state = fresh(); storageError = null;
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) { state = sanitize(JSON.parse(raw)); return; }
      var old = window.localStorage.getItem(OLD); /* nâng cấp từ bản 1.x: giữ thiết bị TV, bỏ lịch sử và điều hòa cũ */
      if (old) {
        var o = JSON.parse(old);
        state = sanitize({ devices: (o.devices || []).filter(function (d) { return d && d.type === 'tv'; }) });
        save();
      }
    } catch (e) { storageError = 'Không đọc được dữ liệu đã lưu: ' + e.message; state = fresh(); }
  }

  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); storageError = null; return true; }
    catch (e) { storageError = 'Không lưu được dữ liệu: ' + e.message; return false; }
  }

  var Store = {
    init: load,
    error: function () { return storageError; },
    onChange: function (f) { listeners.push(f); },
    devices: function () { return state.devices.slice(); },
    get: function (id) { return state.devices.filter(function (d) { return d.id === id; })[0] || null; },
    active: function () { return Store.get(state.activeId) || state.devices[0] || null; },
    setActive: function (id) { if (Store.get(id)) { state.activeId = id; save(); emit(); } },
    add: function (d) {
      var dev = { id: uid(), name: d.name, type: d.type, brand: d.brand || '', model: d.model || '', createdAt: Date.now() };
      if (d.type !== 'ac') { dev.codes = d.codes || {}; dev.source = d.source || ''; }
      else { dev.ac = d.ac; dev.state = d.state; }
      state.devices.push(dev); state.activeId = dev.id; save(); emit(); return dev;
    },
    update: function (id, patch, silent) {
      var d = Store.get(id); if (!d) return null;
      Object.keys(patch).forEach(function (k) { d[k] = patch[k]; });
      save(); if (!silent) emit(); return d;
    },
    remove: function (id) {
      state.devices = state.devices.filter(function (d) { return d.id !== id; });
      if (state.activeId === id) state.activeId = state.devices[0] ? state.devices[0].id : null;
      save(); emit();
    },
    settings: function () { return Object.assign({}, state.settings); },
    setting: function (k) { return state.settings[k]; },
    set: function (k, v) { if (k in DEFAULTS) { state.settings[k] = v; save(); emit(); } },

    account: function () { return state.account; },
    setAccount: function (a) { state.account = a ? { email: String(a.email).slice(0, 120), name: String(a.name || '').slice(0, 80) } : null; save(); emit(); },
    pro: function () { return Object.assign({}, state.pro); },
    setPro: function (active) { state.pro = { active: !!active, checkedAt: Date.now() }; save(); emit(); },

    exportJson: function () { var copy = Object.assign({}, state); delete copy.account; delete copy.pro; /* tài khoản/gói không nằm trong sao lưu */
      return JSON.stringify({ app: 'vigo-remote', version: 2, data: copy }, null, 1); },
    importJson: function (text) {
      var p;
      try { p = JSON.parse(text); } catch (e) { throw new Error('Nội dung không phải JSON hợp lệ'); }
      if (!p || p.app !== 'vigo-remote' || !p.data) throw new Error('Đây không phải bản sao lưu của VIGO Remote');
      var s = sanitize(p.data);
      s.account = state.account; s.pro = state.pro;
      state = s; save(); emit();
      return s.devices.length;
    },
    wipe: function () {
      try { window.localStorage.removeItem(KEY); window.localStorage.removeItem(OLD); } catch (e) { /* bỏ qua */ }
      state = fresh(); emit();
    }
  };
  window.VigoStore = Store;
})();
