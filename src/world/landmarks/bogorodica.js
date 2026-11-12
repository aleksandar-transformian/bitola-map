// Црквата „Пресвета Богородица“ (1872) — рачно, според фотографии и сателитска снимка.
// Бела двокатна базилика со рустика (сиви жлебови, лепезести клучни камења над прозорците),
// камено подножје, венец меѓу катовите и запченест венец под стреата; покрив од ќерамиди со
// низок забат на запад (икона над вратата, „1872“). На северната фасада, кон истокот, портик
// со парни столбови и триаголен забат; над него осмоаголен тамбур со кромидеста купола.
// Источно — понизок дел; до него тенка бетонска камбанарија со тулени полиња и крстови.
//
// Рамка: u = исток по долгата оска на OSM основата (w210252893), v = југ; почеток = центарот.

import * as THREE from 'three';
import { Kit } from './kit.js';
import { onFace, facePos, disc, archWin } from './facade.js';
import { obb } from '../geom2d.js';

const PI = Math.PI;
const U0 = -14.3; // западен ѕид
const UJ = 8.6; // крај на двокатниот дел (понатаму понизок дел)
const U1 = 14.3; // источен ѕид
const V = 10.1; // половина ширина
const H = 9.6; // стреа
const H_LOW = 6.2; // стреа на нискиот источен дел
const RISE = 3.0; // висина на покривот (низок забат)
const STRING = 5.2; // венец меѓу катовите

/** Клучен камен со „лепеза“ над отвор: централен камен и два коси (сиви). */
function fan(kit, face, c, s, y) {
  const [u, v] = facePos(face, c, s);
  for (const [dx, rz, w] of [[0, 0, 0.36], [-0.42, 0.42, 0.3], [0.42, -0.42, 0.3]]) {
    kit.add(new THREE.BoxGeometry(w, 0.62, 0.1).rotateZ(rz).translate(dx, 0.31, 0.04), onFace(face, u, y, v), 'stone');
  }
}

/** Правоаголен прозорец (долен кат) со решетка и лепеза над него. */
function lowWin(kit, face, c, s, y0, w, h) {
  const [u, v] = facePos(face, c, s);
  kit.add(new THREE.BoxGeometry(w + 0.3, h + 0.3, 0.08).translate(0, h / 2, 0), onFace(face, u, y0, v), 'stone');
  kit.add(new THREE.BoxGeometry(w, h, 0.14).translate(0, h / 2 + 0.15, 0), onFace(face, u, y0 - 0.15, v), 'window');
  fan(kit, face, c, s, y0 + h + 0.12);
}

/** Лачен прозорец (горен кат) со камен лак и лепеза. */
function upWin(kit, face, c, s, y0, w, h) {
  archWin(kit, face, c, s, y0, w, h, 'window', 'stone');
  fan(kit, face, c, s, y0 + h + w / 2 + 0.05);
}

function door(kit, face, c, s, w, h) {
  const [u, v] = facePos(face, c, s);
  kit.add(new THREE.BoxGeometry(w + 0.5, h + 0.35, 0.1).translate(0, (h + 0.35) / 2, 0), onFace(face, u, 0.6, v), 'stone');
  kit.add(new THREE.BoxGeometry(w, h, 0.16).translate(0, h / 2, 0), onFace(face, u, 0.6, v), 'wood');
}

/** Кутија [u0,u1]×[−V,V] до висина h: малтер со рустика (жлебови), камено подножје, венци. */
function block(kit, u0, u1, h) {
  const w = u1 - u0;
  const cu = (u0 + u1) / 2;
  kit.box(cu, -0.6, 0, w, h + 0.6, 2 * V, 'plaster');
  kit.box(cu, -0.6, 0, w + 0.14, 1.7, 2 * V + 0.14, 'stone'); // подножје до 1.1 m
  for (let y = 1.7; y < h - 0.7; y += 0.62) kit.box(cu, y, 0, w + 0.03, 0.05, 2 * V + 0.03, 'stone');
  if (h > STRING + 1) kit.box(cu, STRING, 0, w + 0.3, 0.32, 2 * V + 0.3, 'stone');
  kit.box(cu, h - 0.55, 0, w + 0.5, 0.55, 2 * V + 0.5, 'accent'); // запченест венец
  kit.box(cu, h - 0.75, 0, w + 0.3, 0.2, 2 * V + 0.3, 'stone');
}

