// Митрополијата (Преспанско-пелагониска епархија) — рачно, според фотографии и сателит.
// Еклектичка вила: висок камен сокл и приземје со рустика; кат со прозорци со тимпанони и
// балустради; среден ризалит со три лачни прозорци меѓу столбови; позлатени фризови и венец со
// конзоли; мансарден покрив од тмносив лим со баџи, над средината висок павилјон со три лачни
// прозорци и украсен забат; на врвот ограда. Пред неа градина со камен ѕид, железна ограда и
// порта кон улицата „Влатко Миленкоски“, а од страните ѕидови со ќерамида.
//
// Рамка: u = по долгата страна (OSM w302354632), v = нанадвор кон градината (југ).

import * as THREE from 'three';
import { Kit } from './kit.js';
import { onFace, facePos, disc, archWin } from './facade.js';
import { buildingShape } from '../buildings.js';

const PI = Math.PI;
const HW = 8.3; // половина ширина (u)
const HD = 6.3; // половина длабочина (v)
const RF = [3.35, 1.9]; // преден ризалит: половина ширина, истурање
const RB = [4.85, 1.8]; // заден ризалит
const SOCLE = 1.3; // висок сокл (подигнато приземје)
const BELT = 5.2; // венец меѓу катовите
const EAVE = 10.2; // венец под мансардата
const FENCE = 21.5; // оградата кон улицата (v)

/** Кутија чии горни темиња се вовлечени за inset (мансарда, пресечена пирамида). */
function frustum(w, h, d, inset) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) {
      p.setX(i, p.getX(i) * ((w - 2 * inset) / w));
      p.setZ(i, p.getZ(i) * ((d - 2 * inset) / d));
    }
  }
  g.translate(0, h / 2, 0);
  g.computeVertexNormals();
  return g;
}

/** Сегментен (полуелипсест) забат: плоча со ширина w, висина h, дебелина t (во рамнината x–y). */
function segment(w, h, t) {
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, 0);
  sh.absellipse(0, 0, w / 2, h, PI, 0, true);
  sh.closePath();
  return new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 14 });
}

/** Прозорец на катот: рамка, тимпанон (триаголен) и балустрада под него. */
function nobleWin(kit, face, c, s, y0, w, h, { pediment = true } = {}) {
  const [u, v] = facePos(face, c, s);
  const at = (y, z = 0, x = 0) => onFace(face, u, y, v).multiply(new THREE.Matrix4().makeTranslation(x, 0, z));
  kit.add(new THREE.BoxGeometry(w + 0.6, h + 0.5, 0.12).translate(0, h / 2, 0), at(y0 - 0.25), 'accent');
  kit.add(new THREE.BoxGeometry(w, h, 0.18).translate(0, h / 2, 0), at(y0), 'window');
  if (pediment) {
    const tri = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.55, 0), new THREE.Vector2(w / 2 + 0.55, 0), new THREE.Vector2(0, 0.7)]);
    kit.add(new THREE.ExtrudeGeometry(tri, { depth: 0.3, bevelEnabled: false }), at(y0 + h + 0.35), 'accent');
    kit.add(new THREE.BoxGeometry(w + 1.2, 0.18, 0.34).translate(0, 0.09, 0.15), at(y0 + h + 0.2), 'accent');
    // позлатени ленти до прозорецот
    for (const sx of [-1, 1]) kit.add(new THREE.BoxGeometry(0.9, 0.35, 0.06), at(y0 + h - 0.4, 0.04, sx * (w / 2 + 0.95)), 'crestGold');
  }
  // балустрада
  kit.add(new THREE.BoxGeometry(w + 0.6, 0.12, 0.3).translate(0, 0, 0.15), at(y0 - 0.25), 'accent');
  for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 5) {
    kit.add(new THREE.CylinderGeometry(0.07, 0.09, 0.7, 6).translate(x, -0.6, 0.15), at(y0 - 0.25), 'roof');
  }
  kit.add(new THREE.BoxGeometry(w + 0.6, 0.12, 0.3).translate(0, -1.0, 0.15), at(y0 - 0.25), 'accent');
}

