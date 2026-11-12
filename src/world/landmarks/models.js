// Процедурални модели на знаменитостите. Секој модел: (kit, item, ctx) → void.
// item доаѓа од public/data/landmarks.json (основа од OSM, подлога), ctx = { hf, buildings, skip }.
// Моделите се стилизирани — препознатлив силует, пропорции од основата, без архитектонски детали.

import { obb, ringCentroid, pointInRing, distToPolyline, ringArea } from '../geom2d.js';
import { buildingShape, shell, wantsPitch, Writer } from '../buildings.js';
import { BUILDING_ID } from '../../config/classes.js';
import { magnoliaHouses } from './magnolija.js';

const TAU = Math.PI * 2;

/** Рамка од основата: центар и оска по подолгата страна. */
function frameOf(kit, item, y = item.ground.mean) {
  const f = obb(item.polys[0][0]);
  kit.setFrame(f.cx, y, f.cz, f.ax, f.az);
  return f;
}

// ───────────────────────── Саат Кула ─────────────────────────
function clockTower(kit, item) {
  const f = frameOf(kit, item, item.ground.min - 0.5);
  const s = Math.max(4.6, Math.min(f.L, f.W, 6.5));
  const H = 32.5;
  kit.box(0, 0, 0, s + 1.2, 1.6, s + 1.2, 'stone');
  kit.box(0, 1.6, 0, s, 19.4, s, 'wall');
  // тесни прорези-прозорци по шахтата
  for (let y = 6; y < 19; y += 5) {
    for (const [u, v, r] of [[s / 2 + 0.03, 0, Math.PI / 2], [-s / 2 - 0.03, 0, -Math.PI / 2], [0, s / 2 + 0.03, 0], [0, -s / 2 - 0.03, Math.PI]]) {
      kit.box(u, y, v, 0.5, 1.4, 0.06, 'window', r);
    }
  }
  kit.box(0, 21, 0, s + 0.8, 0.6, s + 0.8, 'stone');
  kit.box(0, 21.6, 0, s - 0.4, 3.6, s - 0.4, 'wall');
  // часовници на четирите страни
  const half = (s - 0.4) / 2;
  for (const [u, v, r] of [[half, 0, Math.PI / 2], [-half, 0, -Math.PI / 2], [0, half, 0], [0, -half, Math.PI]]) clockFace(kit, u, 23.4, v, r);
  kit.box(0, 25.2, 0, s + 0.9, 0.35, s + 0.9, 'stone');
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    kit.cylinder(Math.cos(a) * (s / 2 + 0.3), 25.55, Math.sin(a) * (s / 2 + 0.3), 0.06, 0.9, 'metal', { seg: 5 });
  }
  kit.cylinder(0, 25.55, 0, 2.0, 3.2, 'wall', { seg: 8, rotY: Math.PI / 8 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    kit.box(Math.cos(a) * 1.9, 26.2, Math.sin(a) * 1.9, 0.7, 1.6, 0.1, 'window', -a + Math.PI / 2);
  }
  kit.cylinder(0, 28.75, 0, 2.35, 0.3, 'stone', { seg: 8, rotY: Math.PI / 8 });
  kit.cone(0, 29.05, 0, 2.2, H - 30.6, 'dome', { seg: 8 });
  kit.cylinder(0, H - 1.6, 0, 0.08, 1.4, 'metal', { seg: 6 });
  kit.sphere(0, H - 0.9, 0, 0.22, 'metal', { seg: 8 });
}

// Часовник: бел диск во рамнината на ѕидот + две стрелки (дискот сјае ноќе).
function clockFace(kit, u, y, v, rotY) {
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * TAU;
    const a1 = ((i + 1) / steps) * TAU;
    tri(kit, u, y, v, rotY, [0, 0], [Math.cos(a0) * 1.25, Math.sin(a0) * 1.25], [Math.cos(a1) * 1.25, Math.sin(a1) * 1.25], 'accent', 0.6);
  }
  tri(kit, u, y, v, rotY, [-0.06, 0], [0.06, 0], [0, 0.95], 'metal', 0, 0.02);
  tri(kit, u, y, v, rotY, [0, -0.05], [0.7, 0.2], [0, 0.05], 'metal', 0, 0.02);
}

