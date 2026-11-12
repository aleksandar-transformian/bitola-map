// Хераклеа Линкестис — археолошкиот локалитет, рачно според сателитска снимка и фотографии:
// театарот на ридот (гледалиште, орхестра, сцена со заштитни црвени покриви, аркада од тула),
// поплочената улица со колонадата, Големата базилика (наоси покриени со песок, мозаик во
// нартексот), Малата базилика (бели колони, црно-бел под), лакови од тула на колони, урнатините
// на куќите (ѕидови од речен камен со редови тула), куќичките покрај оградата, оградата и тополите.
//
// Позициите се во рамка на локалитетот: u = по мрежата на античкиот град (ИСИ, −30° од исток),
// v = нормално на неа (ЈЈИ); почетокот е во центарот на гледалиштето. Рамката е регистрирана
// на сателитската снимка преку OSM (краевите на театарот и раскрсницата на Буковска, ~1–2 m).

import * as THREE from 'three';
import { Kit } from './kit.js';
import { pointInRing } from '../geom2d.js';
import { fence } from './fence.js';

const TAU = Math.PI * 2;
// центар на гледалиштето (локални метри) и оска u
const O = [617.4, 2147.3];
const AX = Math.cos(-Math.PI / 6);
const AZ = Math.sin(-Math.PI / 6);

/** (u, v) од рамката на локалитетот → (x, z) во светот. */
function W(u, v) {
  return [O[0] + u * AX - v * AZ, O[1] + u * AZ + v * AX];
}

