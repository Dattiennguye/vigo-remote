'use strict';
const assert = require('assert');
const V = require('../web/js/voice.js');
const tv = (t) => V.parse(t, { activeType: 'tv', hasTv: true, hasAc: true });
const one = (t, ctx) => { const r = V.parse(t, ctx || { activeType: 'tv', hasTv: true, hasAc: true }); assert.strictEqual(r.unknown.length, 0, t + ' → không hiểu: ' + r.unknown); return r.actions; };
let n = 0; const ok = (m) => { n++; console.log('ok -', m); };

assert.deepStrictEqual(one('Tăng âm lượng 5 lần').map((a) => [a.key, a.count]), [['vol_up', 5]]);
assert.deepStrictEqual(one('giảm âm lượng').map((a) => [a.key, a.count]), [['vol_down', 1]]);
assert.deepStrictEqual(one('Tắt tiếng').map((a) => a.key), ['mute']);
assert.deepStrictEqual(one('tắt tivi').map((a) => a.key), ['power']);
assert.deepStrictEqual(one('bật tv').map((a) => a.key), ['power']);
assert.deepStrictEqual(one('Chuyển kênh 12').map((a) => a.digits), ['12']);
assert.deepStrictEqual(one('kênh số năm').map((a) => a.digits), ['5']);
assert.deepStrictEqual(one('kênh mười hai').map((a) => a.digits), ['12']);
assert.deepStrictEqual(one('kênh hai mươi lăm').map((a) => a.digits), ['25']);
assert.deepStrictEqual(one('kênh một hai').map((a) => a.digits), ['12']);
assert.deepStrictEqual(one('quay lại').map((a) => a.key), ['back']);
assert.deepStrictEqual(one('về trang chủ').map((a) => a.key), ['home']);
assert.deepStrictEqual(one('Quay lại rồi xuống 3 lần rồi OK').map((a) => [a.key, a.count]), [['back', 1], ['down', 3], ['ok', 1]]);
assert.deepStrictEqual(one('lên ba lần').map((a) => [a.key, a.count]), [['up', 3]]);
assert.deepStrictEqual(one('chọn HDMI').map((a) => a.key), ['src_hdmi']);
assert.deepStrictEqual(one('kênh tiếp theo').map((a) => a.key), ['ch_up']);
ok('lệnh TV: âm lượng, kênh (cả số bằng chữ), điều hướng, chuỗi lệnh "rồi"');

const ac = { activeType: 'ac', hasTv: false, hasAc: true };
assert.deepStrictEqual(one('bật điều hòa', ac).map((a) => [a.op, a.on]), [['power', true]]);
assert.deepStrictEqual(one('tắt máy lạnh', ac).map((a) => [a.op, a.on]), [['power', false]]);
assert.deepStrictEqual(one('nhiệt độ 24 độ', ac).map((a) => [a.op, a.value]), [['temp', 24]]);
assert.deepStrictEqual(one('chỉnh hai mươi sáu độ', ac).map((a) => [a.op, a.value]), [['temp', 26]]);
assert.deepStrictEqual(one('giảm 2 độ', ac).map((a) => [a.op, a.value]), [['step', -2]]);
assert.deepStrictEqual(one('tăng nhiệt độ', ac).map((a) => [a.op, a.value]), [['step', 1]]);
assert.deepStrictEqual(one('chế độ sưởi', ac).map((a) => [a.op, a.value]), [['mode', 'heat']]);
assert.deepStrictEqual(one('chế độ hút ẩm', ac).map((a) => [a.op, a.value]), [['mode', 'dry']]);
assert.deepStrictEqual(one('quạt mạnh', ac).map((a) => [a.op, a.value]), [['fan', 'high']]);
assert.deepStrictEqual(one('bật điều hòa rồi nhiệt độ 25 độ', ac).map((a) => a.op), ['power', 'temp']);
ok('lệnh điều hòa: nguồn, nhiệt độ tuyệt đối/tương đối, chế độ, quạt, chuỗi lệnh');

/* chọn đúng loại thiết bị theo từ khóa dù đang ở thiết bị khác */
assert.strictEqual(V.parse('tắt điều hòa', { activeType: 'tv', hasTv: true, hasAc: true }).actions[0].t, 'ac');
assert.strictEqual(V.parse('tăng âm lượng', { activeType: 'ac', hasTv: true, hasAc: true }).actions[0].t, 'tv');
/* không hiểu thì báo, không đoán */
const bad = V.parse('hôm nay trời đẹp quá', { activeType: 'tv', hasTv: true, hasAc: true });
assert.strictEqual(bad.actions.length, 0); assert.strictEqual(bad.unknown.length, 1);
assert.strictEqual(V.parse('', {}).actions.length, 0);
/* "nhỏ" / "tư" / "năm" không biến thành số lung tung */
assert.strictEqual(V.numberWords('nam nay'), 'nam nay');
ok('chọn đúng thiết bị theo từ khóa; câu không hiểu được báo lại, không đoán');
console.log('\n' + n + ' nhóm kiểm tra giọng nói đạt');