/** Триаголник во рамнината на ѕид (локални 2Д координати x→десно, y→горе), малку пред ѕидот. */
function tri(kit, u, y, v, rotY, a, b, c, part, glow, off = 0) {
  const dx = Math.sin(rotY);
  const dz = Math.cos(rotY);
  // десно во рамнината на ѕидот = (dz, 0, -dx)
  const P = [a, b, c].map(([px, py]) => {
    const lx = u + dz * px + dx * (0.02 + off);
    const lz = v - dx * px + dz * (0.02 + off);
    const w = kit.frame.elements;
    const ly = y + py;
    return [w[0] * lx + w[4] * ly + w[8] * lz + w[12], w[1] * lx + w[5] * ly + w[9] * lz + w[13], w[2] * lx + w[6] * ly + w[10] * lz + w[14]];
  });
  const nx = kit.frame.elements[0] * dx + kit.frame.elements[8] * dz;
  const nz = kit.frame.elements[2] * dx + kit.frame.elements[10] * dz;
  const pos = [];
  const nor = [];
  // a, b, c се против стрелките гледано однадвор → предната страна гледа нанадвор
  for (const p of P) {
    pos.push(...p);
    nor.push(nx, 0, nz);
  }
  kit.raw(pos, nor, part, glow);
}

// ───────────────────────── Џамија ─────────────────────────
function mosque(kit, item) {
  const f = frameOf(kit, item, item.ground.min - 0.3);
  const o = item.opts;
  const hall = Math.min(o.hall || 15, f.W - 0.5, f.L - 0.5);
  const hallU = (f.L - hall) / 2; // салата е на задниот крај на долгата оска
  const wallH = hall * 0.62;
  const domeR = Math.min(o.dome || hall * 0.45, hall * 0.47);

  kit.box(hallU, 0, 0, hall, wallH, hall, 'wall');
  kit.box(hallU, wallH, 0, hall + 0.5, 0.45, hall + 0.5, 'stone');
  // прозорци во два реда
  for (const y of [1.6, wallH * 0.58]) {
    for (let i = -1; i <= 1; i++) {
      const d = i * (hall / 3.3);
      kit.box(hallU + d, y, hall / 2 + 0.03, 1.1, 1.9, 0.06, 'window');
      kit.box(hallU + d, y, -hall / 2 - 0.03, 1.1, 1.9, 0.06, 'window');
      kit.box(hallU + hall / 2 + 0.03, y, d, 0.06, 1.9, 1.1, 'window');
    }
  }
  // тамбур и купола
  kit.cylinder(hallU, wallH + 0.45, 0, domeR * 0.98, 1.5, 'wall', { seg: 8, rotY: Math.PI / 8 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    kit.box(hallU + Math.cos(a) * domeR * 0.97, wallH + 0.75, Math.sin(a) * domeR * 0.97, 0.6, 0.9, 0.08, 'window', -a + Math.PI / 2);
  }
  kit.dome(hallU, wallH + 1.95, 0, domeR, 'dome', { seg: 24 });
  kit.cylinder(hallU, wallH + 1.95 + domeR, 0, 0.12, 1.4, 'metal', { seg: 6 });
  kit.sphere(hallU, wallH + 3.6 + domeR, 0, 0.25, 'metal', { seg: 8 });

  // трем со столбови и мали куполи
  const pd = Math.min(6.5, f.L - hall);
  if (pd > 2.5) {
    const pu = hallU - hall / 2 - pd / 2;
    const ph = wallH * 0.62;
    const n = o.porticoDomes || 3;
    for (let i = 0; i <= n; i++) {
      const v = -hall / 2 + 0.5 + (i * (hall - 1)) / n;
      kit.cylinder(pu - pd / 2 + 0.5, 0, v, 0.32, ph, 'stone', { seg: 10 });
    }
    kit.box(pu, ph, 0, pd, 0.6, hall, 'stone');
    for (let i = 0; i < n; i++) {
      const v = -hall / 2 + (hall / n) * (i + 0.5);
      kit.dome(pu, ph + 0.6, v, Math.min(pd, hall / n) * 0.4, 'dome', { seg: 14 });
    }
  }

  // минаре на десниот преден агол на салата
  const mu = hallU - hall / 2 + 1.5;
  const mv = hall / 2 + 1.7;
  const H = o.minaret || 30;
  kit.box(mu, 0, mv, 2.8, 5, 2.8, 'stone');
  kit.cylinder(mu, 5, mv, 1.15, H * 0.72 - 5, 'wall', { top: 1.0, seg: 12 });
  kit.cylinder(mu, H * 0.72, mv, 1.75, 0.5, 'stone', { seg: 12 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    kit.cylinder(mu + Math.cos(a) * 1.65, H * 0.72 + 0.5, mv + Math.sin(a) * 1.65, 0.05, 0.8, 'metal', { seg: 4 });
  }
  kit.cylinder(mu, H * 0.72 + 0.5, mv, 0.95, H * 0.14, 'wall', { top: 0.9, seg: 12 });
  kit.cone(mu, H * 0.86 + 0.5, mv, 1.05, H * 0.14, 'dome', { seg: 12 });
  kit.cylinder(mu, H + 0.5, mv, 0.07, 1.2, 'metal', { seg: 5 });
  kit.box(mu, H * 0.72 + 0.6, mv + 1.66, 0.4, 0.5, 0.05, 'light'); // светилка на шерефето
}

// ───────────────────────── Безистен ─────────────────────────
function bezisten(kit, item) {
  const ring = item.polys[0][0];
  const y0 = item.ground.min - 0.5;
  const top = item.ground.mean + 7;
  kit.slab([ring], y0, top, 'wall');
  kit.slab([ring], top, top + 0.5, 'roof');
  kit.windows(ring, [{ y: item.ground.mean + 3.8, h: 1.4 }], { spacing: 5, width: 0.9 });
  // низа куполи по оската
  const f = obb(ring);
  kit.setFrame(f.cx, top + 0.5, f.cz, f.ax, f.az);
  const rows = f.W > 18 ? [-f.W / 4, f.W / 4] : [0];
  for (let u = -f.L / 2 + 4; u <= f.L / 2 - 4; u += 7.5) {
    for (const v of rows) {
      const wx = f.cx + u * f.ax - v * f.az;
      const wz = f.cz + u * f.az + v * f.ax;
      if (!pointInRing([wx, wz], ring)) continue;
      kit.cylinder(u, 0, v, 2.5, 0.8, 'stone', { seg: 12 });
      kit.dome(u, 0.8, v, 2.5, 'dome', { seg: 16 });
    }
  }
  // порти на краевите
  for (const s of [-1, 1]) kit.box((s * f.L) / 2, -7.5, 0, 0.4, 6.5, 3.2, 'stone');
}

// ───────────────────────── Јавни згради ─────────────────────────
// opts: height, floors, part ('wall'|'wall2'), roof ('hip'|'flat'|'tiles'), attic, flag, band.
// item.inside = основата е двор/парцела → моделот е врз најголемата зграда во неа.
export function publicBuilding(kit, item, ctx, defaults = {}) {
  const o = { height: 13, floors: 3, part: 'wall2', roof: 'hip', ...defaults, ...item.opts };
  let rings = item.polys[0];
  let g = item.ground.mean;
  let gmin = item.ground.min;
  if (item.inside) {
    const hit = (item.pick && buildingAt(ctx, item.pick)) || largestInside(ctx, rings[0]);
    if (!hit) return;
    ctx.skip.add(hit.b);
    rings = hit.shape.rings;
    g = hit.shape.gmean;
    gmin = hit.shape.gmin;
  }
  const ring = rings[0];
  const top = g + o.height;
  kit.slab(rings, gmin - 0.5, g + 1.2, 'stone');
  kit.slab(rings, g + 1.2, top, o.part);
  kit.slab([grow(ring, 0.45), ...rings.slice(1)], top, top + 0.7, 'accent');
  const floorH = (o.height - 1.6) / o.floors;
  const floors = [];
  for (let k = 0; k < o.floors; k++) floors.push({ y: g + 2 + k * floorH, h: Math.min(2.4, floorH * 0.62) });
  for (const r of rings) kit.windows(r, floors, { spacing: o.band ? 2.2 : 3.2, width: o.band ? 1.9 : 1.2 });
  const f = obb(ring);
  kit.setFrame(f.cx, top + 0.7, f.cz, f.ax, f.az);
  if (o.roof === 'hip') kit.hip(0, 0, 0, f.L * 0.92, Math.min(5, f.W * 0.3), f.W * 0.86, 'roof');
  else if (o.roof === 'tiles') kit.slab(rings, top + 0.7, top + 1.5, 'roof');
  else kit.box(0, 0, 0, f.L * 0.5, 1.2, f.W * 0.4, 'stone'); // машинска просторија на рамниот покрив
  if (o.attic) {
    kit.box(0, 0, 0, Math.min(10, f.L * 0.3), 2.6, f.W * 0.5, o.part);
    kit.box(0, 2.6, 0, Math.min(10.6, f.L * 0.32), 0.4, f.W * 0.52, 'accent');
  }
  if (o.flag) kit.cylinder(0, o.attic ? 3 : 1.2, 0, 0.06, 5, 'metal', { seg: 5 });
}

function officersHome(kit, item, ctx) {
  publicBuilding(kit, item, ctx, { height: 13.5, floors: 3, part: 'wall2', roof: 'hip', attic: true, flag: true });
}

/** Зградата (од buildings.bin) што ја содржи точката, или најблиската (до 40 m). */
export function buildingAt(ctx, [px, pz]) {
  const pack = ctx.buildings;
  const q = pack.meta.q;
  let best = null;
  for (let b = 0; b < pack.meta.count; b++) {
    const r0 = pack.arrays.ringPt[pack.arrays.polyRing[b]];
    const x = pack.arrays.coords[r0 * 2] * q;
    const z = pack.arrays.coords[r0 * 2 + 1] * q;
    if (Math.abs(x - px) > 200 || Math.abs(z - pz) > 200) continue;
    const shape = buildingShape(pack, b);
    if (pointInRing([px, pz], shape.rings[0])) return { b, a: Math.abs(ringArea(shape.rings[0])), shape };
    const c = ringCentroid(shape.rings[0]);
    const d = Math.hypot(c[0] - px, c[1] - pz);
    if (d < 40 && (!best || d < best.d)) best = { b, d, a: Math.abs(ringArea(shape.rings[0])), shape };
  }
  return best;
}

/** Најголемата зграда (од buildings.bin) чиј центар е во прстенот. */
export function largestInside(ctx, ring) {
  const pack = ctx.buildings;
  const q = pack.meta.q;
  const [cx, cz] = ringCentroid(ring);
  let best = null;
  for (let b = 0; b < pack.meta.count; b++) {
    const r0 = pack.arrays.ringPt[pack.arrays.polyRing[b]];
    const x = pack.arrays.coords[r0 * 2] * q;
    const z = pack.arrays.coords[r0 * 2 + 1] * q;
    if (Math.abs(x - cx) > 400 || Math.abs(z - cz) > 400) continue;
    const shape = buildingShape(pack, b);
    const c = ringCentroid(shape.rings[0]);
    if (!pointInRing(c, ring)) continue;
    const a = Math.abs(ringArea(shape.rings[0]));
    if (!best || a > best.a) best = { b, a, shape };
  }
  return best;
}

/** Прстен „надуен“ од центарот за d метри (приближно — за корнизи). */
export function grow(ring, d) {
  const [cx, cz] = ringCentroid(ring);
  return ring.map(([x, z]) => {
    const dx = x - cx;
    const dz = z - cz;
    const l = Math.hypot(dx, dz) || 1;
    return [x + (dx / l) * d, z + (dz / l) * d];
  });
}

// ───────────────────────── Цркви ─────────────────────────
// opts: wallH, dome (true), tower ('west' | 'front' | 'none'), towerH, spire (шилест врв).
function church(kit, item) {
  churchOn(kit, item.polys[0][0], item.ground.mean, item.ground.min, item.opts);
}

export function churchOn(kit, ring, g, gmin, opts = {}) {
  const o = { wallH: 10, dome: true, tower: 'west', towerH: 26, spire: false, ...opts };
  const top = g + o.wallH;
  kit.slab([ring], gmin - 0.5, top, 'wall');
  const rows = o.wallH > 7 ? [{ y: g + 2.5, h: o.wallH * 0.26 }, { y: g + o.wallH * 0.66, h: o.wallH * 0.2 }] : [{ y: g + 2, h: 1.8 }];
  kit.windows(ring, rows, { spacing: 3.6, width: 1 });
  const f = obb(ring);
  kit.setFrame(f.cx, top, f.cz, f.ax, f.az);
  kit.box(0, 0, 0, f.L * 0.97, 0.4, f.W * 0.97, 'stone');
  kit.gable(0, 0.4, 0, f.L * 0.94, Math.min(7, f.W * 0.33), f.W * 0.94, 'roof');
  if (o.dome) {
    const r = Math.min(3, f.W * 0.2);
    kit.cylinder(f.L * 0.12, r * 1.05, 0, r, r, 'wall', { seg: 8, rotY: Math.PI / 8 });
    kit.dome(f.L * 0.12, r * 2.05, 0, r, 'dome', { seg: 16 });
    kit.cylinder(f.L * 0.12, r * 3.05, 0, 0.08, 1.6, 'metal', { seg: 5 });
    kit.box(f.L * 0.12, r * 3.05 + 0.9, 0, 0.9, 0.08, 0.08, 'metal');
  }
  if (o.tower === 'none') return;
  // камбанарија: 'west' = до западниот крај, 'front' = вградена во предниот крај
  const west = f.ax > 0 ? -1 : 1;
  const ts = Math.min(5.2, f.W * 0.45);
  const bu = o.tower === 'front' ? west * (f.L / 2 - ts / 2) : west * (f.L / 2 + ts / 2);
  kit.setFrame(f.cx, gmin - 0.5, f.cz, f.ax, f.az);
  const H = o.towerH;
  kit.box(bu, 0, 0, ts, H - 6, ts, 'wall');
  kit.box(bu, H - 6, 0, ts + 0.4, 0.4, ts + 0.4, 'stone');
  kit.box(bu, H - 5.6, 0, ts - 0.6, 3.4, ts - 0.6, 'wall');
  const h2 = (ts - 0.6) / 2 + 0.03;
  for (const [du, dv, r] of [[h2, 0, Math.PI / 2], [-h2, 0, -Math.PI / 2], [0, h2, 0], [0, -h2, Math.PI]]) kit.box(bu + du, H - 5, dv, 1.1, 2.2, 0.06, 'window', r);
  if (o.spire) kit.cone(bu, H - 2.2, 0, ts * 0.62, 9, 'dome', { seg: 8 });
  else kit.hip(bu, H - 2.2, 0, ts, 4, ts, 'roof');
  const capTop = H - 2.2 + (o.spire ? 9 : 4);
  kit.cylinder(bu, capTop, 0, 0.08, 1.8, 'metal', { seg: 5 });
  kit.box(bu, capTop + 1.1, 0, 0.9, 0.08, 0.08, 'metal');
}

// ───────────────────────── Плоштад Магнолија ─────────────────────────
function square(kit, item, ctx) {
  const ring = item.polys[0][0];
  // (фонтаната со споменикот на Филип II е посебна знаменитост — equestrian)
  // магнолии и светилки по работ на плоштадот (навнатре 3.5 m)
  placeAlong(ring, 11, 3.5, (x, z, i) => {
    const gy = ctx.hf.sample(x, z);
    kit.setFrame(x, gy, z);
    if (i % 3 === 2) lamp(kit, 0, 0);
    else magnolia(kit, 0, 0, 1 + ((i * 37) % 10) / 25);
  });
}

export function magnolia(kit, u, v, s = 1) {
  kit.cylinder(u, 0, v, 0.18 * s, 2.2 * s, 'trunk', { seg: 6 });
  kit.sphere(u, 3.2 * s, v, 2.1 * s, 'blossom', { seg: 10, sy: 0.85 });
  kit.sphere(u + 0.9 * s, 2.6 * s, v + 0.5 * s, 1.3 * s, 'blossom', { seg: 8 });
}

export function lamp(kit, u, v, h = 4.2) {
  kit.cylinder(u, 0, v, 0.08, h, 'metal', { seg: 6 });
  kit.sphere(u, h + 0.25, v, 0.32, 'light', { seg: 8 });
}

/** Точки по прстен на растојание step, поместени навнатре за inset (приближно). */
function placeAlong(ring, step, inset, fn) {
  const [cx, cz] = ringCentroid(ring);
  let i = 0;
  let carry = 0;
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k];
    const b = ring[(k + 1) % ring.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let d = carry; d < len; d += step) {
      const x = a[0] + ((b[0] - a[0]) * d) / len;
      const z = a[1] + ((b[1] - a[1]) * d) / len;
      const dx = cx - x;
      const dz = cz - z;
      const l = Math.hypot(dx, dz) || 1;
      const px = x + (dx / l) * Math.min(inset, l * 0.5);
      const pz = z + (dz / l) * Math.min(inset, l * 0.5);
      if (pointInRing([px, pz], ring)) fn(px, pz, i++);
      carry = d + step - len;
    }
    if (carry < 0) carry = 0;
  }
}

