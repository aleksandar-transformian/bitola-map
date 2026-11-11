#!/usr/bin/env node
// Проверка на интерфејсот: смена на стил и време од денот во живо, #style= / #time= во URL,
// памтење во localStorage, брзи погледи, глувче, тастатура и натписи.
//   node scripts/dev/check-styles.mjs [--url http://127.0.0.1:5173/] [--out screenshots/tmp]

import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const url = opt('url', 'http://127.0.0.1:5173/');
const out = opt('out', 'screenshots/tmp');
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1000, height: 650 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const ready = () => page.waitForFunction(() => window.__bitola?.ready, null, { timeout: 120000 });
const result = {};
// клик директно во страницата: софтверското рендерирање е бавно, па Playwright-овото чекање
// „елементот е стабилен два кадра“ знае да истече иако копчето е таму
const tap = (p, sel) => p.$eval(sel, (el) => el.click());
const check = (name, ok, detail = '') => {
  result[name] = ok;
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

await page.goto(url + '#style=razglednica');
await ready();
check('почеток со #style=razglednica', (await page.evaluate(() => document.documentElement.dataset.style)) === 'razglednica');

// Упатство: само при првата посета, се затвора со копче.
check('упатството при првата посета', await page.isVisible('.help'));
await tap(page, '.help-close');
check('упатството се затвора', !(await page.isVisible('.help')));
await tap(page, '.help-btn');
check('копче ? го отвора упатството', await page.isVisible('.help'));
await page.keyboard.press('Escape');

// „Оди до…“: знаменитостите се во листата, по групи.
const opts = await page.evaluate(() => [...document.querySelectorAll('.panel select optgroup')].map((g) => `${g.label} (${g.children.length})`));
check('листа „Оди до…“ со групи', opts.length >= 5, opts.join(', '));

// Глувче: средината на екранот мора да е canvas-от (ништо не смее да ги „голта“ настаните).
const hit = await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.tagName);
check('средината на екранот е мапата', hit === 'CANVAS', hit);
const before = await page.evaluate(() => window.__bitolaApp.getView());
await page.mouse.move(500, 380);
await page.mouse.down();
await page.mouse.move(380, 330, { steps: 6 });
await page.mouse.up();
await page.mouse.wheel(0, -600);
await page.waitForFunction((b) => {
  const v = window.__bitolaApp.getView();
  return Math.hypot(v.target.x - b.target.x, v.target.z - b.target.z) > 20 && v.distance < b.distance * 0.97;
}, before, { timeout: 60000, polling: 300 }).catch(() => {});
const after = await page.evaluate(() => window.__bitolaApp.getView());
check(
  'влечење и тркалце ја движат камерата',
  Math.hypot(after.target.x - before.target.x, after.target.z - before.target.z) > 20 && after.distance < before.distance * 0.97,
  `цел помесна ${Math.hypot(after.target.x - before.target.x, after.target.z - before.target.z).toFixed(0)} m, растојание ${before.distance.toFixed(0)} → ${after.distance.toFixed(0)} m`,
);

// Смена преку копчето (со анимација) — снимка среде премин.
await tap(page, '.style-picker button[data-id="maketa"]');
await page.waitForTimeout(250);
await page.screenshot({ path: `${out}/switch-mid.png`, timeout: 300000 });
await page.waitForTimeout(2000);
const s1 = await page.evaluate(() => ({ style: document.documentElement.dataset.style, hash: location.hash, ms: window.__bitola.lastSwitchMs, roofs: window.__bitolaApp.world.buildings.geometry.userData.info.roofs }));
check('клик → Макета', s1.style === 'maketa' && s1.roofs === 'flat', `${s1.ms} ms, покриви: ${s1.roofs}`);
check('URL се ажурира', s1.hash.includes('style=maketa'), s1.hash);
await page.screenshot({ path: `${out}/switch-after.png`, timeout: 300000 });

// Смена преку тастатура (1 = прв стил).
await page.keyboard.press('1');
await page.waitForTimeout(1500);
const s2 = await page.evaluate(() => ({ style: document.documentElement.dataset.style, roofs: window.__bitolaApp.world.buildings.geometry.userData.info.roofs, ms: window.__bitola.lastSwitchMs }));
check('тастер 1 → Разгледница', s2.style === 'razglednica' && s2.roofs === 'gabled', `${s2.ms} ms (геометријата од кеш)`);

// Тастер 3 → „Цртан филм“ (без сенки).
await page.keyboard.press('3');
await page.waitForFunction(() => document.documentElement.dataset.style === 'crtan', null, { timeout: 60000 }).catch(() => {});
const s3 = await page.evaluate(() => {
  let sun;
  window.__bitolaApp.scene.traverse((o) => o.isDirectionalLight && (sun = o));
  return { style: document.documentElement.dataset.style, shadows: sun.castShadow };
});
check('тастер 3 → Цртан филм (без сенки)', s3.style === 'crtan' && !s3.shadows, JSON.stringify(s3));