/** Баџа на мансардата: ѕид со лачен прозорец и сегментен забат (на лице face, висина y0). */
function dormer(kit, face, c, s, y0) {
  const [u, v] = facePos(face, c, s);
  const at = (y, z = 0) => onFace(face, u, y, v).multiply(new THREE.Matrix4().makeTranslation(0, 0, z));
  kit.add(new THREE.BoxGeometry(1.7, 1.9, 1.6).translate(0, 0.95, -0.8), at(y0), 'ochre');
  kit.add(new THREE.BoxGeometry(0.7, 1.0, 0.1).translate(0, 0.5, 0.02), at(y0 + 0.3), 'window');
  kit.add(disc(0.35, 0.1, 10), at(y0 + 1.3, 0.02), 'window');
  kit.add(segment(2.0, 0.55, 0.3), at(y0 + 1.9, -0.2), 'accent');
  kit.add(new THREE.BoxGeometry(0.22, 1.9, 0.2).translate(-0.85, 0.95, 0.05), at(y0), 'accent');
  kit.add(new THREE.BoxGeometry(0.22, 1.9, 0.2).translate(0.85, 0.95, 0.05), at(y0), 'accent');
}

function villa(kit) {
  // ── тело, ризалити, сокл, рустика, венци ──
  const parts = [
    [-HW, HW, -HD, HD],
    [-RF[0], RF[0], HD - 0.1, HD + RF[1]],
    [-RB[0], RB[0], -HD - RB[1], -HD + 0.1],
  ];
  for (const [u0, u1, v0, v1] of parts) {
    const cu = (u0 + u1) / 2;
    const cv = (v0 + v1) / 2;
    const w = u1 - u0;
    const d = v1 - v0;
    kit.box(cu, -0.6, cv, w, EAVE + 0.6, d, 'ochre');
    kit.box(cu, -0.6, cv, w + 0.16, SOCLE + 0.6, d + 0.16, 'plinth');
    for (let y = SOCLE + 0.55; y < BELT - 0.3; y += 0.55) kit.box(cu, y, cv, w + 0.04, 0.06, d + 0.04, 'stone');
    kit.box(cu, BELT, cv, w + 0.3, 0.4, d + 0.3, 'accent');
    kit.box(cu, EAVE - 1.3, cv, w + 0.1, 0.6, d + 0.1, 'crestGold'); // позлатен фриз
    kit.box(cu, EAVE - 0.6, cv, w + 0.3, 0.25, d + 0.3, 'accent');
    kit.box(cu, EAVE - 0.35, cv, w + 0.9, 0.45, d + 0.9, 'accent'); // венец
    // конзоли под венецот (по должина на предните и задните лица)
    for (let x = u0 + 0.4; x < u1; x += 0.7) {
      for (const vv of [v0 - 0.25, v1 + 0.25]) kit.box(x, EAVE - 0.65, vv, 0.18, 0.3, 0.4, 'accent');
    }
  }

  // ── мансарда (тело) со рамен врв и ограда ──
  kit.add(frustum(2 * HW + 0.8, 3.2, 2 * HD + 0.8, 1.4), Kit.at(0, EAVE + 0.1, 0), 'dome');
  const tw = 2 * HW + 0.8 - 2.8;
  const td = 2 * HD + 0.8 - 2.8;
  const ty = EAVE + 3.3;
  for (const [x, z, w, d] of [[0, -td / 2, tw, 0.05], [0, td / 2, tw, 0.05], [-tw / 2, 0, 0.05, td], [tw / 2, 0, 0.05, td]]) {
    kit.box(x, ty + 0.7, z, w + 0.05, 0.06, d + 0.05, 'metal');
    kit.box(x, ty, z, w + 0.05, 0.06, d + 0.05, 'metal');
  }
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kit.box((x * tw) / 2, ty, (z * td) / 2, 0.06, 0.7, 0.06, 'metal');

  // ── среден павилјон: висока мансарда, предниот ѕид со три лачни прозорци и украсен забат ──
  const pv = HD + RF[1];
  kit.add(frustum(6.6, 5.2, 9.0, 1.0), Kit.at(0, EAVE + 0.1, pv - 4.7), 'dome');
  kit.box(0, EAVE + 0.1, pv - 0.9, 5.8, 3.8, 1.6, 'ochre');
  kit.box(0, EAVE + 3.9, pv - 0.9, 6.0, 0.3, 1.7, 'accent');
  const pc = pv - 0.08;
  archWin(kit, '+v', pc, 0, EAVE + 0.6, 1.1, 1.8, 'window', 'accent');
  for (const s of [-1.75, 1.75]) archWin(kit, '+v', pc, s, EAVE + 0.8, 0.75, 1.5, 'window', 'accent');
  for (const s of [-2.75, -1.1, 1.1, 2.75]) kit.box(s, EAVE + 0.1, pv - 0.05, 0.35, 3.8, 0.2, 'accent');
  // сегментен забат со „круна“
  kit.add(segment(5.4, 1.1, 0.4), Kit.at(0, EAVE + 4.2, pv - 0.4), 'accent');
  kit.add(segment(4.2, 0.75, 0.1), Kit.at(0, EAVE + 4.25, pv - 0.02), 'ochre');
  kit.add(disc(0.45, 0.3, 12), Kit.at(0, EAVE + 4.8, pv - 0.05), 'crestGold');
  const top = EAVE + 5.3;
  for (const [x, z, w, d] of [[0, pv - 2.2, 4.6, 0.05], [0, pv - 7.2, 4.6, 0.05], [-2.3, pv - 4.7, 0.05, 5], [2.3, pv - 4.7, 0.05, 5]]) {
    kit.box(x, top + 0.7, z, w, 0.06, d, 'metal');
  }
  for (const [x, z] of [[-2.3, pv - 2.2], [2.3, pv - 2.2], [-2.3, pv - 7.2], [2.3, pv - 7.2]]) kit.box(x, top, z, 0.06, 0.7, 0.06, 'metal');

  // ── баџи ──
  for (const s of [-5.8, 5.8]) dormer(kit, '+v', HD - 0.35, s, EAVE + 0.4);
  for (const s of [-5.8, 5.8]) dormer(kit, '-v', -HD + 0.35, s, EAVE + 0.4);
  for (const face of ['+u', '-u']) for (const s of [-3, 3]) dormer(kit, face, (face === '+u' ? 1 : -1) * (HW - 0.35), s, EAVE + 0.4);

  // ── предна фасада ──
  const cf = HD + 0.02;
  for (const s of [-5.8, 5.8]) {
    nobleWin(kit, '+v', cf, s, BELT + 1.2, 1.3, 2.4);
    nobleWin(kit, '+v', cf, s, SOCLE + 0.9, 1.2, 2.1, { pediment: false });
  }
  const cr = HD + RF[1] + 0.02;
  // ризалит: три лачни прозорци меѓу столбови (кат), долу два прозорци и врата
  for (const s of [-2.1, 0, 2.1]) {
    archWin(kit, '+v', cr, s, BELT + 1.1, 1.15, 2.0, 'window', 'accent');
    kit.add(new THREE.BoxGeometry(1.4, 0.12, 0.3).translate(0, 0, 0.15), onFace('+v', s, BELT + 0.8, cr), 'accent');
    for (let x = -0.55; x <= 0.56; x += 0.275) kit.add(new THREE.CylinderGeometry(0.06, 0.08, 0.6, 6).translate(x, 0.45, 0.15), onFace('+v', s, BELT + 0.2, cr), 'roof');
  }
  for (const s of [-3.15, -1.05, 1.05, 3.15]) {
    kit.cylinder(s, BELT + 0.4, cr, 0.24, EAVE - BELT - 1.7, 'accent', { seg: 10 });
    kit.box(s, EAVE - 1.35, cr, 0.6, 0.35, 0.5, 'crestGold'); // капител
  }
  for (const s of [-2.1, 2.1]) nobleWin(kit, '+v', cr, s, SOCLE + 0.9, 1.0, 2.0, { pediment: false });
  // влез: врата меѓу два столба, скали
  const [du, dv] = facePos('+v', cr, 0);
  kit.add(new THREE.BoxGeometry(1.6, 2.9, 0.18).translate(0, 1.45, 0), onFace('+v', du, SOCLE, dv), 'wood');
  for (const s of [-1.2, 1.2]) kit.cylinder(s, SOCLE, cr + 0.4, 0.22, BELT - SOCLE, 'accent', { seg: 10 });
  for (let i = 0; i < 4; i++) kit.box(0, -0.6, cr + 0.6 + i * 0.45, 3.6 + i * 0.3, SOCLE + 0.6 - i * 0.33, 0.5, 'accent');

  // ── бочни и задна фасада ──
  for (const face of ['+u', '-u']) {
    const c = (face === '+u' ? 1 : -1) * (HW + 0.02);
    for (const s of [-3.6, 0, 3.6]) {
      nobleWin(kit, face, c, s, BELT + 1.2, 1.1, 2.3);
      nobleWin(kit, face, c, s, SOCLE + 0.9, 1.0, 2.0, { pediment: false });
    }
  }
  for (const s of [-6, -2.4, 2.4, 6]) {
    const c = Math.abs(s) < RB[0] ? -HD - RB[1] - 0.02 : -HD - 0.02;
    nobleWin(kit, '-v', c, s, BELT + 1.2, 1.1, 2.3, { pediment: false });
    nobleWin(kit, '-v', c, s, SOCLE + 0.9, 1.0, 2.0, { pediment: false });
  }
}

