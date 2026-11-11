// Мерење на изведбата во живо: интервал меѓу кадри, CPU време по фаза од јамката и
// GPU време по пас (ако прелистувачот има тајмер). Вклучено само со ?debug или ?bench —
// инаку сите функции се празни и не чинат ништо.
//
// Јамката:  perf.begin(now) → … perf.mark('update') → … perf.mark('render') → … perf.end('labels')
// Pipeline: GPU круговите ('scene', 'shadow', 'output', пасовите на стилот) — види pipeline.instrument.

import { createGpuTimer } from './gpu-timer.js';
import { Ring, summarize } from './stats.js';

const NOOP = { enabled: false, gpu: null, frame: 0, begin() {}, mark() {}, end() {}, subscribe: () => () => {}, live: () => null };

/** Опис на уредот и прелистувачот (за извештајот). */
export function describeEnv(renderer, pipeline) {
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
  const s = pipeline.size;
  return {
    ua: navigator.userAgent,
    gpu,
    vendor,
    software: /swiftshader|llvmpipe|software|basic render/i.test(gpu),
    cores: navigator.hardwareConcurrency || null,
    deviceMemory: navigator.deviceMemory || null,
    screen: { w: screen.width, h: screen.height, devicePixelRatio: window.devicePixelRatio },
    canvas: { cssW: s.width, cssH: s.height, dpr: s.dpr, pxW: Math.round(s.width * s.dpr), pxH: Math.round(s.height * s.dpr), megapixels: Math.round(s.width * s.height * s.dpr * s.dpr / 1e4) / 100 },
    msaa: pipeline.msaa,
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
  };
}

export function createPerf(renderer, { enabled = false } = {}) {
  if (!enabled) return NOOP;
  const gpu = createGpuTimer(renderer.getContext());
  const sinks = new Set();
  const N = 120; // ~2 s за HUD
  const live = { interval: new Ring(N), cpu: new Ring(N), gpu: new Ring(N), cpuPhases: new Map(), gpuPasses: new Map() };
  const ring = (map, k) => map.get(k) || map.set(k, new Ring(N)).get(k);

  let last = 0;
  let t0 = 0;
  let tm = 0;
  let cur = null;

  function onGpu(tag, laps, total) {
    live.gpu.push(total);
    for (const k in laps) ring(live.gpuPasses, k).push(laps[k]);
    for (const s of sinks) s.gpu?.(tag, laps, total);
  }

  return {
    enabled: true,
    gpu,
    frame: 0,
    begin(now) {
      this.frame++;
      if (gpu) gpu.tag = this.frame;
      cur = { frame: this.frame, interval: last ? now - last : 0, cpu: {} };
      last = now;
      t0 = tm = performance.now();
    },
    mark(name) {
      if (!cur) return;
      const t = performance.now();
      cur.cpu[name] = (cur.cpu[name] || 0) + (t - tm);
      tm = t;
    },
    end(name) {
      if (!cur) return;
      if (name) this.mark(name);
      cur.cpu.total = performance.now() - t0;
      if (cur.interval) live.interval.push(cur.interval);
      live.cpu.push(cur.cpu.total);
      for (const k in cur.cpu) if (k !== 'total') ring(live.cpuPhases, k).push(cur.cpu[k]);
      for (const s of sinks) s.cpu?.(cur);
      cur = null;
      gpu?.poll(onGpu);
    },
    /** sink = { cpu(frame), gpu(tag, laps, total) }; враќа функција за откажување. */
    subscribe(sink) {
      sinks.add(sink);
      return () => sinks.delete(sink);
    },
    /** Збир од последните ~2 s (за debug панелот). */
    live() {
      const by = (map) => Object.fromEntries([...map].map(([k, r]) => [k, summarize(r.values()).p50]));
      return {
        interval: summarize(live.interval.values()),
        cpu: summarize(live.cpu.values()),
        gpu: gpu ? summarize(live.gpu.values()) : null,
        cpuPhases: by(live.cpuPhases),
        gpuPasses: gpu ? by(live.gpuPasses) : null,
      };
    },
  };
}
