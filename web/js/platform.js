/* VIGO — dịch vụ trực tuyến qua native (window.VigoPlatform): đăng nhập Google, gói Pro (Google Play Billing), quảng cáo AdMob.
 * Ngoài ứng dụng Android (Demo) mọi thứ báo "chỉ có trong ứng dụng". Không bao giờ giả lập đăng nhập hay thanh toán thành công. */
(function () {
  'use strict';
  var listeners = [];
  function native() { return typeof window !== 'undefined' && window.VigoPlatform && typeof window.VigoPlatform.getConfig === 'function' ? window.VigoPlatform : null; }
  function emit(ev) { listeners.slice().forEach(function (f) { try { f(ev); } catch (e) { /* bỏ qua */ } }); }
  window.__vigoPlatform = function (json) { var ev; try { ev = JSON.parse(json); } catch (e) { return; } emit(ev); };

  var P = {
    available: function () { return !!native(); },
    on: function (f) { listeners.push(f); },
    config: function () {
      var n = native(); if (!n) return { available: false, signIn: false, ads: false, billing: false };
      try { var c = JSON.parse(n.getConfig()); c.available = true; return c; } catch (e) { return { available: false }; }
    },
    call: function (name, arg) {
      var n = native();
      if (!n || typeof n[name] !== 'function') { emit({ type: name === 'signIn' || name === 'signOut' ? 'auth' : 'plans', ok: false, error: 'Chỉ có trong ứng dụng Android' }); return false; }
      try { arg === undefined ? n[name]() : n[name](arg); return true; } catch (e) { emit({ type: 'error', ok: false, error: e.message }); return false; }
    },
    signIn: function () { return P.call('signIn'); },
    signOut: function () { return P.call('signOut'); },
    loadPlans: function () { return P.call('loadPlans'); },
    buy: function (id) { return P.call('buy', id); },
    checkEntitlement: function () { var n = native(); if (n) { try { n.checkEntitlement(); } catch (e) { /* bỏ qua */ } } },
    manage: function () { return P.call('manageSubscription'); },
    setAds: function (on) { var n = native(); if (n) { try { n.setAdsEnabled(!!on); } catch (e) { /* bỏ qua */ } } },
    periodLabel: function (iso) {
      var m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(iso || '');
      if (!m) return '';
      if (m[1]) return m[1] === '1' ? 'mỗi năm' : 'mỗi ' + m[1] + ' năm';
      if (m[2]) return m[2] === '1' ? 'mỗi tháng' : 'mỗi ' + m[2] + ' tháng';
      return '';
    }
  };
  window.VigoOnline = P;
})();
