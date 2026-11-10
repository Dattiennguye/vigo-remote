/* VIGO Universal Remote — khởi động, thanh 2 tab (Điều khiển | Cài đặt), hiệu ứng mở app và chuyển tab, nút Back của Android. */
(function () {
  'use strict';
  var UI = window.VigoUI, Store = window.VigoStore, Bridge = window.IRBridge;
  var tab = 'control', order = ['control', 'settings'];
  var views = {}, buttons = {};

  function applyPrefs() {
    var calm = Store.setting('reduceMotion') || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    document.documentElement.classList.toggle('calm', !!calm);
    window.VigoControl && window.VigoControl.sync();
  }

  function showTab(name, silent) {
    if (order.indexOf(name) < 0) return;
    var prev = tab, dir = order.indexOf(name) >= order.indexOf(prev) ? 1 : -1;
    tab = name;
    order.forEach(function (n) {
      var v = views[n], on = n === name;
      if (n !== prev && on) { /* view đi vào: đặt vị trí xuất phát không hiệu ứng rồi trượt về giữa */
        v.style.transition = 'none';
        v.classList.remove('to-left', 'to-right', 'active');
        v.classList.add(dir > 0 ? 'from-right' : 'from-left');
        void v.offsetWidth;
        v.style.transition = '';
        v.classList.remove('from-left', 'from-right');
      } else if (n === prev && !on) {
        v.classList.remove('from-left', 'from-right');
        v.classList.add(dir > 0 ? 'to-left' : 'to-right');
      }
      v.classList.toggle('active', on);
      v.setAttribute('aria-hidden', on ? 'false' : 'true');
      if ('inert' in v) v.inert = !on;
      buttons[n].classList.toggle('on', on);
      buttons[n].setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.getElementById('tabbar').setAttribute('data-tab', name);
    if (!silent && prev !== name) UI.haptic('nav');
    if (name === 'settings') window.VigoSettings.render();
    window.VigoControl.setTabActive(name === 'control');
    if (name === 'control') window.VigoControl.render();
  }

  function addDevice() { showTab('settings', true); window.VigoSettings.addDevice(); }

  window.__vigoBack = function () {
    if (UI.hasSheet()) return UI.closeSheet() || true;
    if (UI.hasPage()) return UI.closePage() || true;
    if (tab !== 'control') { showTab('control'); return true; }
    return false;
  };

  function splash() {
    var s = document.getElementById('splash'); if (!s) return;
    var calm = document.documentElement.classList.contains('calm');
    var end = function () { s.classList.add('done'); setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, calm ? 0 : 420); };
    if (calm) end(); else setTimeout(end, 950);
  }

  function init() {
    Store.init();
    Bridge.check();
    applyPrefs();
    views.control = document.getElementById('view-control');
    views.settings = document.getElementById('view-settings');
    order.forEach(function (n) {
      var b = document.querySelector('#tabbar [data-tab-btn="' + n + '"]');
      buttons[n] = b; b.addEventListener('click', function () { if (tab !== n) showTab(n); else if (n === 'settings') views.settings.scrollTop = 0; });
    });
    window.VigoControl.mount(views.control);
    window.VigoSettings.mount(views.settings);
    showTab('control', true);
    if (Store.error()) UI.toast('err', Store.error());
    splash();
    document.addEventListener('visibilitychange', function () { if (!document.hidden) window.VigoControl.sync(); });
  }

  window.VigoApp = { showTab: showTab, addDevice: addDevice, applyPrefs: applyPrefs, tab: function () { return tab; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
