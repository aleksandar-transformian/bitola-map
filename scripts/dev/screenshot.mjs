#!/usr/bin/env node
// Визуелна проверка: отвора ја мапата во headless Chromium, чека да се вчита,
// мери време и FPS и прави screenshot-ови.
//
//   node scripts/dev/screenshot.mjs [--url http://127.0.0.1:5173/] [--out screenshots/tmp]
//        [--mobile] [--views home,center] [--scale 1] [--style razglednica|maketa] [--clean]
//
// Забелешка: headless Chromium рендерира софтверски (SwiftShader) —
// FPS бројките се многу пониски од вистински GPU; корисни се само за споредба.

import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const has = (name) => args.includes(`--${name}`);

const url = opt('url', 'http://127.0.0.1:5173/');
const out = opt('out', 'screenshots/tmp');
const mobile = has('mobile');
const scale = Number(opt('scale', '1'));
const views = opt('views', 'home').split(',');

// Погледи за проверка (во фаза 3 ова ќе стане дел од апликацијата).
const VIEWS = {
  home: null,
  center: { target: { x: 0, z: 0 }, bearing: 200, polar: 55, distance: 900 },
  close: { target: { x: 30, z: -60 }, bearing: 160, polar: 62, distance: 350 },
  west: { target: { x: -2500, z: 800 }, bearing: 70, polar: 65, distance: 4500 },
  top: { target: { x: -500, z: 400 }, bearing: 0, polar: 1, distance: 11000 },
};

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = mobile
  ? await browser.newContext({ ...devices['iPhone 13'] })
  : await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: scale });
const page = await context.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const t0 = Date.now();
const u = new URL(url);
if (!has('clean')) u.searchParams.set('debug', ''); // --clean = без debug панел
if (opt('style')) u.hash = `style=${opt('style')}`;
await page.goto(u.toString());
await page.waitForFunction(() => window.__bitola?.ready, null, { timeout: 120000 });
const wall = Date.now() - t0;

for (const v of views) {
  if (VIEWS[v]) {
    await page.evaluate((view) => {
      const app = window.__bitolaApp;
      app.setView({ ...view, target: { x: view.target.x, z: view.target.z } });
    }, VIEWS[v]);
  }
  await page.waitForTimeout(2500);
  const file = `${out}/${mobile ? 'mobile-' : ''}${opt('style') ? opt('style') + '-' : ''}${v}.png`;
  await page.screenshot({ path: file, timeout: 180000 });
  console.log(`screenshot: ${file}`);
}
await page.waitForTimeout(1500);
const stats = await page.evaluate(() => window.__bitola);
console.log(JSON.stringify({ wallMs: wall, ...stats }));
for (const l of logs) if (!l.includes('[bitola]')) console.log(l);
await browser.close();