/** Предна градина: патека, тревници, грмушки; камен ѕид со железна ограда и порта; бочни ѕидови. */
function garden(kit, hf, toWorld, g0) {
  const gy = (u, v) => hf.sample(...toWorld(u, v)) - g0;
  const front = HD + RF[1] + 2.2;
  // патека и тревници
  kit.box(0, gy(0, 14) - 0.3, (front + FENCE) / 2, 2.2, 0.36, FENCE - front, 'paving');
  for (const s of [-1, 1]) {
    kit.box(s * 6, gy(s * 6, 14) - 0.3, (HD + FENCE) / 2 + 0.5, 9.4, 0.38, FENCE - HD - 1.5, 'green');
    for (const v of [12, 17]) kit.sphere(s * 2.2, gy(s * 2, v) + 0.6, v, 0.75, 'green', { seg: 10 });
  }
  // камен ѕид со решетка; портата во средината (вовлечена)
  const yF = gy(0, FENCE);
  for (const s of [-1, 1]) {
    const u0 = s * 2.3;
    const u1 = s * 11.5;
    const L = Math.abs(u1 - u0);
    const cu = (u0 + u1) / 2;
    kit.box(cu, yF - 0.5, FENCE, L, 1.75, 0.6, 'plinth');
    kit.box(cu, yF + 1.25, FENCE, L + 0.1, 0.14, 0.7, 'stone');
    kit.box(cu, yF + 1.55, FENCE, L, 0.06, 0.06, 'metal');
    kit.box(cu, yF + 2.75, FENCE, L, 0.06, 0.06, 'metal');
    for (let x = Math.min(u0, u1) + 0.15; x < Math.max(u0, u1); x += 0.28) kit.box(x, yF + 1.39, FENCE, 0.04, 1.6, 0.04, 'metal');
    for (let x = Math.min(u0, u1); x <= Math.max(u0, u1) + 0.01; x += L / 3) kit.box(x, yF + 1.39, FENCE, 0.16, 1.9, 0.16, 'metal');
    // заоблено вовлекување кон портата
    kit.add(new THREE.CylinderGeometry(1.3, 1.3, 1.75, 10, 1, true, s > 0 ? 0 : PI / 2, PI / 2).translate(0, 0.875, 0), Kit.at(s * 1.0, yF - 0.5, FENCE - 1.3), 'plinth');
    // бочен ѕид со ќерамида
    const sv0 = HD + 1;
    kit.box(s * 11.5, gy(s * 11.5, 14) - 0.5, (sv0 + FENCE) / 2, 0.35, 2.9, FENCE - sv0, 'plaster');
    kit.gable(s * 11.5, gy(s * 11.5, 14) + 2.4, (sv0 + FENCE) / 2, FENCE - sv0, 0.3, 0.7, 'roof', PI / 2);
  }
  // порта: две крила, лак со украс и крст
  const gv = FENCE - 1.2;
  kit.box(0, yF - 0.3, gv + 0.6, 3.2, 0.3, 1.6, 'stone');
  for (const s of [-1, 1]) kit.box(s * 1.6, yF, gv, 0.2, 3.4, 0.2, 'metal');
  kit.box(0, yF, gv, 3.0, 1.3, 0.06, 'metal'); // долу полни крила
  kit.box(0, yF + 1.3, gv, 3.0, 0.08, 0.08, 'metal');
  kit.box(0, yF + 2.75, gv, 3.0, 0.08, 0.08, 'metal');
  for (let x = -1.35; x <= 1.36; x += 0.3) kit.box(x, yF + 1.3, gv, 0.05, 1.5, 0.05, 'metal'); // горе решетка
  kit.add(new THREE.TorusGeometry(1.6, 0.05, 4, 16, PI).scale(1, 0.4, 1), Kit.at(0, yF + 2.8, gv), 'metal');
  kit.add(new THREE.TorusGeometry(1.0, 0.04, 4, 12, PI), Kit.at(0, yF + 2.8, gv), 'metal');
  kit.box(0, yF + 2.8, gv, 0.06, 1.6, 0.06, 'metal');
  kit.box(0, yF + 3.9, gv, 0.7, 0.06, 0.06, 'metal');
}

