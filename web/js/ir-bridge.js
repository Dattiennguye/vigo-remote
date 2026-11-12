/* VIGO — IR Bridge.
 * Giao tiếp với lớp Android Native qua window.VigoNative (JavaScript Interface của WebView).
 * Nếu không có VigoNative => chế độ DEMO: KHÔNG phát IR và KHÔNG bao giờ báo "đã gửi".
 * Lưu ý: ConsumerIrManager.transmit() không trả về xác nhận thiết bị đích đã nhận;
 * "sent" chỉ có nghĩa là hệ điều hành đã nhận lệnh phát mà không báo lỗi. */
(function () {
  'use strict';

  var caps = null, toggle = 0;

  function native() {
    return typeof window.VigoNative !== 'undefined' && window.VigoNative !== null &&
      typeof window.VigoNative.transmit === 'function';
  }

  function call(fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    try {
      var raw = window.VigoNative[fn].apply(window.VigoNative, args);
      return JSON.parse(raw);
    } catch (e) {
      return { ok: false, error: 'Lỗi cầu nối Native (' + fn + '): ' + e.message };
    }
  }

  function inRanges(freq, ranges) {
    return ranges.some(function (r) { return freq >= r[0] && freq <= r[1]; });
  }

  var IRBridge = {
    mode: function () { return native() ? 'native' : 'demo'; },

    /* Kiểm tra mắt phát + dải tần. Trả về { mode, hasEmitter, ranges, error } */
    check: function () {
      if (!native()) {
        caps = { mode: 'demo', hasEmitter: null, ranges: [], error: null };
        return caps;
      }
      var e = call('hasIrEmitter');
      if (!e.ok) { caps = { mode: 'native', hasEmitter: false, ranges: [], error: e.error }; return caps; }
      if (!e.available) { caps = { mode: 'native', hasEmitter: false, ranges: [], error: null }; return caps; }
      var f = call('getCarrierFrequencies');
      caps = {
        mode: 'native', hasEmitter: true,
        ranges: f.ok && Array.isArray(f.ranges) ? f.ranges : [],
        error: f.ok ? null : f.error
      };
      return caps;
    },

    capabilities: function () { return caps || IRBridge.check(); },

    /* Gửi mã IR. Trả về { ok, status: 'sent'|'demo'|'error', message } */
    send: function (spec) {
      var enc;
      /* RC5/RC6 có bit toggle: đổi sau mỗi lần bấm để thiết bị nhận ra đó là lần bấm mới, không phải giữ phím. */
      if (spec && (spec.protocol === 'rc5' || spec.protocol === 'rc5x' || spec.protocol === 'rc6')) { toggle ^= 1; spec = Object.assign({}, spec, { toggle: toggle }); }
      try { enc = window.VigoIR.encode(spec); }
      catch (e) { return { ok: false, status: 'error', message: 'Mã IR không hợp lệ: ' + e.message }; }
      return IRBridge.sendRaw(enc.freq, enc.pattern);
    },

    sendRaw: function (freq, pattern) {
      try { window.VigoIR.validatePattern(freq, pattern); }
      catch (e) { return { ok: false, status: 'error', message: 'Mẫu xung không hợp lệ: ' + e.message }; }

      if (!native()) {
        return { ok: false, status: 'demo', message: 'Chế độ Demo: tín hiệu KHÔNG được phát vì ứng dụng chưa có Android Native Bridge.' };
      }
      var c = IRBridge.capabilities();
      if (!c.hasEmitter) {
        return { ok: false, status: 'error', message: c.error || 'Thiết bị này không có mắt phát hồng ngoại (IR blaster).' };
      }
      if (c.ranges.length && !inRanges(freq, c.ranges)) {
        return { ok: false, status: 'error', message: 'Tần số ' + freq + ' Hz nằm ngoài dải mắt phát IR hỗ trợ.' };
      }
      var out = pattern.slice();
      if (out.length % 2 === 1) out.push(20000); /* kết thúc bằng khoảng nghỉ để HAL không bị treo ở mức bật */
      var r = call('transmit', freq, JSON.stringify(out));
      if (r.ok) return { ok: true, status: 'sent', message: 'Đã gửi lệnh tới mắt phát IR.' };
      return { ok: false, status: 'error', message: r.error || 'Gửi tín hiệu thất bại.' };
    },

    /* Kiểm tra khả năng phát: xung ngắn không thuộc giao thức nào (không điều khiển thiết bị nào). */
    selfTest: function () {
      return IRBridge.sendRaw(38000, [600, 600, 600, 600, 600, 600, 600, 20000]);
    },

    /* Rung phản hồi. kind: tick | click | heavy | error. Native dùng VibrationEffect; ngoài app dùng navigator.vibrate. */
    haptic: function (kind, mode) {
      try {
        if (native() && typeof window.VigoNative.haptic === 'function') window.VigoNative.haptic(kind, mode || 'system');
        else if (navigator.vibrate) navigator.vibrate(kind === 'error' ? [25, 40, 25] : kind === 'heavy' ? 28 : kind === 'tick' ? 8 : 16);
      } catch (e) { /* rung chỉ là phụ trợ */ }
    },

    /* Chẩn đoán rung: trả về {status, message}. */
    hapticTest: function () {
      if (!native() || typeof window.VigoNative.hapticTest !== 'function') {
        var ok = !!navigator.vibrate; if (ok) navigator.vibrate(40);
        return { status: 'demo', message: ok ? 'Chế độ Demo: dùng rung của trình duyệt.' : 'Chế độ Demo: trình duyệt này không hỗ trợ rung.' };
      }
      try {
        var r = JSON.parse(window.VigoNative.hapticTest());
        if (!r.ok) return { status: 'error', message: r.error || 'Không rung thử được' };
        return { status: 'sent', message: 'Đã rung thử (rung hệ thống, Android ' + r.sdk + '). Không thấy rung? Kiểm tra Cài đặt máy → Âm thanh & rung → bật “Rung khi chạm”.' };
      } catch (e) { return { status: 'error', message: 'Lỗi rung thử: ' + e.message }; }
    },

    /* Dùng phím âm lượng vật lý để điều khiển TV (chỉ có tác dụng trong app Android). */
    setVolumeKeys: function (on) {
      try { if (native() && typeof window.VigoNative.setVolumeKeys === 'function') call('setVolumeKeys', !!on); } catch (e) { /* bỏ qua */ }
    },
    keepScreenOn: function (on) {
      try { if (native() && typeof window.VigoNative.keepScreenOn === 'function') call('keepScreenOn', !!on); } catch (e) { /* bỏ qua */ }
    },

    vibrate: function (ms) {
      try {
        if (native() && typeof window.VigoNative.vibrate === 'function') window.VigoNative.vibrate(ms);
        else if (navigator.vibrate) navigator.vibrate(ms);
      } catch (e) { /* bỏ qua: rung chỉ là phụ trợ */ }
    }
  };

  window.IRBridge = IRBridge;
})();
