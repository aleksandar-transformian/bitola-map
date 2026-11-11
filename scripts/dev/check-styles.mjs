#!/usr/bin/env node
// Проверка на интерфејсот: смена на стил и време од денот во живо, #style= / #time= во URL,
// памтење во localStorage, брзи погледи, тастатура и натписи.
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
const check = (name, ok, detail = '') => {
  result[name] = ok;
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

await page.goto(url + '#style=razglednica');
await ready();
check('почеток со #style=razglednica', (await page.evaluate(() => document.documentElement.dataset.style)) === 'razglednica');

// Смена преку копчето (со анимација) — снимка среде премин.
await page.click('.style-picker button[data-id="maketa"]');
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

// Смена преку hashchange.
await page.evaluate(() => (location.hash = 'style=maketa'));
await page.waitForTimeout(1500);
check('hashchange → Макета', (await page.evaluate(() => document.documentElement.dataset.style)) === 'maketa');

// Време од денот: копче, URL, localStorage.
await page.click('.time-toggle button[data-id="night"]');
await page.waitForTimeout(2500);
const t1 = await page.evaluate(() => ({ time: document.documentElement.dataset.time, hash: location.hash }));
check('копче Ноќ', t1.time === 'night' && t1.hash.includes('time=night'), t1.hash);
await page.evaluate(() => (location.hash = 'style=maketa&time=sunset'));
await page.waitForTimeout(2500);
check('hashchange → зајдисонце', (await page.evaluate(() => document.documentElement.dataset.time)) === 'sunset');

// Брз поглед: лет до Хераклеа.
await page.click('.view-bar button[data-id="herakleja"]');
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

check('без JS грешки', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
process.exit(Object.values(result).every(Boolean) ? 0 : 1);
