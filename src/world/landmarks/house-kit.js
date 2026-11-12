// Заеднички делови за детални фасади според фотографии (Магнолија, западно кон Саат Кула):
// прозорци, балкони, ѕидни светилки, појаси, рабови на основата, тело на зградата, градење по OSM id.
//
// Рамка на раб: u = по работ, v = нанадвор од ѕидот (v = 0 е рамнината на ѕидот), y = над подлогата.

import * as THREE from 'three';
import { Kit } from './kit.js';
import { buildingShape, shell, Writer } from '../buildings.js';
import { pointInRing } from '../geom2d.js';

// ─────────────────────────── примитиви за фасада ───────────────────────────

/** Профил на прозорец/отвор: правоаголник со (опционален) лак горе. */
export function openingShape(w, h, arch) {
  const hw = w / 2;
  const s = new THREE.Shape();
  if (arch === 'round') {
    const sp = h - hw;
    s.moveTo(-hw, 0);
    s.lineTo(hw, 0);
    s.lineTo(hw, sp);
    s.absarc(0, sp, hw, 0, Math.PI, false);
    s.lineTo(-hw, 0);
  } else if (arch === 'pointed') {
    // зашилен (готски) лак: два лака со радиус w, центри на спротивните почетоци
    const sp = h - w * 0.866;
    s.moveTo(-hw, 0);
    s.lineTo(hw, 0);
    s.lineTo(hw, sp);
    const n = 8;
    for (let i = 1; i <= n; i++) {
      const a = (i / n) * (Math.PI / 3);
      s.lineTo(-hw + w * Math.cos(a), sp + w * Math.sin(a));
    }
    for (let i = n - 1; i >= 0; i--) {
      const a = (i / n) * (Math.PI / 3);
      s.lineTo(hw - w * Math.cos(a), sp + w * Math.sin(a));
    }
    s.lineTo(-hw, 0);
  } else {
    s.moveTo(-hw, 0);
    s.lineTo(hw, 0);
    s.lineTo(hw, h);
    s.lineTo(-hw, h);
    s.lineTo(-hw, 0);
  }
  return s;
}

/** Плоча по профил, истисната нанадвор (v од v0 до v0 + d). */
export function plate(kit, shape, u, y, v0, d, part, glow) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 8 });
  kit.add(g, Kit.at(u, y, v0), part, glow);
}