/** Детерминистички „случаен“ број 0–1 од два цели броја. */
function hash(i, j, k = 0) {
  let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function heraclea(kit, item, ctx) {
  const { hf } = ctx;
  const site = item.polys[0][0];
  const g = (u, v) => {
    const [x, z] = W(u, v);
    return hf.sample(x, z);
  };
  /** Рамка во точка (u, v) на тлото (+dy), со оските на локалитетот. */
  const at = (u, v, dy = 0) => {
    const [x, z] = W(u, v);
    kit.setFrame(x, hf.sample(x, z) + dy, z, AX, AZ);
  };
  const inside = (u, v) => pointInRing(W(u, v), site);

  // модерните покриви/настрешници во оградата (ML детекции) ги кријат урнатините — без нив
  const pack = ctx.buildings;
  const q = pack.meta.q;
  for (let b = 0; b < pack.meta.count; b++) {
    const r0 = pack.arrays.ringPt[pack.arrays.polyRing[b]];
    const x = pack.arrays.coords[r0 * 2] * q;
    const z = pack.arrays.coords[r0 * 2 + 1] * q;
    if (Math.abs(x - item.center[0]) < 300 && Math.abs(z - item.center[1]) < 300 && pointInRing([x, z], site)) ctx.skip.add(b);
  }

  /** Ѕид од (u0, v0) до (u1, v1): стои на најниската точка, врвот е h над средното тло. */
  const wall = (u0, v0, u1, v1, h, t = 0.7, part = 'rubble', cap) => {
    const len = Math.hypot(u1 - u0, v1 - v0);
    if (len < 0.3) return;
    const ga = g(u0, v0);
    const gb = g(u1, v1);
    const gm = g((u0 + u1) / 2, (v0 + v1) / 2);
    const lo = Math.min(ga, gb, gm) - 0.3;
    const top = (ga + gb) / 2 + h;
    const [x, z] = W((u0 + u1) / 2, (v0 + v1) / 2);
    kit.setFrame(x, lo, z, AX, AZ);
    const rot = Math.atan2(-(v1 - v0), u1 - u0);
    kit.box(0, 0, 0, len, top - lo, t, part, rot);
    // редови тула на врвот (opus mixtum)
    if (cap) kit.box(0, top - lo, 0, len, 0.16, t + 0.04, 'brick', rot);
  };

  /** Под што го следи релјефот: правоаголник во рамката, lift над тлото. */
  const drape = (u0, u1, v0, v1, lift, part, step = 3) => {
    const nu = Math.max(1, Math.ceil((u1 - u0) / step));
    const nv = Math.max(1, Math.ceil((v1 - v0) / step));
    const P = [];
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const [x, z] = W(u0 + ((u1 - u0) * i) / nu, v0 + ((v1 - v0) * j) / nv);
        P.push([x, hf.sample(x, z) + lift, z]);
      }
    }
    const pos = [];
    const nor = [];
    const id = (i, j) => P[j * (nu + 1) + i];
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        // A=(i,j), B=(i+1,j), C=(i+1,j+1), D=(i,j+1): (A, D, B), (B, D, C) гледаат нагоре
        for (const p of [id(i, j), id(i, j + 1), id(i + 1, j), id(i + 1, j), id(i, j + 1), id(i + 1, j + 1)]) {
          pos.push(p[0], p[1], p[2]);
          nor.push(0, 1, 0);
        }
      }
    }
    kit.raw(pos, nor, part);
  };

  /** Кружен исечок (прстен r0–r1, агли a0–a1 во рамката: (cos a, sin a) = (u, v)), висина h. */
  const sector = (r0, r1, a0, a1, y, h, part, seg) => {
    const n = seg || Math.max(2, Math.ceil(((a1 - a0) * r1) / 2.2));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push(new THREE.Vector2(Math.cos(a) * r1, -Math.sin(a) * r1));
    }
    for (let i = n; i >= 0; i--) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push(new THREE.Vector2(Math.cos(a) * r0, -Math.sin(a) * r0));
    }
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: h, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    kit.add(geo, Kit.at(0, y, 0), part);
  };

  /** Мермерна колона со база и капител (broken = скршена, без капител). */
  const column = (u, v, h, r = 0.32, broken = false) => {
    at(u, v, -0.2);
    kit.box(0, 0, 0, r * 2.8, 0.45, r * 2.8, 'marble');
    kit.cylinder(0, 0.45, 0, r, h, 'marble', { seg: 8, top: r * 0.9 });
    if (!broken) {
      kit.cylinder(0, 0.45 + h, 0, r * 0.9, 0.18, 'marble', { seg: 8, top: r * 1.3 });
      kit.box(0, 0.63 + h, 0, r * 3, 0.3, r * 3, 'marble');
    }
  };

  theater(kit, { at, g, wall, drape, sector, column });
  greatBasilica({ wall, drape, sector, at, column, kit });
  smallBasilica({ wall, drape, sector, at, column, kit });

  // ── поплочената улица пред сцената, со колонадата на јужната страна ──
  drape(-16, 42, 17.6, 23.4, 0.12, 'paving', 4);
  wall(-16, 17.4, 42, 17.4, 0.35, 0.4, 'stone');
  wall(-16, 23.6, 42, 23.6, 0.35, 0.4, 'stone');
  [[-12, 5.2], [-6.5, 1.4], [-1, 5.0], [4.5, 4.6], [10, 0], [15.5, 5.3], [21, 1.8], [26.5, 4.9], [32, 0], [37, 3.2]].forEach(([u, h]) => {
    if (h) column(u, 24.8, h, 0.34, h < 3.5);
  });

  // ── лакови од тула на колони (кон Малата базилика) ──
  for (const u of [24, 27.6, 31.2]) column(u, 50.5, 2.6, 0.3, true);
  for (const u of [25.8, 29.4]) {
    at(u, 50.5, -0.2);
    const arch = new THREE.TorusGeometry(1.8, 0.32, 5, 10, Math.PI);
    kit.add(arch, Kit.at(0, 3.1, 0), 'brick');
  }
  wall(22, 52.4, 34, 52.4, 1.0, 0.7, 'rubble', true);

  // ── фонтана: две кружни корита ──
  for (const [u, v, r] of [[20.5, 66.5, 1.8], [24.5, 66, 1.3]]) {
    at(u, v, -0.2);
    sector(r - 0.35, r, 0, TAU, 0, 0.75, 'marble', 12);
    kit.cylinder(0, 0, 0, r - 0.35, 0.5, 'water', { seg: 12 });
  }

  // ── вкопана четвртеста зграда (терми) западно од сцената ──
  for (const [a, b] of [[[-36, 9], [-22, 9]], [[-22, 9], [-22, 24]], [[-22, 24], [-36, 24]], [[-36, 24], [-36, 9]], [[-29, 9], [-29, 16]]]) {
    wall(a[0], a[1], b[0], b[1], 2.1, 0.9, 'rubble', true);
  }

  // ── куќички за чуварите и археолозите (жолти, со црвени покриви) ──
  const huts = [
    [50, 69, 7, 3.2],
    [9, 81.5, 6, 3.0],
    [-24, 89, 6.5, 2.6, true], // контејнер
  ];
  for (const [u, v, w, d, box] of huts) {
    if (!inside(u, v)) continue;
    at(u, v, -0.3);
    const rot = Math.atan2(0.25, 1); // по оградата
    kit.box(0, 0, 0, w, box ? 2.8 : 2.9, d, 'ochre', rot);
    if (box) kit.box(0, 2.8, 0, w + 0.1, 0.12, d + 0.1, 'accent', rot);
    else kit.gable(0, 2.9, 0, w + 0.6, 1.1, d + 0.8, 'roof', rot);
  }

  // ── урнатини на куќите: блокови по мрежата на градот ──
  ruins({ wall, drape, inside, huts });

  // ── ограда по границата на локалитетот ──
  fence(kit, hf, site);

  // ── тополи покрај патот (надвор од оградата, кон Буковска) и чемпреси во локалитетот ──
  const SE = [[86.4, 69.5], [63.1, 71.4], [38.3, 79.0], [-13.0, 92.5], [-54.2, 96.1]];
  let p = 0;
  for (let i = 0; i + 1 < SE.length; i++) {
    const [u0, v0] = SE[i];
    const [u1, v1] = SE[i + 1];
    const len = Math.hypot(u1 - u0, v1 - v0);
    for (let d = 4; d < len; d += 8.5) {
      const r = hash(p++, 7);
      if (r < 0.3) continue;
      const u = u0 + ((u1 - u0) * d) / len;
      const v = v0 + ((v1 - v0) * d) / len + 5.5 + r * 2;
      poplar(kit, at, u, v, 13 + r * 6);
    }
  }
  for (const [u, v, h] of [[-14, 28.5, 7], [8, 28, 6], [40, 30, 6.5], [62, 44, 6]]) {
    at(u, v, -0.2);
    kit.cylinder(0, 0, 0, 0.18, 1, 'trunk', { seg: 5 });
    kit.cone(0, 0.8, 0, 1.3, h, 'green', { seg: 7 });
  }
}

