// Дополнителни знаменитости: споменик на Филип II, Зандан Куле, станица, стадион, тврдина,
// воени гробишта (германски, француски, српски), манастири; Филџанот е во fildzan.js.
// Сите се стилизирани модели од примитиви, во рамка од основата во OSM.

import * as THREE from 'three';
import { Kit } from './kit.js';
import { obb, ringCentroid, pointInRing, distToPolyline, ringArea } from '../geom2d.js';
import { churchOn, largestInside, lamp } from './models.js';
import { fildzan } from './fildzan.js';
import { dimitrija } from './dimitrija.js';
import { bezisten } from './bezisten.js';
import { bogorodica } from './bogorodica.js';
import { mitropolija } from './mitropolija.js';
import { stivMonument } from './stiv.js';

const TAU = Math.PI * 2;

// ───────────────────────── помошни ─────────────────────────

/** Ѕид по прстен (светски координати): кутија по секој раб, на теренот; опционално запци. */
function wallAlong(kit, ctx, ring, h, t, part, { crenel = false, gap = null } = {}) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.5) continue;
    const mx = (a[0] + b[0]) / 2;
    const mz = (a[1] + b[1]) / 2;
    if (gap && i === gap) continue; // влез
    const y = Math.min(ctx.hf.sample(a[0], a[1]), ctx.hf.sample(b[0], b[1])) - 0.6;
    kit.setFrame(mx, y, mz, (b[0] - a[0]) / len, (b[1] - a[1]) / len);
    kit.box(0, 0, 0, len + t * 0.5, h + 0.6, t, part);
    if (crenel) for (let d = -len / 2 + 0.9; d < len / 2 - 0.4; d += 1.9) kit.box(d, h + 0.6, 0, 0.9, 0.8, t, part);
  }
}

/** Отстрани ги обичните згради во прстенот (ги заменува моделот). */
function skipInside(ctx, ring) {
  const pack = ctx.buildings;
  const q = pack.meta.q;
  const [cx, cz] = ringCentroid(ring);
  for (let b = 0; b < pack.meta.count; b++) {
    const r0 = pack.arrays.ringPt[pack.arrays.polyRing[b]];
    const x = pack.arrays.coords[r0 * 2] * q;
    const z = pack.arrays.coords[r0 * 2 + 1] * q;
    if (Math.abs(x - cx) < 400 && Math.abs(z - cz) < 400 && pointInRing([x, z], ring)) ctx.skip.add(b);
  }
}

/** Отстрани ја обичната зграда со дадениот OSM id. */
function skipOsm(ctx, osmId) {
  const ids = ctx.buildings.arrays.osmId;
  for (let b = 0; b < ids.length; b++) if (ids[b] === osmId) ctx.skip.add(b);
}

/** Точка во локалната рамка на OBB → свет. */
const toWorld = (f, u, v) => [f.cx + u * f.ax - v * f.az, f.cz + u * f.az + v * f.ax];

/** Прстен со позитивна плоштина (како основите на зградите — прозорците гледаат нанадвор). */
const positive = (r) => (ringArea(r) < 0 ? [...r].reverse() : r);

/** Кружен базен: ниско дно, вода, заоблен камен раб. */
function basin(kit, u, v, R) {
  kit.cylinder(u, -0.3, v, R, 0.5, 'stone', { seg: 40 });
  kit.cylinder(u, 0.2, v, R - 0.4, 0.08, 'water', { seg: 40 });
  kit.add(new THREE.TorusGeometry(R - 0.25, 0.32, 6, 48), Kit.atE(u, 0.32, v, Math.PI / 2), 'stone');
}

