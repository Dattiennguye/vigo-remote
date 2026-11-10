/* Kiểm tra giao diện trong Chromium thật (cần playwright). Chạy cục bộ: NODE_PATH=$(npm root -g) node tests/ui-browser.test.js
 * Có bộ giả lập Native Bridge để ghi lại mọi lần phát IR / rung / cờ native. */
'use strict';
const assert = require('assert');
const path = require('path');
const { chromium } = require('playwright');
const URL = 'file://' + path.join(__dirname, '..', 'web', 'index.html');
const OUT = process.env.SHOTS || '';
let n = 0; const ok = (m) => { n++; console.log('ok -', m); };

const FAKE = () => {
  window.__tx = []; window.__hap = []; window.__flags = { vol: [], awake: [] };
  window.VigoNative = {
    hasIrEmitter: () => JSON.stringify({ ok: true, available: true }),
    getCarrierFrequencies: () => JSON.stringify({ ok: true, ranges: [[30000, 60000]] }),
    transmit: (f, p) => { window.__tx.push({ f, p: JSON.parse(p) }); return JSON.stringify({ ok: true }); },
    haptic: (k) => { window.__hap.push(k); }, vibrate: () => {},
    setVolumeKeys: (v) => { window.__flags.vol.push(v); return JSON.stringify({ ok: true }); },
    keepScreenOn: (v) => { window.__flags.awake.push(v); return JSON.stringify({ ok: true }); }
  };
};

async function open(browser, vp, { native = true, storage = null } = {}) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  if (native) await page.addInitScript(FAKE);
  if (storage) await page.addInitScript((s) => { if (!localStorage.getItem('__seeded')) { localStorage.setItem('vigo.remote.v2', s); localStorage.setItem('__seeded', '1'); } }, storage);
  await page.goto(URL); await page.waitForSelector('#view-control.active');
  await page.waitForTimeout(1800); /* chờ màn hình mở app kết thúc */
  page.errs = errs; page.ctx = ctx; return page;
}

async function addTv(p, brand = 'Samsung') {
  await p.click('text=Thêm thiết bị'); await p.click('.bigcard >> nth=0');
  await p.click('.row.tap:has-text("' + brand + '")'); await p.waitForSelector('.setname');
  await p.click('button:has-text("Dùng bộ mã này")'); await p.click('#sheet-root .sheet button.primary');
  await p.waitForSelector('#view-control .cpad.tv'); await p.waitForTimeout(350);
}
async function addAc(p, brand = 'Daikin') {
  await p.click('#view-settings button:has-text("Thêm thiết bị")').catch(async () => { await p.click('text=Thêm thiết bị'); });
}

async function hitTest(p, selector, scroll) {
  return p.evaluate(([sel, scroll]) => {
    const tab = document.getElementById('tabbar').getBoundingClientRect();
    const bad = [];
    document.querySelectorAll(sel).forEach((el) => {
      if (scroll) el.scrollIntoView({ block: 'center' });
      const sc = el.closest('.chips');
      if (sc && sc.scrollWidth > sc.clientWidth) { const pr = sc.getBoundingClientRect(), er = el.getBoundingClientRect(); if (er.right > pr.right + 1 || er.left < pr.left - 1) return; /* nằm ngoài vùng cuộn ngang: hợp lệ */ }
      const r = el.getBoundingClientRect(); if (!r.width) return;
      const name = el.getAttribute('data-key') || el.getAttribute('aria-label') || el.textContent.trim();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      if (!(top && (top === el || el.contains(top)))) bad.push(name + ': bị che bởi ' + (top && (top.className || top.tagName)));
      if (r.width < 48 || r.height < 44) bad.push(name + ': quá nhỏ ' + Math.round(r.width) + 'x' + Math.round(r.height));
      if (r.left < 0 || r.right > innerWidth + 0.5) bad.push(name + ': tràn ngang');
      if (!scroll && r.bottom > tab.top + 0.5) bad.push(name + ': bị thanh tab che (bottom ' + Math.round(r.bottom) + ' > ' + Math.round(tab.top) + ')');
      if (r.top < 0) bad.push(name + ': tràn lên trên');
    });
    return bad;
  }, [selector, !!scroll]);
}

