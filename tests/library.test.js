/* Chạy: node tests/library.test.js — kiểm tra thư viện mã dựng sẵn (không phải kiểm tra phần cứng). */
const assert = require('assert'), fs = require('fs'), path = require('path');
global.window = global; // ir-library.js gán window.VIGO_LIBRARY
const IR = require('../web/js/ir-protocols.js');
eval(fs.readFileSync(path.join(__dirname, '..', 'web', 'data', 'ir-library.js'), 'utf8'));
const LIB = global.VIGO_LIBRARY;

assert.ok(LIB.entries.length > 100, 'thư viện quá nhỏ');
assert.strictEqual(LIB.source.license, 'CC0-1.0');
let codes = 0; const perBrand = {};
LIB.entries.forEach((e, i) => {
  assert.ok(e.brand && e.model && e.type === 'tv', 'mục #' + i + ' thiếu trường');
  assert.ok(e.source && e.source.name && e.source.url && e.source.license, 'mục #' + i + ' thiếu nguồn');
  assert.ok(Object.keys(e.codes).length >= 4, 'mục #' + i + ' ít mã');
  Object.keys(e.codes).forEach(k => {
    assert.ok(/^[a-z0-9_]+$/.test(k), 'khóa lạ: ' + k);
    const enc = IR.encode(e.codes[k].spec); // ném lỗi nếu mã không hợp lệ
    assert.ok(enc.pattern.length >= 2); codes++;
  });
  perBrand[e.brand] = (perBrand[e.brand] || 0) + 1;
});
['Samsung', 'LG', 'Sony', 'TCL', 'Hisense', 'Xiaomi', 'Panasonic', 'Sharp', 'Toshiba'].forEach(b => assert.ok(perBrand[b] > 0, 'thiếu hãng ' + b));
const withPower = LIB.entries.filter(e => e.codes.power).length;
console.log('ok  - ' + LIB.entries.length + ' bộ mã, ' + codes + ' mã đều mã hóa được; ' + withPower + ' bộ có nút Nguồn');
console.log('     ', JSON.stringify(perBrand));
