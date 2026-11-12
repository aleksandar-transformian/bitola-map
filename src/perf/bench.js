// Бенчмарк во прелистувачот: ?bench[=quick|standard|ablation][&styles=a,b][&frames=120&warmup=45&ms=4000]
//
// Ги поминува истите сценарија секој пат (стил × време × поглед + лет низ градот), а потоа
// „аблација“: го исклучува делот по делот (дрвја, згради, сенки, пост-ефекти, DPR, MSAA) за да се
// види колку чини секој. Резултатот е JSON (window.__bitolaBench) + табела во панел со копчиња
// за копирање/снимање. Го користи и scripts/dev/bench.mjs (Playwright).
//
// Табот мора да остане видлив — скриен таб не црта кадри и мерењето застанува.

import { describeEnv } from './perf.js';
import { summarize, over } from './stats.js';
import { checkBudgets, formatReport } from './report.js';
import { JANK_MS } from '../config/perf.js';
import { STYLES } from '../styles/index.js';

const SUITES = {
  // брза проверка: сите стилови, дење, преглед и улица + лет
  quick: { day: ['pregled', 'shirok-sokak'], night: [], fly: true, ablation: false },
  standard: { day: ['pregled', 'center', 'shirok-sokak', 'close', 'top'], night: ['pregled', 'shirok-sokak'], fly: true, ablation: true },
  ablation: { day: [], night: [], fly: false, ablation: true },
};
const ABLATION_VIEW = 'center';
const FLY = ['pregled', 'center', 'shirok-sokak', 'herakleja'];
const FLY_MS = 2500;

const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

