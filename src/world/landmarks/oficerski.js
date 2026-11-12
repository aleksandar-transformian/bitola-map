// Офицерскиот дом — рачно, според фотографии (по обновата) и OSM основата (w1102567439).
// Светла зграда во ориентален (маварски) стил, симетрична по оската север–југ:
//   средина (3 распони): долу три шилести застаклени врати, над нив долг балкон на конзоли,
//     три прозорци со витраж и три кружни витражи („розети“) во шилести рамки;
//   две кули (по 3 распони, низ целата длабочина, највисоки): балкон на првиот кат, над него
//     истурена плоча и три шилести прозорци под фриз со заби;
//   крила (по 2 распони) со широка стреа; на источниот и западниот крај ризалит со влез.
// Камен сокл со подрумски прозорци, хоризонтални фуги, бели венци; покрив од ќерамиди.
//
// Рамка: u = исток, v = југ (кон плоштадот); почеток = центарот на основата.

import * as THREE from 'three';
import { Kit } from './kit.js';
import { onFace, facePos, disc } from './facade.js';

const PI = Math.PI;
// половини од ширините (u) и длабочините (v), од OSM
const HC = 5.85; // средина
const HT = 13.15; // кули (од HC до HT)
const HW = 17.3; // крила (од HT до HW)
const HE = 18.9; // краен ризалит (од HW до HE)
const DC = 6.5; // средина и крила
const DT = 9.2; // кули
const DE = 2.75; // краен ризалит
// висини
const SOCLE = 1.5;
const FLOOR = 1.0; // под на приземјето (скали до вратите)
const S1 = 6.9; // венец над приземјето
const S2 = 11.0; // венец над првиот кат
const H_C = 13.9; // венец на средината
const H_W = 13.5; // стреа на крилата
const H_T = 16.4; // венец на кулите (и на крајните ризалити)

// ───────────────────────── облици ─────────────────────────

/** Шилест лак: правоаголник w × h и врв со висина rise (во рамнината x–y, од y = 0). */
function pointed(w, h, rise) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h);
  s.quadraticCurveTo(w / 2, h + rise * 0.7, 0, h + rise);
  s.quadraticCurveTo(-w / 2, h + rise * 0.7, -w / 2, h);
  s.closePath();
  return s;
}
const ext = (shape, t) => new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 6 });

/** Помошник за едно лице: place(geo, s, y, part, z) — s по лицето (надесно однадвор), z нанадвор. */
function face(kit, f, c) {
  return (geo, s, y, part, z = 0) => {
    const [u, v] = facePos(f, c, s);
    geo.translate(0, 0, z);
    kit.add(geo, onFace(f, u, y, v), part);
  };
}

/** Шилест прозорец (или врата) со бела рамка-„веѓа“ и бела вертикала. */
function pointedWin(P, s, y0, w, h, { rise = w * 0.55, part = 'window' } = {}) {
  P(ext(pointed(w + 0.5, h + 0.1, rise + 0.3), 0.08), s, y0 - 0.1, 'accent');
  P(ext(pointed(w, h, rise), 0.14), s, y0, part);
  P(new THREE.BoxGeometry(0.07, h + rise * 0.8, 0.06).translate(0, (h + rise * 0.8) / 2, 0.15), s, y0, 'accent');
}

/** Правоаголен прозорец со бела рамка и бела крстовина. */
function rectWin(P, s, y0, w, h) {
  P(new THREE.BoxGeometry(w + 0.3, h + 0.3, 0.08).translate(0, h / 2, 0), s, y0, 'accent');
  P(new THREE.BoxGeometry(w, h, 0.14).translate(0, h / 2, 0), s, y0, 'window');
  P(new THREE.BoxGeometry(0.07, h, 0.06).translate(0, h / 2, 0.15), s, y0, 'accent');
  P(new THREE.BoxGeometry(w, 0.07, 0.06).translate(0, h * 0.62, 0.15), s, y0, 'accent');
}

/** Балкон: плоча на конзоли, со балустрада (rail = false → само истурена плоча). */
function balcony(P, s, y, w, d, { rail = true } = {}) {
  P(new THREE.BoxGeometry(w, 0.28, d).translate(0, 0.14, d / 2), s, y, 'accent');
  const n = Math.max(2, Math.round(w / 1.6));
  for (let i = 0; i <= n; i++) P(new THREE.BoxGeometry(0.22, 0.5, d * 0.8).translate(-w / 2 + 0.3 + (i * (w - 0.6)) / n, -0.25, (d * 0.8) / 2), s, y, 'accent');
  if (!rail) return;
  P(new THREE.BoxGeometry(w, 0.12, 0.2).translate(0, 1.05, d - 0.12), s, y, 'accent');
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) P(new THREE.BoxGeometry(0.12, 1.0, d - 0.1).translate(x, 0.6, d / 2), s, y, 'accent');
  for (let x = -w / 2 + 0.25; x < w / 2 - 0.15; x += 0.24) P(new THREE.CylinderGeometry(0.05, 0.065, 0.78, 5).translate(x, 0.67, d - 0.12), s, y, 'accent');
}

