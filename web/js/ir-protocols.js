/* VIGO — bộ mã hóa giao thức IR.
 * Chỉ dùng các giao thức công khai (NEC và biến thể, Samsung32, Sony SIRC, Kaseikyo, Philips RC5/RC6, Pioneer) + Raw + Pronto + Broadlink.
 * Không chứa bất kỳ mã thiết bị cụ thể nào: mã do người dùng nhập/import và tự kiểm tra.
 * Kết quả encode(spec) = { freq: Hz, pattern: [µs bật, µs tắt, ...] } (bắt đầu bằng xung bật). */
(function (root) {
  'use strict';

  var MAX_PATTERN_LEN = 2000;

  function hexInt(v) {
    if (typeof v === 'number') return v;
    var s = String(v).trim().replace(/^0x/i, '');
    if (!/^[0-9a-f]+$/i.test(s)) throw new Error('Giá trị hex không hợp lệ: "' + v + '"');
    return parseInt(s, 16);
  }

  function checkRange(name, v, max) {
    if (!Number.isInteger(v) || v < 0 || v > max) {
      throw new Error(name + ' phải nằm trong khoảng 0 đến ' + max + ' (nhận được ' + v + ')');
    }
  }

  function lsb(value, n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push((value >>> i) & 1);
    return a;
  }

  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }

  /* Khoảng cách xung: mỗi bit = [mark, space(0|1)] */
  function pulseDistance(bits, t) {
    var p = [];
    bits.forEach(function (b) { p.push(t.mark, b ? t.one : t.zero); });
    return p;
  }

  var PROTOCOLS = {
    nec: {
      label: 'NEC (địa chỉ 8 bit)', freq: 38000, addrMax: 0xFF, cmdMax: 0xFF,
      encode: function (s) {
        var a = hexInt(s.address), c = hexInt(s.command);
        checkRange('Địa chỉ', a, 0xFF); checkRange('Lệnh', c, 0xFF);
        var bits = [].concat(lsb(a, 8), lsb(~a & 0xFF, 8), lsb(c, 8), lsb(~c & 0xFF, 8));
        return [9000, 4500].concat(pulseDistance(bits, { mark: 560, zero: 560, one: 1690 }), [560]);
      }
    },
    necext: {
      label: 'NEC mở rộng (địa chỉ 16 bit, lệnh 16 bit)', freq: 38000, addrMax: 0xFFFF, cmdMax: 0xFFFF,
      encode: function (s) {
        var a = hexInt(s.address), c = hexInt(s.command);
        checkRange('Địa chỉ', a, 0xFFFF); checkRange('Lệnh', c, 0xFFFF);
        var bits = [].concat(lsb(a, 16), lsb(c, 16));
        return [9000, 4500].concat(pulseDistance(bits, { mark: 560, zero: 560, one: 1690 }), [560]);
      }
    },
    samsung32: {
      label: 'Samsung32', freq: 38000, addrMax: 0xFF, cmdMax: 0xFF,
      encode: function (s) {
        var a = hexInt(s.address), c = hexInt(s.command);
        checkRange('Địa chỉ', a, 0xFF); checkRange('Lệnh', c, 0xFF);
        var bits = [].concat(lsb(a, 8), lsb(a, 8), lsb(c, 8), lsb(~c & 0xFF, 8));
        return [4500, 4500].concat(pulseDistance(bits, { mark: 560, zero: 560, one: 1690 }), [560]);
      }
    },
    /* Kaseikyo (Panasonic và một số hãng khác). Cách xếp trường theo định nghĩa của Flipper:
     * address = (id << 24) | (vendor << 8) | (genre1 << 4) | genre2 ; command 10 bit.
     * Khung 48 bit, LSB trước: vendor(16) | parity vendor(4) genre1(4) | genre2(4) command thấp(4) | command cao(6) id(2) | parity(8). */
    kaseikyo: {
      label: 'Kaseikyo (Panasonic)', freq: 38000, addrMax: 0x3FFFFFF, cmdMax: 0x3FF,
      encode: function (s) {
        var a = hexInt(s.address), c = hexInt(s.command);
        checkRange('Địa chỉ', a, 0x3FFFFFF); checkRange('Lệnh', c, 0x3FF);
        var id = (a >>> 24) & 3, vendor = (a >>> 8) & 0xFFFF, g1 = (a >>> 4) & 0xF, g2 = a & 0xF;
        var d = [];
        d[0] = vendor & 0xFF; d[1] = vendor >>> 8;
        var vp = d[0] ^ d[1]; vp = (vp & 0xF) ^ (vp >>> 4);
        d[2] = (vp & 0xF) | (g1 << 4);
        d[3] = (g2 & 0xF) | ((c & 0xF) << 4);
        d[4] = (id << 6) | (c >>> 4);
        d[5] = d[2] ^ d[3] ^ d[4];
        var bits = [];
        d.forEach(function (byte) { bits = bits.concat(lsb(byte, 8)); });
        return [3456, 1728].concat(pulseDistance(bits, { mark: 432, zero: 432, one: 1296 }), [432]);
      }
    }
  };

  /* Sony SIRC: lệnh 7 bit + địa chỉ 5/8/13 bit, LSB trước, gửi 3 lần, chu kỳ 45 ms. */
  [['sirc12', 12, 5, 'Sony SIRC 12 bit'], ['sirc15', 15, 8, 'Sony SIRC 15 bit'], ['sirc20', 20, 13, 'Sony SIRC 20 bit']]
    .forEach(function (d) {
      var name = d[0], addrBits = d[2];
      PROTOCOLS[name] = {
        label: d[3], freq: 40000, addrMax: (1 << addrBits) - 1, cmdMax: 0x7F,
        encode: function (s) {
          var a = hexInt(s.address), c = hexInt(s.command);
          checkRange('Địa chỉ', a, (1 << addrBits) - 1); checkRange('Lệnh', c, 0x7F);
          var bits = [].concat(lsb(c, 7), lsb(a, addrBits));
          var frame = [2400, 600];
          bits.forEach(function (b) { frame.push(b ? 1200 : 600, 600); });
          var out = [];
          for (var r = 0; r < 3; r++) {
            var f = frame.slice();
            if (r < 2) f[f.length - 1] += Math.max(0, 45000 - sum(frame));
            out = out.concat(f);
          }
          return out;
        }
      };
    });

  /* ---- Giao thức bổ sung: viết theo đúng bộ phát của Flipper (flipperzero-firmware/lib/infrared/encoder_decoder) ---- */

  /* Manchester: danh sách [mức, µs] nửa-bit -> mẫu xung (gộp các nửa liền kề cùng mức; bỏ khoảng nghỉ đầu/cuối). */
  function halvesToPattern(h, lead) {
    var runs = [];
    (lead || []).forEach(function (x) { runs.push([x[0], x[1]]); });
    h.forEach(function (x) {
      var last = runs[runs.length - 1];
      if (last && last[0] === x[0]) last[1] += x[1]; else runs.push([x[0], x[1]]);
    });
    while (runs.length && !runs[0][0]) runs.shift();
    while (runs.length && !runs[runs.length - 1][0]) runs.pop();
    return runs.map(function (r) { return r[1]; });
  }

  function msb(value, n) {
    var a = [];
    for (var i = n - 1; i >= 0; i--) a.push((value >>> i) & 1);
    return a;
  }

  /* RC5 / RC5X: 36 kHz, nửa-bit 888 µs. 14 bit: start, start2 (RC5=1, RC5X=0), toggle, địa chỉ 5 bit, lệnh 6 bit (MSB trước).
   * Bit 1 = nghỉ rồi phát; bit 0 = phát rồi nghỉ. Bit toggle đổi mỗi lần bấm (spec.toggle) để thiết bị phân biệt "bấm lại" với "giữ". */
  ['rc5', 'rc5x'].forEach(function (name) {
    PROTOCOLS[name] = {
      label: name === 'rc5' ? 'Philips RC5' : 'Philips RC5X', freq: 36000, addrMax: 0xFF, cmdMax: 0xFF,
      encode: function (s) {
        var a = hexInt(s.address), c = hexInt(s.command);
        checkRange('Địa chỉ', a, 0xFF); checkRange('Lệnh', c, 0xFF);
        var bits = [1, name === 'rc5' ? 1 : 0, s.toggle ? 1 : 0].concat(msb(a & 0x1F, 5), msb(c & 0x3F, 6));
        var h = [];
        bits.forEach(function (b) { h.push([b ? 0 : 1, 888], [b ? 1 : 0, 888]); });
        return halvesToPattern(h);
      }
    };
  });

  /* RC6 (chế độ 0): 36 kHz, dẫn 2666/889, nửa-bit 444 µs; start, 3 bit chế độ = 0, toggle (dài gấp đôi), địa chỉ 8 bit, lệnh 8 bit (MSB trước).
   * Bit 1 = phát rồi nghỉ; bit 0 = nghỉ rồi phát. */
  PROTOCOLS.rc6 = {
    label: 'Philips RC6', freq: 36000, addrMax: 0xFF, cmdMax: 0xFF,
    encode: function (s) {
      var a = hexInt(s.address), c = hexInt(s.command);
      checkRange('Địa chỉ', a, 0xFF); checkRange('Lệnh', c, 0xFF);
      var bits = [1, 0, 0, 0, s.toggle ? 1 : 0].concat(msb(a, 8), msb(c, 8));
      var h = [];
      bits.forEach(function (b, i) {
        var d = i === 4 ? 888 : 444;
        h.push([b ? 1 : 0, d], [b ? 0 : 1, d]);
      });
      return halvesToPattern(h, [[1, 2666], [0, 889]]);
    }
  };

  /* NEC42 (địa chỉ 13 bit + bù, lệnh 8 bit + bù) và NEC42ext (địa chỉ 26 bit, lệnh 16 bit): 42 bit, thời gian như NEC. */
  PROTOCOLS.nec42 = {
    label: 'NEC42', freq: 38000, addrMax: 0x1FFF, cmdMax: 0xFF,
    encode: function (s) {
      var a = hexInt(s.address), c = hexInt(s.command);
      checkRange('Địa chỉ', a, 0x1FFF); checkRange('Lệnh', c, 0xFF);
      var bits = [].concat(lsb(a, 13), lsb(~a & 0x1FFF, 13), lsb(c, 8), lsb(~c & 0xFF, 8));
      return [9000, 4500].concat(pulseDistance(bits, { mark: 560, zero: 560, one: 1690 }), [560]);
    }
  };
  PROTOCOLS.nec42ext = {
    label: 'NEC42ext', freq: 38000, addrMax: 0x3FFFFFF, cmdMax: 0xFFFF,
    encode: function (s) {
      var a = hexInt(s.address), c = hexInt(s.command);
      checkRange('Địa chỉ', a, 0x3FFFFFF); checkRange('Lệnh', c, 0xFFFF);
      var bits = [].concat(lsb(a, 26), lsb(c, 16));
      return [9000, 4500].concat(pulseDistance(bits, { mark: 560, zero: 560, one: 1690 }), [560]);
    }
  };

  /* Pioneer: 40 kHz, dẫn 8500/4225, bit 500 + (500|1500), 32 bit (địa chỉ, ~địa chỉ, lệnh, ~lệnh), phát 2 lần cách ~26 ms. */
  PROTOCOLS.pioneer = {
    label: 'Pioneer', freq: 40000, addrMax: 0xFF, cmdMax: 0xFF,
    encode: function (s) {
      var a = hexInt(s.address), c = hexInt(s.command);
      checkRange('Địa chỉ', a, 0xFF); checkRange('Lệnh', c, 0xFF);
      var bits = [].concat(lsb(a, 8), lsb(~a & 0xFF, 8), lsb(c, 8), lsb(~c & 0xFF, 8));
      var frame = [8500, 4225].concat(pulseDistance(bits, { mark: 500, zero: 500, one: 1500 }), [500]);
      var gap = 500 + 26000;
      return frame.concat([gap], frame);
    }
  };

  function validatePattern(freq, pattern) {
    if (!Number.isInteger(freq) || freq < 15000 || freq > 60000) {
      throw new Error('Tần số sóng mang không hợp lệ: ' + freq + ' Hz (cho phép 15000–60000)');
    }
    if (!Array.isArray(pattern) || pattern.length < 2) throw new Error('Mẫu xung phải có ít nhất 2 phần tử');
    if (pattern.length > MAX_PATTERN_LEN) throw new Error('Mẫu xung quá dài (' + pattern.length + ' > ' + MAX_PATTERN_LEN + ')');
    pattern.forEach(function (v, i) {
      if (!Number.isInteger(v) || v <= 0 || v > 500000) {
        throw new Error('Phần tử xung #' + (i + 1) + ' không hợp lệ: ' + v);
      }
    });
  }

  /* Broadlink IR (header 0x26) -> µs. Tick = 269/8192 ms. Tần số sóng mang không có trong khung: dùng 38 kHz. */
  function b64bytes(s) {
    var clean = String(s).replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+\/]+={0,2}$/.test(clean)) throw new Error('Chuỗi Base64 không hợp lệ');
    if (typeof atob === 'function') {
      var bin = atob(clean), out = new Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return Array.prototype.slice.call(Buffer.from(clean, 'base64'));
  }

  function decodeBroadlink(b64) {
    var b = b64bytes(b64);
    if (b.length < 8 || b[0] !== 0x26) throw new Error('Không phải khung IR Broadlink (0x26)');
    var n = b[2] | (b[3] << 8);
    if (4 + n > b.length || n < 6) throw new Error('Khung Broadlink bị cụt');
    var out = [], i = 4, end = 4 + n;
    if (b[end - 2] !== 0x0d || b[end - 1] !== 0x05) throw new Error('Khung Broadlink thiếu đoạn kết thúc');
    while (i < end) {
      var v;
      if (b[i] === 0) {
        if (i + 2 >= end) throw new Error('Khung Broadlink hỏng');
        v = (b[i + 1] << 8) | b[i + 2]; i += 3;
      } else { v = b[i]; i += 1; }
      out.push(Math.round(v * 269 / 8192 * 1000));
    }
    return out;
  }

  function encode(spec) {
    if (!spec || typeof spec !== 'object') throw new Error('Thiếu thông tin mã IR');
    var freq, pattern;
    if (spec.protocol === 'broadlink') {
      freq = 38000; pattern = decodeBroadlink(spec.data);
    } else if (spec.protocol === 'raw') {
      freq = Number(spec.freq); pattern = (spec.pattern || []).map(Number);
    } else if (PROTOCOLS[spec.protocol]) {
      var p = PROTOCOLS[spec.protocol];
      freq = p.freq; pattern = p.encode(spec);
    } else {
      throw new Error('Giao thức chưa được hỗ trợ: ' + spec.protocol);
    }
    validatePattern(freq, pattern);
    return { freq: freq, pattern: pattern };
  }

  /* Pronto hex (định dạng 0000) -> spec raw */
  function parseProntoHex(text) {
    var words = String(text).trim().split(/[\s,]+/).filter(Boolean).map(function (w) {
      if (!/^[0-9a-f]{1,4}$/i.test(w)) throw new Error('Từ Pronto không hợp lệ: "' + w + '"');
      return parseInt(w, 16);
    });
    if (words.length < 6) throw new Error('Chuỗi Pronto quá ngắn');
    if (words[0] !== 0) throw new Error('Chỉ hỗ trợ Pronto dạng 0000 (mã học được)');
    var period = words[1] * 0.241246;
    if (!(period > 0)) throw new Error('Mã tần số Pronto không hợp lệ');
    var freq = Math.round(1e6 / period);
    var once = words[2], rep = words[3];
    var count = once > 0 ? once : rep;
    if (words.length < 4 + 2 * (once + rep)) throw new Error('Độ dài Pronto không khớp với phần đầu');
    var start = 4 + (once > 0 ? 0 : 2 * once);
    var pattern = words.slice(start, start + 2 * count).map(function (w) { return Math.round(w * period); });
    var spec = { protocol: 'raw', freq: freq, pattern: pattern };
    encode(spec);
    return spec;
  }

  function parseRawPattern(text) {
    var nums = String(text).trim().split(/[\s,;]+/).filter(Boolean).map(function (x) {
      var n = Number(x.replace(/^\+/, '').replace(/^-/, ''));
      if (!Number.isFinite(n)) throw new Error('Giá trị không phải số: "' + x + '"');
      return Math.round(Math.abs(n));
    });
    return nums;
  }

  /* Flipper .ir (Flipper-IRDB là nguồn công khai) */
  function leBytesToInt(str) {
    var bytes = String(str).trim().split(/\s+/).map(function (h) { return parseInt(h, 16); });
    var v = 0;
    for (var i = bytes.length - 1; i >= 0; i--) v = v * 256 + (bytes[i] || 0);
    return v;
  }

  var FLIPPER_MAP = { NEC: 'nec', NECext: 'necext', Samsung32: 'samsung32', SIRC: 'sirc12', SIRC15: 'sirc15', SIRC20: 'sirc20', Kaseikyo: 'kaseikyo',
    RC5: 'rc5', RC5X: 'rc5x', RC6: 'rc6', NEC42: 'nec42', NEC42ext: 'nec42ext', Pioneer: 'pioneer' };

  function parseFlipperIr(text) {
    var records = [], cur = null;
    String(text).split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line || line[0] === '#') return;
      var i = line.indexOf(':');
      if (i < 0) return;
      var k = line.slice(0, i).trim().toLowerCase(), v = line.slice(i + 1).trim();
      if (k === 'name') { cur = { name: v }; records.push(cur); }
      else if (cur) cur[k] = v;
    });
    var ok = [], skipped = [];
    records.forEach(function (r) {
      try {
        if (r.type === 'raw') {
          var spec = { protocol: 'raw', freq: parseInt(r.frequency, 10), pattern: String(r.data).split(/\s+/).map(Number) };
          encode(spec);
          ok.push({ name: r.name, spec: spec });
        } else if (r.type === 'parsed') {
          var proto = FLIPPER_MAP[r.protocol];
          if (!proto) { skipped.push(r.name + ' (giao thức ' + r.protocol + ' chưa hỗ trợ)'); return; }
          var s2 = { protocol: proto, address: leBytesToInt(r.address), command: leBytesToInt(r.command) };
          encode(s2);
          ok.push({ name: r.name, spec: s2 });
        } else {
          skipped.push(r.name + ' (kiểu ' + r.type + ' không hợp lệ)');
        }
      } catch (e) { skipped.push(r.name + ' (' + e.message + ')'); }
    });
    return { ok: ok, skipped: skipped };
  }

  var api = {
    PROTOCOLS: PROTOCOLS, encode: encode, validatePattern: validatePattern,
    parseProntoHex: parseProntoHex, parseRawPattern: parseRawPattern, parseFlipperIr: parseFlipperIr, hexInt: hexInt, decodeBroadlink: decodeBroadlink
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VigoIR = api;
})(typeof window !== 'undefined' ? window : globalThis);