export async function startBench(app) {
  const qs = new URLSearchParams(location.search);
  const suiteId = SUITES[qs.get('bench')] ? qs.get('bench') : 'standard';
  // сите стилови од регистарот (или ?styles=razglednica,crtan)
  const pick = (qs.get('styles') || '').split(',').filter((id) => STYLES.some((st) => st.id === id));
  const suite = { ...SUITES[suiteId], styles: pick.length ? pick : STYLES.map((st) => st.id) };
  const params = {
    frames: Number(qs.get('frames')) || 120,
    warmup: Number(qs.get('warmup')) || 45,
    maxMs: Number(qs.get('ms')) || 4000,
  };
  const ui = createPanel(app.uiRoot);
  const { perf, pipeline, world, renderer } = app;
  const state = { done: false, progress: 0, step: '' };
  window.__bitolaBench = state;

  // ── помошни ──
  const nextFrames = (n) =>
    new Promise((resolve) => {
      let k = 0;
      const off = perf.subscribe({
        cpu() {
          if (++k >= n) {
            off();
            resolve();
          }
        },
      });
    });
  /** n кадри или maxMs, што ќе дојде прво (барем min кадри). */
  const framesOrTime = (n, maxMs, min = 3) =>
    new Promise((resolve) => {
      let k = 0;
      const t0 = performance.now();
      const off = perf.subscribe({
        cpu() {
          k++;
          if (k >= n || (k >= min && performance.now() - t0 >= maxMs)) {
            off();
            resolve();
          }
        },
      });
    });
  /** Кадри додека не важи cond() (најмногу max). */
  const framesUntil = (cond, max) =>
    new Promise((resolve) => {
      let k = 0;
      if (cond()) return resolve();
      const off = perf.subscribe({
        cpu() {
          if (cond() || ++k >= max) {
            off();
            resolve();
          }
        },
      });
    });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // дали тајмерот воопшто враќа резултати (SwiftShader ја нуди екстензијата, но не мери)
  let gpuSeen = 0;
  let measured = 0;
  perf.subscribe({ gpu: (tag) => (gpuSeen = Math.max(gpuSeen, tag)) });
  const settle = () => framesOrTime(params.warmup, Math.min(1500, params.maxMs), 2);

  const quality = app.quality;
  const auto = quality.mode === 'auto';
  async function measure(id, meta, run) {
    await settle();
    // „авто“: почекај нивото да се смири (инаку се мери преминот, не состојбата)
    if (auto) await framesUntil(() => quality.stable, 1200);
    const interval = [];
    const cpu = [];
    const phases = {};
    const gpu = [];
    const passes = {};
    const start = perf.frame + 1;
    let end = Infinity;
    let lastGpuTag = 0;
    const off = perf.subscribe({
      cpu(f) {
        if (f.frame < start || f.frame > end) return;
        if (f.interval) interval.push(f.interval);
        cpu.push(f.cpu.total);
        for (const k in f.cpu) if (k !== 'total') (phases[k] ||= []).push(f.cpu[k]);
      },
      gpu(tag, laps, total) {
        lastGpuTag = Math.max(lastGpuTag, tag);
        if (tag < start || tag > end) return;
        gpu.push(total);
        for (const k in laps) (passes[k] ||= []).push(laps[k]);
      },
    });
    const t0 = performance.now();
    if (run) await run();
    else await framesOrTime(params.frames, params.maxMs);
    end = perf.frame;
    const seconds = (performance.now() - t0) / 1000;
    const info = renderer.info.render;
    const calls = info.calls;
    const triangles = info.triangles;
    // GPU резултатите доаѓаат со задоцнување од неколку кадри
    if (perf.gpu && (gpuSeen || !measured)) await framesUntil(() => lastGpuTag >= end, 12);
    measured++;
    off();
    const m = mean(interval);
    return {
      id,
      ...meta,
      frames: cpu.length,
      seconds: r2(seconds),
      fps: m ? r2(1000 / m) : null,
      interval: summarize(interval),
      jankPct: over(interval, JANK_MS),
      cpu: { total: summarize(cpu), phases: Object.fromEntries(Object.entries(phases).map(([k, v]) => [k, r2(mean(v))])) },
      gpu: gpu.length
        ? { total: summarize(gpu), passes: Object.fromEntries(Object.entries(passes).map(([k, v]) => [k, { mean: r2(mean(v)), p95: summarize(v).p95 }])) }
        : null,
      calls,
      triangles,
      quality: quality.level,
    };
  }

  const switches = [];
  async function useStyle(id) {
    if (app.style === id) return;
    const t0 = performance.now();
    const applyMs = app.setStyle(id, { animate: false, remember: false });
    await nextFrames(1); // првиот кадар го компајлира шејдерите
    switches.push({ to: id, applyMs, hitchMs: Math.round(performance.now() - t0) });
  }

  // ── аблација ──
  const hide = (...objs) => {
    for (const o of objs) o.visible = false;
    return () => objs.forEach((o) => (o.visible = true));
  };
  const disable = (passes) => {
    const on = passes.filter((p) => p.enabled);
    for (const p of on) p.enabled = false;
    return () => on.forEach((p) => (p.enabled = true));
  };
  const setDpr = (r) => {
    const old = pipeline.size.dpr;
    pipeline.setPixelRatio(r);
    return () => pipeline.setPixelRatio(old);
  };
  const setMsaa = (n) => {
    const old = pipeline.msaa;
    pipeline.setMsaa(n);
    return () => pipeline.setMsaa(old);
  };
  const noShadows = () => {
    app.sun.castShadow = false;
    return () => (app.sun.castShadow = true);
  };
  const variants = () => {
    const dpr = pipeline.size.dpr;
    const list = [
      ['без дрвја', () => hide(world.trees)],
      ['без згради', () => hide(world.buildings)],
      ['без знаменитости', () => hide(world.landmarks)],
      ['без релјеф', () => hide(world.terrain, world.skirt)],
      ['без улици и вода', () => hide(world.roads, world.rail, world.water)],
    ];
    if (app.sun.castShadow) list.push(['без сенки', noShadows]);
    if (pipeline.stylePasses.length) list.push(['без пост-ефекти', () => disable(pipeline.stylePasses)]);
    for (const name of new Set(pipeline.stylePasses.map((p) => p.perfName))) {
      if (name) list.push([`без ${name}`, () => disable(pipeline.stylePasses.filter((p) => p.perfName === name))]);
    }
    if (dpr > 1.5) list.push(['DPR 1.5', () => setDpr(1.5)]);
    if (dpr > 1) list.push(['DPR 1', () => setDpr(1)]);
    if (pipeline.msaa > 0) list.push(['без MSAA', () => setMsaa(0)]);
    // замаглувањето зад панелите го прави композиторот на прелистувачот (не се гледа во GPU
    // тајмерот на WebGL) — разликата се гледа само во интервалот меѓу кадри
    list.push([
      'без blur зад панелите',
      () => {
        document.documentElement.classList.add('perf-no-blur');
        return () => document.documentElement.classList.remove('perf-no-blur');
      },
    ]);
    list.push([
      'минимум (без сенки, пост, MSAA; DPR 1)',
      () => {
        const undo = [app.sun.castShadow ? noShadows() : null, disable(pipeline.stylePasses), dpr > 1 ? setDpr(1) : null, pipeline.msaa ? setMsaa(0) : null];
        return () => undo.reverse().forEach((u) => u?.());
      },
    ]);
    return list;
  };

  // ── план ──
  const plan = [];
  for (const style of suite.styles) {
    for (const v of suite.day) plan.push({ style, time: 'day', view: v });
    for (const v of suite.night) plan.push({ style, time: 'night', view: v });
    if (suite.fly) plan.push({ style, time: 'day', view: 'let', fly: true });
    // аблацијата бара фиксен квалитет (во „авто“ нивото би се менувало под неа)
    if (suite.ablation && !auto) plan.push({ style, time: 'day', view: ABLATION_VIEW, ablation: true });
  }
  const total = plan.reduce((n, p) => n + (p.ablation ? variants().length + 1 : 1), 0);
  let doneSteps = 0;
  const step = (label) => {
    state.step = label;
    state.progress = doneSteps / total;
    ui.progress(label, doneSteps, total);
  };

  const original = { style: app.style, time: app.time, view: app.getView(), dpr: pipeline.size.dpr };
  const scenarios = [];
  const ablation = [];
  for (const p of plan) {
    await useStyle(p.style);
    app.setTime(p.time, false);
    const meta = { style: p.style, time: p.time, view: p.view };
    if (p.fly) {
      step(`${p.style} · лет низ градот`);
      app.setView(app.places.get(FLY[0]));
      scenarios.push(
        await measure(`${p.style}/${p.time}/let`, meta, async () => {
          for (const id of FLY.slice(1)) {
            app.flyTo(app.places.get(id), FLY_MS);
            await wait(FLY_MS + 50);
          }
        }),
      );
      doneSteps++;
      continue;
    }
    app.setView(app.places.get(p.view));
    const id = `${p.style}/${p.time}/${p.view}`;
    step(id);
    const base = await measure(id, meta);
    doneSteps++;
    if (!p.ablation) {
      scenarios.push(base);
      continue;
    }
    // цена: GPU време ако го има, инаку интервалот меѓу кадри (тоа што го гледа корисникот)
    const key = (s) => (s.gpu ? s.gpu.total.mean : s.interval.mean);
    ablation.push({ base: id, variant: 'основа', ms: key(base), delta: null, deltaPct: null, triangles: base.triangles, calls: base.calls, interval: base.interval.p50, cpu: base.cpu.total.mean });
    for (const [name, apply] of variants()) {
      step(`${id} — ${name}`);
      const undo = apply();
      const s = await measure(`${id}/${name}`, meta);
      undo();
      const d = key(base) - key(s);
      ablation.push({ base: id, variant: name, ms: key(s), delta: r2(d), deltaPct: r2((d / key(base)) * 100), triangles: s.triangles, calls: s.calls, interval: s.interval.p50, cpu: s.cpu.total.mean });
      doneSteps++;
    }
  }

  // врати како што беше
  if (pipeline.size.dpr !== original.dpr) pipeline.setPixelRatio(original.dpr);
  await useStyle(original.style);
  switches.pop(); // враќањето не е дел од мерењето
  app.setTime(original.time, false);
  app.setView(original.view);

  const info = renderer.info;
  const report = {
    schema: 1,
    app: 'bitola-map',
    commit: typeof __COMMIT__ !== 'undefined' ? __COMMIT__ : null,
    date: new Date().toISOString(),
    suite: suiteId,
    params,
    profile: app.profile.name,
    gpuTimer: !!perf.gpu && scenarios.some((s) => s.gpu),
    quality: { mode: quality.mode, ladder: quality.ladder },
    env: describeEnv(renderer, pipeline),
    load: { dataMs: app.stats.dataMs, buildMs: app.stats.buildMs, styleMs: app.stats.styleMs, firstFrameMs: app.stats.firstFrameMs },
    memory: {
      programs: info.programs?.length ?? null,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      jsHeapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null,
    },
    scenarios,
    ablation,
    switches,
  };
  report.budgets = checkBudgets(report);
  const text = formatReport(report);
  console.info('[bench]', JSON.stringify(report));
  ui.done(report, text);
  Object.assign(state, { done: true, progress: 1, step: 'готово', report, text });
  return report;
}

