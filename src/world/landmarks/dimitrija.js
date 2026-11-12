// Црквата „Св. Димитриј“ — рачно, според фотографии (двор, камбанарија, источната страна).
// Тробродна базилика под широк покрив со низок наклон (сив лим); на север и југ двокатни
// галерии (аркади со застаклени лакови долу, правоаголни прозорци горе) меѓу четири аголни
// павилјони; на исток три полигонални апсиди, над нив четирилист и два окулуса. Ѕидовите се
// од камен со ленти од тули. Самостојна камбанарија југозападно (OSM): камено подножје со
// врата и крст, тулено стебло со камен крст, ѕвонара со по три лака, четиристрешен покрив.
// Во дворот базен; кон улицата (исток) ограда: бел камен ѕид, железна решетка, порта со столбови.
//
// Рамка: u = исток (по оската на OSM основата), v = југ, почеток = центарот на основата.

import * as THREE from 'three';
import { Kit } from './kit.js';
import { onFace, facePos, disc, archWin, rectWin, oculus } from './facade.js';

const PI = Math.PI;
// оска на основата (јужниот раб во OSM, w38582552) — речиси точно исток–запад
const AX = 0.99946;
const AZ = -0.03282;

// ── основа во локални метри (од OSM) ──
const U0 = -15.8; // западен ѕид
const U1 = 15.6; // источен ѕид
const BODY = 10; // половина ширина на телото на црквата (наос + бродови)
const GAL = 15.4; // надворешно лице на галериите (север −, југ +)
const PAV = [
  // аголни павилјони: [u0, u1, v0, v1]
  [-15.8, -9.9, 10, 19.0], // ЈЗ
  [9.9, 15.4, 10, 18.3], // ЈИ
  [-16.1, -11.1, -19.2, -10], // СЗ
  [11.1, 15.8, -18.1, -10], // СИ
];
const H_BODY = 11; // стреа на телото
const RISE = 3; // висина на покривот (низок наклон)
const H_GAL = 8.6; // стреа на галериите
const H_PAV = 9.4; // стреа на павилјоните

/** Четирилист: четири круга (стакло) на камена подлога. */
function quatrefoil(kit, face, c, s, y, r) {
  const [u, v] = facePos(face, c, s);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    kit.add(disc(r * 0.62, 0.14, 12).translate(dx * r * 0.45, dy * r * 0.45, 0), onFace(face, u, y, v), 'stone');
    kit.add(disc(r * 0.45, 0.22, 12).translate(dx * r * 0.45, dy * r * 0.45, 0), onFace(face, u, y, v), 'window');
  }
}

/** Олук (вертикална цевка) по лицето. */
function downpipe(kit, face, c, s, h) {
  const [u, v] = facePos(face, c, s);
  kit.add(new THREE.CylinderGeometry(0.09, 0.09, h, 5).translate(0, h / 2, 0.12), onFace(face, u, 0, v), 'eave');
}

/** Кутија [u0,u1]×[v0,v1], од y0 до y1, со ленти од тули на секои ~1.1 m. */
function stripedBox(kit, u0, u1, v0, v1, y0, y1, part = 'wall') {
  const w = u1 - u0;
  const d = v1 - v0;
  const cu = (u0 + u1) / 2;
  const cv = (v0 + v1) / 2;
  kit.box(cu, y0, cv, w, y1 - y0, d, part);
  for (let y = 0.9; y < y1 - 0.4; y += 0.9) kit.box(cu, y, cv, w + 0.04, 0.09, d + 0.04, 'mosaic1');
}

/** Плитка покривна плоча (кутија) наклонета околу u: од (v0, y0) до (v1, y1), должина L. */
function slope(kit, uc, L, v0, y0, v1, y1, part = 'dome') {
  const len = Math.hypot(v1 - v0, y1 - y0);
  const ang = Math.atan2(y1 - y0, v1 - v0);
  kit.add(new THREE.BoxGeometry(L, 0.2, len), Kit.atE(uc, (y0 + y1) / 2, (v0 + v1) / 2, -ang), part);
}