// ───────────────────────── Споменик на Филип II ─────────────────────────
// Коњаник на висок постамент. Насоката: opts.backTo = знаменитост зад грбот на коњаникот.
function equestrian(kit, item, ctx) {
  const [cx, cz] = item.center;
  const o = { pedestal: 9, fountain: 0, ...item.opts };
  const y = ctx.hf.sample(cx, cz);
  // насока: главата на коњот (+u) гледа од backTo кон споменикот
  let ax = 0.25;
  let az = 1;
  const back = o.backTo && ctx.items?.find((it) => it.id === o.backTo);
  if (back) {
    ax = cx - back.center[0];
    az = cz - back.center[1];
  }
  kit.setFrame(cx, y, cz, ax, az);
  if (o.fountain) {
    basin(kit, 0, 0, o.fountain);
  }
  // рефлектори во аглите на постаментот (светат ноќе)
  for (const [su, sv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) kit.box(su * 4.4, 0, sv * 4.4, 0.4, 0.3, 0.4, 'light');
  // постамент: скали, тело, корниз
  const P = o.pedestal;
  kit.box(0, 0, 0, 7.5, 1, 7.5, 'stone');
  kit.box(0, 1, 0, 6.2, 0.8, 6.2, 'stone');
  kit.box(0, 1.8, 0, 4.6, P - 3, 4.6, 'stone');
  kit.box(0, P - 1.2, 0, 5.2, 0.6, 5.2, 'accent');
  kit.box(0, P - 0.6, 0, 4.8, 0.6, 4.8, 'stone');
  // статуата е во природна големина × ~1.6 — посебна рамка на врвот на постаментот
  kit.setFrame(cx, y + P, cz, ax, az);
  kit.frame.scale(new THREE.Vector3(1.6, 1.6, 1.6));
  // коњ (по u): труп, нозе (предните во скок), врат, глава, опашка
  const H = 0;
  const B = 'bronze';
  kit.add(new THREE.SphereGeometry(1, 12, 8), Kit.atE(0, H + 2.4, 0, 0, 0, 0.12, 1.75, 0.95, 0.9), B);
  const leg = (u, v, rz, len = 2.4) => kit.add(new THREE.CylinderGeometry(0.2, 0.15, len, 6).translate(0, -len / 2, 0), Kit.atE(u, H + 2.2, v, 0, 0, rz), B);
  leg(-1.1, 0.45, 0.15);
  leg(-1.1, -0.45, -0.1);
  leg(1.1, 0.45, -1.15, 2.0); // предните нозе подигнати
  leg(1.1, -0.45, -0.85, 2.0);
  kit.add(new THREE.CylinderGeometry(0.42, 0.6, 2.2, 8).translate(0, 1.1, 0), Kit.atE(1.35, H + 2.6, 0, 0, 0, -0.75), B);
  kit.add(new THREE.BoxGeometry(1.35, 0.55, 0.5), Kit.atE(2.55, H + 4.15, 0, 0, 0, -0.55), B);
  kit.add(new THREE.CylinderGeometry(0.12, 0.25, 1.8, 6).translate(0, -0.9, 0), Kit.atE(-1.7, H + 2.8, 0, 0, 0, -0.5), B);
  // јавач: труп, глава, наметка, крената рака со меч
  kit.add(new THREE.CylinderGeometry(0.42, 0.5, 1.6, 8).translate(0, 0.8, 0), Kit.atE(0.15, H + 3.1, 0, 0, 0, -0.08), B);
  kit.sphere(0.3, H + 5.0, 0, 0.36, B, { seg: 10 });
  kit.add(new THREE.BoxGeometry(0.15, 1.6, 1.1), Kit.atE(-0.35, H + 3.4, 0, 0, 0, 0.25), B);
  kit.add(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 6).translate(0, 0.65, 0), Kit.atE(0.25, H + 4.4, 0.45, -0.5, 0, -0.35), B);
  kit.add(new THREE.BoxGeometry(0.08, 1.9, 0.14).translate(0, 0.95, 0), Kit.atE(0.7, H + 5.4, 1.0, -0.3, 0, -0.25), 'metal');
}

