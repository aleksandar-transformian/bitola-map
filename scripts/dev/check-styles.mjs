#!/usr/bin/env node
// Проверка на системот за стилови: смена во живо, анимација на премин,
// #style= во URL и памтење во localStorage по превчитување.
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

// „Превчитување“ без hash → од localStorage (нова страница во истиот контекст;
// старата се затвора за софтверското рендерирање да не ја блокира навигацијата).
await page.close();
const p2 = await context.newPage();
p2.on('pageerror', (e) => errors.push(e.message));
await p2.goto(url);
await p2.waitForFunction(() => window.__bitola?.ready, null, { timeout: 120000 });
check('localStorage по превчитување', (await p2.evaluate(() => document.documentElement.dataset.style)) === 'maketa');
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