// Смена преку hashchange.
await page.evaluate(() => (location.hash = 'style=maketa'));
await page.waitForTimeout(1500);
check('hashchange → Макета', (await page.evaluate(() => document.documentElement.dataset.style)) === 'maketa');

// Време од денот: копче, URL, localStorage.
await tap(page, '.time-toggle button[data-id="night"]');
await page.waitForTimeout(2500);
const t1 = await page.evaluate(() => ({ time: document.documentElement.dataset.time, hash: location.hash }));
check('копче Ноќ', t1.time === 'night' && t1.hash.includes('time=night'), t1.hash);
await page.evaluate(() => (location.hash = 'style=maketa&time=sunset'));
await page.waitForTimeout(2500);
check('hashchange → зајдисонце', (await page.evaluate(() => document.documentElement.dataset.time)) === 'sunset');

// Брз поглед: лет до Хераклеа.
await page.selectOption('.panel select', 'herakleja');
// летот е временски (1.8 s), но софтверското рендерирање е бавно — чекај да заврши
await page
  .waitForFunction(() => {
    const v = window.__bitolaApp.getView();
    return Math.hypot(v.target.x - 625, v.target.z - 2150) < 5 && Math.abs(v.distance - 300) < 5;
  }, null, { timeout: 90000, polling: 500 })
  .catch(() => {});
const v1 = await page.evaluate(() => window.__bitolaApp.getView());
check('поглед Хераклеа', Math.hypot(v1.target.x - 625, v1.target.z - 2150) < 5 && Math.abs(v1.distance - 300) < 5, `цел ${v1.target.x.toFixed(0)}, ${v1.target.z.toFixed(0)}; ${v1.distance.toFixed(0)} m`);

// Тастатура: Q ротира.
const b0 = v1.bearing;
await page.keyboard.press('q');
await page
  .waitForFunction((b) => Math.abs(((window.__bitolaApp.getView().bearing - b + 540) % 360) - 180 + 12) < 1.5, b0, { timeout: 60000, polling: 300 })
  .catch(() => {});
await page.waitForTimeout(1500); // натписите се ажурираат во следниот кадар
const b1 = (await page.evaluate(() => window.__bitolaApp.getView())).bearing;
check('тастер Q ротира', Math.abs(((b1 - b0 + 540) % 360) - 180 + 12) < 1.5, `${b0.toFixed(1)}° → ${b1.toFixed(1)}°`);

// Натписи: на близина само знаменитости.
const labels = await page.evaluate(() => [...document.querySelectorAll('.label.on')].map((e) => e.textContent));
check('натпис Хераклеа', labels.includes('Хераклеа Линкестис'), labels.join(', '));

// „Оди до…“ знаменитост: Битолскиот филџан.
await page.selectOption('.panel select', 'fildzan');
await page
  .waitForFunction(() => {
    const v = window.__bitolaApp.getView();
    return Math.hypot(v.target.x + 1584, v.target.z + 263) < 5;
  }, null, { timeout: 90000, polling: 500 })
  .catch(() => {});
const vf = await page.evaluate(() => window.__bitolaApp.getView());
check('Оди до → Битолскиот филџан', Math.hypot(vf.target.x + 1584, vf.target.z + 263) < 5, `цел ${vf.target.x.toFixed(0)}, ${vf.target.z.toFixed(0)}`);

// „Превчитување“ без hash → од localStorage (нова страница во истиот контекст;
// старата се затвора за софтверското рендерирање да не ја блокира навигацијата).
await page.close();
const p2 = await context.newPage();
p2.on('pageerror', (e) => errors.push(e.message));
await p2.goto(url);
await p2.waitForFunction(() => window.__bitola?.ready, null, { timeout: 120000 });
check('localStorage по превчитување', (await p2.evaluate(() => document.documentElement.dataset.style)) === 'maketa');
check('времето запаметено', (await p2.evaluate(() => document.documentElement.dataset.time)) === 'sunset');
await p2.close();

// Непознат стил во URL → запаметениот, без грешка.
const p3 = await context.newPage();
p3.on('pageerror', (e) => errors.push(e.message));
await p3.goto(url + '#style=nepostoi');
await p3.waitForFunction(() => window.__bitola?.ready, null, { timeout: 120000 });
check('непознат #style= се игнорира', (await p3.evaluate(() => document.documentElement.dataset.style)) === 'maketa');

// Треперење на светлата: вклучено стандардно, исклучено при „намалено движење“.
await p3.waitForTimeout(300);
const fk1 = await p3.evaluate(() => ({ f: window.__bitolaApp.env.flicker.value, t: window.__bitolaApp.env.time.value }));
await p3.emulateMedia({ reducedMotion: 'reduce' });
await p3.waitForTimeout(500);
const fk2 = await p3.evaluate(() => ({ f: window.__bitolaApp.env.flicker.value, t: window.__bitolaApp.env.time.value }));
check('треперење: вклучено / исклучено при reduced-motion', fk1.f > 0 && fk2.f === 0 && fk2.t > fk1.t, `${fk1.f} → ${fk2.f}`);

check('без JS грешки', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
process.exit(Object.values(result).every(Boolean) ? 0 : 1);