/** Полигонална апсида на источниот ѕид: центар (u, v), радиус r, висина h, покрив од лим. */
function apse(kit, u, v, r, h, { win = true } = {}) {
  const seg = 10;
  kit.cylinder(u, -0.5, v, r, h + 0.5, 'wall', { seg, rotY: PI / seg });
  for (let y = 0.9; y < h - 0.3; y += 0.9) kit.cylinder(u, y, v, r + 0.03, 0.09, 'mosaic1', { seg, rotY: PI / seg });
  // венец на половина висина и слепи лакови над него (по еден на секоја страна кон исток)
  kit.cylinder(u, h * 0.5, v, r + 0.1, 0.22, 'stone', { seg, rotY: PI / seg });
  const fw = 2 * r * Math.sin(PI / seg); // ширина на страната
  for (let i = -2; i <= 2; i++) {
    const a = (i * 2 * PI) / seg;
    const d = r * Math.cos(PI / seg) + 0.04;
    kit.add(new THREE.TorusGeometry(fw * 0.36, 0.1, 4, 10, PI), Kit.at(u + Math.cos(a) * d, h * 0.68, v - Math.sin(a) * d, a + PI / 2), 'mosaic1');
  }
  kit.cylinder(u, h - 0.45, v, r + 0.06, 0.45, 'mosaic1', { seg, rotY: PI / seg });
  kit.cone(u, h, v, r + 0.35, r * 0.45, 'dome', { seg, rotY: PI / seg });
  if (win) {
    // тесен прозорец кон исток
    kit.add(new THREE.BoxGeometry(0.16, 1.6, 0.6).translate(0, 0.8, 0), Kit.at(u + r * 0.96, h * 0.35, v), 'window');
  }
}

/** Мал железен крст. */
function cross(kit, u, y, v, s = 1, rotY = 0) {
  kit.cylinder(u, y, v, 0.07 * s, 2.0 * s, 'metal', { seg: 5 });
  kit.add(new THREE.BoxGeometry(0.9 * s, 0.09 * s, 0.09 * s), Kit.at(u, y + 1.45 * s, v, rotY), 'metal');
}

// ───────────────────────── Црквата ─────────────────────────
function body(kit) {
  // подножје (камен)
  kit.box((U0 + U1) / 2, -0.6, 0, U1 - U0 + 0.3, 1.0, 2 * GAL + 0.3, 'plinth');
  // тело: наос и бродови до стреата; калкан (низок наклон) на исток и запад
  stripedBox(kit, U0, U1, -BODY, BODY, 0, H_BODY);
  kit.gable((U0 + U1) / 2, H_BODY, 0, U1 - U0, RISE, 2 * BODY, 'wall');
  for (const s of [-1, 1]) slope(kit, (U0 + U1) / 2, U1 - U0 + 0.9, s * (BODY + 0.7), H_BODY - 0.25, 0, H_BODY + RISE + 0.05);
  kit.box((U0 + U1) / 2, H_BODY + RISE - 0.05, 0, U1 - U0 + 0.9, 0.22, 0.3, 'dome'); // слеме
  cross(kit, 0, H_BODY + RISE, 0, 1.3, PI / 2);

  // галерии (север и југ) меѓу павилјоните
  for (const s of [-1, 1]) {
    const v0 = s > 0 ? BODY : -GAL;
    const v1 = s > 0 ? GAL : -BODY;
    stripedBox(kit, -10, 10, v0, v1, 0, H_GAL);
    // покрив на една вода: од стреата до ѕидот на телото
    slope(kit, 0, 20.2, s * (GAL + 0.6), H_GAL - 0.2, s * BODY, H_BODY - 0.6);
    const face = s > 0 ? '+v' : '-v';
    const c = s * (GAL + 0.02);
    // приземје: 7 застаклени лакови; кат: правоаголни прозорци
    for (let i = 0; i < 7; i++) {
      const x = -8.6 + i * 2.87;
      archWin(kit, face, c, x, 0.5, 2.0, 2.5);
      rectWin(kit, face, c, x, 5.2, 0.85, 1.35);
    }
    for (const x of [-9.7, -4.3, 1.45, 7.2, 9.7]) downpipe(kit, face, c, x, H_GAL);
    // камен венец меѓу катовите
    kit.box(0, 4.35, s * (GAL + 0.06), 20, 0.22, 0.14, 'stone');
  }

  // павилјони на аглите
  for (const [u0, u1, v0, v1] of PAV) {
    stripedBox(kit, u0, u1, v0, v1, 0, H_PAV);
    kit.box((u0 + u1) / 2, H_PAV, (v0 + v1) / 2, u1 - u0 + 0.8, 0.25, v1 - v0 + 0.8, 'eave');
    kit.hip((u0 + u1) / 2, H_PAV + 0.25, (v0 + v1) / 2, u1 - u0 + 0.8, 1.5, v1 - v0 + 0.8, 'dome');
    const south = v1 > 0;
    const vf = south ? v1 + 0.02 : v0 - 0.02;
    const face = south ? '+v' : '-v';
    const um = (u0 + u1) / 2;
    const s = south ? um : -um;
    archWin(kit, face, vf, s, 0.5, 2.2, 2.6);
    rectWin(kit, face, vf, s, 5.4, 0.9, 1.5);
    // бочни лица (исток/запад): прозорци
    const east = u0 > 0;
    const fu = east ? '+u' : '-u';
    const uf = east ? u1 + 0.02 : u0 - 0.02;
    const vm = south ? v1 - 2.8 : v0 + 2.8;
    const sv = east ? -vm : vm;
    archWin(kit, fu, uf, sv, 0.5, 1.6, 2.4);
    rectWin(kit, fu, uf, sv, 5.4, 0.9, 1.5);
    kit.box(um, 4.35, south ? v1 + 0.06 : v0 - 0.06, u1 - u0, 0.22, 0.14, 'stone');
  }

  // исток: три апсиди, четирилист и окулуси
  apse(kit, U1 - 0.2, 0.7, 3.3, 7.2);
  apse(kit, U1 - 0.2, -6.4, 2.2, 5.6);
  apse(kit, U1 - 0.2, 7.6, 2.2, 5.6);
  quatrefoil(kit, '+u', U1 + 0.02, -0.7, 10.6, 1.2);
  oculus(kit, '+u', U1 + 0.02, 6.4, 7.6, 0.8);
  oculus(kit, '+u', U1 + 0.02, -7.6, 7.6, 0.8);
  for (const s of [-1, 1]) {
    // лачни прозорци горе на бродовите
    archWin(kit, '+u', U1 + 0.02, s * 4.2, 8.2, 0.8, 1.2);
    downpipe(kit, '+u', U1 + 0.02, s * 9.6, H_BODY);
  }

  // запад: влез (лачна врата) и прозорци
  archWin(kit, '-u', U0 - 0.02, 0, 0.3, 2.0, 2.6, 'wood');
  for (const s of [-1, 1]) {
    archWin(kit, '-u', U0 - 0.02, s * 5, 2.0, 1.1, 1.8);
    archWin(kit, '-u', U0 - 0.02, s * 5, 6.6, 1.0, 1.4);
  }
  oculus(kit, '-u', U0 - 0.02, 0, 7.6, 1.0);
  quatrefoil(kit, '-u', U0 - 0.02, 0, 11.4, 0.9);
}

