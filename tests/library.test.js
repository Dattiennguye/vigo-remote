/* Kiểm tra toàn vẹn thư viện mã: TV (Flipper-IRDB) và điều hòa (SmartIR). Chạy: node tests/library.test.js */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const IR = require('../web/js/ir-protocols.js');
const AC = require('../web/js/ac-engine.js');

const DATA = path.join(__dirname, '..', 'web', 'data');
const loaded = { tv: {}, ac: {}, tvIdx: null, acIdx: null, dev: {}, devIdx: {}, labels: {} };
globalThis.VigoLib = {
  registerTv: (b, l) => { loaded.tv[b] = l; }, registerTvIndex: (i) => { loaded.tvIdx = i; },
  registerAc: (id, e) => { loaded.ac[id] = e; }, registerAcIndex: (i) => { loaded.acIdx = i; },
  registerDev: (type, b, l) => { (loaded.dev[type] = loaded.dev[type] || {})[b] = l; }, registerDevIndex: (type, i) => { loaded.devIdx[type] = i; },
  registerKeyLabels: (m) => { loaded.labels = Object.assign(loaded.labels, m); }
};
const run = (rel) => vm.runInThisContext(fs.readFileSync(path.join(DATA, rel), 'utf8'), { filename: rel });
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

const CORE = ['power', 'mute', 'vol_up', 'vol_down', 'up', 'down', 'left', 'right', 'ok', 'back', 'home', 'exit'];

/* ---------- TV ---------- */
run('tv/index.js');
t('chỉ mục TV: có các hãng chính và nguồn/giấy phép', () => {
  const names = loaded.tvIdx.brands.map((b) => b.name);
  ['Samsung', 'LG', 'Sony', 'TCL', 'Xiaomi', 'Panasonic'].forEach((b) => assert(names.includes(b), 'thiếu ' + b));
  assert.strictEqual(loaded.tvIdx.source.license, 'CC0-1.0');
});
let tvSets = 0, tvCodes = 0, tvFull = 0;
loaded.tvIdx.brands.forEach((b) => {
  run(b.file);
  const list = loaded.tv[b.name];
  assert.strictEqual(list.length, b.n, b.name + ': số bộ mã không khớp chỉ mục');
  list.forEach((e) => {
    assert.strictEqual(e.brand, b.name); assert(e.source && e.source.license === 'CC0-1.0' && e.source.url, 'thiếu nguồn');
    assert(Object.keys(e.codes).length >= 4, 'quá ít phím: ' + e.model);
    Object.entries(e.codes).forEach(([k, c]) => { IR.encode(c.spec); tvCodes++; assert(k && /^[a-z0-9_]+$/.test(k), 'khóa lạ: ' + k); });
    assert.strictEqual(e.core, CORE.filter((k) => e.codes[k]).length, 'đếm core sai: ' + e.model);
    if (e.core === 12) tvFull++;
    tvSets++;
  });
});
t('mọi mã TV (' + tvCodes + ' mã / ' + tvSets + ' bộ) mã hóa được thành xung hợp lệ', () => assert(tvCodes > 5000));
t('có bộ đủ 12 phím chính ở các hãng phổ biến (' + tvFull + ' bộ)', () => {
  ['Samsung', 'LG', 'Sony', 'Panasonic'].forEach((b) => assert(loaded.tv[b].some((e) => e.core === 12), b + ' không có bộ đủ phím'));
});
t('bộ đầu tiên của Samsung/LG đủ phím chính (OK dùng được)', () => {
  ['Samsung', 'LG'].forEach((b) => assert.strictEqual(loaded.tv[b][0].core, 12, b));
});
t('khóa phím không trùng bí danh (không còn Enter_OK, vol_plus...)', () => {
  const bad = new Set(['enter_ok', 'vol_plus', 'vol_minus', 'channel_up', 'nav_ok', 'return']);
  Object.values(loaded.tv).flat().forEach((e) => Object.keys(e.codes).forEach((k) => assert(!bad.has(k), k + ' ở ' + e.model)));
});

