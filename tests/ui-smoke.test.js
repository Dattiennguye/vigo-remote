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
  assert.strictEqual(qa(w, '.rb').length, 28);
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

/* ---- Thư viện + dò tự động (Native giả lập) ---- */
{
  const sent = [];
  const w3 = boot({
    hasIrEmitter: () => JSON.stringify({ ok: true, available: true }),
    getCarrierFrequencies: () => JSON.stringify({ ok: true, ranges: [[30000, 60000]] }),
    transmit: (f, p) => { sent.push([f, JSON.parse(p)]); return JSON.stringify({ ok: true }); }, vibrate: () => {}
  });
  const LIB = w3.VIGO_LIBRARY;
  t('form thêm TV: chọn hãng Samsung → có danh sách bộ mã, mặc định chọn sẵn bộ đầu', () => {
    qa(w3, '.btn.primary').find(b => b.textContent.includes('Thêm thiết bị')).click();
    const sels = qa(w3, '#sheet select');
    const brand = sels[1]; brand.value = 'Samsung'; brand.dispatchEvent(new w3.Event('change'));
    const lib = qa(w3, '#sheet select')[2];
    assert.ok(lib.options.length > 10, 'phải có nhiều bộ mã Samsung');
    assert.notStrictEqual(lib.value, '', 'phải chọn sẵn một bộ mã thật');
    qa(w3, '#sheet input')[0].value = 'TV Samsung';
    qa(w3, '#sheet button.primary').click ? null : null;
    qa(w3, '#sheet button').find(b => b.textContent === 'Lưu').click();
    const d = w3.VigoStore.devices()[0];
    assert.strictEqual(d.brand, 'Samsung'); assert.ok(Object.keys(d.codes).length >= 4);
    assert.ok(w3.location.hash.startsWith('#device/'), 'chuyển thẳng tới remote');
  });
  t('remote TV từ thư viện: bấm Nguồn → transmit đúng mã của thư viện', () => {
    const d = w3.VigoStore.devices()[0];
    w3.dispatchEvent(new w3.HashChangeEvent('hashchange'));
    const want = w3.VigoIR.encode(d.codes.power.spec);
    qa(w3, '.rb.pwr')[0].click();
    const last = sent[sent.length - 1];
    assert.strictEqual(last[0], want.freq);
    assert.strictEqual(last[1].slice(0, want.pattern.length).join(','), want.pattern.join(','));
    assert.ok(q(w3, '#toast').className.includes('ok'));
  });
  t('IR Setup: dò tự động gửi lần lượt Nguồn từng bộ, bấm "đã phản ứng" thì nạp bộ mã và xác nhận Nguồn', () => {
    const d = w3.VigoStore.devices()[0];
    w3.VigoStore.update(d.id, { codes: {} });
    w3.location.hash = '#setup'; w3.dispatchEvent(new w3.HashChangeEvent('hashchange'));
    assert.ok(txt(w3).includes('3. Chọn hãng và dòng TV'));
    const bsel = q(w3, 'select[aria-label="Hãng"]'); bsel.value = 'LG'; bsel.dispatchEvent(new w3.Event('change'));
    const before = sent.length;
    qa(w3, 'button').find(b => b.textContent.startsWith('Bắt đầu dò')).click();
    assert.strictEqual(sent.length, before + 1, 'gửi đúng 1 lệnh cho bộ đầu tiên');
    const first = sent[sent.length - 1];
    qa(w3, 'button').find(b => b.textContent === 'Bộ tiếp ▶').click();
    assert.strictEqual(sent.length, before + 2);
    assert.notStrictEqual(sent[sent.length - 1][1].join(), first[1].join(), 'bộ tiếp theo phải khác mã Nguồn');
    qa(w3, 'button').find(b => b.textContent === '◀ Bộ trước').click();
    assert.strictEqual(sent[sent.length - 1][1].join(), first[1].join(), 'bộ trước gửi lại đúng mã đầu');
    qa(w3, 'button').find(b => b.textContent === 'TV đã phản ứng ✓').click();
    assert.ok(txt(w3).includes('Tìm thấy!'));
    const save = qa(w3, 'button').find(b => b.textContent.startsWith('Lưu cấu hình'));
    assert.ok(!save.disabled, 'Nguồn đã xác nhận → cho phép lưu');
    save.click();
    const d2 = w3.VigoStore.get(d.id);
    assert.ok(Object.keys(d2.codes).length >= 4); assert.strictEqual(d2.codes.power.verified, true);
    assert.ok(/Flipper-IRDB/.test(d2.source));
  });
  t('dò tự động: hết bộ mà không phản ứng → báo rõ, không nạp gì', () => {
    const d = w3.VigoStore.devices()[0];
    w3.VigoStore.update(d.id, { codes: {} });
    w3.location.hash = '#home'; w3.dispatchEvent(new w3.HashChangeEvent('hashchange'));
    w3.location.hash = '#setup'; w3.dispatchEvent(new w3.HashChangeEvent('hashchange'));
    const bsel = q(w3, 'select[aria-label="Hãng"]'); bsel.value = 'Akai'; bsel.dispatchEvent(new w3.Event('change'));
    qa(w3, 'button').find(b => b.textContent.startsWith('Bắt đầu dò')).click();
    for (let i = 0; i < 10 && qa(w3, 'button').some(b => b.textContent === 'Bộ tiếp ▶'); i++) qa(w3, 'button').find(b => b.textContent === 'Bộ tiếp ▶').click();
    assert.ok(txt(w3).includes('Đã thử hết'));
    assert.strictEqual(Object.keys(w3.VigoStore.get(d.id).codes).length, 0);
  });
  t('hãng không có mã Nguồn (Xiaomi): báo rõ, nút dò bị khóa', () => {
    w3.location.hash = '#home'; w3.dispatchEvent(new w3.HashChangeEvent('hashchange'));
    w3.location.hash = '#setup'; w3.dispatchEvent(new w3.HashChangeEvent('hashchange'));
    const bsel = q(w3, 'select[aria-label="Hãng"]'); bsel.value = 'Xiaomi'; bsel.dispatchEvent(new w3.Event('change'));
    const b = qa(w3, 'button').find(x => x.textContent.startsWith('Bắt đầu dò'));
    assert.ok(b.disabled); assert.ok(txt(w3).includes('chưa có mã Nguồn'));
  });
  t('Demo: dò tự động bị khóa', () => {
    const w4 = boot(null);
    w4.VigoStore.add({ name: 'TV', type: 'tv', brand: 'Sony' });
    w4.location.hash = '#setup'; w4.dispatchEvent(new w4.HashChangeEvent('hashchange'));
    const b = qa(w4, 'button').find(x => x.textContent.startsWith('Bắt đầu dò'));
    assert.ok(b && b.disabled);
  });
  t('không có lỗi script khi dùng thư viện', () => { assert.strictEqual(w3.__errs.length, 0, String(w3.__errs)); });
}
console.log('\n' + n + ' nhóm kiểm tra giao diện đạt.');
process.exit(0);
