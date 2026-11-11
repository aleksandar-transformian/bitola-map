// Јавни згради со препознатлива архитектура (рачно моделирани според фотографии):
//   culturalCenter — Дом на културата (Смилевски и Мушич, 1976–1980):
//     двокатно приземје (темно стакло долу, сјајно бакарно горе), стреи од темен бакарен лим
//     што се шират надолу, рамни црвени покриви, скалести темни
//     волумени над салите, сценска кула и волумен со вдлабнато „седло“ на врвот.
//   gymnasium — Горна гимназија (1882/1892): неокласична фасада кон Драгор, кафеав камен
//     сутерен, три ката жолт малтер, бели пиластри, корнизи, рамки, лачни прозорци,
//     портал со скали и низок четиристрешен покрив со оџаци.
// Пропорциите се проценети од фотографии; позицијата и основата се од OSM.

import * as THREE from 'three';
import { Kit } from './kit.js';
import { obb, pointInRing } from '../geom2d.js';
import { buildingAt, largestInside } from './models.js';

// ───────────────────────── 2Д помошници ─────────────────────────

/** +1 ако (tz, −tx) е нормала нанадвор за рабовите на прстенот, инаку −1. */
function outSign(ring) {
  let bi = 0;
  let bl = -1;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > bl) [bl, bi] = [l, i];
  }
  const a = ring[bi];
  const b = ring[(bi + 1) % ring.length];
  const tx = (b[0] - a[0]) / bl;
  const tz = (b[1] - a[1]) / bl;
  const p = [(a[0] + b[0]) / 2 + tz * 0.2, (a[1] + b[1]) / 2 - tx * 0.2];
  return pointInRing(p, ring) ? -1 : 1;
}

/** Нормала нанадвор на работ a→b. */
function edgeNormal(a, b, s) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(s * (b[1] - a[1])) / l, (-s * (b[0] - a[0])) / l];
}

/** Прстен поместен нанадвор (d > 0) или навнатре (d < 0), со митра во аглите. */
function offsetRing(ring, d, s = outSign(ring)) {
  const n = ring.length;
  return ring.map((c, i) => {
    const n1 = edgeNormal(ring[(i - 1 + n) % n], c, s);
    const n2 = edgeNormal(c, ring[(i + 1) % n], s);
    let mx = n1[0] + n2[0];
    let mz = n1[1] + n2[1];
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml;
    mz /= ml;
    const k = 1 / Math.max(0.35, mx * n1[0] + mz * n1[1]);
    return [c[0] + mx * d * k, c[1] + mz * d * k];
  });
}

/** Локална точка (u, v) од рамката на OBB → светски (x, z). */
const toWorld = (f, u, v) => [f.cx + u * f.ax - v * f.az, f.cz + u * f.az + v * f.ax];
const rectRing = (f, u0, u1, v0, v1) => [toWorld(f, u0, v0), toWorld(f, u1, v0), toWorld(f, u1, v1), toWorld(f, u0, v1)];

/** Сурови триаголници со нормали по теме; редоследот се поправа да одговара на нормалата. */
class Tris {
  constructor() {
    this.pos = [];
    this.nor = [];
  }
  tri(a, b, c, na, nb, nc) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const nx = na[0] + nb[0] + nc[0], ny = na[1] + nb[1] + nc[1], nz = na[2] + nb[2] + nc[2];
    if (cx * nx + cy * ny + cz * nz < 0) [b, c, nb, nc] = [c, b, nc, nb];
    this.pos.push(...a, ...b, ...c);
    this.nor.push(...na, ...nb, ...nc);
  }
  quad(a, b, c, d, na, nb, nc, nd) {
    this.tri(a, b, c, na, nb, nc);
    this.tri(a, c, d, na, nc, nd);
  }
  flush(kit, part, glow) {
    if (this.pos.length) kit.raw(this.pos, this.nor, part, glow);
    this.pos = [];
    this.nor = [];
  }
}