// ───────────────────────── Камбанаријата ─────────────────────────
// Рамка: u кон исток (вратата), центар на OSM основата (w961554014).
function belfry(kit) {
  const W = 4.6; // стебло
  const H = 19.5; // стреа
  // скали и камено подножје со благ кос ѕид
  kit.box(0.5, -0.6, 0, 6.6, 0.9, 6.2, 'plinth');
  kit.box(0.3, 0.3, 0, 6.0, 0.3, 5.8, 'plinth');
  kit.cylinder(0, 0.6, 0, (W + 1.2) * Math.SQRT1_2, 4.8, 'stone', { top: (W + 0.5) * Math.SQRT1_2, seg: 4, rotY: PI / 4 });
  kit.box(0, 5.4, 0, W + 0.4, 0.8, W + 0.4, 'stone');
  // тулено стебло
  kit.box(0, 6.2, 0, W, H - 6.2, W, 'roof');
  for (const face of ['+u', '-u', '+v', '-v']) {
    const c = W / 2 + 0.02;
    const at = (s, y) => {
      const [u, v] = facePos(face, c, s);
      return onFace(face, u, y, v);
    };
    // камен крст на секое лице (вертикала и крак) — ист камен како подножјето
    kit.add(new THREE.BoxGeometry(1.4, 7.4, 0.1).translate(0, 3.7, 0), at(0, 6.2), 'stone');
    kit.add(new THREE.BoxGeometry(2.8, 1.1, 0.1).translate(0, 0.55, 0), at(0, 11.4), 'stone');
    // ѕвонара: три лачни отвори со камени столпчиња
    for (const s of [-1.15, 0, 1.15]) {
      kit.add(new THREE.BoxGeometry(0.72, 2.2, 0.14).translate(0, 1.1, 0), at(s, 15.2), 'copper');
      kit.add(disc(0.36, 0.14, 10), at(s, 17.4), 'copper');
      kit.add(new THREE.TorusGeometry(0.46, 0.1, 4, 10, PI), at(s, 17.4), 'stone');
    }
  }
  // венци: под ѕвонарата и под стреата (камен)
  kit.box(0, 14.5, 0, W + 0.3, 0.3, W + 0.3, 'stone');
  kit.box(0, 18.5, 0, W + 0.2, 0.2, W + 0.2, 'stone');
  kit.box(0, H - 0.3, 0, W + 0.7, 0.3, W + 0.7, 'stone');
  kit.hip(0, H, 0, W + 0.9, 1.5, W + 0.9, 'roof');
  cross(kit, 0, H + 1.4, 0, 1.1, PI / 2);
  // врата на источното лице: лачна, со рамка од тули и камен; темен крст над неа
  archWin(kit, '+u', (W + 1.2) / 2 - 0.15, 0, 0.6, 1.3, 2.0, 'wood');
  kit.add(new THREE.BoxGeometry(0.18, 1.1, 0.12), Kit.at(W / 2 + 0.55, 4.0, 0, PI / 2), 'copper');
  kit.add(new THREE.BoxGeometry(0.7, 0.18, 0.12), Kit.at(W / 2 + 0.55, 4.15, 0, PI / 2), 'copper');
}

