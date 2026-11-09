/* VIGO — lưu trữ cục bộ (localStorage), hoạt động ngoại tuyến. */
(function () {
  'use strict';
  var KEY = 'vigo.remote.v1';
  var MAX_HISTORY = 60;
  var state = { devices: [], history: [] };
  var storageError = null;

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && Array.isArray(p.devices)) state.devices = p.devices;
        if (p && Array.isArray(p.history)) state.history = p.history;
      }
    } catch (e) { storageError = 'Không đọc được dữ liệu đã lưu: ' + e.message; }
  }

  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); storageError = null; return true; }
    catch (e) { storageError = 'Không lưu được dữ liệu: ' + e.message; return false; }
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  var Store = {
    init: load,
    error: function () { return storageError; },
    devices: function () { return state.devices.slice(); },
    get: function (id) { return state.devices.filter(function (d) { return d.id === id; })[0] || null; },
    add: function (d) {
      var dev = {
        id: uid(), name: d.name, type: d.type, brand: d.brand || '', model: d.model || '',
        codes: d.codes || {}, source: d.source || '', createdAt: Date.now(),
        state: d.type === 'ac' ? { power: false, mode: 'cool', temp: 25, fan: 'auto', swingV: false, swingH: false } : {},
        timer: null
      };
      state.devices.push(dev); save(); return dev;
    },
    update: function (id, patch) {
      var d = Store.get(id); if (!d) return null;
      Object.keys(patch).forEach(function (k) { d[k] = patch[k]; });
      save(); return d;
    },
    remove: function (id) {
      state.devices = state.devices.filter(function (d) { return d.id !== id; });
      save();
    },
    persist: save,

    history: function () { return state.history.slice(); },
    log: function (entry) {
      entry.t = Date.now();
      state.history.unshift(entry);
      if (state.history.length > MAX_HISTORY) state.history.length = MAX_HISTORY;
      save();
    },
    clearHistory: function () { state.history = []; save(); }
  };

  window.VigoStore = Store;
})();
