#!/usr/bin/env node
// Бенчмарк на изведбата преку Playwright: ја отвора мапата со ?bench, чека извештај,
// го печати како табела, го снима како JSON и (по желба) го споредува со основа.
//
//   node scripts/dev/bench.mjs [--suite quick|standard|ablation] [--url http://127.0.0.1:5173/]
//        [--styles razglednica,crtan] [--gpu] [--uncapped] [--mobile] [--width 720 --height 450 --scale 1]  (со --gpu: 1440×900)
//        [--frames N --warmup N --ms N] [--out docs/perf/results] [--label име]
//        [--baseline docs/perf/baseline-swiftshader.json] [--check]
//   node scripts/dev/bench.mjs --compare стар.json нов.json [--check]
//
// Без --gpu: headless Chromium со SwiftShader (софтверски) — времињата НЕ се репрезентативни,
//   но структурата на кадарот (повици, триаголници, програми) е точна → проверка за регресии.
// Со --gpu: видлив прозорец со вистинскиот GPU (за мерење на сопствена машина).
//   --uncapped ги исклучува vsync и лимитот на кадри — fps тогаш ја покажува вистинската резерва.
// --check: излез 1 ако има регресија > 10 % во однос на основата (структура; времиња само за ист GPU).

import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { formatReport, compareReports } from '../../src/perf/report.js';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const has = (n) => args.includes(`--${n}`);
const check = has('check');

function printCompare(base, next) {
  const { lines, regressions } = compareReports(base, next);
  console.log('\n' + lines.join('\n'));
  if (regressions.length) {
    console.log(`\nРегресии (> 10 %):\n  ${regressions.join('\n  ')}`);
    if (check) process.exitCode = 1;
  } else console.log('\nНема регресии.');
}

// ── само споредба ──
if (has('compare')) {
  const i = args.indexOf('--compare');
  const [a, b] = [args[i + 1], args[i + 2]];
  printCompare(JSON.parse(await readFile(a, 'utf8')), JSON.parse(await readFile(b, 'utf8')));
  process.exit();
}

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const gpu = has('gpu');
const mobile = has('mobile');
const suite = opt('suite', 'standard');
const out = opt('out', 'docs/perf/results');
// во SwiftShader кадарот трае и секунда — малку кадри се доволни за структурата
const frames = opt('frames', gpu ? null : '3');
const warmup = opt('warmup', gpu ? null : '1');
const ms = opt('ms', gpu ? null : '1');

const launchArgs = gpu
  ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', ...(has('uncapped') ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [])]
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: !gpu, args: launchArgs });
const context = mobile
  ? await browser.newContext({ ...devices['iPhone 13'] })
  : await browser.newContext({
      // SwiftShader: помал прозорец со ист однос (16:10) — структурата е иста, а е 4× побрзо
      viewport: { width: Number(opt('width', gpu ? 1440 : 720)), height: Number(opt('height', gpu ? 900 : 450)) },
      deviceScaleFactor: Number(opt('scale', 1)),
    });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const u = new URL(opt('url', 'http://127.0.0.1:5173/'));
u.searchParams.set('bench', suite);
if (opt('styles')) u.searchParams.set('styles', opt('styles'));
if (frames) u.searchParams.set('frames', frames);
if (warmup) u.searchParams.set('warmup', warmup);
if (ms) u.searchParams.set('ms', ms);
if (mobile) u.searchParams.set('profile', 'mobile');
u.hash = 'style=razglednica&time=day';

const t0 = Date.now();
await page.goto(u.toString());
let lastStep = '';
const timer = setInterval(async () => {
  const s = await page.evaluate(() => window.__bitolaBench && { step: window.__bitolaBench.step, p: window.__bitolaBench.progress }).catch(() => null);
  if (s && s.step !== lastStep) {
    lastStep = s.step;
    process.stdout.write(`  [${Math.round(s.p * 100)}%] ${s.step}\n`);
  }
}, 1000);
try {
  await page.waitForFunction(() => window.__bitolaBench?.done, null, { timeout: Number(opt('timeout', 45 * 60 * 1000)), polling: 1000 });
} finally {
  clearInterval(timer);
}
const report = await page.evaluate(() => window.__bitolaBench.report);
await browser.close();
// commit од работната копија (Vite го чита само при старт на dev серверот, а тој служи тековни фајлови)
try {
  const git = (c) => execSync(c, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  report.commit = git('git rev-parse --short HEAD') + (git('git status --porcelain -- src') ? '-dirty' : '');
} catch {
  // без git — останува тоа што го дал прелистувачот
}

console.log('\n' + formatReport(report));
console.log(`\n(вкупно ${Math.round((Date.now() - t0) / 1000)} s)`);
if (errors.length) console.log('Грешки во страницата:\n  ' + errors.join('\n  '));

await mkdir(out, { recursive: true });
const kind = report.env.software ? 'swiftshader' : 'gpu';
const label = opt('label', '');
const file = `${out}/${report.date.slice(0, 10)}-${report.commit || 'local'}-${suite}-${kind}${mobile ? '-mobile' : ''}${label ? '-' + label : ''}.json`;
await writeFile(file, JSON.stringify(report, null, 1) + '\n');
console.log(`\nизвештај: ${file}`);

const baseline = opt('baseline', mobile ? 'docs/perf/baseline-swiftshader-mobile.json' : 'docs/perf/baseline-swiftshader.json');
if (existsSync(baseline)) printCompare(JSON.parse(await readFile(baseline, 'utf8')), report);
else console.log(`(нема основа за споредба: ${baseline})`);