/** Топола: тенка висока крошна на кратко стебло. */
function poplar(kit, at, u, v, h) {
  at(u, v, -0.2);
  kit.cylinder(0, 0, 0, 0.28, 2.4, 'trunk', { seg: 5 });
  const r = h * 0.11;
  kit.sphere(0, 2 + (h - 2) / 2, 0, r, 'green', { seg: 7, sy: (h - 2) / 2 / r });
}

// ───────────────────────── театар ─────────────────────────
function theater(kit, { at, g, wall, drape, sector }) {
  const CV = -1.5; // центар на орхестрата во рамката (v)
  const base = -0.25;
  at(0, CV, base);
  // орхестра (полукруг + до сцената) и подиум-ѕидот околу неа
  sector(0.01, 9.6, Math.PI, TAU, 0, 0.2, 'paving', 14);
  kit.box(0, 0, 2.2, 19.2, 0.2, 4.4, 'paving');
  sector(9.6, 10.4, Math.PI, TAU, 0, 1.1, 'marble', 14);

  // гледалиште: долен појас (10 реда, 6 клина), дијазома, горен појас (9 реда, 8 клина)
  const rowD = 0.82;
  const rise = 0.36;
  const tiers = [
    { r: 10.4, rows: 10, cunei: 6, h0: 1.1 },
    { r: 19.6, rows: 9, cunei: 8 },
  ];
  let top = 1.1;
  for (let t = 0; t < tiers.length; t++) {
    const T = tiers[t];
    if (t === 1) {
      // дијазома: рамен премин, потоа ѕид до горниот појас
      sector(18.6, T.r, Math.PI, TAU, 0, top, 'paving');
      top += 0.6;
    }
    for (let r = 0; r < T.rows; r++) {
      const r0 = T.r + r * rowD;
      const r1 = r0 + rowD;
      top += rise;
      const gap = 0.9 / r1;
      for (let k = 0; k < T.cunei; k++) {
        let a0 = Math.PI + (k * Math.PI) / T.cunei;
        let a1 = Math.PI + ((k + 1) * Math.PI) / T.cunei;
        if (k > 0) a0 += gap / 2;
        if (k < T.cunei - 1) a1 -= gap / 2;
        sector(r0, r1, a0, a1, 0, top, 'marble');
        // скали меѓу клиновите (малку под седиштата — темни линии)
        if (k > 0) {
          const am = Math.PI + (k * Math.PI) / T.cunei;
          kit.box(Math.cos(am) * (r0 + rowD / 2), 0, Math.sin(am) * (r0 + rowD / 2), rowD, top - 0.18, 0.9, 'stone', -am);
        }
      }
    }
  }
  // горниот потпорен ѕид и пешачката патека на врвот
  const R = 19.6 + 9 * rowD;
  sector(R, R + 1.4, Math.PI, TAU, 0, top + 0.1, 'paving');
  sector(R + 1.4, R + 1.9, Math.PI - 0.02, TAU + 0.02, 0, top + 1.1, 'rubble');
  // краевите на гледалиштето (аналемата) — потпорни ѕидови што се качуваат со редовите
  for (const s of [-1, 1]) {
    const pts = [[10.4, 0], [R + 1.9, 0], [R + 1.9, top + 0.6], [10.4, 1.6]].map(([x, y]) => new THREE.Vector2(s * x, y));
    const ana = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.8, bevelEnabled: false });
    ana.translate(0, 0, -0.8);
    kit.add(ana, new THREE.Matrix4(), 'rubble');
  }

  // ── сцена: ниски ѕидови на просториите, предниот ѕид (пулпитум) ──
  wall(-18, 3.2, 30, 3.2, 1.5, 0.9, 'rubble', true);
  for (const u of [-18, -11, -4, 3, 10, 16, 23, 30]) wall(u, 3.2, u, 14.2, 1.3 + ((u + 40) % 3) * 0.5, 0.8, 'rubble', u % 2 === 0);
  wall(-18, 8.5, 3, 8.5, 1.1, 0.7, 'rubble');
  drape(-17.5, 29.5, 3.6, 13.8, 0.08, 'sand', 4);
  // заштитни покриви (црвена ќерамида) над две простории
  for (const [u0, u1, v0, v1, h] of [[16, 29, 4, 14, 3.2], [3.4, 9.6, 4, 12, 2.6]]) {
    const u = (u0 + u1) / 2;
    const v = (v0 + v1) / 2;
    for (const [pu, pv] of [[u0 + 0.4, v0 + 0.4], [u1 - 0.4, v0 + 0.4], [u0 + 0.4, v1 - 0.4], [u1 - 0.4, v1 - 0.4]]) {
      at(pu, pv, -0.2);
      kit.box(0, 0, 0, 0.35, h + 0.3, 0.35, 'wood');
    }
    at(u, v, 0);
    const lift = Math.max(g(u0, v0), g(u1, v1)) - g(u, v);
    kit.box(0, h + lift, 0, u1 - u0 + 0.6, 0.25, v1 - v0 + 0.6, 'wood');
    kit.gable(0, h + lift + 0.25, 0, u1 - u0 + 0.8, 1.3, v1 - v0 + 0.8, 'roof');
  }

  // ── аркада од тула: задната фасада на сцената (кон локалитетот) ──
  const U0 = -21;
  const U1 = 33;
  const V = 15.2;
  const D = 1.4;
  let lo = Infinity;
  const gs = [];
  const n = 13;
  const bay = (U1 - U0) / n;
  for (let i = 0; i <= n; i++) {
    const gi = g(U0 + i * bay, V);
    gs.push(gi);
    lo = Math.min(lo, gi);
  }
  lo -= 0.4;
  const H = 5.1;
  const mid = (gs[0] + gs[n]) / 2 - lo;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(U1 - U0, 0);
  shape.lineTo(U1 - U0, mid + H);
  shape.lineTo(0, mid + H);
  shape.lineTo(0, 0);
  for (let i = 0; i < n; i++) {
    const end = i === 0 || i === n - 1;
    const w = end ? 3.3 : 2.8;
    const xc = (i + 0.5) * bay;
    const yb = (gs[i] + gs[i + 1]) / 2 - lo + 0.1;
    const ys = yb + (end ? 2.3 : 2.1);
    const hole = new THREE.Path();
    hole.moveTo(xc - w / 2, yb);
    hole.lineTo(xc + w / 2, yb);
    hole.lineTo(xc + w / 2, ys);
    hole.absarc(xc, ys, w / 2, 0, Math.PI, false);
    hole.lineTo(xc - w / 2, yb);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false, curveSegments: 6 });
  geo.translate(-(U1 - U0) / 2, 0, -D / 2);
  const [mx, mz] = W((U0 + U1) / 2, V);
  kit.setFrame(mx, lo, mz, AX, AZ);
  kit.add(geo, new THREE.Matrix4(), 'brick');
  // темните сводови зад лаковите и каменот над аркадата
  kit.box(0, 0, -D / 2 - 0.06, U1 - U0 - 0.4, mid + 4.4, 0.1, 'copper');
  kit.box(0, 0, -D / 2 - 0.6, U1 - U0 - 0.4, mid + 4.4, 1, 'rubble');
  kit.box(0, mid + H - 0.1, -0.2, U1 - U0, 1.1, D + 0.4, 'rubble');
  // дрвени скали до гледалиштето на западниот крај
  kit.box(-(U1 - U0) / 2 - 1.2, 0, -2, 1.6, mid + 2.5, 3, 'wood');
}