/* ---------- Điều hòa ---------- */
run('ac/index.js');
t('chỉ mục AC: nhiều hãng, có nguồn/giấy phép', () => {
  assert(loaded.acIdx.brands.length >= 100);
  assert.strictEqual(loaded.acIdx.source.license, 'MIT');
  ['Daikin', 'Panasonic', 'LG', 'Samsung', 'Mitsubishi Electric', 'Midea', 'Gree'].forEach((b) => assert(loaded.acIdx.brands.some((x) => x.name === b), 'thiếu ' + b));
});
let acSets = 0, acCodes = 0, combos = 0;
loaded.acIdx.brands.forEach((b) => b.sets.forEach((s) => {
  run('ac/' + s.id + '.js');
  const e = loaded.ac[s.id];
  assert(e, 'không nạp được ' + s.id);
  assert.strictEqual(e.commands.off, s.off, s.id + ': mã tắt ở chỉ mục lệch');
  IR.encode({ protocol: 'broadlink', data: e.commands.off });
  const dflt = AC.defaults(e);
  assert(AC.spec(e, Object.assign({}, dflt, { power: true })), s.id + ': không có mã bật cho trạng thái mặc định');
  AC.modes(e).forEach((m) => AC.fans(e, m).forEach((f) => {
    const sw = AC.swings(e, m, f);
    (sw.length ? sw : [null]).forEach((v) => {
      const st = { power: true, mode: m, fan: f, swing: v, temp: 25 };
      const ts = AC.temps(e, st);
      assert(ts.length, s.id + ' ' + m + '/' + f + ': không có nhiệt độ');
      ts.forEach((tp) => { const spec = AC.spec(e, Object.assign({}, st, { temp: tp })); assert(spec, 'thiếu mã'); IR.encode(spec); acCodes++; });
      combos++;
      /* bước nhiệt độ lên/xuống luôn rơi vào nhiệt độ có mã */
      const up = AC.stepTemp(e, Object.assign({}, st, { temp: ts[0] }), 1), dn = AC.stepTemp(e, Object.assign({}, st, { temp: ts[0] }), -1);
      assert(ts.includes(up) && dn === ts[0]);
    });
  }));
  acSets++;
}));
t('mọi mã AC (' + acCodes + ' mã, ' + acSets + ' bộ, ' + combos + ' tổ hợp) giải mã được và có xung hợp lệ', () => assert(acCodes > 100000));
t('engine: trạng thái không hợp lệ được đưa về tổ hợp có sẵn', () => {
  const e = loaded.ac[loaded.acIdx.brands.find((x) => x.name === 'Daikin').sets[0].id];
  const s = AC.normalize(e, { power: true, mode: 'khong-co', fan: 'x', swing: 'y', temp: 99 });
  assert(AC.modes(e).includes(s.mode) && AC.fans(e, s.mode).includes(s.fan));
  assert(AC.temps(e, s).includes(s.temp));
  assert(AC.spec(e, s));
});
t('engine: tắt máy gửi mã tắt', () => {
  const e = loaded.ac[loaded.acIdx.brands[0].sets[0].id];
  assert.strictEqual(AC.spec(e, Object.assign(AC.defaults(e), { power: false })).data, e.commands.off);
});
t('nhãn tiếng Việt cho chế độ/quạt/đảo gió', () => {
  assert.strictEqual(AC.modeLabel('cool'), 'Làm lạnh'); assert.strictEqual(AC.fanLabel('high'), 'Cao'); assert.strictEqual(AC.swingLabel('off'), 'Tắt');
  assert.strictEqual(AC.fanLabel('weird_mode'), 'Weird mode');
});

