/* Chạy: node tests/ui-smoke.test.js  (cần: npm i jsdom ở thư mục bất kỳ, đặt NODE_PATH tới node_modules)
 * Kiểm tra giao diện trong jsdom với cả chế độ Demo và Native giả lập. KHÔNG phải kiểm tra phần cứng. */
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..', 'web');

function boot(nativeMock) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'file:///android_asset/web/index.html' });
  const w = dom.window;
  w.eval('window.__errs=[];window.addEventListener("error",e=>window.__errs.push(e.message))');
  if (nativeMock) w.VigoNative = nativeMock;
  ['data/ir-library.js', 'js/ir-protocols.js', 'js/ir-bridge.js', 'js/store.js', 'js/app.js'].forEach(f => w.eval(fs.readFileSync(path.join(root, f), 'utf8')));
  return w;
}
const q = (w, s) => w.document.querySelector(s);
const qa = (w, s) => Array.from(w.document.querySelectorAll(s));
const txt = w => w.document.body.textContent;
let n = 0; function t(name, fn) { fn(); n++; console.log('ok  -', name); }

/* ---- Demo mode ---- */
let w = boot(null);
t('trang chủ hiển thị chế độ Demo + chưa có thiết bị', () => {
  assert.ok(txt(w).includes('Chế độ Demo'));
  assert.ok(txt(w).includes('Chưa có thiết bị nào'));
});
t('thêm thiết bị TV qua Store và mở remote', () => {
  const dev = w.VigoStore.add({ name: 'TV <b>test</b>', type: 'tv', brand: 'Samsung' });
  w.location.hash = '#device/' + dev.id; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  assert.ok(txt(w).includes('TV <b>test</b>'), 'tên phải hiển thị như văn bản, không là HTML');
  assert.strictEqual(q(w, 'h1 b'), null);
  assert.strictEqual(qa(w, '.rb').length, 27);
});
t('bấm nút khi chưa có mã → báo lỗi rõ ràng, không báo thành công', () => {
  q(w, '.rb.pwr').click();
  assert.ok(q(w, '#toast').className.includes('err'));
  assert.ok(q(w, '#toast').textContent.includes('chưa có mã'));
});
t('import Flipper + gửi trong Demo → "Demo", không phải "ok"', () => {
  const dev = w.VigoStore.devices()[0];
  const r = w.VigoIR.parseFlipperIr('name: Power\ntype: parsed\nprotocol: NEC\naddress: 04 00 00 00\ncommand: 08 00 00 00');
  w.VigoStore.update(dev.id, { codes: { power: { spec: r.ok[0].spec } } });
  w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  q(w, '.rb.pwr').click();
  assert.ok(q(w, '#toast').className.includes('demo'));
  const h = w.VigoStore.history()[0]; assert.strictEqual(h.status, 'demo');
});
t('IR Setup render ở Demo, nút ✓ bị khóa', () => {
  w.location.hash = '#setup'; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  assert.ok(txt(w).includes('1. Kiểm tra phần cứng'));
  const ok = qa(w, 'button').filter(b => b.textContent === '✓');
  assert.ok(ok.length && ok.every(b => b.disabled));
  const save = qa(w, 'button').find(b => b.textContent.startsWith('Lưu cấu hình'));
  assert.ok(save.disabled);
});
t('tất cả tab nhập mã render được', () => {
  ['flipper', 'proto', 'pronto', 'raw', 'json'].forEach(tab => {
    const b = qa(w, '.seg button').find(x => x.textContent.length); // chuyển bằng click theo thứ tự
  });
  qa(w, '.seg button').forEach(b => { b.click(); });
  assert.strictEqual(w.__errs.length, 0, String(w.__errs));
});
t('điều hòa: render panel, bật khi chưa có mã báo lỗi', () => {
  const ac = w.VigoStore.add({ name: 'AC', type: 'ac' });
  w.location.hash = '#device/' + ac.id; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  assert.ok(txt(w).includes('Bật điều hòa'));
  qa(w, 'button').find(b => b.textContent.includes('Bật điều hòa')).click();
  assert.ok(q(w, '#toast').textContent.includes('chưa có mã'));
  assert.strictEqual(w.VigoStore.get(ac.id).state.power, false, 'không đổi trạng thái khi lỗi');
});
t('không có lỗi script nào ở chế độ Demo', () => assert.strictEqual(w.__errs.length, 0, String(w.__errs)));

/* ---- Native giả lập ---- */
const calls = [];
w = boot({
  hasIrEmitter: () => JSON.stringify({ ok: true, available: true }),
  getCarrierFrequencies: () => JSON.stringify({ ok: true, ranges: [[30000, 60000]] }),
  transmit: (f, p) => { calls.push([f, JSON.parse(p)]); return JSON.stringify({ ok: true }); },
  vibrate: () => {}
});
t('native: gửi NEC → transmit được gọi đúng tần số, status sent', () => {
  const r = w.IRBridge.send({ protocol: 'nec', address: 4, command: 8 });
  assert.strictEqual(r.status, 'sent'); assert.strictEqual(calls[0][0], 38000);
  assert.strictEqual(calls[0][1].length % 2, 0);
});
t('native: tần số ngoài dải bị chặn, không gọi transmit', () => {
  const before = calls.length;
  const r = w.IRBridge.send({ protocol: 'raw', freq: 20000, pattern: [500, 500] });
  assert.strictEqual(r.status, 'error'); assert.strictEqual(calls.length, before);
});
t('native: transmit báo lỗi → status error', () => {
  w.VigoNative.transmit = () => JSON.stringify({ ok: false, error: 'IllegalArgumentException: x' });
  const r = w.IRBridge.send({ protocol: 'nec', address: 1, command: 1 });
  assert.strictEqual(r.status, 'error'); assert.ok(r.message.includes('IllegalArgumentException'));
});
t('native: máy không có IR → lỗi rõ ràng', () => {
  const w2 = boot({ hasIrEmitter: () => JSON.stringify({ ok: true, available: false }), transmit: () => '{"ok":true}' });
  const r = w2.IRBridge.send({ protocol: 'nec', address: 1, command: 1 });
  assert.strictEqual(r.status, 'error'); assert.ok(r.message.includes('không có mắt phát'));
});
t('native: AC bật thành công mới đổi trạng thái', () => {
  w.VigoNative.transmit = () => JSON.stringify({ ok: true });
  const ac = w.VigoStore.add({ name: 'AC', type: 'ac', codes: { power_on: { spec: { protocol: 'nec', address: 1, command: 2 } }, power_off: { spec: { protocol: 'nec', address: 1, command: 3 } } } });
  w.location.hash = '#device/' + ac.id; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  qa(w, 'button').find(b => b.textContent.includes('Bật điều hòa')).click();
  assert.strictEqual(w.VigoStore.get(ac.id).state.power, true);
});
t('không có lỗi script nào ở chế độ Native', () => assert.strictEqual(w.__errs.length, 0, String(w.__errs)));
console.log('\n' + n + ' nhóm kiểm tra giao diện đạt.');
process.exit(0);