// ───────────────────────── Голема базилика ─────────────────────────
function greatBasilica({ wall, drape, sector, at, column, kit }) {
  const U0 = -20;
  const UN = -15.4; // крај на нартексот
  const U1 = 12; // почеток на апсидата
  const V0 = 43.6;
  const V1 = 68.4;
  const VS = 50.2; // стилобати меѓу наосите
  const VN = 61.8;
  const VC = (V0 + V1) / 2;

  // подови: нартекс со мозаик, наоси покриени со песок
  drape(U0 + 0.5, UN - 0.4, V0 + 0.5, V1 - 0.5, 0.1, 'mosaic2', 2);
  drape(U0 + 0.5, UN - 0.4, V0 + 0.5, V0 + 0.9, 0.14, 'mosaic1', 6);
  drape(U0 + 0.5, UN - 0.4, V1 - 0.9, V1 - 0.5, 0.14, 'mosaic1', 6);
  drape(U0 + 0.5, U0 + 0.9, V0 + 0.5, V1 - 0.5, 0.14, 'mosaic1', 6);
  drape(UN - 0.8, UN - 0.4, V0 + 0.5, V1 - 0.5, 0.14, 'mosaic1', 6);
  drape(U0 + 1.15, U0 + 1.35, V0 + 1.1, V1 - 1.1, 0.15, 'slate', 6);
  drape(UN - 1.25, UN - 1.05, V0 + 1.1, V1 - 1.1, 0.15, 'slate', 6);
  // дрва и животни на мозаикот
  for (let v = V0 + 2.6; v < V1 - 2; v += 2.4) {
    const k = Math.round(v);
    drape(U0 + 2.1, U0 + 2.9, v - 0.4, v + 0.4, 0.16, k % 3 ? 'green' : 'mosaic1', 1);
    drape(UN - 2.6, UN - 2.1, v + 0.6, v + 1.1, 0.16, k % 2 ? 'trunk' : 'green', 1);
  }
  drape(UN + 0.5, U1, VS + 0.6, VN - 0.6, 0.1, 'sand', 4);
  drape(UN + 0.5, U1, V0 + 0.5, VS - 0.4, 0.1, 'sand', 4);
  drape(UN + 0.5, U1, VN + 0.4, V1 - 0.5, 0.1, 'sand', 4);

  // ѕидови (на места урнати до темелите)
  wall(U0, V0, U0, V1, 1.3, 0.9, 'rubble', true);
  wall(U0, V0, U1 + 0.4, V0, 1.1, 0.9, 'rubble');
  wall(U0, V1, U1 + 0.4, V1, 1.4, 0.9, 'rubble', true);
  wall(UN, V0, UN, VS - 1.5, 1.2, 0.8, 'rubble');
  wall(UN, VS + 1.6, UN, VN - 1.6, 1.2, 0.8, 'rubble', true); // средна врата
  wall(UN, VN + 1.5, UN, V1, 1.2, 0.8, 'rubble');
  wall(U1, V0, U1, VS, 1.0, 0.8, 'rubble');
  wall(U1, VN, U1, V1, 1.0, 0.8, 'rubble');
  // апсида
  at(U1, VC, -0.3);
  sector(5.4, 6.3, -Math.PI / 2, Math.PI / 2, 0, 1.6, 'rubble', 10);
  sector(0.01, 5.4, -Math.PI / 2, Math.PI / 2, 0, 0.42, 'sand', 8);
  kit.box(-0.3, 0, 0, 0.6, 0.9, 11.6, 'marble'); // олтарна преграда
  // стилобати со бази и колони (повеќето скршени, неколку исправени)
  for (const v of [VS, VN]) {
    wall(UN + 0.4, v, U1, v, 0.45, 0.7, 'marble');
    for (let i = 0; i < 9; i++) {
      const u = UN + 1.8 + i * 3.4;
      const tall = (i === 2 || i === 6) && v === VN;
      column(u, v, tall ? 4.2 : 0.4 + ((i * 7) % 5) * 0.25, 0.3, !tall);
    }
  }
}