/** Детерминистички „случај“ (0–1). */
export function rnd(a, b) {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Прозорец: рамка + стакло (свети ноќе) + крст од пречки + подпрозорник.
 * o: { arch, frame, sill, bars, shutter (дел за ролетна горе), hood (дел за натпрозорник) }
 */
export function windowAt(kit, u, y, w, h, o = {}) {
  const frame = o.frame || 'accent';
  const v = o.v || 0;
  const lit = rnd(u * 3.1 + y, w) < (o.lit ?? 0.7);
  plate(kit, openingShape(w + 0.26, h + 0.2, o.arch), u, y - 0.1, v, 0.1, frame);
  // големите излози светат помеко (инаку се рамни светли плочи ноќе)
  const glow = lit ? (w * h > 4 ? 0.45 : 0.8) : 0;
  plate(kit, openingShape(w, h, o.arch), u, y, v + 0.1, 0.03, 'window', glow);
  if (o.shutter) kit.box(u, y + h * 0.62, v + 0.135, w, h * 0.38 - (o.arch ? w / 2 : 0.02), 0.02, o.shutter);
  if (o.bars !== false) {
    kit.box(u, y, v + 0.14, 0.06, h - (o.arch ? w * 0.4 : 0), 0.03, frame);
    kit.box(u, y + h * 0.58, v + 0.14, w, 0.06, 0.03, frame);
  }
  if (o.sill !== false) kit.box(u, y - 0.16, v + 0.12, w + 0.5, 0.1, 0.25, o.sillPart || frame);
  if (o.hood) kit.box(u, y + h + 0.12, v + 0.14, w + 0.6, 0.18, 0.28, o.hood);
}

/** Балкон: плоча, конзоли, огради (столбчиња) со рачка. */
export function balcony(kit, u, y, w, d, { slab = 'stone', rail = 'metal', h = 1.0, step = 0.16, solid = false } = {}) {
  kit.box(u, y - 0.18, d / 2, w, 0.18, d, slab);
  for (const s of [-1, 1]) kit.box(u + s * (w / 2 - 0.2), y - 0.6, 0.2, 0.14, 0.42, 0.4, slab);
  if (solid) {
    // зидана балустрада: ниски столбчиња + плоча горе
    for (let x = -w / 2 + 0.12; x <= w / 2 - 0.1; x += 0.24) kit.cylinder(u + x, y, d - 0.12, 0.06, h - 0.12, rail, { seg: 6, top: 0.045 });
    kit.box(u, y + h - 0.12, d - 0.12, w, 0.12, 0.2, rail);
    return;
  }
  kit.box(u, y + h - 0.05, d - 0.04, w, 0.05, 0.05, rail);
  kit.box(u, y + 0.08, d - 0.04, w, 0.04, 0.04, rail);
  for (let x = -w / 2; x <= w / 2 + 1e-3; x += step) kit.box(u + x, y, d - 0.04, 0.025, h, 0.025, rail);
  for (const s of [-1, 1]) {
    kit.box(u + s * (w / 2), y + h - 0.05, d / 2, 0.05, 0.05, d, rail);
    for (let z = 0.15; z < d; z += step) kit.box(u + s * (w / 2), y, z, 0.025, h, 0.025, rail);
  }
}

/** Ѕидна светилка (фенер) со конзола — свети ноќе. */
export function wallLamp(kit, u, y) {
  kit.box(u, y, 0.2, 0.06, 0.06, 0.4, 'metal');
  kit.box(u, y - 0.42, 0.42, 0.24, 0.36, 0.24, 'light');
  kit.box(u, y - 0.06, 0.42, 0.3, 0.08, 0.3, 'metal');
}

/** Хоризонтален венец по целиот прстен (корниз, појас) — ги следи и заоблените агли. */
export function band(kit, ring, y0, y1, out, part) {
  kit.slab([grow(ring, out)], y0, y1, part);
}

/** Прстен поместен нанадвор за d (отсечки по нормалите, спојување на аглите). */
export function grow(ring, d) {
  const n = ring.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = ring[(i - 1 + n) % n];
    const c = ring[i];
    const q = ring[(i + 1) % n];
    const n1 = norm(c[0] - p[0], c[1] - p[1]);
    const n2 = norm(q[0] - c[0], q[1] - c[1]);
    let mx = n1[1] + n2[1];
    let mz = -n1[0] - n2[0];
    const l = Math.hypot(mx, mz) || 1;
    mx /= l;
    mz /= l;
    const k = Math.max(0.5, mx * n2[1] - mz * n2[0]);
    out.push([c[0] + (mx * d) / k, c[1] + (mz * d) / k]);
  }
  return out;
}
function norm(x, z) {
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
}

// ─────────────────────────── рабови на основата ───────────────────────────

/** Отворени рабови (без заеднички ѕид): рамка, должина, колку гледаат кон focus (−1…1). */
export function openEdges(ring, others, focus = null) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.5) continue;
    const tx = (b[0] - a[0]) / len;
    const tz = (b[1] - a[1]) / len;
    const nx = tz;
    const nz = -tx;
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const probe = [m[0] + nx * 1.2, m[1] + nz * 1.2];
    if (others.some((r) => pointInRing(probe, r))) continue;
    const fx = (focus ? focus[0] : m[0] + nx) - m[0];
    const fz = (focus ? focus[1] : m[1] + nz) - m[1];
    out.push({ i, a, b, len, m, nx, nz, face: (nx * fx + nz * fz) / (Math.hypot(fx, fz) || 1) });
  }
  return out;
}

export function frameOn(kit, e, y) {
  kit.setFrame(e.m[0], y, e.m[1], e.nz, -e.nx);
}

/** Тело на зградата: ѕидови по основата + рамен или кос покрив. */
export function body(kit, s, h, part, { pitched = false, roof = 'roof', top = 'stone' } = {}) {
  const W = new Writer();
  const R = new Writer();
  const isPitched = shell({ ...s, h, top: s.gmean + h }, pitched, W, R, 0);
  kit.raw(W.pos, W.nor, part);
  kit.raw(R.pos, R.nor, isPitched ? roof : top);
}

/** Прозорци на споредните отворени рабови (едноставно, по кат). */
export function plainWindows(kit, edges, floors, { spacing = 2.6, w = 1.0, h = 1.7, frame = 'accent', minLen = 2.4, skipMain = null } = {}) {
  for (const e of edges) {
    if (e === skipMain || e.len < minLen) continue;
    const n = Math.max(1, Math.floor(e.len / spacing));
    frameOn(kit, e, 0);
    for (let k = 0; k < n; k++) {
      const u = -e.len / 2 + (e.len * (k + 0.5)) / n;
      for (const y of floors) windowAt(kit, u, y, w, h, { frame, sill: false, bars: e.len > 4 });
    }
  }
}