(async () => {
  const browser = await chromium.launch();

  /* 1. Mở app: màn hình đầu tiên là Điều khiển; chưa có thiết bị thì có lời mời thêm */
  let p = await open(browser, { width: 393, height: 852 });
  assert.strictEqual(await p.locator('#view-control').getAttribute('class').then((c) => c.includes('active')), true);
  assert.ok(await p.locator('#view-control .empty .btn.primary').isVisible());
  assert.strictEqual(await p.locator('#tabbar [role=tab]').count(), 2); /* chỉ 2 mục menu */
  assert.deepStrictEqual(await p.locator('#tabbar [role=tab]').allTextContents().then((a) => a.map((s) => s.trim())), ['Điều khiển', 'Cài đặt']);
  assert.strictEqual(await p.locator('#splash').count(), 0, 'màn hình mở app phải tự gỡ');
  ok('mở app → tab Điều khiển, đúng 2 mục menu, splash tự gỡ');

  /* 2. Thêm TV Samsung qua luồng chọn hãng, thử nút, lưu */
  await p.click('text=Thêm thiết bị'); await p.click('.bigcard >> nth=0');
  await p.click('.row.tap:has-text("Samsung")'); await p.waitForSelector('.setname');
  await p.click('button:has-text("Thử phím Nguồn")');
  let tx = await p.evaluate(() => window.__tx);
  assert.strictEqual(tx.length, 1); assert.strictEqual(tx[0].f, 38000);
  ok('Thử phím Nguồn phát đúng 1 xung 38 kHz qua Native Bridge');
  await p.click('button:has-text("Dùng bộ mã này")'); await p.click('#sheet-root .sheet button.primary');
  await p.waitForSelector('#view-control .cpad.tv'); await p.waitForTimeout(400);
  assert.strictEqual(await p.evaluate(() => window.VigoApp.tab()), 'control');
  ok('thêm TV xong tự về màn hình Điều khiển');

  /* 3. TV tối giản: đúng các phím yêu cầu */
  const keys = await p.$$eval('#view-control .cpad.tv [data-key]', (els) => els.map((e) => e.getAttribute('data-key')));
  assert.deepStrictEqual(keys.sort(), ['back', 'down', 'exit', 'home', 'left', 'mute', 'ok', 'power', 'right', 'up', 'vol_down', 'vol_up'].sort());
  ok('TV có đúng 12 phím: lên/xuống/trái/phải/OK, quay lại/trang chủ/thoát, âm lượng ±, tắt tiếng, nguồn');

  /* 4. Nút OK bấm được và phát mã; có rung */
  await p.evaluate(() => { window.__tx.length = 0; window.__hap.length = 0; });
  await p.locator('[data-key=ok]').tap(); await p.waitForTimeout(60);
  tx = await p.evaluate(() => window.__tx); const hap = await p.evaluate(() => window.__hap);
  assert.strictEqual(tx.length, 1, 'OK phải phát đúng 1 lần'); assert.ok(tx[0].p.length > 20);
  assert.deepStrictEqual(hap, ['click']);
  assert.match(await p.locator('.status').textContent(), /OK/);
  ok('nút OK bấm được → phát 1 mã, rung "click", báo ✓ OK');

  /* 5. Giữ để lặp (âm lượng +) */
  await p.evaluate(() => { window.__tx.length = 0; });
  const vb = await p.locator('[data-key=vol_up]').boundingBox();
  await p.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2); await p.mouse.down(); await p.waitForTimeout(1100); await p.mouse.up();
  const rep = (await p.evaluate(() => window.__tx)).length; assert.ok(rep >= 4 && rep <= 9, 'lặp ' + rep);
  await p.waitForTimeout(400); assert.strictEqual((await p.evaluate(() => window.__tx)).length, rep, 'thả tay phải dừng lặp');
  ok('giữ Âm lượng + lặp (' + rep + ' lần/1,1s) và dừng ngay khi thả');

  /* 6. Vùng chạm: không bị che, ≥48px, trong màn hình, nằm trên thanh tab — nhiều cỡ máy */
  for (const vp of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 393, height: 852 }, { width: 412, height: 915 }, { width: 430, height: 932 }]) {
    await p.setViewportSize(vp); await p.waitForTimeout(150);
    const bad = await hitTest(p, '#view-control .key, #view-control .pill, #view-control .irchip');
    assert.deepStrictEqual(bad, [], vp.width + 'x' + vp.height + ' → ' + bad.join('; '));
    /* bố cục thấp: phím điều hướng nằm ở nửa dưới màn hình (với ngón cái) */
    const okTop = await p.evaluate(() => document.querySelector('[data-key=ok]').getBoundingClientRect().top);
    assert.ok(okTop > vp.height * 0.4, 'OK phải ở nửa dưới: ' + okTop);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.strictEqual(ov, false, 'tràn ngang ' + vp.width);
  }
  ok('5 cỡ màn hình (320×568 → 430×932): mọi phím ≥48px, không bị che, không tràn, nằm nửa dưới');
  await p.setViewportSize({ width: 393, height: 852 });
  if (OUT) await p.screenshot({ path: OUT + '/tv-393.png' });

  /* 7. Thêm phím + bảng phím */
  await p.click('button[aria-label="Thêm phím"]'); await p.waitForSelector('.xgrid .xkey');
  assert.ok((await p.locator('.xgrid .xkey').count()) > 3);
  await p.evaluate(() => { window.__tx.length = 0; });
  await p.locator('.xgrid .xkey').first().tap(); await p.waitForTimeout(50);
  assert.strictEqual((await p.evaluate(() => window.__tx)).length, 1);
  await p.keyboard.press('Escape'); await p.evaluate(() => window.__vigoBack());
  ok('Thêm phím: Menu/Kênh/Số… bấm được');

  /* 8. Chuyển tab: hiệu ứng + trạng thái; Cài đặt có đủ mục */
  await p.click('#tabbar [data-tab-btn=settings]'); await p.waitForTimeout(450);
  assert.strictEqual(await p.getAttribute('#tabbar', 'data-tab'), 'settings');
  assert.ok(await p.locator('#view-settings').evaluate((e) => e.classList.contains('active')));
  assert.ok(!(await p.locator('#view-control').evaluate((e) => e.classList.contains('active'))));
  const secs = await p.locator('#view-settings .sec').allTextContents();
  assert.deepStrictEqual(secs.map((s) => s.toLowerCase()), ['thiết bị', 'phản hồi & chuyển động', 'khi điều khiển', 'mắt phát hồng ngoại', 'dữ liệu', 'giới thiệu']);
  const swBad = await hitTest(p, '#view-settings .row, #view-settings .btn', true);
  assert.deepStrictEqual(swBad, [], swBad.join('; '));
  await p.evaluate(() => { document.getElementById('view-settings').scrollTop = 0; });
  if (OUT) await p.screenshot({ path: OUT + '/settings-393.png' });
  ok('chuyển sang Cài đặt: đủ 6 nhóm, mục chạm không bị che');

  /* 9. Rung: tắt trong Cài đặt thì không rung nữa; cường độ */
  await p.locator('.toggle:has-text("Rung khi bấm nút")').click(); await p.waitForTimeout(100);
  assert.strictEqual(await p.evaluate(() => window.VigoStore.setting('haptics')), false);
  await p.click('#tabbar [data-tab-btn=control]'); await p.waitForTimeout(400);
  await p.evaluate(() => { window.__hap.length = 0; window.__tx.length = 0; });
  await p.locator('[data-key=ok]').tap(); await p.waitForTimeout(50);
  assert.deepStrictEqual(await p.evaluate(() => window.__hap), []); assert.strictEqual((await p.evaluate(() => window.__tx)).length, 1);
  await p.click('#tabbar [data-tab-btn=settings]'); await p.waitForTimeout(400);
  await p.locator('.toggle:has-text("Rung khi bấm nút")').click();
  await p.click('.seg button:has-text("Mạnh")');
  await p.click('#tabbar [data-tab-btn=control]'); await p.waitForTimeout(400);
  await p.evaluate(() => { window.__hap.length = 0; }); await p.locator('[data-key=ok]').tap(); await p.waitForTimeout(50);
  assert.deepStrictEqual(await p.evaluate(() => window.__hap), ['heavy']);
  ok('công tắc rung: tắt → không rung nhưng vẫn phát IR; bật + cường độ Mạnh → "heavy"');

  /* 10. Phím không có trong bộ mã: báo lỗi + rung lỗi, không phát */
  await p.evaluate(() => { const s = window.VigoStore, d = s.active(); const c = Object.assign({}, d.codes); delete c.exit; s.update(d.id, { codes: c }); });
  await p.waitForTimeout(100);
  await p.evaluate(() => { window.__hap.length = 0; window.__tx.length = 0; });
  await p.locator('[data-key=exit]').tap({ force: true }); await p.waitForTimeout(50);
  assert.deepStrictEqual(await p.evaluate(() => window.__tx), []); assert.deepStrictEqual(await p.evaluate(() => window.__hap), ['error']);
  assert.match(await p.locator('.status').textContent(), /không có phím/);
  ok('phím thiếu trong bộ mã: không phát, rung lỗi, báo rõ');

  /* 11. Cờ Native: phím âm lượng + giữ sáng */
  await p.click('#tabbar [data-tab-btn=settings]'); await p.waitForTimeout(400);
  await p.locator('.toggle:has-text("Phím âm lượng của máy")').click();
  await p.locator('.toggle:has-text("Giữ màn hình sáng")').click();
  await p.click('#tabbar [data-tab-btn=control]'); await p.waitForTimeout(400);
  let fl = await p.evaluate(() => ({ vol: window.__flags.vol.slice(-1)[0], awake: window.__flags.awake.slice(-1)[0] }));
  assert.deepStrictEqual(fl, { vol: true, awake: true });
  await p.evaluate(() => { window.__tx.length = 0; window.__vigoKey('vol_up'); });
  assert.strictEqual((await p.evaluate(() => window.__tx)).length, 1);
  await p.click('#tabbar [data-tab-btn=settings]'); await p.waitForTimeout(400);
  fl = await p.evaluate(() => ({ vol: window.__flags.vol.slice(-1)[0], awake: window.__flags.awake.slice(-1)[0] }));
  assert.deepStrictEqual(fl, { vol: false, awake: false }, 'rời tab Điều khiển phải nhả phím âm lượng/giữ sáng');
  assert.strictEqual(await p.evaluate(() => window.__vigoKey('vol_up')), false);
  ok('phím âm lượng vật lý + giữ sáng: bật ở Điều khiển, nhả khi sang Cài đặt');

  /* 12. Không ghi lịch sử */
  const stored = await p.evaluate(() => localStorage.getItem('vigo.remote.v2'));
  assert.ok(!/history/i.test(stored)); assert.ok(!/vigo.remote.v1/.test(Object.keys(await p.evaluate(() => ({ ...localStorage }))).join()));
  ok('không có lịch sử thao tác trong dữ liệu lưu');

  /* 13. Nút Back của Android */
  await p.evaluate(() => window.VigoSettings.addDevice());
  await p.waitForTimeout(300);
  assert.strictEqual(await p.evaluate(() => window.__vigoBack()), true);
  await p.waitForTimeout(350);
  assert.strictEqual(await p.locator('.page').count(), 0);
  assert.strictEqual(await p.evaluate(() => window.__vigoBack()), true); /* Cài đặt → Điều khiển */
  assert.strictEqual(await p.evaluate(() => window.VigoApp.tab()), 'control');
  assert.strictEqual(await p.evaluate(() => window.__vigoBack()), false); /* thoát app */
  ok('nút Back: đóng trang → về Điều khiển → mới thoát app');

  /* 14. Dữ liệu còn sau khi mở lại + sao lưu/khôi phục + xóa */
  await p.reload(); await p.waitForTimeout(1800);
  assert.strictEqual(await p.evaluate(() => window.VigoStore.active().brand), 'Samsung');
  assert.strictEqual(await p.evaluate(() => window.VigoStore.setting('hapticLevel')), 'strong');
  const bk = await p.evaluate(() => window.VigoStore.exportJson());
  await p.evaluate(() => window.VigoStore.wipe()); assert.strictEqual(await p.evaluate(() => window.VigoStore.devices().length), 0);
  assert.strictEqual(await p.evaluate((t) => window.VigoStore.importJson(t), bk), 1);
  await p.evaluate(() => { try { window.VigoStore.importJson('{"x":1}'); } catch (e) { window.__e = e.message; } });
  assert.match(await p.evaluate(() => window.__e), /không phải bản sao lưu/);
  assert.deepStrictEqual(p.errs, [], p.errs.join('\n'));
  ok('lưu bền sau khi mở lại; sao lưu → xóa → khôi phục; từ chối dữ liệu lạ; không lỗi console');
  await p.ctx.close();

  /* 15. Điều hòa: thêm Daikin, đổi nhiệt độ/chế độ/quạt, tắt, hẹn giờ */
  p = await open(browser, { width: 393, height: 852 });
  await p.click('text=Thêm thiết bị'); await p.click('.bigcard >> nth=1');
  await p.waitForSelector('.row.tap:has-text("Daikin")'); await p.click('.row.tap:has-text("Daikin")'); await p.waitForSelector('.setname');
  await p.click('button:has-text("Thử TẮT")'); assert.strictEqual((await p.evaluate(() => window.__tx)).length, 1);
  await p.click('button:has-text("Thử BẬT")'); await p.waitForFunction(() => window.__tx.length === 2);
  assert.strictEqual((await p.evaluate(() => window.__tx))[1].f, 38000);
  await p.click('button:has-text("Dùng bộ mã này")'); await p.click('#sheet-root .sheet button.primary');
  await p.waitForSelector('#view-control .cpad.ac .big-temp', { timeout: 8000 }); await p.waitForTimeout(400);
  assert.strictEqual(await p.locator('.ac-display').evaluate((e) => e.classList.contains('off')), true);
  ok('thêm điều hòa Daikin: thử BẬT/TẮT phát mã Broadlink đã giải mã');
  /* đang tắt: đổi nhiệt độ không phát, báo rõ */
  await p.evaluate(() => { window.__tx.length = 0; });
  await p.locator('.key[aria-label="Tăng nhiệt độ"]').tap(); await p.waitForTimeout(50);
  assert.strictEqual((await p.evaluate(() => window.__tx)).length, 0); assert.match(await p.locator('.status').textContent(), /đang tắt/);
  await p.locator('.key[aria-label="Bật hoặc tắt máy"]').tap(); await p.waitForTimeout(80);
  assert.strictEqual((await p.evaluate(() => window.__tx)).length, 1);
  assert.strictEqual(await p.locator('.ac-display').evaluate((e) => e.classList.contains('off')), false);
  const t0 = Number(await p.locator('.big-temp').textContent());
  await p.evaluate(() => { window.__tx.length = 0; });
  await p.locator('.key[aria-label="Giảm nhiệt độ"]').tap(); await p.waitForTimeout(50);
  assert.strictEqual(Number(await p.locator('.big-temp').textContent()), t0 - 1);
  assert.strictEqual((await p.evaluate(() => window.__tx)).length, 1);
  const before = JSON.stringify((await p.evaluate(() => window.__tx))[0].p);
  await p.locator('.key[aria-label="Giảm nhiệt độ"]').tap(); await p.waitForTimeout(50);
  assert.notStrictEqual(JSON.stringify((await p.evaluate(() => window.__tx))[1].p), before, 'mỗi nhiệt độ một mã khác nhau');
  ok('AC: bật gửi mã trạng thái, ± đổi nhiệt độ và gửi mã khác nhau mỗi bước; khi tắt không gửi');
  const chips = await p.locator('.chiprow .chip').count(); assert.ok(chips >= 4);
  await p.locator('.chiprow:has(.cl:text("Chế độ")) .chip').nth(1).tap(); await p.waitForTimeout(80);
  assert.ok((await p.evaluate(() => window.__tx)).length >= 3);
  await p.evaluate(() => { window.__tx.length = 0; });
  await p.locator('.key[aria-label="Bật hoặc tắt máy"]').tap(); await p.waitForTimeout(60);
  assert.strictEqual((await p.evaluate(() => window.__tx)).length, 1);
  assert.strictEqual(await p.locator('.ac-display').evaluate((e) => e.classList.contains('off')), true);
  ok('AC: đổi chế độ gửi lại trạng thái; tắt gửi mã tắt');
  for (const vp of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 393, height: 852 }, { width: 430, height: 932 }]) {
    await p.setViewportSize(vp); await p.waitForTimeout(150);
    const bad = await hitTest(p, '#view-control .key, #view-control .chip');
    /* màn hình rất thấp được phép cuộn: chỉ cần không bị che/không tràn ngang */
    const real = vp.height < 700 ? bad.filter((x) => !/thanh tab che|tràn lên/.test(x)) : bad;
    assert.deepStrictEqual(real, [], vp.width + 'x' + vp.height + ' → ' + real.join('; '));
  }
  await p.setViewportSize({ width: 393, height: 852 }); await p.waitForTimeout(200);
  if (OUT) await p.screenshot({ path: OUT + '/ac-393.png' });
  ok('AC: bố cục chạm được ở nhiều cỡ màn hình');
  /* hẹn giờ */
  await p.click('.chip.timer'); await p.click('.sheet .chip:has-text("30 phút")'); await p.waitForTimeout(300);
  assert.match(await p.locator('.chip.timer').textContent(), /Tắt sau/);
  await p.evaluate(() => { const s = window.VigoStore, d = s.active(); s.update(d.id, { timer: { at: Date.now() - 10 }, state: Object.assign({}, d.state, { power: true }) }, true); window.__tx.length = 0; });
  await p.waitForFunction(() => window.__tx.length === 1, null, { timeout: 4000 });
  assert.strictEqual(await p.evaluate(() => window.VigoStore.active().state.power), false);
  assert.strictEqual(await p.evaluate(() => window.VigoStore.active().timer), null);
  ok('AC: hẹn giờ tắt hết hạn → gửi mã tắt đúng 1 lần, xóa hẹn giờ');
  assert.deepStrictEqual(p.errs, [], p.errs.join('\n'));
  await p.ctx.close();

  /* 16. Chế độ Demo (không có Native): không bao giờ báo "đã gửi" */
  p = await open(browser, { width: 393, height: 852 }, { native: false });
  await addTv(p);
  await p.locator('[data-key=power]').tap(); await p.waitForTimeout(60);
  const st = await p.locator('.status').textContent(); assert.match(st, /Demo/); assert.ok(!/✓/.test(st));
  assert.match(await p.locator('.irchip').textContent(), /Demo/);
  ok('Demo: nút bấm báo "Demo — chưa phát IR thật", không có dấu ✓ giả');
  await p.ctx.close();

  /* 17. Giảm chuyển động: tắt hiệu ứng */
  p = await open(browser, { width: 393, height: 852 });
  await p.evaluate(() => { window.VigoStore.set('reduceMotion', true); window.VigoApp.applyPrefs(); });
  assert.ok(await p.evaluate(() => document.documentElement.classList.contains('calm')));
  const dur = await p.evaluate(() => getComputedStyle(document.querySelector('#tabbar .ind')).transitionDuration);
  assert.ok(parseFloat(dur) < 0.01, dur);
  ok('"Giảm chuyển động" tắt hiệu ứng chuyển tab');
  await p.ctx.close();

  await browser.close();
  console.log('\n' + n + ' nhóm kiểm tra giao diện đạt');
  process.exit(0);
})().catch((e) => { console.error('FAIL:', e); process.exit(1); });