/** Кружен витраж во шилеста рамка. */
function rose(P, s, y, r) {
  P(ext(pointed(2 * r + 0.6, 0.2, r + 0.5), 0.08), s, y - r - 0.2, 'accent');
  P(disc(r + 0.08, 0.12, 16), s, y, 'accent', 0.06);
  P(disc(r, 0.16, 16), s, y, 'mosaic1', 0.06);
  P(disc(r * 0.55, 0.2, 6), s, y, 'crestGold', 0.06);
}

// ───────────────────────── маса ─────────────────────────

/** Блок [u0,u1]×[v0,v1] до висина h: ѕид, камен сокл, фуги, бели венци, стреа со заби. */
function block(kit, u0, u1, v0, v1, h, { eave = 0.5, frieze = false } = {}) {
  const w = u1 - u0;
  const d = v1 - v0;
  const cu = (u0 + u1) / 2;
  const cv = (v0 + v1) / 2;
  kit.box(cu, -0.6, cv, w, h + 0.6, d, 'wall');
  kit.box(cu, -0.6, cv, w + 0.2, SOCLE + 0.6, d + 0.2, 'plinth');
  kit.box(cu, SOCLE, cv, w + 0.26, 0.14, d + 0.26, 'stone');
  for (let y = SOCLE + 0.62; y < h - 1; y += 0.62) kit.box(cu, y, cv, w + 0.03, 0.04, d + 0.03, 'stone');
  for (const y of [S1, S2]) if (y < h - 1) kit.box(cu, y, cv, w + 0.24, 0.26, d + 0.24, 'accent');
  if (frieze) kit.box(cu, h - 2.2, cv, w + 0.12, 1.5, d + 0.12, 'stone'); // ориенталниот фриз на кулите
  kit.box(cu, h - 0.7, cv, w + 0.16, 0.3, d + 0.16, 'accent');
  // заби под венецот
  for (const [vv, rot, len] of [[v1 + 0.12, 0, w], [v0 - 0.12, 0, w], [u1 + 0.12, PI / 2, d], [u0 - 0.12, PI / 2, d]]) {
    for (let t = -len / 2 + 0.25; t < len / 2; t += 0.5) {
      const [x, z] = rot ? [vv, cv + t] : [cu + t, vv];
      kit.box(x, h - 0.95, z, 0.18, 0.28, 0.18, 'accent');
    }
  }
  kit.box(cu, h - 0.4, cv, w + 2 * eave, 0.4, d + 2 * eave, 'accent'); // венец / стреа
}

// ───────────────────────── фасади ─────────────────────────

/** Јужна (главна) или северна фасада; sgn = +1 југ, −1 север. */
function longFacade(kit, sgn) {
  const fc = sgn > 0 ? '+v' : '-v';
  const S = (u) => sgn * u; // u → s по лицето
  // средина
  const P = face(kit, fc, sgn * (DC + 0.02));
  for (const u of [-3.6, 0, 3.6]) {
    if (sgn > 0) {
      pointedWin(P, S(u), FLOOR, 2.3, 3.4, { rise: 1.2 });
      P(new THREE.BoxGeometry(2.3, 0.08, 0.06).translate(0, 0, 0.18), S(u), FLOOR + 3.4, 'accent');
    } else rectWin(P, S(u), 2.6, 1.6, 2.8);
    pointedWin(P, S(u), S1 + 1.3, 1.5, 1.6, { rise: 0.75 });
    rose(P, S(u), S2 + 1.05, 0.72);
  }
  if (sgn > 0) balcony(P, 0, S1 + 0.1, 2 * HC + 0.4, 1.3);
  // кули
  for (const k of [-1, 1]) {
    const um = (k * (HC + HT)) / 2;
    const PT = face(kit, fc, sgn * (DT + 0.02));
    for (const du of [-2.1, 0, 2.1]) {
      rectWin(PT, S(um + du), 2.4, du ? 1.0 : 1.4, 3.0);
      rectWin(PT, S(um + du), S1 + 1.2, du ? 0.9 : 1.3, 2.3);
      pointedWin(PT, S(um + du), S2 + 0.9, du ? 0.85 : 1.15, 1.6, { rise: du ? 0.6 : 0.8 });
    }
    balcony(PT, S(um), S1 + 0.1, HT - HC - 1.0, 1.1);
    balcony(PT, S(um), S2 - 0.05, HT - HC - 0.8, 0.9, { rail: false });
    // крила
    const uw = (k * (HT + HW)) / 2;
    for (const du of [-0.85, 0.85]) {
      rectWin(P, S(uw + du), 2.5, 0.75, 2.9);
      rectWin(P, S(uw + du), S1 + 1.0, 0.7, 2.6);
      pointedWin(P, S(uw + du), S2 + 0.5, 0.65, 1.0, { rise: 0.45 });
    }
  }
  // подрумски прозорци (со решетка)
  const PB = face(kit, fc, sgn * (DC + 0.13));
  const PBT = face(kit, fc, sgn * (DT + 0.13));
  for (const u of [-15.9, -14.6, -11.3, -9.5, -7.7, 7.7, 9.5, 11.3, 14.6, 15.9]) {
    (Math.abs(u) > HC && Math.abs(u) < HT ? PBT : PB)(new THREE.BoxGeometry(0.7, 0.5, 0.06).translate(0, 0.25, 0), S(u), 0.45, 'metal');
  }
  // скали пред вратите (југ)
  if (sgn > 0) for (let i = 0; i < 4; i++) kit.box(0, -0.6, DC + 0.4 + (3 - i) * 0.45, 2 * HC + 1.6 - i * 0.2, 0.6 + (i + 1) * 0.25, 0.46 + i * 0.01, 'stone');
}