export function mitropolija(kit, item, ctx) {
  const ring = item.polys[0][0];
  // оска: доминантен агол на рабовите (по модул 90°), со тежина по должина — основата е речиси
  // квадратна со ризалитите, па OBB не е сигурен. u ≈ исток, v = (−az, ax) ≈ југ (кон улицата).
  let sx = 0;
  let sz = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const dx = ring[i + 1][0] - ring[i][0];
    const dz = ring[i + 1][1] - ring[i][1];
    const a = Math.atan2(dz, dx) * 4; // агол × 4: рабовите на 90° се совпаѓаат
    const l = Math.hypot(dx, dz);
    sx += Math.cos(a) * l;
    sz += Math.sin(a) * l;
  }
  const th = Math.atan2(sz, sx) / 4;
  const ax = Math.cos(th);
  const az = Math.sin(th);
  // центар: средина на опсегот на основата во (u, v)
  const us = ring.map(([x, z]) => x * ax + z * az);
  const vs = ring.map(([x, z]) => -x * az + z * ax);
  const um = (Math.min(...us) + Math.max(...us)) / 2;
  const vm = (Math.min(...vs) + Math.max(...vs)) / 2;
  const cx = um * ax - vm * az;
  const cz = um * az + vm * ax;
  const g0 = item.ground.mean;
  const toWorld = (u, v) => [cx + ax * u - az * v, cz + az * u + ax * v];
  kit.setFrame(cx, g0, cz, ax, az);
  villa(kit);
  garden(kit, ctx.hf, toWorld, g0);
  clearGarden(ctx, cx, cz, ax, az);
}