/**
 * „Здолниште“ од бакар: од работ на прстенот (горе, вертикално) вдлабнато се шири надолу
 * до `flare` метри нанадвор. soffit = колку навнатре од долниот раб оди подгледот (или null).
 */
function skirt(kit, ring, y0, h, flare, part, { steps = 7, soffit = null } = {}) {
  const s = outSign(ring);
  const n = ring.length;
  const rows = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    rows.push({ r: offsetRing(ring, flare * (1 - t) ** 2, s), y: y0 + h * t, t });
  }
  const T = new Tris();
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [nx, nz] = edgeNormal(ring[i], ring[j], s);
    // нормала на профилот: (h·n, 2·flare·(1−t)) — мазно засенчена кривина
    const nrm = (t) => {
      const a = h;
      const b = 2 * flare * (1 - t);
      const l = Math.hypot(a, b) || 1;
      return [(nx * a) / l, b / l, (nz * a) / l];
    };
    for (let k = 0; k < steps; k++) {
      const r0 = rows[k];
      const r1 = rows[k + 1];
      const n0 = nrm(r0.t);
      const n1 = nrm(r1.t);
      T.quad(
        [r0.r[i][0], r0.y, r0.r[i][1]],
        [r0.r[j][0], r0.y, r0.r[j][1]],
        [r1.r[j][0], r1.y, r1.r[j][1]],
        [r1.r[i][0], r1.y, r1.r[i][1]],
        n0, n0, n1, n1,
      );
    }
  }
  T.flush(kit, part);
  if (soffit != null) {
    const outer = rows[0].r;
    const inner = offsetRing(ring, -soffit, s);
    const D = [0, -1, 0];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      T.quad([outer[i][0], y0, outer[i][1]], [outer[j][0], y0, outer[j][1]], [inner[j][0], y0, inner[j][1]], [inner[i][0], y0, inner[i][1]], D, D, D, D);
    }
    T.flush(kit, part);
  }
}

/** Повеќе ѕидни елементи по рабовите на прстенот (светски координати): fn(x, z, rot, i). */
function alongRing(ring, step, fn) {
  const s = outSign(ring);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < step) continue;
    const [nx, nz] = edgeNormal(a, b, s);
    const count = Math.floor(len / step);
    const start = (len - (count - 1) * step) / 2;
    for (let c = 0; c < count; c++) {
      const d = start + c * step;
      fn(a[0] + ((b[0] - a[0]) * d) / len, a[1] + ((b[1] - a[1]) * d) / len, Math.atan2(nx, nz), nx, nz);
    }
  }
}

// ───────────────────────── Дом на културата ─────────────────────────

// Волумени во рамката на основата: u = по главната (источна) фасада, од југ (−) кон север (+);
// v = длабочина, + кон паркот (напред). Висините се над рамниот покрив на приземјето.
// Распоредот е според воздушна фотографија (поглед од југоисток).
const CC = {
  base: 11, // рамниот покрив над двата ката (над теренот)
  floor1: 4.2, // приземје: повлечено темно стакло меѓу бели столбови
  band: 1.0, // темна појасна плоча меѓу катовите
  skirt: 2.2, // висина на бакарната стреа
  flare: 1.8, // колку се шири стреата
  glassIn: 2.0, // стаклото на горниот кат, навнатре од работ на покривот
  groundIn: 4.0, // стаклото на приземјето (под истурениот горен кат)
  tiers: [
    // [u0, u1, v0, v1, висина, на_кој_стои (индекс или -1 = приземје)]
    { r: [-37, -8, -33, 8], h: 3.8, on: -1 }, //  0 јужен (лев) скалест дел
    { r: [-8, 2, -3, 14], h: 3.6, on: -1 }, //    1 мал преден дел во средината
    { r: [5, 37, -31, 14], h: 4.0, on: -1 }, //   2 северна сала, прв скалник
    { r: [5, 31, -31, 4], h: 4.0, on: 2 }, //     3 втор скалник
    { r: [5, 22, -31, -6], h: 3.6, on: 3 }, //    4 трет скалник (до сценската кула)
  ],
  fly: { r: [-8, 5, -30, -3], h: 16.5 }, // сценска кула
  saddle: { r: [-30, -9, -33, -6], on: 0, skirt: 3.0, flare: 2.0, h: 7.0, dip: 2.6 }, // волумен со „седло“
};