// ───────────────────────── Мала базилика ─────────────────────────
function smallBasilica({ wall, drape, sector, at, column, kit }) {
  const U0 = 35;
  const U1 = 56; // почеток на апсидата
  const V0 = 49;
  const V1 = 64.6;
  const VS = 53;
  const VN = 60.6;
  const VC = (V0 + V1) / 2;
  // наос: црно-бел под на квадрати, бочните наоси со мозаик
  for (let u = U0 + 1; u < U1 - 0.5; u += 1.5) {
    for (let v = VS + 0.6, j = 0; v < VN - 0.6; v += 1.5, j++) {
      const k = Math.round((u - U0) / 1.5) + j;
      drape(u, Math.min(u + 1.5, U1 - 0.5), v, Math.min(v + 1.5, VN - 0.6), 0.1, k % 2 ? 'slate' : 'marble', 2);
    }
  }
  drape(U0 + 0.5, U1, V0 + 0.5, VS - 0.4, 0.1, 'mosaic2', 4);
  drape(U0 + 0.5, U1, VN + 0.4, V1 - 0.5, 0.1, 'mosaic2', 4);
  drape(U0 + 1, U1 - 0.5, VC - 0.5, VC + 0.5, 0.13, 'marble', 4); // патека по средината
  wall(U0, V0, U1, V0, 1.0, 0.8, 'rubble', true);
  wall(U0, V1, U1, V1, 1.4, 0.8, 'rubble', true);
  wall(U0, V0, U0, VC - 1.4, 1.2, 0.8, 'rubble');
  wall(U0, VC + 1.4, U0, V1, 1.2, 0.8, 'rubble');
  at(U1, VC, -0.3);
  sector(3.4, 4.1, -Math.PI / 2, Math.PI / 2, 0, 1.3, 'rubble', 8);
  sector(0.01, 3.4, -Math.PI / 2, Math.PI / 2, 0, 0.35, 'marble', 8);
  // две редици бели колони (исправени), олтарни столбчиња меѓу нив
  for (const v of [VS, VN]) {
    wall(U0 + 0.5, v, U1, v, 0.3, 0.8, 'marble');
    for (let i = 0; i < 7; i++) {
      const u = U0 + 2 + i * 3;
      column(u, v, i === 3 ? 1.2 : 3.4 + ((i * 3) % 4) * 0.25, 0.3, i === 3);
    }
  }
  for (let i = 0; i < 4; i++) {
    for (const v of [VC - 1.3, VC + 1.3]) {
      at(U1 - 6 + i * 1.6, v, -0.2);
      kit.box(0, 0, 0, 0.4, 1.4, 0.4, 'marble');
    }
  }
}