// ─────────────────────────── геометрија на основата ───────────────────────────

/** Отсечи прстен со полурамнина x ≤ x0 (keep = -1) или x ≥ x0 (keep = 1). */
export function clipX(ring, x0, keep) {
  const out = [];
  const inside = (p) => (p[0] - x0) * keep >= 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) {
      const t = (x0 - a[0]) / (b[0] - a[0]);
      out.push([x0, a[1] + (b[1] - a[1]) * t]);
    }
  }
  // отстрани двојни точки и точки на права (по сечењето по вертикален раб на основата)
  let r = out.filter((p, i) => {
    const q = out[(i + 1) % out.length];
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05;
  });
  return simplify(r);
}

/** Отстрани точки што се (речиси) на права меѓу соседите (sin на аголот < tol). */
export function simplify(ring, tol = 0.02) {
  let r = ring;
  for (let changed = true; changed && r.length > 3; ) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i - 1 + r.length) % r.length];
      const p = r[i];
      const b = r[(i + 1) % r.length];
      const l1 = Math.hypot(p[0] - a[0], p[1] - a[1]);
      const l2 = Math.hypot(b[0] - p[0], b[1] - p[1]);
      const cross = (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]);
      if (l1 < 1e-6 || l2 < 1e-6 || Math.abs(cross) / (l1 * l2) < tol) {
        r = r.filter((_, k) => k !== i);
        changed = true;
        break;
      }
    }
  }
  return r;
}

/** Закосен раб: од прстенот на y0 до прстенот вовлечен за inset на y0 + h, со капак горе. */
export function chamfer(kit, ring, y0, h, inset, part) {
  const inner = grow(ring, -inset);
  const pos = [];
  const nor = [];
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const a = ring[i];
    const b = ring[j];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-3) continue;
    const nx = (b[1] - a[1]) / len;
    const nz = -(b[0] - a[0]) / len;
    const l = Math.hypot(h, inset);
    const n = [(nx * h) / l, inset / l, (nz * h) / l];
    const A = [a[0], y0, a[1]];
    const B = [b[0], y0, b[1]];
    const C = [inner[j][0], y0 + h, inner[j][1]];
    const D = [inner[i][0], y0 + h, inner[i][1]];
    for (const p of [A, B, C, A, C, D]) {
      pos.push(...p);
      nor.push(...n);
    }
  }
  kit.raw(pos, nor, part);
  kit.slab([inner], y0 + h - 0.05, y0 + h, 'stone');
}

// ─────────────────────────── градење по OSM id ───────────────────────────

/**
 * Изгради ги зградите од листата { osm, build } (ги додава во ctx.skip — обичниот слој не ги
 * црта). build(kit, shape, openEdges, gmean, othersRings) — рамката е светот (u/v по раб).
 * @param {{focus?: number[], tag?: string}} o  focus = точка кон која гледаат главните фасади
 * @returns {Set<number>} индекси на изградените згради
 */
export function buildHouses(kit, ctx, houses, { focus = null, tag = 'houses' } = {}) {
  const pack = ctx.buildings;
  const ids = pack.arrays.osmId;
  const want = new Map(houses.map((h) => [h.osm, h]));
  const done = new Set();
  for (let b = 0; b < ids.length; b++) {
    const h = want.get(ids[b]);
    if (!h || ctx.skip.has(b)) continue;
    const s = buildingShape(pack, b);
    const others = neighbourRings(pack, b, 60);
    const edges = openEdges(s.rings[0], others, h.focus || focus);
    try {
      h.build(kit, s, edges, s.gmean, others);
      ctx.skip.add(b);
      done.add(b);
    } catch (err) {
      console.warn(`[${tag}] w${h.osm}:`, err);
    }
    kit.setFrame(0, 0, 0);
  }
  return done;
}

/** Основите на соседните згради (во квадрат ±r околу првата точка на зградата b). */
export function neighbourRings(pack, b, r) {
  const q = pack.meta.q;
  const first = (k) => {
    const i = pack.arrays.ringPt[pack.arrays.polyRing[k]];
    return [pack.arrays.coords[i * 2] * q, pack.arrays.coords[i * 2 + 1] * q];
  };
  const [cx, cz] = first(b);
  const out = [];
  for (let o = 0; o < pack.meta.count; o++) {
    if (o === b) continue;
    const [x, z] = first(o);
    if (Math.abs(x - cx) < r && Math.abs(z - cz) < r) out.push(buildingShape(pack, o).rings[0]);
  }
  return out;
}