/**
 * Зградите без OSM извор (Overture/Microsoft, препознаени од снимки) што паѓаат во предната
 * градина се отстрануваат — таму е тревник, а не куќа.
 */
function clearGarden(ctx, cx, cz, ax, az) {
  const pack = ctx.buildings;
  const q = pack.meta.q;
  for (let b = 0; b < pack.meta.count; b++) {
    if (pack.arrays.osmId[b]) continue;
    const r0 = pack.arrays.ringPt[pack.arrays.polyRing[b]];
    const x = pack.arrays.coords[r0 * 2] * q;
    const z = pack.arrays.coords[r0 * 2 + 1] * q;
    if (Math.abs(x - cx) > 60 || Math.abs(z - cz) > 60) continue;
    // опсег во (u, v); се отстранува ако се преклопува со градината
    const loc = buildingShape(pack, b).rings[0].map(([px, pz]) => [(px - cx) * ax + (pz - cz) * az, -(px - cx) * az + (pz - cz) * ax]);
    const u0 = Math.min(...loc.map((p) => p[0]));
    const u1 = Math.max(...loc.map((p) => p[0]));
    const v0 = Math.min(...loc.map((p) => p[1]));
    const v1 = Math.max(...loc.map((p) => p[1]));
    if (u0 < 11 && u1 > -11 && v0 < FENCE - 1 && v1 > HD + 1.5) ctx.skip.add(b);
  }
}