// ───────────────────────── Фонтана ─────────────────────────
// Кружна фонтана: базен, централен столб со чинија и млазови.
function fountain(kit, item, ctx) {
  const ring = item.polys[0][0];
  const [ox, oz] = ringCentroid(ring);
  const R = Math.max(2.5, ring.reduce((a, [x, z]) => a + Math.hypot(x - ox, z - oz), 0) / ring.length);
  const [cx, cz] = item.center;
  kit.setFrame(cx, ctx.hf.sample(cx, cz), cz);
  basin(kit, 0, 0, R);
  kit.cylinder(0, 0, 0, 0.5, 2.2, 'stone', { seg: 10 });
  kit.cylinder(0, 2.2, 0, R * 0.3, 0.35, 'stone', { top: R * 0.36, seg: 20 });
  kit.cylinder(0, 2.56, 0, R * 0.33, 0.04, 'water', { seg: 20 });
  kit.cylinder(0, 2.6, 0, 0.12, 1.6, 'water', { seg: 6 });
  const n = Math.max(6, Math.round(R * 1.5));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    kit.add(new THREE.CylinderGeometry(0.05, 0.09, 1.4, 5).translate(0, 0.7, 0), Kit.atE(Math.cos(a) * (R - 1), 0.25, Math.sin(a) * (R - 1), Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5), 'water');
    kit.box(Math.cos(a) * (R - 0.25), 0.55, Math.sin(a) * (R - 0.25), 0.25, 0.15, 0.25, 'light', -a);
  }
}

// ───────────────────────── Зандан Куле ─────────────────────────
// Камена кула (затвор/саат-кула од отоманскиот период), горен кат што малку излегува, четиристрешен покрив.
function stoneTower(kit, item) {
  const f = obb(item.polys[0][0]);
  const s = Math.max(6, Math.min(f.L, 9));
  const H = item.opts.height || 11;
  kit.setFrame(f.cx, item.ground.min - 0.5, f.cz, f.ax, f.az);
  kit.box(0, 0, 0, s, H - 2.6, s, 'stone');
  for (const y of [3, 6]) {
    for (const [u, v, r] of [[s / 2 + 0.03, 0, Math.PI / 2], [-s / 2 - 0.03, 0, -Math.PI / 2], [0, s / 2 + 0.03, 0], [0, -s / 2 - 0.03, Math.PI]]) kit.box(u, y, v, 0.5, 1.1, 0.06, 'window', r);
  }
  kit.box(0, H - 2.6, 0, s + 0.8, 2.4, s + 0.8, 'wall2');
  for (const [u, v, r] of [[s / 2 + 0.43, 0, Math.PI / 2], [-s / 2 - 0.43, 0, -Math.PI / 2], [0, s / 2 + 0.43, 0], [0, -s / 2 - 0.43, Math.PI]]) kit.box(u, H - 2, v, 1.4, 1.2, 0.06, 'window', r);
  kit.hip(0, H - 0.2, 0, s + 2, 3.2, s + 2, 'roof');
  kit.cylinder(0, H + 3, 0, 0.07, 1.2, 'metal', { seg: 5 });
}

// ───────────────────────── Железничка станица ─────────────────────────
function station(kit, item, ctx) {
  const ring = item.polys[0][0];
  const g = item.ground.mean;
  const f = obb(ring);
  // перонот е на страната кон пругата
  let side = 1;
  if (ctx.rails?.length) {
    const d = (s) => Math.min(...ctx.rails.map((l) => distToPolyline(toWorld(f, 0, s * (f.W / 2 + 6)), l)));
    side = d(1) < d(-1) ? 1 : -1;
  }
  kit.slab([ring], item.ground.min - 0.5, g + 1, 'stone');
  kit.slab([ring], g + 1, g + 8.5, 'wall2');
  kit.windows(ring, [{ y: g + 1.8, h: 2.4 }, { y: g + 5.4, h: 1.9 }], { spacing: 3, width: 1.3 });
  kit.setFrame(f.cx, g + 8.5, f.cz, f.ax, f.az);
  kit.hip(0, 0, 0, f.L, 3.2, f.W, 'roof');
  // централен повисок дел со часовник
  kit.box(0, -8.5, 0, Math.min(10, f.L * 0.3), 11.5, f.W + 0.6, 'wall2');
  kit.hip(0, 3, 0, Math.min(10, f.L * 0.3) + 0.4, 2.6, f.W + 1, 'roof');
  kit.box(0, 0.6, side * (f.W / 2 + 0.34), 1.6, 1.6, 0.06, 'accent', 0, 0.6); // часовник
  // настрешница над перонот
  const pv = side * (f.W / 2 + 4);
  kit.setFrame(f.cx, g, f.cz, f.ax, f.az);
  for (let u = -f.L / 2 - 6; u <= f.L / 2 + 6; u += 6) kit.cylinder(u, 0, pv + side * 2.6, 0.15, 4.2, 'metal', { seg: 6 });
  kit.box(0, 4.2, pv, f.L + 14, 0.25, 7, 'dome');
  kit.box(0, 0, pv + side * 1.2, f.L + 14, 0.5, 5, 'paving');
  for (let u = -f.L / 2; u <= f.L / 2; u += 10) kit.box(u, 3.8, pv + side * 2.4, 0.5, 0.3, 0.5, 'light');
}

