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
