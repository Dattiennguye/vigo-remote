/* VIGO — thư viện mã IR (TV từ Flipper-IRDB CC0, điều hòa từ SmartIR MIT).
 * Dữ liệu nằm trong data/tv/*.js và data/ac/*.js, nạp khi cần (ngoại tuyến, từ assets của app).
 * Mỗi tệp dữ liệu tự gọi register*(); các hàm load*() trả về Promise. */
(function (root) {
  'use strict';
  var dev = {}, devIdx = {}, ac = {}, acIndex = null, keyLabels = {};
  var loading = {};
  var loader = function (file) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'data/' + file;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Không tải được dữ liệu mã IR: ' + file)); };
      document.head.appendChild(s);
    });
  };

  function load(file, ready) {
    var v = ready();
    if (v) return Promise.resolve(v);
    if (!loading[file]) {
      loading[file] = loader(file).then(function () {
        delete loading[file];
        var r = ready();
        if (!r) throw new Error('Tệp dữ liệu không hợp lệ: ' + file);
        return r;
      }, function (e) { delete loading[file]; throw e; });
    }
    return loading[file];
  }

  var Lib = {
    /* TV giữ API cũ (data/tv/*.js) và dùng chung kho với các loại khác. */
    registerTv: function (brand, list) { Lib.registerDev('tv', brand, list); },
    registerTvIndex: function (idx) { Lib.registerDevIndex('tv', idx); },
    registerDev: function (type, brand, list) { (dev[type] = dev[type] || {})[brand] = list; },
    registerDevIndex: function (type, idx) { devIdx[type] = idx; },
    registerKeyLabels: function (m) { keyLabels = Object.assign(keyLabels, m); },
    registerAc: function (id, entry) { ac[id] = entry; },
    registerAcIndex: function (idx) { acIndex = idx; },
    setLoader: function (fn) { loader = fn; },
    keyLabel: function (k) { return keyLabels[k] || null; },
    labelKeys: function () { return Object.keys(keyLabels); },

    devIndex: function (type) { return load(type + '/index.js', function () { return devIdx[type]; }); },
    devBrand: function (type, name) {
      return Lib.devIndex(type).then(function (idx) {
        var b = idx.brands.filter(function (x) { return x.name === name; })[0];
        if (!b) throw new Error('Không có hãng ' + name);
        return load(b.file, function () { return dev[type] && dev[type][name]; });
      });
    },
    tvIndex: function () { return Lib.devIndex('tv'); },
    tvBrand: function (name) { return Lib.devBrand('tv', name); },
    acIndex: function () { return load('ac/index.js', function () { return acIndex; }); },
    acSet: function (id) { return load('ac/' + id + '.js', function () { return ac[id]; }); },
    sources: function () {
      return [
        { name: 'Flipper-IRDB', license: 'CC0-1.0', url: 'https://github.com/logickworkshop/Flipper-IRDB', what: 'Mã TV, đầu thu, TV box, đầu đĩa, loa/amply, quạt, đèn, máy chiếu và thiết bị khác' },
        { name: 'SmartIR', license: 'MIT', url: 'https://github.com/smartHomeHub/SmartIR', what: 'Mã điều hòa' }
      ];
    }
  };
  root.VigoLib = Lib;
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.VigoLib;