// ───────────────────────── Стадион ─────────────────────────
function stadium(kit, item, ctx) {
  const ring = item.polys[0][0];
  skipInside(ctx, ring);
  const f = obb(ring);
  const g = item.ground.mean;
  kit.setFrame(f.cx, g, f.cz, f.ax, f.az);
  const pl = Math.min(105, f.L * 0.6);
  const pw = Math.min(68, f.W * 0.5);
  // атлетска патека и терен
  kit.box(0, -0.1, 0, pl + 16, 0.2, pw + 14, 'mosaic1');
  kit.box(0, 0, 0, pl, 0.15, pw, 'green');
  const line = (u, v, w, d) => kit.box(u, 0.15, v, w, 0.02, d, 'accent');
  line(0, pw / 2, pl, 0.2);
  line(0, -pw / 2, pl, 0.2);
  line(pl / 2, 0, 0.2, pw);
  line(-pl / 2, 0, 0.2, pw);
  line(0, 0, 0.2, pw);
  kit.cylinder(0, 0.15, 0, 9.15, 0.02, 'accent', { seg: 32 });
  kit.cylinder(0, 0.16, 0, 8.95, 0.02, 'green', { seg: 32 });
  // трибини по долгите страни (главната со покрив), пониски зад головите
  const steps = 9;
  for (const s of [1, -1]) {
    const v0 = s * (pw / 2 + 9);
    for (let i = 0; i < steps; i++) kit.box(0, 0, v0 + s * i * 1.3, pl + 10, 0.55 * (i + 1), 1.3, i % 2 ? 'stone' : 'wall');
    if (s === 1) {
      const vr = v0 + s * steps * 0.65;
      kit.box(0, 0.55 * steps + 4.2, vr, pl * 0.7, 0.35, steps * 1.3 + 3, 'dome');
      for (let u = -pl * 0.33; u <= pl * 0.33; u += 12) kit.cylinder(u, 0.55 * steps, v0 + s * (steps * 1.3), 0.25, 4.4, 'metal', { seg: 6 });
    }
  }
  for (const s of [1, -1]) {
    const u0 = s * (pl / 2 + 10);
    for (let i = 0; i < 5; i++) kit.box(u0 + s * i * 1.3, 0, 0, 1.3, 0.5 * (i + 1), pw + 4, i % 2 ? 'stone' : 'wall');
  }
  // рефлектори во аглите
  for (const [su, sv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const u = su * (pl / 2 + 14);
    const v = sv * (pw / 2 + 16);
    kit.cylinder(u, 0, v, 0.45, 30, 'metal', { top: 0.3, seg: 8 });
    kit.add(new THREE.BoxGeometry(4.5, 2.6, 0.5), Kit.atE(u, 31, v, 0, Math.atan2(-su, -sv), 0), 'light', 1);
  }
}

// ───────────────────────── Битолска тврдина ─────────────────────────
function fortress(kit, item, ctx) {
  const ring = item.polys[0][0];
  wallAlong(kit, ctx, ring, 6.5, 2.2, 'stone', { crenel: true });
  for (const [x, z] of ring) {
    const y = ctx.hf.sample(x, z) - 0.6;
    kit.setFrame(x, y, z);
    kit.cylinder(0, 0, 0, 3.3, 10, 'stone', { seg: 12 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      kit.box(Math.cos(a) * 2.8, 10, Math.sin(a) * 2.8, 1.1, 0.9, 1.1, 'stone', -a);
    }
    kit.box(3.3, 6.5, 0, 0.06, 1.2, 0.5, 'window', Math.PI / 2);
  }
}

// ───────────────────────── Тотенборг (германски воени гробишта) ─────────────────────────
// Камена „тврдина на мртвите“: кружен ѕид со запци околу внатрешен двор, ниска ограда.
function totenburg(kit, item, ctx) {
  const ring = item.polys[0][0];
  skipInside(ctx, ring);
  const f = obb(ring);
  const y = item.ground.min - 0.5;
  kit.setFrame(f.cx, y, f.cz, f.ax, f.az);
  const R = Math.min(15, f.W * 0.36);
  const segs = 24;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * TAU;
    const w = ((R + 1.5) * TAU) / segs + 0.3;
    if (i === 0) continue; // влез
    kit.box(Math.cos(a) * (R + 1.5), 0, Math.sin(a) * (R + 1.5), 3, 9.5, w, 'stone', -a);
    if (i % 2) kit.box(Math.cos(a) * (R + 1.5), 9.5, Math.sin(a) * (R + 1.5), 3, 1, w * 0.6, 'stone', -a);
    kit.box(Math.cos(a) * (R + 3.03), 5.5, Math.sin(a) * (R + 3.03), 0.06, 1.6, 0.35, 'window', -a + Math.PI / 2);
  }
  kit.cylinder(0, 0, 0, R, 0.6, 'paving', { seg: 32 });
  // крст во средината
  kit.box(0, 0.6, 0, 0.6, 6, 0.6, 'metal');
  kit.box(0, 4.6, 0, 2.6, 0.5, 0.6, 'metal');
  wallAlong(kit, ctx, ring, 1.6, 0.6, 'stone');
}

// ───────────────────────── Воени гробишта (француски, српски) ─────────────────────────
function warCemetery(kit, item, ctx) {
  const ring = item.polys[0][0];
  wallAlong(kit, ctx, ring, 1.8, 0.6, 'stone', { gap: 0 });
  const f = obb(ring);
  // редови бели крстови
  let n = 0;
  for (let u = -f.L / 2 + 8; u < f.L / 2 - 8; u += 3.2) {
    for (let v = -f.W / 2 + 8; v < f.W / 2 - 8; v += 2.4) {
      if (Math.abs(v) < 4) continue; // централна алеја
      const [x, z] = toWorld(f, u, v);
      if (!pointInRing([x, z], ring) || n > 900) continue;
      kit.setFrame(x, ctx.hf.sample(x, z), z, f.ax, f.az);
      kit.box(0, 0, 0, 0.14, 1.15, 0.14, 'accent');
      kit.box(0, 0.75, 0, 0.14, 0.12, 0.62, 'accent');
      n++;
    }
  }
  // централен споменик (обелиск) и јарбол
  const [cx, cz] = toWorld(f, f.L * 0.18, 0);
  kit.setFrame(cx, ctx.hf.sample(cx, cz) - 0.3, cz, f.ax, f.az);
  kit.box(0, 0, 0, 5, 1, 5, 'stone');
  kit.cylinder(0, 1, 0, 1.3, 13, 'stone', { top: 0.7, seg: 4, rotY: Math.PI / 4 });
  kit.cone(0, 14, 0, 0.75, 1.6, 'stone', { seg: 4 });
  kit.cylinder(4, 0, 4, 0.08, 12, 'metal', { seg: 5 });
  // спомен-зграда (француските гробишта)
  const mem = item.parts?.memorial;
  if (mem) {
    const r = mem.polys[0][0];
    const g = ctx.hf.sample(...mem.center);
    skipOsm(ctx, mem.osmId);
    kit.slab([r], g - 0.5, g + 6.5, 'wall');
    kit.windows(r, [{ y: g + 1.5, h: 3 }], { spacing: 2.5, width: 1 });
    const mf = obb(r);
    kit.setFrame(mf.cx, g + 6.5, mf.cz, mf.ax, mf.az);
    kit.box(0, 0, 0, mf.L + 0.8, 0.6, mf.W + 0.8, 'accent');
  }
  // капела (српските гробишта)
  if (item.opts.chapel) {
    const [hx, hz] = toWorld(f, -f.L / 2 + 14, 0);
    const c = [
      toWorld(f, -f.L / 2 + 8, -4),
      toWorld(f, -f.L / 2 + 20, -4),
      toWorld(f, -f.L / 2 + 20, 4),
      toWorld(f, -f.L / 2 + 8, 4),
    ];
    const g = ctx.hf.sample(hx, hz);
    churchOn(kit, positive(c), g, g, { wallH: 6, towerH: 14, dome: true });
  }
}

// ───────────────────────── Манастир ─────────────────────────
// Ограден ѕид околу комплексот; црквата е најголемата зграда во оградата.
function monastery(kit, item, ctx) {
  const ring = item.polys[0][0];
  wallAlong(kit, ctx, ring, 2.4, 0.7, 'stone', { gap: 0 });
  const hit = largestInside(ctx, ring);
  if (hit && Math.abs(hit.a) > 40) {
    ctx.skip.add(hit.b);
    churchOn(kit, hit.shape.rings[0], hit.shape.gmean, hit.shape.gmin, { wallH: 8, towerH: 17, dome: true });
  } else {
    // нема зграда во податоците — мала црква во средината
    const f = obb(ring);
    const c = [toWorld(f, -7, -4), toWorld(f, 7, -4), toWorld(f, 7, 4), toWorld(f, -7, 4)];
    const g = ctx.hf.sample(f.cx, f.cz);
    churchOn(kit, positive(c), g, g - 0.5, { wallH: 7, towerH: 15, dome: true });
  }
  // неколку дрва и светилка пред влезот
  const [lx, lz] = ring[0];
  kit.setFrame(lx, ctx.hf.sample(lx, lz), lz);
  lamp(kit, 0, 0, 3.5);
}

// ───────────────────────── Кај авионите ─────────────────────────
// Изложени млазни ловци со стреловидни крила (стилизирани по F-86), секој на рамно тревно
// плато со кружна патека. Позициите се од OSM (parts), насоката и големината на кругот — opts.planes.

/** Рамна плоча по многуаголник во (u, v) со дебелина t, легната хоризонтално на висина y. */
function flatPlate(kit, pts, y, t, part) {
  const shape = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, -v)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); // (u, -v, z) → (u, z, v)
  kit.add(g, Kit.at(0, y, 0), part);
}