/** Двоводен покрив околу оската u: две коси плочи од стреата (±(vEdge + over)) до слемето. */
function gableRoof(kit, u0, u1, vEdge, y0, rise, over = 0.6) {
  const yE = y0 - (over * rise) / vEdge; // стреата се продолжува по истиот наклон
  for (const s of [-1, 1]) {
    const va = s * (vEdge + over);
    const len = Math.hypot(va, y0 + rise - yE);
    const ang = Math.atan2(y0 + rise - yE, -va);
    kit.add(new THREE.BoxGeometry(u1 - u0 + over * 1.5, 0.22, len), Kit.atE((u0 + u1) / 2, (yE + y0 + rise) / 2 + 0.1, va / 2, -ang), 'roof');
  }
}

function church(kit) {
  // ── двокатен дел ──
  block(kit, U0, UJ, H);
  kit.gable((U0 + UJ) / 2, H, 0, UJ - U0, RISE, 2 * V, 'plaster');
  gableRoof(kit, U0 - 0.4, UJ, V, H, RISE);
  // ── понизок источен дел ──
  block(kit, UJ, U1, H_LOW);
  kit.hip((UJ + U1) / 2 + 0.3, H_LOW, 0, U1 - UJ + 1.4, 2.2, 2 * V + 1.0, 'roof');

  // ── северна и јужна фасада: 6 распони; долу прозорци и врата, горе лачни прозорци ──
  const bays = [-12.4, -8.6, -4.8, -1.0, 2.8, 6.6];
  for (const face of ['-v', '+v']) {
    const c = face === '-v' ? -V - 0.02 : V + 0.02;
    const S = (u) => (face === '-v' ? -u : u);
    bays.forEach((u, i) => {
      upWin(kit, face, c, S(u), 6.2, 1.0, 1.5);
      if (face === '-v' && i === 5) return; // портикот
      if (i === 3) door(kit, face, c, S(u), 1.5, 2.8);
      else lowWin(kit, face, c, S(u), 1.6, 1.1, 1.8);
    });
    // нискиот дел: мал окулус и прозорец
    const [ou, ov] = facePos(face, c, S(11.6));
    kit.add(disc(0.45, 0.14, 14), onFace(face, ou, 4.3, ov), 'stone');
    kit.add(disc(0.32, 0.2, 14), onFace(face, ou, 4.3, ov), 'window');
    lowWin(kit, face, c, S(11.6), 1.6, 1.0, 1.6);
    // олуци
    for (const u of [-14.0, -2.9, 8.4]) {
      const [pu, pv] = facePos(face, c, S(u));
      kit.add(new THREE.CylinderGeometry(0.08, 0.08, H, 5).translate(0, H / 2, 0.12), onFace(face, pu, 0, pv), 'eave');
    }
  }

  // ── запад: низок забат, врата со икона, пет лачни прозорци ──
  const cw = U0 - 0.02;
  door(kit, '-u', cw, 0, 1.7, 2.9);
  archWin(kit, '-u', cw, 0, 3.8, 1.5, 0.5, 'ochre', 'stone'); // икона на Богородица во лачна ниша
  for (const s of [-5.6, 5.6]) lowWin(kit, '-u', cw, s, 2.2, 0.9, 0.9);
  for (const s of [-7.4, -3.7, 3.7, 7.4]) upWin(kit, '-u', cw, s, 6.4, 0.95, 1.3);
  upWin(kit, '-u', cw, 0, 6.0, 1.3, 1.9);
  kit.cylinder(U0 + 0.3, H + RISE, 0, 0.05, 1.0, 'metal', { seg: 4 });

  // ── исток (нискиот дел) ──
  for (const s of [-5, 0, 5]) lowWin(kit, '+u', U1 + 0.02, s, 1.8, 1.0, 1.6);

  // ── портик на северната фасада ──
  const pu = 6.8;
  const pv0 = -V;
  const pd = 2.6;
  const pw = 5.4;
  kit.box(pu, -0.6, pv0 - pd / 2, pw + 0.6, 0.9, pd + 0.2, 'stone'); // скалило
  for (const du of [-2.3, -1.55, 1.55, 2.3]) kit.cylinder(pu + du, 0.3, pv0 - pd + 0.35, 0.24, 4.5, 'accent', { seg: 10 });
  for (const du of [-2.3, 2.3]) kit.box(pu + du, 0.3, pv0 - 0.6, 0.6, 4.5, 0.9, 'accent'); // пиластри до ѕидот
  kit.box(pu, 4.8, pv0 - pd / 2, pw, 0.75, pd, 'accent'); // архитрав
  kit.box(pu, 5.55, pv0 - pd / 2, pw + 0.3, 0.15, pd + 0.2, 'stone');
  // забат (калкан нормално на ѕидот) и покривче
  kit.gable(pu, 5.7, pv0 - pd / 2, pd + 0.2, 1.5, pw + 0.2, 'accent', PI / 2);
  const sl = Math.hypot(pw / 2 + 0.3, 1.6);
  const ang = Math.atan2(1.6, pw / 2 + 0.3);
  for (const s of [-1, 1]) {
    kit.add(new THREE.BoxGeometry(sl, 0.18, pd + 0.6), Kit.atE(pu + (s * (pw / 2 + 0.3)) / 2, 5.7 + 0.8 + 0.1, pv0 - pd / 2 - 0.2, 0, 0, -s * ang), 'roof');
  }
  door(kit, '-v', -V - 0.02, -pu, 1.6, 3.0);
  // мала баџа на покривот над портикот
  kit.box(pu, H - 0.2, -V + 1.6, 1.6, 1.6, 1.6, 'plaster');
  kit.gable(pu, H + 1.4, -V + 1.6, 1.8, 0.7, 2.0, 'roof', PI / 2);
  archWin(kit, '-v', -V + 0.78, -pu, H + 0.1, 0.6, 0.5, 'window', 'stone');

  // ── тамбур со кромидеста купола (над портикот, кон северната страна) ──
  const du = 4.4;
  const dv = -3.0;
  const R = 2.6;
  const y0 = H + 1.4;
  const yT = y0 + 4.6;
  kit.cylinder(du, y0, dv, R, yT - y0, 'plaster', { seg: 8, rotY: PI / 8 });
  kit.cylinder(du, y0, dv, R + 0.15, 0.6, 'stone', { seg: 8, rotY: PI / 8 });
  const ap = R * Math.cos(PI / 8); // апотема
  for (let i = 0; i < 8; i++) {
    const a = (i * PI) / 4;
    const cx = du + Math.cos(a) * (ap + 0.04);
    const cz = dv - Math.sin(a) * (ap + 0.04);
    const rot = a + PI / 2;
    kit.add(new THREE.BoxGeometry(0.6, 1.5, 0.12).translate(0, 0.75, 0), Kit.at(cx, y0 + 1.5, cz, rot), 'window');
    kit.add(disc(0.3, 0.12, 10), Kit.at(cx, y0 + 3.0, cz, rot), 'window');
    kit.add(new THREE.TorusGeometry(0.42, 0.1, 4, 10, PI), Kit.at(cx, y0 + 3.0, cz, rot), 'stone');
    // пиластри на аглите
    const b = a + PI / 8;
    kit.add(new THREE.BoxGeometry(0.35, yT - y0 - 0.6, 0.35).translate(0, (yT - y0 - 0.6) / 2, 0), Kit.at(du + Math.cos(b) * R, y0 + 0.6, dv - Math.sin(b) * R, b), 'stone');
  }
  kit.cylinder(du, yT, dv, R + 0.4, 0.4, 'accent', { seg: 8, rotY: PI / 8 });
  // кромид: профил (r, y) од основата до врвот
  const prof = [
    [R - 0.05, 0], [R + 0.25, 0.7], [R + 0.3, 1.25], [R, 1.95], [1.6, 2.75], [0.7, 3.5], [0.28, 4.05], [0.22, 4.4], [0.01, 4.55],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  kit.add(new THREE.LatheGeometry(prof, 16), Kit.at(du, yT + 0.4, dv), 'dome');
  // позлатен крст
  const cy = yT + 0.4 + 4.5;
  kit.cylinder(du, cy, dv, 0.07, 2.2, 'ochre', { seg: 5 });
  kit.box(du, cy + 1.45, dv, 1.0, 0.1, 0.1, 'ochre', PI / 2);
  kit.box(du, cy + 1.05, dv, 0.6, 0.08, 0.08, 'ochre', PI / 2);
}

// ───────────────────────── Камбанаријата ─────────────────────────
// Тенка бетонска кула: аголни столбови и појаси (бетон), тулени полиња со мали крстови,
// горе ѕвонара со по еден голем крст-отвор на секоја страна, четиристрешен покрив.
function belfry(kit) {
  const W = 3.6;
  const HT = 23;
  kit.box(0, -0.6, 0, W, HT + 0.6, W, 'mosaic1');
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kit.box((x * (W - 0.5)) / 2, -0.6, (z * (W - 0.5)) / 2, 0.62, HT + 0.6, 0.62, 'stone');
  for (let y = 3.2; y < HT - 4; y += 3.4) kit.box(0, y, 0, W + 0.06, 0.35, W + 0.06, 'stone');
  // ѕвонара (бетон) со крст-отвори
  kit.box(0, HT - 4.2, 0, W + 0.08, 4.2, W + 0.08, 'stone');
  for (const face of ['+u', '-u', '+v', '-v']) {
    const c = (W + 0.08) / 2 + 0.01;
    const [u, v] = facePos(face, c, 0);
    kit.add(new THREE.BoxGeometry(0.45, 2.7, 0.08).translate(0, 1.35, 0), onFace(face, u, HT - 3.6, v), 'copper');
    kit.add(new THREE.BoxGeometry(1.6, 0.42, 0.08), onFace(face, u, HT - 1.85, v), 'copper');
    // мали крстови на тулените полиња
    for (let y = 4.9; y < HT - 5; y += 3.4) {
      kit.add(new THREE.BoxGeometry(0.14, 0.5, 0.06), onFace(face, u, y + 0.2, v), 'copper');
      kit.add(new THREE.BoxGeometry(0.4, 0.14, 0.06), onFace(face, u, y + 0.3, v), 'copper');
    }
  }
  kit.box(0, HT, 0, W + 0.7, 0.25, W + 0.7, 'stone');
  kit.hip(0, HT + 0.25, 0, W + 0.8, 1.2, W + 0.8, 'roof');
  kit.cylinder(0, HT + 1.3, 0, 0.06, 1.6, 'metal', { seg: 5 });
  kit.box(0, HT + 2.4, 0, 0.8, 0.08, 0.08, 'metal');
}

// ───────────────────────── Модел ─────────────────────────
export function bogorodica(kit, item, ctx) {
  // оска: долгата страна на OBB на основата, насочена кон исток (долгите рабови се од по две отсечки)
  const f = obb(item.polys[0][0]);
  const best = { t: f.ax >= 0 ? [f.ax, f.az] : [-f.ax, -f.az] };
  const [cx, cz] = [f.cx, f.cz];
  kit.setFrame(cx, item.ground.mean, cz, best.t[0], best.t[1]);
  church(kit);

  const T = item.parts?.tower;
  if (T) {
    const ids = ctx.buildings.arrays.osmId;
    for (let b = 0; b < ids.length; b++) if (ids[b] === T.osmId) ctx.skip.add(b);
    const [tx, tz] = T.center;
    kit.setFrame(tx, ctx.hf.sample(tx, tz), tz, best.t[0], best.t[1]);
    belfry(kit);
  }
  // мермерна чешма (OSM: amenity=fountain) западно од црквата
  const F = item.parts?.fountain;
  if (F) {
    const [fx, fz] = F.center;
    kit.setFrame(fx, F.ground, fz);
    kit.cylinder(0, -0.3, 0, 2.0, 0.95, 'accent', { seg: 20 });
    kit.cylinder(0, 0.62, 0, 1.75, 0.04, 'water', { seg: 20 });
    kit.cylinder(0, 0.6, 0, 0.25, 1.0, 'accent', { seg: 10 });
    kit.cylinder(0, 1.6, 0, 0.6, 0.2, 'accent', { top: 0.3, seg: 12 });
  }
}