// ───────────────────────── Оградата кон улицата ─────────────────────────
/** Ѕид со железна решетка по отсечка (светски координати), со опционален отвор [s0, s1]. */
function fenceRun(kit, hf, a, b, gap) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / len;
  const tz = (b[1] - a[1]) / len;
  const pieces = gap ? [[0, gap[0]], [gap[1], len]] : [[0, len]];
  for (const [s0, s1] of pieces) {
    if (s1 - s0 < 0.3) continue;
    const ms = (s0 + s1) / 2;
    const x = a[0] + tx * ms;
    const z = a[1] + tz * ms;
    const g = Math.min(hf.sample(a[0] + tx * s0, a[1] + tz * s0), hf.sample(a[0] + tx * s1, a[1] + tz * s1));
    kit.setFrame(x, g, z, tx, tz);
    const L = s1 - s0;
    kit.box(0, -0.4, 0, L, 1.6, 0.55, 'accent'); // бел камен ѕид
    kit.box(0, 1.2, 0, L, 0.12, 0.65, 'stone'); // капак
    kit.box(0, 1.5, 0, L, 0.06, 0.06, 'metal');
    kit.box(0, 2.55, 0, L, 0.06, 0.06, 'metal');
    for (let d = -L / 2 + 0.2; d < L / 2; d += 0.32) kit.box(d, 1.32, 0, 0.045, 1.5, 0.045, 'metal');
    // столбчиња на секои ~6 m
    const n = Math.max(1, Math.round(L / 6));
    for (let i = 0; i <= n; i++) kit.box(-L / 2 + (i * L) / n, 1.32, 0, 0.5, 0.35, 0.5, 'accent');
  }
}

/** Порта: два бели столба со фенери и железна порта со лак и крст. Рамка: u по оградата. */
function gate(kit, w) {
  for (const s of [-1, 1]) {
    const u = s * (w / 2 + 0.45);
    kit.box(u, -0.4, 0, 0.9, 3.9, 0.9, 'accent');
    kit.box(u, 3.5, 0, 1.1, 0.25, 1.1, 'stone');
    kit.box(u, 3.75, 0, 0.3, 0.3, 0.3, 'metal');
    kit.cylinder(u, 4.05, 0, 0.26, 0.6, 'light', { top: 0.34, seg: 4, rotY: PI / 4 });
    kit.cone(u, 4.65, 0, 0.3, 0.3, 'metal', { seg: 4, rotY: PI / 4 });
  }
  // крилата (затворени) и лак со крст
  kit.box(0, 0, 0, w, 2.7, 0.08, 'metal');
  kit.add(new THREE.TorusGeometry(w / 2, 0.07, 4, 16, PI), Kit.at(0, 2.7, 0), 'metal');
  kit.add(new THREE.TorusGeometry(w / 2 + 0.25, 0.05, 4, 16, PI), Kit.at(0, 2.9, 0), 'metal');
  cross(kit, 0, 2.7 + w / 2, 0, 0.7);
}