/** Источна или западна фасада: ризалит со влез, балкони, два шилести прозорци; страните на крилата. */
function endFacade(kit, sgn) {
  const fc = sgn > 0 ? '+u' : '-u';
  const S = (v) => -sgn * v; // v → s по лицето
  const P = face(kit, fc, sgn * (HE + 0.02));
  pointedWin(P, 0, FLOOR, 1.7, 3.0, { rise: 0.9 });
  balcony(P, 0, S1 - 0.4, 2 * DE - 0.4, 1.2);
  for (const dv of [-0.85, 0.85]) {
    rectWin(P, S(dv), S1 + 1.2, 0.65, 2.2);
    pointedWin(P, S(dv), S2 + 0.9, 0.7, 1.5, { rise: 0.5 });
  }
  balcony(P, 0, S2 - 0.05, 2 * DE - 0.6, 0.8, { rail: false });
  for (let i = 0; i < 4; i++) kit.box(sgn * (HE + 0.4 + (3 - i) * 0.45), -0.6, 0, 0.46, 0.6 + (i + 1) * 0.25, 3.6 - i * 0.2, 'stone');
  // страните (крила): по два тесни прозорци на кат
  const PW = face(kit, fc, sgn * (HW + 0.02));
  for (const k of [-1, 1]) {
    for (const dv of [-0.6, 0.6]) {
      const v = k * ((DE + DC) / 2) + dv;
      rectWin(PW, S(v), 2.5, 0.55, 2.9);
      rectWin(PW, S(v), S1 + 0.6, 0.55, 3.4);
      pointedWin(PW, S(v), S2 + 0.5, 0.55, 1.0, { rise: 0.4 });
    }
  }
}

/** Страните на кулите (исток/запад), над крилата: по три прозорци. */
function towerSides(kit) {
  for (const k of [-1, 1]) {
    for (const sgn of [-1, 1]) {
      const fc = sgn > 0 ? '+u' : '-u';
      const u = k * HT;
      if (sgn !== k) continue; // само надворешното лице
      const P = face(kit, fc, u + sgn * 0.02);
      for (const v of [-7.85, 7.85]) {
        const s = -sgn * v;
        rectWin(P, s, 2.5, 0.8, 2.9);
        rectWin(P, s, S1 + 1.0, 0.8, 2.6);
      }
      for (const v of [-7.85, 0, 7.85]) pointedWin(P, -sgn * v, H_W + 0.3, 0.7, 1.0, { rise: 0.45 });
    }
  }
}

// ───────────────────────── модел ─────────────────────────
export function officersHome(kit, item) {
  const [cx, cz] = item.center;
  kit.setFrame(cx, item.ground.mean, cz, 1, 0);
  block(kit, -HC, HC, -DC, DC, H_C);
  for (const k of [-1, 1]) {
    const [a, b] = k > 0 ? [HC, HT] : [-HT, -HC];
    block(kit, a, b, -DT, DT, H_T, { frieze: true });
    const [c, d] = k > 0 ? [HT, HW] : [-HW, -HT];
    block(kit, c, d, -DC, DC, H_W, { eave: 1.1 });
    const [e, f] = k > 0 ? [HW, HE] : [-HE, -HW];
    block(kit, e, f, -DE, DE, H_T, { frieze: true });
  }
  for (const sgn of [-1, 1]) {
    longFacade(kit, sgn);
    endFacade(kit, sgn);
  }
  towerSides(kit);

  // покриви од ќерамиди: средина (меѓу кулите), крила, ниски пирамиди на кулите
  kit.hip(0, H_C, 0, 2 * HC + 0.6, 2.2, 2 * DC + 0.6, 'roof');
  for (const k of [-1, 1]) {
    kit.hip((k * (HC + HT)) / 2, H_T, 0, HT - HC + 0.5, 1.6, 2 * DT + 0.5, 'roof');
    kit.hip((k * (HT + HE)) / 2, H_W, 0, HE - HT + 2, 2.0, 2 * DC + 2.2, 'roof');
    kit.hip((k * (HW + HE)) / 2, H_T, 0, HE - HW + 0.6, 1.2, 2 * DE + 0.6, 'roof'); // краен ризалит
    kit.box(k * 9.5, H_T, -4, 0.9, 2.4, 0.9, 'wall'); // оџак
    kit.box(k * 9.5, H_T + 2.4, -4, 1.1, 0.2, 1.1, 'accent');
  }
}