// ───────────────────────── урнатини на куќите ─────────────────────────
// Блокови 10×8 m по мрежата на градот; на секои три колони улица. Ѕидови од речен камен,
// понекогаш со редови тула на врвот; во некои простории песок (покриени подови).
const RESERVED = [
  [-24, 33, -30, 17], // театар и сцена
  [-18, 44, 16, 26], // улица и колонада
  [-23, 19, 41, 71], // Голема базилика
  [33, 62, 46, 68], // Мала базилика
  [21, 34, 48, 54], // лакови
  [18, 27, 63, 70], // фонтана
  [-38, -20, 7, 26], // терми
];

function ruins({ wall, drape, inside, huts }) {
  const CU = 10;
  const CV = 8;
  const reserved = [...RESERVED, ...huts.map(([u, v]) => [u - 6, u + 6, v - 4, v + 4])];
  const free = (u0, u1, v0, v1) => !reserved.some(([a0, a1, b0, b1]) => u1 > a0 && u0 < a1 && v1 > b0 && v0 < b1);
  const ok = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u0, v1], [u1, v1]].every(([u, v]) => inside(u, v)) && free(u0, u1, v0, v1);
  const built = new Set();
  const cells = [];
  for (let i = -10; i < 10; i++) {
    if (((i % 3) + 3) % 3 === 2) continue; // улица
    for (let j = -4; j < 12; j++) {
      const u0 = i * CU + 1;
      const v0 = j * CV - 2;
      const u1 = u0 + CU;
      const v1 = v0 + CV;
      if (!ok(u0 - 1, u1 + 1, v0 - 1, v1 + 1)) continue;
      // северниот дел (кон ридот) е главно неископан
      const p = v1 < 5 ? 0.25 : 0.85;
      if (hash(i, j) > p) continue;
      built.add(`${i},${j}`);
      cells.push([i, j, u0, v0, u1, v1]);
    }
  }
  for (const [i, j, u0, v0, u1, v1] of cells) {
    const r = (k) => hash(i, j, k);
    const h = (k) => 0.5 + r(k) * 1.5;
    const cap = r(9) < 0.15;
    // секој блок ги црта северниот и западниот ѕид; јужниот/источниот само ако нема сосед
    const sides = [
      [u0, v0, u1, v0, true],
      [u0, v0, u0, v1, true],
      [u0, v1, u1, v1, !built.has(`${i},${j + 1}`)],
      [u1, v0, u1, v1, !built.has(`${i + 1},${j}`)],
    ];
    sides.forEach(([a, b, c, d, draw], k) => {
      if (!draw || r(k + 1) < 0.15) return;
      if (r(k + 5) < 0.45) {
        // врата / урнат дел на средина
        const t = 0.35 + r(k + 11) * 0.2;
        const g = 1.4 / Math.hypot(c - a, d - b);
        wall(a, b, a + (c - a) * (t - g / 2), b + (d - b) * (t - g / 2), h(k), 0.7, 'rubble', cap);
        wall(a + (c - a) * (t + g / 2), b + (d - b) * (t + g / 2), c, d, h(k) * 0.7, 0.7, 'rubble', cap);
      } else wall(a, b, c, d, h(k), 0.7, 'rubble', cap);
    });
    // преграда внатре
    const s = r(13);
    if (s < 0.45) {
      const um = u0 + CU * (0.35 + r(14) * 0.3);
      wall(um, v0, um, v1 - 2, h(15) * 0.8, 0.6, 'rubble');
    } else if (s < 0.75) {
      const vm = v0 + CV * (0.4 + r(14) * 0.2);
      wall(u0 + 1.5, vm, u1, vm, h(15) * 0.8, 0.6, 'rubble');
    }
    // покриени подови (песок) или мозаик
    const f = r(17);
    if (f < 0.12) drape(u0 + 0.5, u1 - 0.5, v0 + 0.5, v1 - 0.5, 0.08, 'sand', 5);
    else if (f < 0.16) drape(u0 + 0.6, u0 + 5, v0 + 0.6, v1 - 0.6, 0.08, 'mosaic1', 5);
  }
}