/* ---------- Các loại thiết bị khác (đầu thu, TV box, đầu đĩa, loa/amply, quạt, sưởi/lọc khí, đèn, máy chiếu, khác) ---------- */
run('keys.js');
const TYPES = { stb: 40, box: 25, disc: 100, audio: 200, fan: 100, air: 60, light: 100, proj: 80, other: 150 };
const MIN_POWER = { stb: 0.7, box: 0.3, disc: 0.8, audio: 0.8, fan: 0.6, air: 0.5, light: 0.6, proj: 0.7, other: 0.3 };
Object.keys(TYPES).forEach((type) => {
  run(type + '/index.js');
  const idx = loaded.devIdx[type];
  let sets = 0, codes = 0, withPower = 0;
  t('loại "' + type + '": chỉ mục có nguồn CC0, phím chính, phím thử', () => {
    assert.strictEqual(idx.type, type); assert.strictEqual(idx.source.license, 'CC0-1.0');
    assert(Array.isArray(idx.core) && idx.core.length >= 8 && Array.isArray(idx.test) && idx.test.length >= 3);
    assert(idx.brands.length >= 15, 'ít hãng: ' + idx.brands.length);
  });
  idx.brands.forEach((b) => {
    run(b.file);
    const list = loaded.dev[type][b.name];
    assert.strictEqual(list.length, b.n, type + '/' + b.name + ': số bộ mã không khớp chỉ mục');
    list.forEach((e) => {
      assert.strictEqual(e.type, type); assert(e.source && e.source.license === 'CC0-1.0' && e.source.url && e.source.files.length, 'thiếu nguồn: ' + e.model);
      assert(Object.keys(e.codes).length >= 2, 'quá ít phím: ' + e.model);
      Object.entries(e.codes).forEach(([k, c]) => {
        assert(/^[a-z0-9_]+$/.test(k), 'khóa lạ: ' + k);
        const enc = IR.encode(c.spec); codes++;
        assert(enc.pattern.length >= 2);
        assert(c.label || loaded.labels[k], 'khóa "' + k + '" không có nhãn (' + e.model + ')');
      });
      assert.strictEqual(e.core, idx.core.filter((k) => e.codes[k]).length, 'đếm core sai: ' + e.model);
      if (e.codes.power || e.codes.on) withPower++;
      sets++;
    });
  });
  t('loại "' + type + '": ' + sets + ' bộ, ' + codes + ' mã đều mã hóa được; nút nguồn có ở ' + withPower + '/' + sets, () => {
    assert(sets >= TYPES[type], 'ít bộ mã: ' + sets);
    assert(withPower / sets >= MIN_POWER[type], 'quá ít bộ có nút nguồn');
  });
});
t('nhãn tiếng Việt cho khóa phím chuẩn; không còn bí danh lẫn vào khóa', () => {
  ['power', 'on', 'off', 'vol_up', 'play_pause', 'speed', 'bright_up', 'keystone_up', 'eject', 'bluetooth', '7'].forEach((k) => assert(loaded.labels[k], 'thiếu nhãn ' + k));
  const bad = new Set(['vol_plus', 'vol_dn', 'ch_next', 'enter', 'return', 'on_off', 'power_on', 'power_off', 'fast_ba', 'fast_fo', 'bass_dn', 'num_1', 'osc', 'oscillate', 'rotate', 'brighter']);
  Object.values(loaded.dev).forEach((byBrand) => Object.values(byBrand).flat().forEach((e) => Object.keys(e.codes).forEach((k) => assert(!bad.has(k), k + ' ở ' + e.model))));
});
t('đầu thu / amply / đầu đĩa dùng được RC5, RC6, NEC42, Pioneer (giao thức mới có mặt trong dữ liệu)', () => {
  const protos = new Set();
  Object.values(loaded.dev).forEach((byBrand) => Object.values(byBrand).flat().forEach((e) => Object.values(e.codes).forEach((c) => protos.add(c.spec.protocol))));
  ['rc5', 'rc6', 'nec42', 'pioneer'].forEach((p) => assert(protos.has(p), 'không có ' + p));
});

console.log('\n' + n + ' nhóm kiểm tra đạt');
process.exit(0);
