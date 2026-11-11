#!/usr/bin/env node
// Визуелна проверка: отвора ја мапата во headless Chromium, чека да се вчита,
// мери време и FPS и прави screenshot-ови.
//
//   node scripts/dev/screenshot.mjs [--url http://127.0.0.1:5173/] [--out screenshots/tmp]
//        [--mobile] [--views home,center] [--scale 1] [--style razglednica|maketa|crtan|bajka] [--time day|sunset|night]
//        [--weather clear|snow|snowfall] [--clean]
//        погледи: home, center, close, west, top + брзите погледи (pregled, shirok-sokak, charshija, …)
//                 + lm-<id> за секоја знаменитост (config/landmarks.js)
//
// Забелешка: headless Chromium рендерира софтверски (SwiftShader) —
// FPS бројките се многу пониски од вистински GPU; корисни се само за споредба.

import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { VIEWS as APP_VIEWS } from '../../src/config/views.js';
import { readFileSync } from 'node:fs';

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

// Погледи за проверка: брзите погледи од апликацијата (config/views.js) + неколку дополнителни.
const VIEWS = {
  home: null,
  ...Object.fromEntries(APP_VIEWS.map((v) => [v.id, v])),
  center: { target: { x: 0, z: 0 }, bearing: 200, polar: 55, distance: 900 },
  close: { target: { x: 30, z: -60 }, bearing: 160, polar: 62, distance: 350 },
  west: { target: { x: -2500, z: 800 }, bearing: 70, polar: 65, distance: 4500 },
  top: { target: { x: -500, z: 400 }, bearing: 0, polar: 1, distance: 11000 },
  // крупни планови на знаменитостите
  saat: { target: { x: -40, z: -20 }, bearing: 215, polar: 62, distance: 170 },
  dimitrija: { target: { x: -82, z: 68 }, bearing: 140, polar: 58, distance: 160 },
  filip: { target: { x: -18, z: 38 }, bearing: 135, polar: 64, distance: 85 },
  // зградите на Магнолија од споменикот (како на фотографиите на сопственикот)
  'mag-red': { target: { x: -17, z: 63 }, bearing: 42, polar: 77, distance: 42 },
  'mag-plostad': { target: { x: 10, z: 58 }, bearing: 300, polar: 68, distance: 90 },
};

// lm-<id> = поглед кон знаменитост од public/data/landmarks.json (растојание по големина)
const LMS = JSON.parse(readFileSync('public/data/landmarks.json', 'utf8'));
for (const lm of LMS) {
  const big = { stadium: 420, warCemetery: 380, fortress: 300, monastery: 300, totenburg: 200, heraclea: 380, promenade: 420 }[lm.model] || 150;
  VIEWS[`lm-${lm.id}`] = { target: { x: lm.center[0], z: lm.center[1] }, bearing: 200, polar: 58, distance: big };
}

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = mobile
  ? await browser.newContext({ ...devices['iPhone 13'] })
  : await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: scale });
// упатството при првата посета не е потребно на сликите
await context.addInitScript(() => {
  try {
    localStorage.setItem('bitola.helpSeen', '1');
  } catch {}
});
const page = await context.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const t0 = Date.now();
const u = new URL(url);
if (!has('clean')) u.searchParams.set('debug', ''); // --clean = без debug панел
const hash = new URLSearchParams();
if (opt('style')) hash.set('style', opt('style'));
if (opt('time')) hash.set('time', opt('time'));
if (opt('weather')) hash.set('weather', opt('weather'));
u.hash = hash.toString();
await page.goto(u.toString());
await page.waitForFunction(() => window.__bitola?.ready, null, { timeout: 120000 });
const wall = Date.now() - t0;
// без CSS анимации (софтверското рендерирање е премногу бавно за нив)
await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });

for (const v of views) {
  if (VIEWS[v]) {
    await page.evaluate((view) => {
      const app = window.__bitolaApp;
      app.setView({ ...view, target: { x: view.target.x, z: view.target.z } });
    }, VIEWS[v]);
  }
  await page.waitForTimeout(2500);
  const file = `${out}/${mobile ? 'mobile-' : ''}${opt('style') ? opt('style') + '-' : ''}${opt('time') ? opt('time') + '-' : ''}${opt('weather') ? opt('weather') + '-' : ''}${v}.png`;
  await page.screenshot({ path: file, timeout: 180000 });
  console.log(`screenshot: ${file}`);
}
await page.waitForTimeout(1500);
const stats = await page.evaluate(() => window.__bitola);
console.log(JSON.stringify({ wallMs: wall, ...stats }));
for (const l of logs) if (!l.includes('[bitola]')) console.log(l);
await browser.close();