function culturalCenter(kit, item) {
  const ring = item.polys[0][0];
  const g = item.ground.mean;
  const gmin = item.ground.min;
  const f = obb(ring);
  // рамката: +v кон фасадата (opts.front = насока во светот), +u = десно гледано од паркот
  const front = item.opts?.front || [1, 0];
  if (-f.az * front[0] + f.ax * front[1] < 0) {
    f.ax = -f.ax;
    f.az = -f.az;
  }
  const s = outSign(ring);
  const top = g + CC.base;
  const inner = offsetRing(ring, -CC.flare, s); // работ на рамниот покрив

  // приземје: повлечено темно стакло, бели столбови по работ на горниот кат
  const y1 = g + CC.floor1;
  const y2 = y1 + CC.band;
  const y3 = top - CC.skirt;
  const ground = offsetRing(ring, -CC.groundIn, s);
  kit.slab([offsetRing(ring, -CC.groundIn + 0.1, s)], gmin - 0.5, g + 0.3, 'stone');
  kit.slab([ground], g + 0.3, y1, 'window');
  kit.setFrame(0, 0, 0);
  alongRing(offsetRing(ring, -CC.glassIn - 0.6, s), 7, (x, z, rot) => kit.box(x, gmin - 0.3, z, 0.7, y1 - gmin + 0.3, 0.7, 'accent', rot));
  // истурениот горен кат: бел раб (и подглед) и темна појасна плоча
  kit.slab([offsetRing(ring, -CC.glassIn + 0.15, s)], y1, y1 + 0.18, 'accent');
  kit.slab([offsetRing(ring, -CC.glassIn + 0.12, s)], y1 + 0.18, y2, 'copper');
  // горен кат: сјајно бакарно стакло (ноќе топло светло) со темни столбчиња
  const glass = offsetRing(ring, -CC.glassIn, s);
  kit.slab([glass], y2, y3 + 0.05, 'amber');
  alongRing(glass, 2.6, (x, z, rot, nx, nz) => {
    kit.box(x + nx * 0.06, y2, z + nz * 0.06, 0.18, y3 - y2, 0.18, 'copper', rot);
  });
  // бакарната стреа со подглед до стаклото и рамниот црвен покрив
  skirt(kit, inner, y3, CC.skirt, CC.flare, 'eave', { soffit: CC.glassIn - CC.flare });
  kit.slab([inner], top - 0.02, top + 0.3, 'tin');

  // екран на покривот, над влезот
  {
    const [sx, sz] = toWorld(f, 13, 29);
    kit.setFrame(sx, top + 0.3, sz, f.ax, f.az);
    for (const du of [-2.5, 2.5]) kit.box(du, 0, 0, 0.3, 1.4, 0.3, 'metal');
    kit.box(0, 1.4, 0, 7.6, 4.6, 0.6, 'metal');
    kit.box(0, 1.75, 0.32, 6.8, 3.9, 0.05, 'copper', 0, 0);
    kit.setFrame(0, 0, 0);
  }

  // скалести волумени: темен бакар, бакарна стреа во основата, црвен покрив
  const level = [];
  CC.tiers.forEach((t, i) => {
    const y0 = t.on < 0 ? top + 0.3 : level[t.on];
    const r = rectRing(f, t.r[0], t.r[1], t.r[2], t.r[3]);
    tier(kit, r, y0, t.h, 2.0, 1.4);
    level[i] = y0 + t.h + 0.35;
  });

  // сценска кула (без стреа)
  {
    const r = rectRing(f, ...CC.fly.r);
    kit.slab([r], top, top + CC.fly.h, 'copper');
    kit.slab([offsetRing(r, 0.25)], top + CC.fly.h, top + CC.fly.h + 0.4, 'tin');
    
  }

  // волумен со вдлабнато „седло“ на врвот (профил по u, истиснат по v)
  {
    const sd = CC.saddle;
    const [u0, u1, v0, v1] = sd.r;
    const y0 = level[sd.on];
    skirt(kit, rectRing(f, u0, u1, v0, v1), y0, sd.skirt, sd.flare, 'eave');
    const W = u1 - u0;
    const D = v1 - v0;
    const prof = (x) => {
      const ax = Math.abs(x);
      const flat = W * 0.14;
      const tr = W * 0.2;
      if (ax <= flat) return sd.h - sd.dip;
      if (ax >= flat + tr) return sd.h;
      return sd.h - sd.dip * (0.5 + 0.5 * Math.cos((Math.PI * (ax - flat)) / tr));
    };
    const xs = [];
    for (let x = W / 2; x > -W / 2 - 1e-6; x -= W / 32) xs.push(x);
    const wall = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), ...xs.map((x) => new THREE.Vector2(x, prof(x)))]);
    const [cx, cz] = toWorld(f, (u0 + u1) / 2, (v0 + v1) / 2);
    kit.setFrame(cx, y0 + sd.skirt, cz, f.ax, f.az);
    const wg = new THREE.ExtrudeGeometry(wall, { depth: D, bevelEnabled: false });
    wg.translate(0, 0, -D / 2);
    kit.add(wg, Kit.at(0, 0, 0), 'copper');
    // црвен покрив што ја следи кривата
    const e = 0.3;
    const cap = [];
    for (let k = 0; k <= 32; k++) {
      const x = -W / 2 - e + ((W + 2 * e) * k) / 32;
      cap.push(new THREE.Vector2(x, prof(Math.max(-W / 2, Math.min(W / 2, x))) - 0.02));
    }
    for (let k = 32; k >= 0; k--) cap.push(new THREE.Vector2(cap[k].x, cap[k].y + 0.38));
    const cg = new THREE.ExtrudeGeometry(new THREE.Shape(cap), { depth: D + 2 * e, bevelEnabled: false });
    cg.translate(0, 0, -D / 2 - e);
    kit.add(cg, Kit.at(0, 0, 0), 'tin');
    kit.setFrame(0, 0, 0);
  }
}