/** Вертикална перка во рамнината (u, y), дебелина t по v. */
function finPlate(kit, pts, t, part) {
  const shape = new THREE.Shape(pts.map(([u, y]) => new THREE.Vector2(u, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
  g.translate(0, 0, -t / 2);
  kit.add(g, Kit.at(0, 0, 0), part);
}

/** Млазен ловец во тековната рамка: нос кон +u, должина ~11.5 m, оската на трупот на висина Y. */
function jet(kit, { radome = false } = {}) {
  const Y = 1.55;
  const BODY = 'dome';
  const WING = 'accent';
  // труп: профил (радиус по должината, од опашката кон носот), вртен околу оската u
  const prof = [
    [0.01, -5.75], [0.42, -5.75], [0.5, -5.2], [0.62, -3.6], [0.74, -1.2], [0.78, 0.8], [0.74, 2.6],
    [0.66, 4.2], [0.55, 5.3], [0.5, 5.75], [0.01, 5.75],
  ].map(([r, u]) => new THREE.Vector2(r, u));
  const body = new THREE.LatheGeometry(prof, 18);
  body.rotateZ(-Math.PI / 2); // оската y → u
  kit.add(body, Kit.at(0, Y, 0), BODY);
  // отвор за воздух во носот (темен) и млазник на опашката
  kit.add(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16).rotateZ(Math.PI / 2), Kit.at(5.76, Y, 0), 'metal');
  kit.add(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 12).rotateZ(Math.PI / 2), Kit.at(-5.76, Y, 0), 'metal');
  if (radome) {
    // Ф-86Д: радарски нос над отворот (карактеристичната „муцка“)
    kit.add(new THREE.SphereGeometry(0.34, 12, 8), Kit.at(5.65, Y + 0.3, 0, 0, 1.9, 0.75, 0.9), 'metal');
  }
  // кабина: издолжена „капка“ над трупот, пред крилата
  kit.add(new THREE.SphereGeometry(0.5, 14, 8), Kit.at(2.6, Y + 0.55, 0, 0, 2.1, 0.95, 0.85), 'water');
  // крила: стреловидни (~35°), ниско на трупот
  flatPlate(kit, [[1.5, 0], [-2.2, 5.65], [-3.4, 5.65], [-1.6, 0.5], [-1.6, -0.5], [-3.4, -5.65], [-2.2, -5.65]], Y - 0.42, 0.16, WING);
  // хоризонтална и вертикална опашка
  flatPlate(kit, [[-3.9, 0], [-5.0, 2.0], [-5.75, 2.0], [-5.4, 0.3], [-5.4, -0.3], [-5.75, -2.0], [-5.0, -2.0]], Y + 0.12, 0.1, WING);
  finPlate(kit, [[-3.5, Y + 0.45], [-5.15, Y + 2.65], [-5.85, Y + 2.65], [-5.7, Y + 0.3]], 0.12, WING);
  // стајни трапови: нос и два главни, со тркала
  for (const [u, v, len] of [[3.9, 0, Y - 0.25], [-0.9, 1.35, Y - 0.6], [-0.9, -1.35, Y - 0.6]]) {
    kit.cylinder(u, 0.32, v, 0.07, len, 'metal', { seg: 5 });
    kit.add(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 10).rotateX(Math.PI / 2), Kit.at(u, 0.32, v), 'metal');
  }
}

