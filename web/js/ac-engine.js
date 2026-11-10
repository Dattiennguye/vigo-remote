/* VIGO — máy trạng thái điều hòa.
 * Remote điều hòa thật gửi TOÀN BỘ trạng thái (chế độ, nhiệt độ, quạt, đảo gió) trong mỗi lệnh.
 * Bộ mã lưu sẵn một mã cho từng tổ hợp: commands[mode][fan]([swing])[temp] và commands.off.
 * Engine chỉ chọn mã có sẵn trong bộ mã — không tự tạo mã mới. */
(function (root) {
  'use strict';

  var MODE_LABEL = { cool: 'Làm lạnh', cold: 'Làm lạnh', heat: 'Sưởi', dry: 'Hút ẩm', humidity: 'Độ ẩm', fan_only: 'Quạt', fan: 'Quạt', heat_cool: 'Tự động', auto: 'Tự động',
    ifeel: 'iFeel', feel: 'iFeel', feal: 'iFeel', ion: 'Ion', ai: 'AI', eco_cool: 'Lạnh tiết kiệm', cool_econo: 'Lạnh tiết kiệm', sweep: 'Quét gió' };
  var FAN_LABEL = { auto: 'Tự động', low: 'Thấp', lo: 'Thấp', min: 'Thấp', lowest: 'Thấp nhất', ultralow: 'Rất thấp', mid: 'Vừa', middle: 'Vừa', medium: 'Vừa', med: 'Vừa', normal: 'Vừa',
    mediumhigh: 'Vừa-cao', lowmedium: 'Thấp-vừa', mediumlow: 'Thấp-vừa', high: 'Cao', hight: 'Cao', highest: 'Cao nhất', max: 'Cao nhất', maximum: 'Cao nhất', superhigh: 'Cao nhất', 'super high': 'Cao nhất',
    quiet: 'Êm', mute: 'Êm', silent: 'Êm', silence: 'Êm', turbo: 'Turbo', powerful: 'Turbo', hi_power: 'Turbo', night: 'Ban đêm', sleep: 'Ban đêm', breeze: 'Gió nhẹ',
    comfort: 'Thoải mái', eco: 'Tiết kiệm', econo: 'Tiết kiệm', nature: 'Tự nhiên', soft: 'Dịu', focus: 'Tập trung', diffuse: 'Lan tỏa', off: 'Tắt', top: 'Trên', bottom: 'Dưới',
    'auto + swing': 'Tự động + đảo', 'auto + no swing': 'Tự động, không đảo', hda: 'HDA' };
  var SWING_LABEL = { off: 'Tắt', on: 'Bật', stop: 'Cố định', static: 'Cố định', fixed: 'Cố định', stop_swing: 'Cố định', stop_swing_eko: 'Cố định', 'swing off': 'Tắt', auto: 'Tự động',
    swing: 'Đảo', swing_eko: 'Đảo', top: 'Trên', up: 'Trên', bottom: 'Dưới', down: 'Dưới', high: 'Cao', highest: 'Cao nhất', mid: 'Giữa', middle: 'Giữa', center: 'Giữa', medium: 'Giữa',
    'medium high': 'Vừa-cao', 'medium low': 'Vừa-thấp', low: 'Thấp', lowest: 'Thấp nhất', vertical: 'Dọc', horizontal: 'Ngang', both: 'Cả hai', hswing: 'Đảo ngang', vswing: 'Đảo dọc',
    'horizontal swing': 'Đảo ngang', 'vertical swing': 'Đảo dọc', '3dauto': '3D tự động', full: 'Toàn phần', half_up: 'Nửa trên', half_down: 'Nửa dưới', updown: 'Lên xuống',
    updown_off: 'Lên xuống (cố định)', up_off: 'Trên (cố định)', mid_off: 'Giữa (cố định)', down_off: 'Dưới (cố định)', auto_nanoex: 'Tự động (nanoe X)', fixed_nanoex: 'Cố định (nanoe X)' };
  var OFF_LIKE = ['off', 'stop', 'static', 'fixed', 'stop_swing', 'swing off'];

  function cap(s) { s = String(s).replace(/_/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); }
  function label(map, k) {
    var raw = String(k), low = raw.toLowerCase().trim();
    if (map[low]) return map[low];
    var m = /^(?:level|l)\s*(\d+)$/.exec(low);
    if (m) return 'Mức ' + m[1];
    if (map === FAN_LABEL && /^\d+$/.test(low)) return +low > 7 ? low + '%' : 'Mức ' + low;
    m = /^position\s*(\d+)$/.exec(low);
    if (m) return 'Vị trí ' + m[1];
    return raw.trim() ? cap(raw.trim()) : '—';
  }
  function nums(keys) { return keys.map(Number).filter(function (n) { return isFinite(n); }).sort(function (a, b) { return a - b; }); }
  function tkey(n) { return String(n); }

  function node(set, st) {
    var n = set.commands[st.mode];
    if (!n) return null;
    n = n[st.fan];
    if (!n) return null;
    if (set.swings && set.swings.length) { n = n[st.swing]; if (!n) return null; }
    return n;
  }

  var AC = {
    modeLabel: function (k) { return label(MODE_LABEL, k); },
    fanLabel: function (k) { return label(FAN_LABEL, k); },
    swingLabel: function (k) { return label(SWING_LABEL, k); },

    modes: function (set) { return set.modes.filter(function (m) { return set.commands[m]; }); },
    fans: function (set, mode) { return set.commands[mode] ? Object.keys(set.commands[mode]) : []; },
    swings: function (set, mode, fan) {
      if (!set.swings || !set.swings.length) return [];
      var f = set.commands[mode] && set.commands[mode][fan];
      return f ? Object.keys(f) : [];
    },
    temps: function (set, st) {
      var n = node(set, st);
      return n ? nums(Object.keys(n)) : [];
    },

    /* Đưa trạng thái về tổ hợp CÓ trong bộ mã (chế độ → quạt → đảo gió → nhiệt độ gần nhất). */
    normalize: function (set, st) {
      var s = { power: !!st.power, mode: st.mode, fan: st.fan, swing: st.swing, temp: Number(st.temp) };
      var modes = AC.modes(set);
      if (modes.indexOf(s.mode) < 0) s.mode = modes.indexOf('cool') >= 0 ? 'cool' : modes[0];
      var fans = AC.fans(set, s.mode);
      if (fans.indexOf(s.fan) < 0) s.fan = fans.indexOf('auto') >= 0 ? 'auto' : fans[0];
      var sw = AC.swings(set, s.mode, s.fan);
      if (sw.length) {
        if (sw.indexOf(s.swing) < 0) {
          s.swing = sw.filter(function (x) { return OFF_LIKE.indexOf(String(x).toLowerCase()) >= 0; })[0] || (sw.indexOf('auto') >= 0 ? 'auto' : sw[0]);
        }
      } else s.swing = null;
      var ts = AC.temps(set, s);
      if (ts.length) {
        if (!isFinite(s.temp)) s.temp = 25;
        s.temp = ts.reduce(function (best, t) { return Math.abs(t - s.temp) < Math.abs(best - s.temp) ? t : best; }, ts[0]);
      }
      return s;
    },

    defaults: function (set) { return AC.normalize(set, { power: false, mode: 'cool', fan: 'auto', swing: 'off', temp: 25 }); },

    /* Mã Base64 (Broadlink) cho trạng thái; null nếu bộ mã không có. */
    codeFor: function (set, st) {
      if (!st.power) return set.commands.off || null;
      var n = node(set, st);
      if (!n) return null;
      return n[tkey(st.temp)] || null;
    },
    spec: function (set, st) {
      var c = AC.codeFor(set, st);
      return c ? { protocol: 'broadlink', data: c } : null;
    },

    /* Nhiệt độ kế tiếp/trước đó CÓ mã (dir = +1 | -1). Trả về nhiệt độ hiện tại nếu đã ở biên. */
    stepTemp: function (set, st, dir) {
      var ts = AC.temps(set, st);
      var i = ts.indexOf(Number(st.temp));
      if (i < 0) return st.temp;
      var j = Math.max(0, Math.min(ts.length - 1, i + dir));
      return ts[j];
    },
    cycle: function (list, cur, dir) {
      var i = list.indexOf(cur);
      return list[(i + (dir || 1) + list.length) % list.length];
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = AC;
  else root.VigoAC = AC;
})(typeof window !== 'undefined' ? window : globalThis);
