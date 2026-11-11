// Време од денот: ден / зајдисонце / ноќ, со мек премин.
// Денот го дефинира стилот (style.light, sky, fog); зајдисонцето и ноќта се стандардни
// поставки што стилот може делумно да ги пребрише во style.times.{sunset,night}.

import * as THREE from 'three';

export const TIMES = [
  { id: 'day', name: 'Ден' },
  { id: 'sunset', name: 'Зајдисонце' },
  { id: 'night', name: 'Ноќ' },
];

const DEFAULTS = {
  sunset: {
    sun: { color: '#ffa865', intensity: 0.95, azimuth: 285, elevation: 10 }, // intensity = × денот
    // топло сонце + ладни (виолетови) сенки = контраст на „златниот час“
    hemi: { sky: '#aaa6cf', ground: '#5f5260', intensity: 0.8 }, // intensity = × денот
    sky: { top: '#7b8dc2', bottom: '#ffc187' },
    fog: { color: '#e9c2a8' },
    shadow: 0.6,
    exposure: 1.0,
  },
  night: {
    sun: { color: '#a8bbff', intensity: 0.32, azimuth: 150, elevation: 42 }, // месечина, апсолутно
    hemi: { sky: '#3b4c7c', ground: '#121621', intensity: 0.5 },
    sky: { top: '#050914', bottom: '#1b2646' },
    fog: { color: '#18213a' },
    shadow: 0.45,
    exposure: 1.1,
  },
};

const DURATION = 1600; // ms

export function createTime(initial = 'day') {
  const w = { day: 0, sunset: 0, night: 0 };
  w[initial] = 1;
  let from = { ...w };
  let to = { ...w };
  let t0 = -1;
  let mode = initial;
  return {
    get mode() {
      return mode;
    },
    weights: w,
    set(id, animate = true) {
      if (!(id in w) || id === mode) return;
      mode = id;
      from = { ...w };
      to = { day: 0, sunset: 0, night: 0, [id]: 1 };
      t0 = animate ? performance.now() : -1;
      if (!animate) Object.assign(w, to);
    },
    /** Враќа true ако тежините се промениле (треба ново осветлување). */
    update() {
      if (t0 < 0) return false;
      const k = Math.min(1, (performance.now() - t0) / DURATION);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      for (const key in w) w[key] = from[key] + (to[key] - from[key]) * e;
      if (k >= 1) t0 = -1;
      return true;
    },
  };
}

const c1 = new THREE.Color();

function mixColors(entries, out) {
  out.setRGB(0, 0, 0);
  for (const [hex, wt] of entries) {
    if (!wt) continue;
    c1.set(hex);
    out.r += c1.r * wt;
    out.g += c1.g * wt;
    out.b += c1.b * wt;
  }
  return out;
}

/** Осветлување за стилот при дадени тежини { day, sunset, night }. */
export function resolveLighting(style, w, out = blank()) {
  const D = style.light;
  const S = merge(DEFAULTS.sunset, style.times?.sunset);
  const N = merge(DEFAULTS.night, style.times?.night);
  const day = {
    sun: D.sun,
    hemi: D.hemi,
    sky: style.sky,
    fog: style.fog,
    shadow: D.shadow ?? 1,
    exposure: D.exposure ?? 1,
  };
  const sun = { ...S.sun, intensity: D.sun.intensity * S.sun.intensity };
  const hemi = { ...S.hemi, intensity: D.hemi.intensity * S.hemi.intensity };
  const sunset = { ...S, sun, hemi };
  const P = [
    [day, w.day],
    [sunset, w.sunset],
    [N, w.night],
  ];
  const sum = (f) => P.reduce((a, [p, wt]) => a + f(p) * wt, 0);
  mixColors(P.map(([p, wt]) => [p.sun.color, wt]), out.sun.color);
  out.sun.intensity = sum((p) => p.sun.intensity);
  out.sun.azimuth = sum((p) => p.sun.azimuth);
  out.sun.elevation = sum((p) => p.sun.elevation);
  mixColors(P.map(([p, wt]) => [p.hemi.sky, wt]), out.hemi.sky);
  mixColors(P.map(([p, wt]) => [p.hemi.ground, wt]), out.hemi.ground);
  out.hemi.intensity = sum((p) => p.hemi.intensity);
  mixColors(P.map(([p, wt]) => [p.sky.top, wt]), out.sky.top);
  mixColors(P.map(([p, wt]) => [p.sky.bottom, wt]), out.sky.bottom);
  mixColors(P.map(([p, wt]) => [p.fog.color, wt]), out.fog.color);
  out.shadow = sum((p) => p.shadow);
  out.exposure = sum((p) => p.exposure);
  // светилките се палат уште на зајдисонце
  out.night = Math.min(1, w.night + w.sunset * 0.35);
  return out;
}

function blank() {
  return {
    sun: { color: new THREE.Color(), intensity: 1, azimuth: 0, elevation: 45 },
    hemi: { sky: new THREE.Color(), ground: new THREE.Color(), intensity: 1 },
    sky: { top: new THREE.Color(), bottom: new THREE.Color() },
    fog: { color: new THREE.Color() },
    shadow: 1,
    exposure: 1,
    night: 0,
  };
}

function merge(a, b) {
  if (!b) return a;
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = typeof b[k] === 'object' && !Array.isArray(b[k]) ? { ...a[k], ...b[k] } : b[k];
  return out;
}