// ───────────────────────── Широк Сокак ─────────────────────────
// Зградите долж пешачката улица: пастелни фасади (по зграда), прозорци по кат, корниз,
// дуќани во приземје, коси покриви; светилки по улицата. Зградите на Магнолија (влезот на
// улицата) се детални модели од фотографии — world/landmarks/magnolija.js.
function promenade(kit, item, ctx) {
  const pack = ctx.buildings;
  const n = pack.meta.count;
  const lines = item.lines;
  const facades = ['facade1', 'facade2', 'facade3', 'facade4', 'facade5'];
  // зградите на Магнолија (влезот на улицата) имаат свои детални модели
  magnoliaHouses(kit, ctx);
  kit.setFrame(0, 0, 0);
  for (let b = 0; b < n; b++) {
    if (ctx.skip.has(b)) continue; // веќе ја црта друга знаменитост
    const s0 = pack.arrays.polyRing[b];
    const r0 = pack.arrays.ringPt[s0];
    const q = pack.meta.q;
    const x = pack.arrays.coords[r0 * 2] * q;
    const z = pack.arrays.coords[r0 * 2 + 1] * q;
    if (Math.abs(x - item.center[0]) > 800 || Math.abs(z - item.center[1]) > 800) continue;
    const s = buildingShape(pack, b);
    const c = ringCentroid(s.rings[0]);
    if (!lines.some((l) => distToPolyline(c, l) < item.buffer)) continue;
    if (s.minH > 0 || Math.abs(ringArea(s.rings[0])) < 20) continue;
    ctx.skip.add(b);
    // 2–3 ката (зоната веќе е проценета така), фасада по зграда
    const part = facades[pack.arrays.seed[b] % facades.length];
    const W = new Writer();
    const R = new Writer();
    const pitched = wantsPitch(s.rings, BUILDING_ID.house, pack.arrays.roof[b], Math.min(s.h, 13), 0) || Math.abs(ringArea(s.rings[0])) < 600;
    shell({ ...s, h: Math.min(s.h, 13) }, pitched, W, R, b);
    kit.raw(W.pos, W.nor, part);
    kit.raw(R.pos, R.nor, pitched ? 'roof' : 'stone');
    // корниз и прозорци
    const ring = s.rings[0];
    kit.slab([grow(ring, 0.25)], s.top - 0.5, s.top - 0.15, 'accent');
    const floors = [];
    for (let fy = s.gmean + 4.3; fy + 1.8 < s.top - 0.6; fy += 3.3) floors.push({ y: fy, h: 1.6 });
    kit.windows(ring, floors, { spacing: 2.6, width: 1.0 });
    kit.windows(ring, [{ y: s.gmean + 0.4, h: 2.6 }], { spacing: 3.4, width: 2.2, glow: 1 });
  }
  // светилки на секои 16 m, наизменично лево/десно
  for (const line of lines) {
    let side = 1;
    walk(line, 16, (x, z, tx, tz) => {
      const px = x - tz * 4.5 * side;
      const pz = z + tx * 4.5 * side;
      kit.setFrame(px, ctx.hf.sample(px, pz), pz);
      lamp(kit, 0, 0, 3.8);
      side = -side;
    });
  }
}

export function walk(line, step, fn) {
  let carry = step / 2;
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, az] = line[i];
    const [bx, bz] = line[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-6) continue;
    const tx = (bx - ax) / len;
    const tz = (bz - az) / len;
    let d = carry;
    for (; d < len; d += step) fn(ax + tx * d, az + tz * d, tx, tz);
    carry = d - len;
  }
}

export const MODELS = { clockTower, mosque, bezisten, officersHome, publicBuilding, church, square, promenade };
