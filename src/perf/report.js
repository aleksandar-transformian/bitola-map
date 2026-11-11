// Извештај од бенчмаркот: проверка на буџетите, табела како текст и споредба на два извештаја.
// Без DOM — го користат и прелистувачот (perf/bench.js) и Node (scripts/dev/bench.mjs).

import { BUDGETS } from '../config/perf.js';

const f1 = (v) => (v == null ? '—' : Number(v).toFixed(1));
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
const mtri = (v) => (v == null ? '—' : (v / 1e6).toFixed(2) + 'M');

/** Проверка на буџетите → [{ id, metric, value, limit, ok }]. Времињата само со вистински GPU. */
export function checkBudgets(report) {
  const out = [];
  const add = (id, metric, value, limit) => value != null && out.push({ id, metric, value, limit, ok: value <= limit });
  const frame = BUDGETS.frame[report.profile] || BUDGETS.frame.desktop;
  const timed = !report.env.software;
  for (const s of report.scenarios) {
    add(s.id, 'calls', s.calls, frame.calls);
    add(s.id, 'triangles', s.triangles, frame.triangles);
    if (!timed) continue;
    add(s.id, 'interval p50', s.interval.p50, BUDGETS.time.intervalP50);
    add(s.id, 'interval p95', s.interval.p95, BUDGETS.time.intervalP95);
    add(s.id, 'jank %', s.jankPct, BUDGETS.time.jankPct);
    add(s.id, 'cpu p95', s.cpu.total.p95, BUDGETS.time.cpuP95);
    if (s.gpu) add(s.id, 'gpu p95', s.gpu.total.p95, BUDGETS.time.gpuP95);
  }
  add('сцена', 'programs', report.memory?.programs, frame.programs);
  if (timed) {
    add('вчитување', 'first frame ms', report.load?.firstFrameMs, BUDGETS.load.firstFrameMs);
    for (const w of report.switches || []) add(`смена → ${w.to}`, 'hitch ms', w.hitchMs, BUDGETS.load.switchHitchMs);
  }
  return out;
}

/** Најскапите пасови по GPU (средно ms), опаѓачки. */
function topPasses(gpu, n = 3) {
  if (!gpu?.passes) return '';
  return Object.entries(gpu.passes)
    .sort((a, b) => b[1].mean - a[1].mean)
    .slice(0, n)
    .map(([k, v]) => `${k} ${f1(v.mean)}`)
    .join(' · ');
}