/** Скалник: бакарна стреа во основата, ѕид од темен бакар, рамен црвен покрив. */
function tier(kit, ring, y0, h, skirtH, flare) {
  skirt(kit, ring, y0, skirtH, flare, 'eave');
  kit.slab([ring], y0 + skirtH - 0.02, y0 + h, 'copper');
  kit.slab([offsetRing(ring, 0.3)], y0 + h, y0 + h + 0.35, 'tin');
}

// ───────────────────────── Горна гимназија ─────────────────────────

// Висини (m над теренот): сутерен, три ката, венец. Од фотографиите: ~16 m до стреата.
const GY = { basement: 1.7, floors: [4.5, 4.5, 4.1], crown: 1.3, roof: 3.0 };

function gymnasium(kit, item, ctx) {
  const hit = (item.pick && buildingAt(ctx, item.pick)) || largestInside(ctx, item.polys[0][0]);
  if (!hit) return;
  ctx.skip.add(hit.b);
  const ring = hit.shape.rings[0];
  const g = hit.shape.gmean;
  const gmin = hit.shape.gmin;
  const s = outSign(ring);
  const yB = g + GY.basement;
  const lv = [yB];
  for (const h of GY.floors) lv.push(lv[lv.length - 1] + h);
  const eave = lv[3] + GY.crown;
  const front = item.opts?.front || [0, 1];

  // маси: камен сутерен, жолти ѕидови, бели корнизи
  kit.slab([offsetRing(ring, 0.12, s)], gmin - 0.5, yB, 'plinth');
  kit.slab([ring], yB, eave, 'ochre');
  kit.slab([offsetRing(ring, 0.22, s)], yB - 0.05, yB + 0.3, 'accent');
  for (const y of [lv[1], lv[2]]) kit.slab([offsetRing(ring, 0.18, s)], y - 0.15, y + 0.3, 'accent');
  kit.slab([offsetRing(ring, 0.1, s)], lv[3], lv[3] + 0.7, 'accent'); // фриз
  kit.slab([offsetRing(ring, 0.6, s)], eave - 0.45, eave, 'accent'); // венец
  kit.slab([offsetRing(ring, 0.35, s)], eave - 0.65, eave - 0.45, 'accent');

  // главната фасада: најдолгиот раб свртен кон front
  let fi = -1;
  let fl = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const [nx, nz] = edgeNormal(a, b, s);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (nx * front[0] + nz * front[1] > 0.7 && len > fl) [fi, fl] = [i, len];
  }

  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 2.5) continue;
    const tx = (b[0] - a[0]) / len;
    const tz = (b[1] - a[1]) / len;
    kit.setFrame((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, tx, tz);
    // локалната оска v = (−tz, tx); нанадвор е (s·tz, −s·tx) = −s·v
    const o = -s;
    facade(kit, len, o, { g, gmin, lv, eave, main: i === fi });
  }

  // покрив: низок четиристрешен над OBB, со оџаци
  const f = obb(ring);
  kit.setFrame(f.cx, eave, f.cz, f.ax, f.az);
  kit.hip(0, 0, 0, f.L + 1.0, GY.roof, f.W + 1.0, 'roof');
  for (const [u, v] of [[-0.36, -0.12], [-0.12, 0.14], [0.12, -0.14], [0.36, 0.12]]) {
    kit.box(u * f.L, 0.4, v * f.W, 0.8, 3.2, 0.8, 'ochre');
    kit.box(u * f.L, 3.6, v * f.W, 1.0, 0.25, 1.0, 'accent');
  }
  kit.setFrame(0, 0, 0);
}