// ── панел ──
function createPanel(root) {
  const el = document.createElement('aside');
  el.className = 'bench';
  el.innerHTML = `
    <h2>Мерење на изведбата</h2>
    <p class="bench-step">Се подготвува…</p>
    <div class="bar"><span></span></div>
    <p class="bench-note">Не менувај таб и не движи ја мапата додека трае мерењето.</p>
    <pre class="bench-out" hidden></pre>
    <div class="bench-actions" hidden>
      <button type="button" data-act="copy">Копирај JSON</button>
      <button type="button" data-act="save">Сними JSON</button>
      <button type="button" data-act="close">Затвори</button>
    </div>`;
  root.appendChild(el);
  const $ = (s) => el.querySelector(s);
  return {
    progress(label, k, n) {
      $('.bench-step').textContent = `${Math.min(k + 1, n)}/${n}: ${label}`;
      $('.bar span').style.width = `${Math.min(100, Math.round((k / n) * 100))}%`;
    },
    done(report, text) {
      $('.bench-step').textContent = 'Готово.';
      $('.bar').remove();
      $('.bench-note').textContent = 'Сними го JSON-от и додај го во docs/perf/results/ (или испрати го).';
      $('.bench-out').hidden = false;
      $('.bench-out').textContent = text;
      $('.bench-actions').hidden = false;
      const json = JSON.stringify(report, null, 1);
      el.addEventListener('click', async (e) => {
        const act = e.target.dataset?.act;
        if (act === 'copy') {
          try {
            await navigator.clipboard.writeText(json);
            e.target.textContent = 'Копирано ✓';
          } catch {
            e.target.textContent = 'Не успеа — сними го';
          }
        } else if (act === 'save') {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
          a.download = `bitola-bench-${report.date.slice(0, 10)}-${report.suite}.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        } else if (act === 'close') el.remove();
      });
    },
  };
}
