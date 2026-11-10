/* Chạy: node tests/protocols.test.js
 * Kiểm tra bộ mã hóa với khung xung tính tay theo đặc tả giao thức (KHÔNG phải kiểm tra phần cứng). */
const assert = require('assert');
const IR = require('../web/js/ir-protocols.js');

let n = 0;
function t(name, fn) { fn(); n++; console.log('ok  -', name); }

t('NEC addr=0x00 cmd=0x00', () => {
  const e = IR.encode({ protocol: 'nec', address: 0, command: 0 });
  const exp = [9000, 4500];
  for (let i = 0; i < 8; i++) exp.push(560, 560);   // addr = 0
  for (let i = 0; i < 8; i++) exp.push(560, 1690);  // ~addr = 0xFF
  for (let i = 0; i < 8; i++) exp.push(560, 560);   // cmd = 0
  for (let i = 0; i < 8; i++) exp.push(560, 1690);  // ~cmd = 0xFF
  exp.push(560);
  assert.deepStrictEqual(e.pattern, exp);
  assert.strictEqual(e.freq, 38000);
  assert.strictEqual(e.pattern.length, 67);
});

t('NEC LSB-first (addr=0x01)', () => {
  const p = IR.encode({ protocol: 'nec', address: '0x01', command: 0 }).pattern;
  assert.strictEqual(p[3], 1690); // bit0 = 1 đi trước
  assert.strictEqual(p[5], 560);  // bit1 = 0
});

t('Samsung32 header + lặp địa chỉ + lệnh đảo', () => {
  const p = IR.encode({ protocol: 'samsung32', address: 0xFF, command: 0x00 }).pattern;
  assert.deepStrictEqual(p.slice(0, 2), [4500, 4500]);
  for (let i = 0; i < 16; i++) assert.strictEqual(p[3 + 2 * i], 1690); // 16 bit địa chỉ = 1
  for (let i = 16; i < 24; i++) assert.strictEqual(p[3 + 2 * i], 560);  // cmd = 0
  for (let i = 24; i < 32; i++) assert.strictEqual(p[3 + 2 * i], 1690); // ~cmd = 1
  assert.strictEqual(p.length, 67);
});

t('Sony SIRC12: 3 lần, 40kHz, chu kỳ 45ms', () => {
  const e = IR.encode({ protocol: 'sirc12', address: 1, command: 0x15 });
  assert.strictEqual(e.freq, 40000);
  assert.strictEqual(e.pattern.length, 3 * (2 + 24));
  const one = e.pattern.slice(0, 26);
  assert.deepStrictEqual(one.slice(0, 2), [2400, 600]);
  const period = e.pattern.slice(0, 26).reduce((a, b) => a + b, 0);
  assert.strictEqual(period, 45000);
  // cmd 0x15 = 0b0010101, LSB trước: 1,0,1,0,1,0,0
  const marks = [];
  for (let i = 0; i < 7; i++) marks.push(one[2 + 2 * i]);
  assert.deepStrictEqual(marks, [1200, 600, 1200, 600, 1200, 600, 600]);
});

t('từ chối giá trị ngoài dải', () => {
  assert.throws(() => IR.encode({ protocol: 'nec', address: 0x100, command: 0 }));
  assert.throws(() => IR.encode({ protocol: 'sirc12', address: 32, command: 0 }));
  assert.throws(() => IR.encode({ protocol: 'sirc12', address: 0, command: 0x80 }));
  assert.throws(() => IR.encode({ protocol: 'nec', address: 'zz', command: 0 }));
  assert.throws(() => IR.encode({ protocol: 'khong-co' }));
  assert.throws(() => IR.encode({ protocol: 'raw', freq: 5, pattern: [100, 100] }));
  assert.throws(() => IR.encode({ protocol: 'raw', freq: 38000, pattern: [100, -5] }));
});

t('Pronto 0000', () => {
  const s = IR.parseProntoHex('0000 006D 0002 0000 0010 0010 0020 0010');
  assert.strictEqual(s.protocol, 'raw');
  assert.ok(Math.abs(s.freq - 38029) < 5);
  assert.strictEqual(s.pattern.length, 4);
  assert.throws(() => IR.parseProntoHex('0100 006D 0002 0000 0010 0010 0020 0010'));
  assert.throws(() => IR.parseProntoHex('0000 006D 0002'));
});

t('Raw pattern parser', () => {
  assert.deepStrictEqual(IR.parseRawPattern('+9000 -4500, 560 560'), [9000, 4500, 560, 560]);
  assert.throws(() => IR.parseRawPattern('9000 abc'));
});

t('Flipper .ir parsed + raw + bỏ qua giao thức lạ', () => {
  const txt = [
    'Filetype: IR signals file', 'Version: 1', '#',
    'name: Power', 'type: parsed', 'protocol: Samsung32', 'address: 07 00 00 00', 'command: 02 00 00 00', '#',
    'name: Vol_up', 'type: parsed', 'protocol: NEC', 'address: 04 00 00 00', 'command: 02 00 00 00', '#',
    'name: Khac', 'type: parsed', 'protocol: RC6', 'address: 00 00 00 00', 'command: 01 00 00 00', '#',
    'name: Raw1', 'type: raw', 'frequency: 38000', 'duty_cycle: 0.330000', 'data: 9000 4500 560 560 560 1690'
  ].join('\n');
  const r = IR.parseFlipperIr(txt);
  assert.strictEqual(r.ok.length, 3);
  assert.strictEqual(r.skipped.length, 1);
  assert.strictEqual(r.ok[0].spec.address, 7);
  assert.strictEqual(r.ok[0].spec.command, 2);
  assert.strictEqual(r.ok[2].spec.protocol, 'raw');
});

console.log('\n' + n + ' nhóm kiểm tra đạt.');