/** Една фасада во рамката на работ (u по работ, центар = 0; o = знак на v нанадвор). */
function facade(kit, len, o, { g, gmin, lv, eave, main }) {
  const yB = lv[0];
  const pil = (u, w) => kit.box(u, yB + 0.3, o * 0.12, w, lv[3] - yB - 0.3, 0.24, 'accent');
  // аголни пиластри
  const corner = Math.min(1.0, len * 0.12);
  pil(-len / 2 + corner / 2, corner);
  pil(len / 2 - corner / 2, corner);
  // модилјони под венецот
  for (let u = -len / 2 + 0.6; u <= len / 2 - 0.6; u += 0.9) kit.box(u, eave - 0.85, o * 0.2, 0.22, 0.4, 0.4, 'accent');

  const inner = len - 2 * corner;
  if (inner < 1.5) return;

  if (main) {
    // 5 групи прозорци, одделени со пиластри; во средината портал
    const n = 5;
    const gw = inner / n;
    for (let k = 1; k < n; k++) pil(-inner / 2 + k * gw, 0.6);
    for (let k = 0; k < n; k++) {
      const uc = -inner / 2 + (k + 0.5) * gw;
      const mid = k === (n - 1) / 2;
      // приземје: два лачни прозорци (во средината — порталот)
      if (mid) portal(kit, uc, o, g, gmin, yB);
      else for (const du of [-0.24, 0.24]) {
        win(kit, o, uc + du * gw, lv[0] + 0.9, 1.2, 2.1, { arch: true });
        basementWin(kit, o, uc + du * gw, g);
      }
      // прв кат: лачен среден прозорец меѓу два правоаголни, балустрада под нив
      balustrade(kit, o, uc, lv[1] + 0.35, gw * 0.82);
      win(kit, o, uc, lv[1] + 1.3, 1.3, 2.0, { arch: true });
      for (const du of [-0.31, 0.31]) win(kit, o, uc + du * gw, lv[1] + 1.3, 0.9, 2.4);
      // втор кат: тројка прозорци, балустрада под нив
      balustrade(kit, o, uc, lv[2] + 0.35, gw * 0.82);
      win(kit, o, uc, lv[2] + 1.25, 1.5, 2.3);
      for (const du of [-0.31, 0.31]) win(kit, o, uc + du * gw, lv[2] + 1.25, 0.9, 2.3);
    }
    return;
  }

  // странични и задни фасади: по еден прозорец на ~4.5 m
  const nb = Math.max(1, Math.round(inner / 4.5));
  const bw = inner / nb;
  for (let k = 0; k < nb; k++) {
    const uc = -inner / 2 + (k + 0.5) * bw;
    win(kit, o, uc, lv[0] + 0.9, 1.2, 2.1, { arch: true });
    basementWin(kit, o, uc, g);
    win(kit, o, uc, lv[1] + 1.3, 1.1, 2.4);
    win(kit, o, uc, lv[2] + 1.25, 1.1, 2.3);
  }
}

