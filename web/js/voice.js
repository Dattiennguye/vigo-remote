/* VIGO — điều khiển bằng giọng nói: hiểu câu tiếng Việt → danh sách lệnh remote.
 * LƯU Ý: hồng ngoại không gõ được chữ vào TV. Đây là ĐIỀU KHIỂN bằng giọng nói (tăng âm lượng, chuyển kênh 12, tắt điều hòa...),
 * không phải tìm kiếm bằng giọng nói trên TV. Bộ phân tích thuần (chạy được trong Node), không tự tạo mã IR. */
(function (root) {
  'use strict';
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9+ ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  var W = { khong: 0, mot: 1, mot_: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, lam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10, mot2: 1, mot_tens: 1 };
  var UNIT = { khong: 0, mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, lam: 5, sau: 6, bay: 7, tam: 8, chin: 9 };

  /* Đổi cụm số bằng chữ ("hai muoi lam", "mot hai") thành chữ số; giữ nguyên chữ số có sẵn. */
  function numberWords(s) {
    var t = s.split(' '), out = [], i = 0;
    function isNum(w) { return w in UNIT || w === 'muoi' || w === 'mươi'; }
    while (i < t.length) {
      if (!isNum(t[i])) { out.push(t[i]); i++; continue; }
      var j = i; while (j < t.length && isNum(t[j])) j++;
      var seg = t.slice(i, j), v;
      var m = seg.indexOf('muoi');
      if (m >= 0) {
        var tens = m === 0 ? 1 : UNIT[seg[m - 1]] !== undefined ? UNIT[seg[m - 1]] : 1;
        var unit = seg[m + 1] !== undefined ? UNIT[seg[m + 1]] : 0;
        v = String(tens * 10 + (unit || 0));
      } else v = seg.map(function (w) { return UNIT[w]; }).join('');
      /* "nam"/"tu" đứng một mình thường không phải số */
      var AMB = seg.length === 1 && (seg[0] === 'nam' || seg[0] === 'tu' || seg[0] === 'sau' || seg[0] === 'ba' || seg[0] === 'tam');
      var prev = out[out.length - 1], prev2 = out[out.length - 2], next = t[j];
      var numCtx = prev === 'kenh' || (prev === 'so' && prev2 === 'kenh') || next === 'lan';
      if (AMB && !numCtx) out.push(seg[0]);
      else out.push(v);
      i = j;
    }
    return out.join(' ');
  }

  function count(seg, dflt) {
    var m = /(\d+)\s*(lan|cai|nac|buoc|do)?\b/.exec(seg);
    var n = m ? parseInt(m[1], 10) : dflt;
    return Math.max(1, Math.min(30, n));
  }

  var TV_LABEL = { power: 'Nguồn', mute: 'Tắt tiếng', vol_up: 'Âm lượng +', vol_down: 'Âm lượng −', up: 'Lên', down: 'Xuống', left: 'Trái', right: 'Phải', ok: 'OK',
    back: 'Quay lại', home: 'Trang chủ', exit: 'Thoát', menu: 'Menu', source: 'Nguồn tín hiệu', ch_up: 'Kênh +', ch_down: 'Kênh −', info: 'Thông tin', src_hdmi: 'HDMI' };

  function parseTv(seg) {
    var m;
    /* thiết bị khác có bảng phím: đèn, quạt, loa, đầu đĩa, máy chiếu */
    if (/tat (den|quat|loa|may chieu|dau|box|amply)\b/.test(seg)) return { t: 'tv', key: 'off', alt: 'power', count: 1, label: 'Tắt' };
    if (/(bat|mo) (den|quat|loa|may chieu|dau|box|amply)\b/.test(seg)) return { t: 'tv', key: 'on', alt: 'power', count: 1, label: 'Bật' };
    if (/sang hon|tang do sang|\bsang len\b/.test(seg)) return { t: 'tv', key: 'bright_up', count: count(seg, 1), label: 'Sáng hơn' };
    if (/toi hon|giam do sang|\btoi di\b/.test(seg)) return { t: 'tv', key: 'bright_down', count: count(seg, 1), label: 'Tối hơn' };
    if (/(tang|manh hon|nhanh hon).*(toc do|gio|quat)|toc do (len|tang)/.test(seg)) return { t: 'tv', key: 'speed_up', count: count(seg, 1), label: 'Tốc độ +' };
    if (/(giam|yeu hon|cham hon).*(toc do|gio|quat)|toc do (xuong|giam)/.test(seg)) return { t: 'tv', key: 'speed_down', count: count(seg, 1), label: 'Tốc độ −' };
    if (/\b(dao|xoay|lac)\b/.test(seg)) return { t: 'tv', key: 'swing', count: 1, label: 'Đảo chiều' };
    if (/hen gio/.test(seg)) return { t: 'tv', key: 'timer', count: 1, label: 'Hẹn giờ' };
    if (/tam dung|\bpause\b/.test(seg)) return { t: 'tv', key: 'pause', alt: 'play_pause', count: 1, label: 'Tạm dừng' };
    if (/tua (toi|nhanh)/.test(seg)) return { t: 'tv', key: 'fast_forward', count: 1, label: 'Tua tới' };
    if (/tua lai/.test(seg)) return { t: 'tv', key: 'rewind', count: 1, label: 'Tua lại' };
    if (/(bai|chuong|ca khuc) (tiep|sau|ke)|\bnext\b/.test(seg)) return { t: 'tv', key: 'next', count: count(seg, 1), label: 'Tiếp theo' };
    if (/(bai|chuong|ca khuc) truoc|\bprev(ious)?\b/.test(seg)) return { t: 'tv', key: 'prev', count: count(seg, 1), label: 'Trước đó' };
    if (/(mo|dong) khay|\beject\b/.test(seg)) return { t: 'tv', key: 'eject', count: 1, label: 'Mở/Đóng khay' };
    if (/^(phat|play|choi)$|^phat (nhac|phim|di)\b/.test(seg)) return { t: 'tv', key: 'play', alt: 'play_pause', count: 1, label: 'Phát' };
    if (/^(dung|stop)$|\bdung (phat|lai)\b/.test(seg)) return { t: 'tv', key: 'stop', count: 1, label: 'Dừng' };
    if ((m = /kenh (?:so )?(\d{1,4})\b/.exec(seg))) return { t: 'tv', digits: m[1], label: 'Kênh ' + m[1] };
    if (/tat tieng|im lang|cam tieng|bat tieng|\bmute\b/.test(seg)) return { t: 'tv', key: 'mute', count: 1, label: TV_LABEL.mute };
    if (/(tang|to|lon|len).*(am luong|tieng)|am luong (len|tang|lon)|^(to|lon) (len|hon)\b|lon hon|to hon/.test(seg)) return { t: 'tv', key: 'vol_up', count: count(seg, 1), label: TV_LABEL.vol_up };
    if (/(giam|nho|bot|xuong).*(am luong|tieng)|am luong (xuong|giam|nho)|nho (di|hon|xuong)|bot tieng/.test(seg)) return { t: 'tv', key: 'vol_down', count: count(seg, 1), label: TV_LABEL.vol_down };
    if (/kenh (tiep|len|sau|ke|\+)|chuyen kenh len/.test(seg)) return { t: 'tv', key: 'ch_up', count: count(seg, 1), label: TV_LABEL.ch_up };
    if (/kenh (truoc|xuong|lui|-)|chuyen kenh xuong/.test(seg)) return { t: 'tv', key: 'ch_down', count: count(seg, 1), label: TV_LABEL.ch_down };
    if (/(tat|bat|mo|khoi dong|dong)\s*(tivi|ti vi|tv|may|man hinh|nguon)|^(tat|bat|mo)$|\bnguon\b(?! tin hieu)/.test(seg) && !/tin hieu/.test(seg)) return { t: 'tv', key: 'power', alt: /^(bat|mo|khoi dong)/.test(seg) ? 'on' : /^(tat|dong)/.test(seg) ? 'off' : null, count: 1, label: TV_LABEL.power };
    if (/quay lai|tro lai|tro ve|lui lai|\bback\b/.test(seg)) return { t: 'tv', key: 'back', count: 1, label: TV_LABEL.back };
    if (/trang chu|man hinh chinh|\bhome\b/.test(seg)) return { t: 'tv', key: 'home', count: 1, label: TV_LABEL.home };
    if (/\bthoat\b|\bexit\b/.test(seg)) return { t: 'tv', key: 'exit', count: 1, label: TV_LABEL.exit };
    if (/\bmenu\b|cai dat|setting/.test(seg)) return { t: 'tv', key: 'menu', count: 1, label: TV_LABEL.menu };
    if (/hdmi/.test(seg)) return { t: 'tv', key: 'src_hdmi', alt: 'source', count: 1, label: TV_LABEL.src_hdmi };
    if (/nguon tin hieu|chon nguon|\binput\b|\bsource\b/.test(seg)) return { t: 'tv', key: 'source', count: 1, label: TV_LABEL.source };
    if (/thong tin|\binfo\b/.test(seg)) return { t: 'tv', key: 'info', count: 1, label: TV_LABEL.info };
    if (/\b(ok|dong y|chon|xac nhan|enter)\b/.test(seg)) return { t: 'tv', key: 'ok', count: 1, label: TV_LABEL.ok };
    if (/\blen\b/.test(seg)) return { t: 'tv', key: 'up', count: count(seg, 1), label: TV_LABEL.up };
    if (/\bxuong\b/.test(seg)) return { t: 'tv', key: 'down', count: count(seg, 1), label: TV_LABEL.down };
    if (/\btrai\b/.test(seg)) return { t: 'tv', key: 'left', count: count(seg, 1), label: TV_LABEL.left };
    if (/\bphai\b/.test(seg)) return { t: 'tv', key: 'right', count: count(seg, 1), label: TV_LABEL.right };
    return null;
  }

  var MODES = [[/hut am|\bkho\b|\bdry\b/, 'dry', 'Hút ẩm'], [/suoi|\bnong\b|\bheat\b/, 'heat', 'Sưởi'], [/\blanh\b|\bcool\b|mat/, 'cool', 'Làm lạnh'], [/\bquat\b|\bfan\b/, 'fan_only', 'Quạt'], [/tu dong|\bauto\b/, 'auto', 'Tự động']];

  function parseAc(seg) {
    var m;
    if (/(bat|mo|khoi dong)\s*(dieu hoa|may lanh|may dieu hoa|\bdh\b)|^bat$/.test(seg)) return { t: 'ac', op: 'power', on: true, label: 'Bật điều hòa' };
    if (/(tat|dong)\s*(dieu hoa|may lanh|may dieu hoa|\bdh\b)|^tat$/.test(seg)) return { t: 'ac', op: 'power', on: false, label: 'Tắt điều hòa' };
    if ((m = /\b(1[6-9]|2\d|3[0-2])\b\s*(do|c)?/.exec(seg)) && !/tang|giam/.test(seg)) return { t: 'ac', op: 'temp', value: parseInt(m[1], 10), label: 'Nhiệt độ ' + m[1] + '°' };
    if (/(tang|nong hon|cao hon|len)\b/.test(seg) && /do|nhiet/.test(seg)) { var n = count(seg, 1); return { t: 'ac', op: 'step', value: n, label: 'Tăng ' + n + '°' }; }
    if (/(giam|lanh hon|thap hon|xuong)\b/.test(seg) && /do|nhiet/.test(seg)) { var d = count(seg, 1); return { t: 'ac', op: 'step', value: -d, label: 'Giảm ' + d + '°' }; }
    if (/quat (to|manh|max|cao|nhat)|manh hon/.test(seg)) return { t: 'ac', op: 'fan', value: 'high', label: 'Quạt mạnh' };
    if (/quat (nho|yeu|thap)|yeu hon/.test(seg)) return { t: 'ac', op: 'fan', value: 'low', label: 'Quạt nhẹ' };
    if (/quat (vua|trung binh)/.test(seg)) return { t: 'ac', op: 'fan', value: 'mid', label: 'Quạt vừa' };
    if (/quat (tu dong|auto)/.test(seg)) return { t: 'ac', op: 'fan', value: 'auto', label: 'Quạt tự động' };
    if (/yen tinh|ban dem|ngu/.test(seg)) return { t: 'ac', op: 'fan', value: 'quiet', label: 'Quạt êm' };
    for (var i = 0; i < MODES.length; i++) if (MODES[i][0].test(seg)) return { t: 'ac', op: 'mode', value: MODES[i][1], label: 'Chế độ ' + MODES[i][2] };
    return null;
  }

  var AC_WORDS = /dieu hoa|may lanh|nhiet do|\bdh\b|che do|\bquat\b|\blanh\b|\bsuoi\b|hut am/;
  var TV_WORDS = /tivi|ti vi|\btv\b|kenh|am luong|tieng|hdmi|nguon tin hieu|trang chu|quay lai/;

  /* ctx: {activeType:'tv'|'ac', hasTv, hasAc}. Trả về {actions:[...], unknown:[...]} */
  function parse(text, ctx) {
    ctx = ctx || { activeType: 'tv', hasTv: true, hasAc: true };
    var s = numberWords(norm(text));
    var segs = s.split(/ (?:roi|sau do|xong|roi sau do|tiep theo|va) /).map(function (x) { return x.trim(); }).filter(Boolean);
    var actions = [], unknown = [];
    segs.forEach(function (seg) {
      var acStrong = /dieu hoa|may lanh|nhiet do|\bdh\b/.test(seg);
      var dom = acStrong ? 'ac' : AC_WORDS.test(seg) && !TV_WORDS.test(seg) ? (ctx.activeType === 'tv' && ctx.hasTv ? 'tv' : 'ac') : TV_WORDS.test(seg) ? 'tv' : (ctx.activeType || 'tv');
      var a = dom === 'ac' ? parseAc(seg) : parseTv(seg);
      if (!a && dom === 'tv' && ctx.hasAc) a = parseAc(seg);
      if (!a && dom === 'ac' && ctx.hasTv) a = parseTv(seg);
      if (!a) unknown.push(seg); else actions.push(a);
    });
    return { actions: actions, unknown: unknown, normalized: s };
  }

  var EXAMPLES = ['Tăng âm lượng 5 lần', 'Chuyển kênh 12', 'Tắt tiếng', 'Quay lại rồi xuống 3 lần rồi OK', 'Bật điều hòa', 'Nhiệt độ 24 độ', 'Giảm 2 độ', 'Quạt mạnh', 'Chế độ sưởi'];
  var api = { parse: parse, norm: norm, numberWords: numberWords, EXAMPLES: EXAMPLES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VigoVoice = api;
})(typeof window !== 'undefined' ? window : globalThis);