/** Целиот извештај како текстуална табела. */
export function formatReport(r) {
  const L = [];
  const e = r.env;
  L.push(`Битола — мерење на изведбата (${r.suite}) · ${r.date.slice(0, 16).replace('T', ' ')} · ${r.commit || 'без commit'}`);
  L.push(`GPU: ${e.gpu}${e.software ? '  (софтверски — времињата НЕ се репрезентативни)' : ''}`);
  L.push(`профил ${r.profile} · ${e.canvas.cssW}×${e.canvas.cssH} @ DPR ${e.canvas.dpr} = ${e.canvas.pxW}×${e.canvas.pxH} (${e.canvas.megapixels} MP) · MSAA ${e.msaa}× · GPU тајмер: ${r.gpuTimer ? 'да' : 'не'}`);
  L.push(`вчитување: податоци ${r.load.dataMs} ms · градење ${r.load.buildMs} ms · прв кадар ${r.load.firstFrameMs} ms · програми ${r.memory.programs} · геометрии ${r.memory.geometries} · текстури ${r.memory.textures}${r.memory.jsHeapMB ? ` · JS heap ${r.memory.jsHeapMB} MB` : ''}`);
  L.push('');
  L.push(`${pad('сценарио', 34)}${lpad('fps', 6)}${lpad('кадар p50', 11)}${lpad('p95', 7)}${lpad('сецк.%', 8)}${lpad('CPU p95', 9)}${lpad('GPU p50', 9)}${lpad('p95', 7)}${lpad('повици', 8)}${lpad('триаг.', 8)}  најскапо (GPU ms)`);
  for (const s of r.scenarios) {
    L.push(
      `${pad(s.id, 34)}${lpad(f1(s.fps), 6)}${lpad(f1(s.interval.p50), 11)}${lpad(f1(s.interval.p95), 7)}${lpad(f1(s.jankPct), 8)}${lpad(f1(s.cpu.total.p95), 9)}${lpad(f1(s.gpu?.total.p50), 9)}${lpad(f1(s.gpu?.total.p95), 7)}${lpad(s.calls, 8)}${lpad(mtri(s.triangles), 8)}  ${topPasses(s.gpu)}`,
    );
  }
  if (r.ablation?.length) {
    L.push('');
    const soft = r.env.software;
    L.push(`Цена на деловите (аблација; ${soft ? 'SwiftShader — само структура' : r.gpuTimer ? 'GPU средно ms' : 'интервал меѓу кадри, средно ms'}; Δ = колку чини делот):`);
    L.push(`${pad('основа / варијанта', 52)}${lpad('ms', 8)}${lpad('Δ ms', 8)}${lpad('Δ %', 7)}${lpad('кадар', 8)}${lpad('повици', 8)}${lpad('триаг.', 9)}`);
    for (const a of r.ablation) {
      L.push(
        `${pad(`${a.base} / ${a.variant}`, 52)}${lpad(soft ? '—' : f1(a.ms), 8)}${lpad(a.delta == null || soft ? '' : f1(a.delta), 8)}${lpad(a.deltaPct == null || soft ? '' : f1(a.deltaPct), 7)}${lpad(soft ? '—' : f1(a.interval), 8)}${lpad(a.calls ?? '', 8)}${lpad(mtri(a.triangles), 9)}`,
      );
    }
  }
  if (r.switches?.length) {
    L.push('');
    L.push('Смена на стил: ' + r.switches.map((w) => `→ ${w.to}: ${w.applyMs} ms + прв кадар ${w.hitchMs} ms`).join(' · '));
  }
  const b = r.budgets || [];
  const bad = b.filter((x) => !x.ok);
  L.push('');
  L.push(`Буџети: ${b.length - bad.length}/${b.length} во ред${e.software ? ' (времињата не се проверуваат во SwiftShader)' : ''}`);
  for (const x of bad.slice(0, 40)) L.push(`  ✗ ${x.id}: ${x.metric} = ${typeof x.value === 'number' && x.value > 1e5 ? mtri(x.value) : f1(x.value)} (буџет ${x.limit > 1e5 ? mtri(x.limit) : x.limit})`);
  if (bad.length > 40) L.push(`  … уште ${bad.length - 40}`);
  return L.join('\n');
}

/**
 * Споредба на два извештаја по сценарио. Структурата (повици, триаголници) се споредува секогаш;
 * времињата само ако двата се од ист (вистински) GPU.
 * @returns {{ lines: string[], regressions: string[] }}
 */
export function compareReports(base, next, { tolerance = 0.1 } = {}) {
  const lines = [];
  const regressions = [];
  const sameGpu = !base.env.software && !next.env.software && base.env.gpu === next.env.gpu && base.env.canvas.dpr === next.env.canvas.dpr;
  const byId = new Map(base.scenarios.map((s) => [s.id, s]));
  lines.push(`споредба: ${base.commit || base.date} → ${next.commit || next.date}${sameGpu ? ' (ист GPU — и времиња)' : ' (само структура)'}`);
  for (const s of next.scenarios) {
    const o = byId.get(s.id);
    if (!o) continue;
    const parts = [];
    const cmp = (label, a, b, fmt = f1) => {
      if (a == null || b == null) return;
      const d = a ? (b - a) / a : 0;
      parts.push(`${label} ${fmt(a)}→${fmt(b)} (${d >= 0 ? '+' : ''}${(d * 100).toFixed(0)}%)`);
      if (d > tolerance) regressions.push(`${s.id}: ${label} ${fmt(a)} → ${fmt(b)}`);
    };
    cmp('повици', o.calls, s.calls, String);
    cmp('триаг.', o.triangles, s.triangles, mtri);
    if (sameGpu) {
      cmp('GPU p50', o.gpu?.total.p50, s.gpu?.total.p50);
      cmp('кадар p95', o.interval.p95, s.interval.p95);
    }
    lines.push(`  ${pad(s.id, 34)} ${parts.join(' · ')}`);
  }
  return { lines, regressions };
}