// ───────────────────────── Модел ─────────────────────────
export function dimitrija(kit, item, ctx) {
  const [cx, cz] = item.center;
  const g = item.ground.mean;
  kit.setFrame(cx, g, cz, AX, AZ);
  body(kit);

  // камбанарија (OSM): оска по јужниот раб на основата
  const T = item.parts?.tower;
  if (T) {
    skipOsm(ctx, T.osmId);
    const ring = T.polys[0][0];
    let best = null;
    for (let i = 0; i < ring.length - 1; i++) {
      const dx = ring[i + 1][0] - ring[i][0];
      const dz = ring[i + 1][1] - ring[i][1];
      const l = Math.hypot(dx, dz);
      if (l > 0.5 && (!best || dx / l > best[0])) best = [dx / l, dz / l];
    }
    const [tx, tz] = T.center;
    const tg = ctx.hf.sample(tx, tz);
    kit.setFrame(tx, tg, tz, best[0], best[1]);
    // поплочена кружна тераса со скали пред вратата (кон дворот)
    for (const [r, y] of [[9.5, 0.15], [8.9, 0.32], [8.3, 0.5]]) kit.cylinder(3, -0.6, 0, r, y + 0.6, 'paving', { seg: 28 });
    belfry(kit);
  }

  // базен во облик на крст (OSM: amenity=fountain) — камени ѕидови, светлосина внатрешност
  const P = item.parts?.pool;
  if (P) {
    const [px, pz] = P.center;
    kit.setFrame(px, P.ground, pz, AX, AZ);
    for (const r of [0, PI / 2]) {
      kit.box(0, -0.4, 0, 7.6, 1.3, 3.2, 'plinth', r);
      kit.box(0, 0.86, 0, 7.0, 0.06, 2.6, 'water', r);
    }
    for (const [du, dv] of [[3.8, 0], [-3.8, 0], [0, 3.8], [0, -3.8]]) {
      kit.cylinder(du, -0.4, dv, 1.6, 1.3, 'plinth', { seg: 12 });
      kit.cylinder(du, 0.86, dv, 1.3, 0.06, 'water', { seg: 12 });
    }
  }
  // бела мермерна чешма на осмоаголна плоча (во дворот, пред галерията)
  kit.setFrame(cx, g, cz, AX, AZ);
  {
    const [u, v] = [8, 20.5];
    kit.cylinder(u, -0.3, v, 2.6, 0.5, 'accent', { seg: 8, rotY: PI / 8 });
    kit.cylinder(u, 0.2, v, 0.35, 1.1, 'accent', { top: 0.22, seg: 10 });
    kit.cylinder(u, 1.3, v, 0.35, 0.5, 'accent', { top: 0.75, seg: 12 });
    kit.cylinder(u, 1.8, v, 0.18, 0.7, 'accent', { seg: 8 });
    kit.cylinder(u, 2.5, v, 0.22, 0.25, 'accent', { top: 0.45, seg: 10 });
    kit.sphere(u, 2.95, v, 0.2, 'accent', { seg: 8 });
  }

  // ограда со порта по источната страна на црковниот двор (кон улицата)
  const F = item.parts?.fence;
  if (F) {
    const ring = F.polys[0][0];
    const loc = ([x, z]) => {
      const dx = x - cx;
      const dz = z - cz;
      return [dx * AX + dz * AZ, -dx * AZ + dz * AX];
    };
    // OSM границата оди по средината на улицата „11. Октомври“: оградата е 4.5 m навнатре
    // (половина коловоз + тротоар), т.е. ~5 m пред апсидите — патот останува надвор од дворот
    const IN = 4.5;
    const shift = ([x, z]) => [x - AX * IN, z - AZ * IN];
    for (let i = 0; i < ring.length - 1; i++) {
      const [ua0] = loc(ring[i]);
      const [ub0] = loc(ring[i + 1]);
      if (Math.min(ua0, ub0) < 24) continue; // само уличната (источна) страна
      const a = shift(ring[i]);
      const b = shift(ring[i + 1]);
      const [, va] = loc(a);
      const [, vb] = loc(b);
      // портата: таму каде што оската на црквата (v ≈ 0.7) ја сече оградата
      let gap = null;
      if ((va - 0.7) * (vb - 0.7) < 0) {
        const t = (0.7 - va) / (vb - va);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const sg = t * len;
        gap = [sg - 2.4, sg + 2.4];
        const gx = a[0] + (b[0] - a[0]) * t;
        const gz = a[1] + (b[1] - a[1]) * t;
        kit.setFrame(gx, ctx.hf.sample(gx, gz), gz, (b[0] - a[0]) / len, (b[1] - a[1]) / len);
        gate(kit, 3.0);
      }
      fenceRun(kit, ctx.hf, a, b, gap);
    }
  }
}

function skipOsm(ctx, osmId) {
  const ids = ctx.buildings.arrays.osmId;
  for (let b = 0; b < ids.length; b++) if (ids[b] === osmId) ctx.skip.add(b);
}