// Hồi quy: các lớp có display riêng (vd .sheet{display:flex}) không được che thuộc tính hidden.
const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'web', 'css', 'app.css'), 'utf8');
assert.ok(/\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(css), 'thiếu [hidden]{display:none!important}');
console.log('ok  - CSS giữ thuộc tính hidden (không còn lớp phủ chặn thao tác)');

/* ---- Kaseikyo: giải mã ngược theo công thức của bộ giải mã Flipper rồi so khớp trường ---- */
function decodeKaseikyo(p) {
  assert.deepStrictEqual(p.slice(0, 2), [3456, 1728]);
  const bits = [];
  for (let i = 0; i < 48; i++) {
    assert.strictEqual(p[2 + 2 * i], 432);
    const sp = p[3 + 2 * i]; assert.ok(sp === 432 || sp === 1296); bits.push(sp === 1296 ? 1 : 0);
  }
  assert.strictEqual(p.length, 2 + 96 + 1); assert.strictEqual(p[p.length - 1], 432);
  const d = []; for (let b = 0; b < 6; b++) { let v = 0; for (let i = 0; i < 8; i++) v |= bits[b * 8 + i] << i; d.push(v); }
  const vendor = (d[1] << 8) | d[0], vp = d[2] & 0xF, g1 = d[2] >> 4, g2 = d[3] & 0xF;
  const cmd = (d[3] >> 4) | ((d[4] & 0x3F) << 4), id = d[4] >> 6, par = d[5];
  let vpc = d[0] ^ d[1]; vpc = (vpc & 0xF) ^ (vpc >> 4);
  assert.strictEqual(vp, vpc, 'parity vendor sai'); assert.strictEqual(par, d[2] ^ d[3] ^ d[4], 'parity khung sai');
  return { address: ((id << 24) | (vendor << 8) | (g1 << 4) | g2) >>> 0, command: cmd };
}
[[0x00200280, 0x3D0], [0x01000000 | (0x2002 << 8) | 0x20, 0x001], [0x03ABCDE5, 0x3FF], [0, 0]].forEach(([a, c]) => {
  const r = decodeKaseikyo(IR.encode({ protocol: 'kaseikyo', address: a, command: c }).pattern);
  assert.strictEqual(r.address, a); assert.strictEqual(r.command, c);
});
assert.strictEqual(IR.encode({ protocol: 'kaseikyo', address: 1, command: 1 }).freq, 38000);
assert.throws(() => IR.encode({ protocol: 'kaseikyo', address: 0x4000000, command: 0 }));
assert.throws(() => IR.encode({ protocol: 'kaseikyo', address: 0, command: 0x400 }));
{
  const r = IR.parseFlipperIr('name: Power\ntype: parsed\nprotocol: Kaseikyo\naddress: 80 02 20 00\ncommand: D0 03 00 00');
  assert.strictEqual(r.ok.length, 1); assert.strictEqual(r.ok[0].spec.protocol, 'kaseikyo');
  assert.strictEqual(r.ok[0].spec.address, 0x00200280); assert.strictEqual(r.ok[0].spec.command, 0x3D0);
}
console.log('ok  - Kaseikyo: mã hóa khớp ngược với bộ giải mã Flipper (parity, trường, thời gian)');

/* ---- Broadlink (điều hòa): khung 0x26, tick = 269/8192 ms, 0x00 + 2 byte BE cho khoảng dài ---- */
{
  const frame = (data) => Buffer.from([0x26, 0x00, data.length & 0xFF, data.length >> 8, ...data, 0, 0, 0]).toString('base64');
  const r = IR.encode({ protocol: 'broadlink', data: frame([0x10, 0x10, 0x20, 0x00, 0x0d, 0x05, 0x10, 0x00, 0x0d, 0x05]) });
  const tick = 269 / 8192 * 1000;
  assert.strictEqual(r.freq, 38000);
  assert.deepStrictEqual(r.pattern, [16, 16, 32, 0x0d05, 16, 0x0d05].map((v) => Math.round(v * tick)));
  assert.ok(Math.abs(r.pattern[0] - 526) <= 1, '16 tick ≈ 526 µs');
  /* khung hỏng bị từ chối, không đoán */
  assert.throws(() => IR.encode({ protocol: 'broadlink', data: Buffer.from([0x25, 0, 6, 0, 1, 1, 1, 1, 0x0d, 0x05]).toString('base64') }), /Broadlink/);
  assert.throws(() => IR.encode({ protocol: 'broadlink', data: frame([0x10, 0x10, 0x10, 0x10, 0x10, 0x10]) }), /kết thúc/);
  assert.throws(() => IR.encode({ protocol: 'broadlink', data: Buffer.from([0x26, 0, 0xFF, 0x7F, 1, 2, 3, 4, 5, 6]).toString('base64') }), /cụt/);
  assert.throws(() => IR.encode({ protocol: 'broadlink', data: '***' }), /Base64/);
  /* mã thật từ SmartIR (Panasonic 1020, lệnh tắt): đầu khung ≈3,8 ms / 1,8 ms đúng kiểu điều hòa Panasonic */
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'web', 'data', 'ac', '1020.js'), 'utf8');
  const off = JSON.parse(src.slice(src.indexOf(',{') + 1, src.lastIndexOf(');'))).commands.off;
  const real = IR.encode({ protocol: 'broadlink', data: off });
  assert.ok(real.pattern[0] > 3500 && real.pattern[0] < 4000 && real.pattern[1] > 1700 && real.pattern[1] < 1900, JSON.stringify(real.pattern.slice(0, 2)));
  assert.strictEqual(real.pattern.length, 440);
}
console.log('ok  - Broadlink: giải mã đúng tick, khoảng dài, từ chối khung hỏng');
process.exit(0);