function jets(kit, item, ctx) {
  for (const p of item.opts.planes || []) {
    const part = item.parts?.[p.part];
    if (!part) continue;
    const [x, z] = part.center;
    const R = p.pad || 8;
    // рамно плато (мала тераса): горе над највисоката точка на теренот во кругот, така што
    // падината не го покрива; искосениот раб се спушта до теренот на пониската страна
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of [0, R * 0.5, R + 0.3, R + 2.8]) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        const g = ctx.hf.sample(x + Math.cos(a) * r, z + Math.sin(a) * r);
        lo = Math.min(lo, g);
        if (r <= R + 0.3) hi = Math.max(hi, g);
      }
    }
    const top = hi + 0.1;
    kit.setFrame(x, lo - 0.6, z);
    kit.cylinder(0, 0, 0, R + 2.8, top - lo + 0.6, 'green', { top: R + 0.3, seg: 36 });
    // кружна патека (утабана земја) и подлога под авионот
    kit.add(new THREE.TorusGeometry(R - 0.5, 0.45, 4, 40), Kit.atE(0, top - lo + 0.6, 0, Math.PI / 2, 0, 0, 1, 1, 0.12), 'paving');
    // авионот, свртен по heading (степени од север, во насока на стрелките)
    const h = ((p.heading || 0) * Math.PI) / 180;
    kit.setFrame(x, top, z, Math.sin(h), -Math.cos(h));
    kit.box(0, -0.05, 0, 9, 0.1, 5, 'paving');
    jet(kit, { radome: p.radome });
    // мала табла пред авионот
    kit.box(7.4, 0, -1.6, 0.08, 0.9, 0.08, 'metal');
    kit.box(7.4, 0.9, -1.6, 0.06, 0.55, 0.9, 'wall', 0);
  }
}

export const EXTRA_MODELS = { equestrian, fountain, stoneTower, station, stadium, fortress, totenburg, warCemetery, monastery, fildzan, dimitrija, bezisten, bogorodica, mitropolija, stivMonument, jets };