/** Прозорец со бела рамка (и полукружен лак, или „капа“ над правоаголен). */
function win(kit, o, u, y, w, h, { arch = false } = {}) {
  const fr = 0.2;
  if (arch) {
    kit.box(u, y - fr, o * 0.07, w + 2 * fr, h + fr, 0.14, 'accent');
    halfDisc(kit, u, y + h, o * 0.07, w / 2 + fr, 0.14, 'accent');
    kit.box(u, y, o * 0.16, w, h, 0.04, 'window');
    halfDisc(kit, u, y + h, o * 0.16, w / 2, 0.04, 'window');
  } else {
    kit.box(u, y - fr, o * 0.07, w + 2 * fr, h + 2 * fr, 0.14, 'accent');
    kit.box(u, y + h + fr, o * 0.14, w + 2 * fr + 0.3, 0.22, 0.28, 'accent');
    kit.box(u, y, o * 0.16, w, h, 0.04, 'window');
  }
}

function basementWin(kit, o, u, g) {
  kit.box(u, g + 0.45, o * 0.14, 0.9, 0.55, 0.04, 'copper', 0, 0);
}

/** Полукруг во рамнината на ѕидот (центар на дното во u, y), дебелина d по v. */
function halfDisc(kit, u, y, v, r, d, part) {
  const sh = new THREE.Shape();
  sh.moveTo(r, 0);
  sh.absarc(0, 0, r, 0, Math.PI, false);
  sh.lineTo(r, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -d / 2);
  kit.add(geo, Kit.at(u, y, v), part);
}

function balustrade(kit, o, u, y, w) {
  kit.box(u, y, o * 0.1, w, 0.75, 0.2, 'accent');
  kit.box(u, y + 0.75, o * 0.16, w + 0.2, 0.14, 0.32, 'accent');
}

/** Влез: темна врата, два столба со греда, скали од тротоарот до приземјето. */
function portal(kit, u, o, g, gmin, yB) {
  kit.box(u, yB, o * 0.1, 1.9, 3.5, 0.1, 'copper', 0, 0);
  for (const du of [-1.45, 1.45]) {
    kit.box(u + du, yB, o * 0.3, 0.75, 0.5, 0.6, 'accent');
    kit.cylinder(u + du, yB + 0.5, o * 0.3, 0.24, 3.4, 'accent', { seg: 10 });
  }
  kit.box(u, yB + 3.9, o * 0.32, 4.0, 0.55, 0.64, 'accent');
  kit.box(u, yB + 4.45, o * 0.36, 4.4, 0.2, 0.72, 'accent');
  // скали
  const n = 4;
  for (let j = 0; j < n; j++) {
    const depth = 0.45 * (j + 1);
    kit.box(u, gmin - 0.3, o * (depth / 2), 3.4 + j * 0.5, yB - (yB - g) * (j / n) - (gmin - 0.3), depth, 'stone');
  }
}

export const CIVIC_MODELS = { culturalCenter, gymnasium };
