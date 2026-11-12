// Широк Сокак од Магнолија надолу — детални фасади според Street View од сопственикот.
// Не се знаменитости: само ги заменуваат обичните фасади на улицата (ги додаваат во ctx.skip).
//
// Рамка на раб (facade.js): u = по работ, v = нанадвор од ѕидот, y = над подлогата. +u е десно
// од гледачот што стои пред фасадата, па „лево → десно на фотографијата“ е t = 0 → 1: u = U(L, t).

import * as THREE from 'three';
import { Kit } from './kit.js';
import { distToPolyline } from '../geom2d.js';
import { windowAt, balcony, wallLamp, band, frameOn, body, simplify, openEdges, openingShape, plate, buildHouses } from './facade.js';

// Широк Сокак (OSM w1414592489, северниот крај), уличките „Кирил и Методиј“ (w37727881) и „27. Март“
const SOKAK = [[6.6, 70.7], [24.5, 112], [36.9, 137.5]];
const KIRIL = [[19.4, 119.2], [-40.8, 150.6]];
const MART = [[24.5, 112], [27.7, 110.2], [46.8, 99.7]];

const U = (L, t) => -L / 2 + t * L;

/** Рабови свртени кон улицата (линија), најдолгиот прв. */
function fronts(edges, line, minLen = 2, maxD = 14) {
  return edges
    .filter((e) => e.len >= minLen)
    .map((e) => ({ e, d0: distToPolyline(e.m, line), d1: distToPolyline([e.m[0] + e.nx * 1.5, e.m[1] + e.nz * 1.5], line) }))
    .filter((o) => o.d1 < o.d0 - 0.4 && o.d0 < maxD)
    .sort((a, b) => b.e.len - a.e.len)
    .map((o) => o.e);
}

/** Прозорец со затворени дрвени ќепенци (летвички). */
function shutterWin(kit, u, y, w, h, { arch = null, frame = 'plaster', lit = 0.6 } = {}) {
  plate(kit, openingShape(w + 0.4, h + 0.25, arch), u, y - 0.12, 0, 0.07, frame);
  windowAt(kit, u, y, w, h, { arch, frame, v: 0.07, sill: true, sillPart: frame, bars: false, lit });
  const sh = arch ? h - w / 2 : h;
  kit.box(u, y, 0.13, w, sh, 0.03, 'wood');
  for (let yy = y + 0.12; yy < y + sh - 0.05; yy += 0.14) kit.box(u, yy, 0.15, w - 0.06, 0.025, 0.02, 'copper');
  kit.box(u, y, 0.16, 0.04, sh, 0.02, 'copper');
}

/** Балкон со железна ограда на леани конзоли. y = подот на балконот. */
function ironBalcony(kit, u, y, w, d) {
  balcony(kit, u, y, w, d, { slab: 'stone', rail: 'metal', h: 1.0, step: 0.12 });
  const n = Math.max(2, Math.round(w / 1.1));
  for (let k = 0; k <= n; k++) {
    const x = u - w / 2 + 0.2 + ((w - 0.4) * k) / n;
    kit.add(new THREE.BoxGeometry(0.08, 0.75, 0.08), Kit.atE(x, y - 0.6, d * 0.35, 0.6, 0, 0), 'metal');
  }
}

/** Триаголен натпрозорник (фронтонче) со основа. */
function pediment(kit, u, y, w, part = 'accent') {
  const tri = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, w * 0.22)]);
  kit.add(new THREE.ExtrudeGeometry(tri, { depth: 0.18, bevelEnabled: false }), Kit.at(u, y, 0.0), part);
  kit.box(u, y - 0.08, 0.09, w + 0.1, 0.1, 0.2, part);
}

/** Радијални пречки во лачен отвор (лепеза). */
function fan(kit, u, y, w, h, part = 'wood') {
  const cy = y + h - w / 2;
  for (const a of [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) kit.add(new THREE.BoxGeometry(w / 2, 0.06, 0.04).translate(w / 4, 0, 0), Kit.atE(u, cy, 0.13, 0, 0, a), part);
  kit.box(u, cy - 0.03, 0.13, w, 0.06, 0.04, part);
}

/** Клинести камења околу лачен отвор (наизменично два дела). */
function voussoirs(kit, u, y, w, h, part, alt) {
  const r = w / 2 + 0.32;
  const cy = y + h - w / 2;
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI;
    kit.add(new THREE.BoxGeometry(0.34, 0.66, 0.12), Kit.atE(u + Math.cos(a) * r, cy + Math.sin(a) * r, 0.04, 0, 0, a - Math.PI / 2), i % 2 ? part : alt);
  }
}

/** Аглови квадери (наизменично тесни и широки блокови) на двата краја на работ. */
function quoins(kit, L, y0, y1, part, step = 0.5) {
  for (const sg of [-1, 1]) {
    for (let y = y0, k = 0; y < y1 - 0.1; y += step, k++) kit.box(sg * (L / 2 - (k % 2 ? 0.45 : 0.32)), y, 0.02, k % 2 ? 0.9 : 0.64, step - 0.06, 0.08, part);
  }
}

// ─────────────────────────── западна страна ───────────────────────────

/**
 * „Adorabela“ (w1070708434), на аголот со „Кирил и Методиј“: крем приземје со жлебови и излог,
 * розово-црвен кат со крем квадери на аглите, три оски — два прозорци со ќепенци и лачен со
 * балустрада во средината, широк венец.
 */
function adorabela(kit, s0, _e, gm, others) {
  const ring = s0.rings[0];
  const s = { ...s0, rings: [ring] };
  const H = 8.6;
  const G = 4.0;
  body(kit, s, H, 'rose', { pitched: 'hip' });
  band(kit, ring, gm - 0.3, gm + G, 0.05, 'plaster');
  for (let y = 0.6; y < G - 0.3; y += 0.5) band(kit, ring, gm + y, gm + y + 0.03, 0.07, 'stone');
  band(kit, ring, gm + G, gm + G + 0.35, 0.16, 'plaster');
  band(kit, ring, gm + H - 0.5, gm + H - 0.3, 0.08, 'plaster');
  band(kit, ring, gm + H - 0.3, gm + H, 0.45, 'plaster');
  const edges = openEdges(ring, others);
  const street = fronts(edges, SOKAK, 2.5);
  const lane = fronts(edges, KIRIL, 2.5);
  const main = street[0];
  for (const e of edges) {
    if (e.len < 2.5) continue;
    frameOn(kit, e, gm);
    const L = e.len;
    quoins(kit, L, G + 0.35, H - 0.5, 'plaster');
    if (e === main) {
      shutterWin(kit, U(L, 0.2), G + 1.0, 1.0, 2.3);
      shutterWin(kit, U(L, 0.8), G + 1.0, 1.0, 2.3);
      shutterWin(kit, 0, G + 0.9, 1.0, 2.7, { arch: 'round' });
      kit.box(0, G + 0.35, 0.25, 1.6, 0.1, 0.5, 'plaster');
      for (let x = -0.65; x <= 0.66; x += 0.18) kit.cylinder(x, G + 0.45, 0.38, 0.06, 0.5, 'plaster', { seg: 6 });
      kit.box(0, G + 0.95, 0.38, 1.6, 0.08, 0.22, 'plaster');
      // приземје: излог и натпис
      kit.box(0, 0.3, 0.02, L * 0.7, 3.0, 0.06, 'plaster');
      windowAt(kit, 0, 0.45, L * 0.62, 2.7, { frame: 'plaster', v: 0.06, bars: true, sill: false, lit: 0.95 });
      kit.box(0, G - 0.75, 0.1, L * 0.55, 0.55, 0.06, 'plaster', 0, 0.3);
      kit.box(0, G - 0.6, 0.14, L * 0.42, 0.25, 0.02, 'roof');
      continue;
    }
    const shop = street.includes(e) || lane.includes(e);
    const n = Math.max(1, Math.round(L / 2.8));
    for (let k = 0; k < n; k++) {
      const u = U(L, (k + 0.5) / n);
      shutterWin(kit, u, G + 1.0, 0.95, 2.1);
      if (shop) windowAt(kit, u, 0.4, Math.min(1.8, L / n - 0.8), 2.8, { frame: 'wood', bars: true, sill: false, lit: 0.9 });
    }
  }
}

/** Пониска бела куќа меѓу „Adorabela“ и белата аголна (w1070708435): ќепенци, дуќани. */
function lowWhite(kit, s0, _e, gm, others) {
  const ring = simplify(s0.rings[0]);
  const s = { ...s0, rings: [ring] };
  const H = 6.8;
  const G = 3.6;
  body(kit, s, H, 'plaster', { pitched: 'hip' });
  band(kit, ring, gm - 0.3, gm + 0.4, 0.06, 'stone');
  band(kit, ring, gm + G, gm + G + 0.2, 0.12, 'plaster');
  band(kit, ring, gm + H - 0.3, gm + H, 0.4, 'plaster');
  const edges = openEdges(ring, others);
  const street = fronts(edges, SOKAK, 2.5);
  for (const e of edges) {
    if (e.len < 2.5) continue;
    frameOn(kit, e, gm);
    const L = e.len;
    const n = Math.max(1, Math.round(L / 2.6));
    for (let k = 0; k < n; k++) {
      const u = U(L, (k + 0.5) / n);
      shutterWin(kit, u, G + 0.8, 0.9, 1.9);
      if (street.includes(e)) windowAt(kit, u, 0.35, Math.min(1.8, L / n - 0.7), 2.7, { frame: 'metal', bars: true, sill: false, lit: 0.9 });
    }
  }
}

/**
 * „Velvet / Sabotage“ (w1070708456), на аголот со „Кирил и Методиј“: бела неокласична, три ката —
 * лачна лоѓија со јонски столбови и скали, балкон на конзола над неа, излози во дрвени рамки,
 * леани огради на првиот кат, високи прозорци со ќепенци и балустради на вториот, пиластри,
 * венец со заби, фронтон над лоѓијата.
 */
function velvet(kit, s0, _e, gm, others) {
  const ring = simplify(s0.rings[0]);
  const s = { ...s0, rings: [ring] };
  const H = 12.0;
  const G = 4.3;
  const F2 = 8.2;
  body(kit, s, H, 'plaster', { pitched: 'hip' });
  band(kit, ring, gm - 0.3, gm + 0.5, 0.08, 'stone');
  band(kit, ring, gm + G, gm + G + 0.3, 0.2, 'accent');
  band(kit, ring, gm + F2 - 0.1, gm + F2 + 0.15, 0.15, 'accent');
  band(kit, ring, gm + H - 0.9, gm + H - 0.6, 0.06, 'accent');
  band(kit, ring, gm + H - 0.3, gm + H, 0.7, 'accent');
  const edges = openEdges(ring, others);
  const main = fronts(edges, SOKAK, 6)[0];
  const lane = fronts(edges, KIRIL, 6)[0];
  const dentils = (L) => {
    for (let x = -L / 2 + 0.2; x < L / 2; x += 0.32) kit.box(x, H - 0.55, 0.12, 0.14, 0.22, 0.3, 'accent');
  };
  const corners = (L) => {
    for (const sg of [-1, 1]) {
      kit.box(sg * (L / 2 - 0.3), G + 0.3, 0.04, 0.55, H - G - 1.2, 0.12, 'accent');
      kit.box(sg * (L / 2 - 0.3), H - 1.15, 0.08, 0.75, 0.3, 0.25, 'accent');
    }
  };
  for (const e of edges) {
    if (e.len < 2.5 || e === main) continue;
    frameOn(kit, e, gm);
    const L = e.len;
    dentils(L);
    corners(L);
    const n = Math.max(1, Math.round(L / 3));
    for (let k = 0; k < n; k++) {
      const u = U(L, (k + 0.5) / n);
      windowAt(kit, u, G + 1.0, 1.0, 2.1, { frame: 'accent', sillPart: 'accent' });
      windowAt(kit, u, F2 + 0.7, 1.0, 2.0, { frame: 'accent', sillPart: 'accent' });
      if (e === lane) windowAt(kit, u, 0.35, Math.min(2.2, L / n - 0.6), 2.9, { frame: 'metal', bars: true, sill: false, lit: 0.95 });
    }
    if (e === lane) {
      // „Sabotage“: стаклена надстрешница и натпис
      kit.add(new THREE.BoxGeometry(L * 0.6, 0.05, 1.1), Kit.atE(U(L, 0.4), 3.4, 0.55, 0.3, 0, 0), 'metal');
      kit.box(U(L, 0.4), 3.8, 0.08, L * 0.4, 0.6, 0.06, 'roof', 0, 0.3);
    }
  }
  if (!main) return;
  frameOn(kit, main, gm);
  const L = main.len;
  const at = (t) => U(L, t);
  dentils(L);
  corners(L);
  // лоѓија: лак на два јонски столба, скали
  const lu = at(0.2);
  plate(kit, openingShape(2.1, 3.8, 'round'), lu, 0.3, 0.0, 0.05, 'ochre');
  for (const sg of [-1, 1]) {
    kit.cylinder(lu + sg * 1.3, 0.35, 0.3, 0.22, 3.35, 'accent', { seg: 10 });
    kit.box(lu + sg * 1.3, 3.7, 0.3, 0.7, 0.25, 0.7, 'accent');
    kit.box(lu + sg * 1.3, 0.1, 0.3, 0.6, 0.25, 0.6, 'accent');
  }
  for (let k = 0; k < 4; k++) kit.box(lu, -0.3 + k * 0.2, 0.4 + (3 - k) * 0.3, 2.6, 0.2, 0.32, 'stone');
  // излози (Velvet)
  for (const t of [0.55, 0.82]) {
    kit.box(at(t), 0.3, 0.02, 2.3, 3.3, 0.06, 'wood');
    windowAt(kit, at(t), 0.45, 2.0, 3.0, { frame: 'wood', v: 0.06, bars: true, sill: false, lit: 0.95 });
  }
  kit.box(at(0.94), 1.8, 0.1, 1.1, 0.9, 0.05, 'granite', 0, 0.2); // табла „Velvet“
  // прв кат: балкон на голема конзола над лоѓијата, прозорци со леани огради
  kit.box(lu, G - 0.5, 0.45, 1.5, 0.9, 0.8, 'accent');
  balcony(kit, lu, G + 0.6, 2.6, 1.0, { slab: 'accent', rail: 'metal', h: 1.0, step: 0.12 });
  windowAt(kit, lu, G + 0.7, 1.1, 2.6, { frame: 'accent', sill: false, lit: 0.7 });
  for (const t of [0.55, 0.82]) {
    windowAt(kit, at(t), G + 0.7, 1.25, 2.6, { frame: 'accent', v: 0.03, sill: false, lit: 0.7 });
    kit.box(at(t), G + 0.7, 0.14, 1.4, 1.0, 0.04, 'metal');
  }
  // втор кат: ќепенци и балустради; лоѓија со столбови
  for (const t of [0.55, 0.82]) {
    shutterWin(kit, at(t), F2 + 0.9, 1.15, 2.3, { frame: 'accent' });
    kit.box(at(t), F2 + 0.25, 0.15, 1.6, 0.08, 0.3, 'accent');
    for (let x = -0.7; x <= 0.71; x += 0.2) kit.cylinder(at(t) + x, F2 + 0.33, 0.18, 0.06, 0.5, 'accent', { seg: 6 });
    kit.box(at(t), F2 + 0.83, 0.18, 1.6, 0.08, 0.25, 'accent');
  }
  kit.box(lu, F2 + 0.2, 0.0, 2.4, 2.9, 0.05, 'ochre');
  for (const sg of [-1, 1]) kit.cylinder(lu + sg * 1.1, F2 + 0.2, 0.15, 0.16, 2.9, 'accent', { seg: 10 });
  for (const t of [0.4, 0.68]) kit.box(at(t), G + 0.3, 0.04, 0.4, H - G - 1.2, 0.08, 'accent');
  pediment(kit, lu, H + 0.05, 3.4, 'accent');
}

// ─────────────────────────── источна страна ───────────────────────────

/**
 * Портокалова куќа бр. 43 (w1463976007): рустично приземје со излози („Penti“, „Onix“) и лачна
 * врата со клинести камења; кат со два тесни прозорци, лачен прозорец со железен балкон на
 * конзоли и два големи прозорци со ќепенци; украсен атик над балконот.
 */
function onix43(kit, s0, _e, gm, others) {
  const ring = simplify(s0.rings[0]);
  const s = { ...s0, rings: [ring] };
  const H = 9.4;
  const G = 4.2;
  body(kit, s, H, 'apricot', { pitched: 'hip' });
  band(kit, ring, gm - 0.3, gm + 0.5, 0.08, 'stone');
  for (let y = 0.9; y < G - 0.2; y += 0.55) band(kit, ring, gm + y, gm + y + 0.04, 0.03, 'apricot');
  band(kit, ring, gm + G, gm + G + 0.3, 0.15, 'plaster');
  band(kit, ring, gm + G + 0.3, gm + G + 0.7, 0.05, 'apricot');
  band(kit, ring, gm + H - 0.55, gm + H - 0.35, 0.1, 'plaster');
  band(kit, ring, gm + H - 0.35, gm + H, 0.5, 'apricot');
  const edges = openEdges(ring, others);
  const main = fronts(edges, SOKAK, 4)[0];
  for (const e of edges) {
    if (e.len < 2.5 || e === main) continue;
    frameOn(kit, e, gm);
    const n = Math.max(1, Math.round(e.len / 2.8));
    for (let k = 0; k < n; k++) shutterWin(kit, U(e.len, (k + 0.5) / n), G + 1.1, 1.0, 2.0);
  }
  if (!main) return;
  frameOn(kit, main, gm);
  const L = main.len;
  const at = (t) => U(L, t);
  for (const t of [0.02, 0.33, 0.98]) kit.box(at(t), G + 0.7, 0.03, 0.45, H - G - 1.25, 0.1, 'apricot');
  // приземје: „Penti“, „Onix“, лачна врата
  kit.box(at(0.17), 0.3, 0.02, L * 0.28, 3.3, 0.06, 'wood');
  windowAt(kit, at(0.17), 0.45, L * 0.24, 3.0, { frame: 'wood', v: 0.06, bars: true, sill: false, lit: 0.95 });
  kit.box(at(0.17), 3.5, 0.12, L * 0.24, 0.55, 0.08, 'roof', 0, 0.25);
  kit.box(at(0.5), 0.3, 0.02, 2.6, 3.2, 0.06, 'plaster');
  windowAt(kit, at(0.5), 0.45, 2.3, 2.4, { frame: 'metal', v: 0.06, bars: true, sill: false, lit: 0.95 });
  kit.box(at(0.5), 2.95, 0.1, 2.3, 0.55, 0.05, 'plaster', 0, 0.3);
  voussoirs(kit, at(0.82), 0, 1.6, 3.5, 'apricot', 'plaster');
  plate(kit, openingShape(1.6, 3.5, 'round'), at(0.82), 0, 0.02, 0.06, 'wood');
  for (const sg of [-1, 1]) kit.box(at(0.82) + sg * 0.4, 0.1, 0.1, 0.7, 2.5, 0.03, 'copper');
  fan(kit, at(0.82), 0, 1.6, 3.5, 'copper');
  wallLamp(kit, at(0.7), 3.9);
  // кат
  shutterWin(kit, at(0.09), G + 1.1, 0.75, 2.1);
  shutterWin(kit, at(0.22), G + 1.1, 0.75, 2.1);
  plate(kit, openingShape(1.5, 3.0, 'round'), at(0.42), G + 0.85, 0.0, 0.07, 'plaster');
  shutterWin(kit, at(0.42), G + 1.0, 0.95, 2.6, { arch: 'round' });
  ironBalcony(kit, at(0.4), G + 0.95, 2.4, 0.85);
  for (const t of [0.64, 0.86]) {
    shutterWin(kit, at(t), G + 1.0, 1.3, 2.3);
    kit.box(at(t), G + 0.45, 0.06, 1.9, 0.45, 0.08, 'apricot');
  }
  // украсен атик над балконот
  const top = H - 0.35;
  kit.box(at(0.42), top, 0.0, 2.6, 0.9, 0.4, 'apricot');
  plate(kit, openingShape(1.8, 1.7, 'round'), at(0.42), top + 0.9, -0.15, 0.5, 'apricot');
  kit.box(at(0.42), top + 1.75, 0.0, 0.5, 0.25, 0.4, 'plaster');
  for (const sg of [-1, 1]) kit.sphere(at(0.42) + sg * 1.15, top + 1.05, 0.1, 0.18, 'plaster', { seg: 8 });
}

/**
 * НЛБ Банка (w1070708436) со аголниот дел кон „27. Март“: жолта, три нивоа. Приземје со жолти
 * квадери, сива табла со логото, лачен излог со лепеза, банкомат во лачен отвор, врата; на аголот
 * црвена тенда (Coca-Cola). Кат со фронтончиња, железен балкон на конзоли, фриз под стреата.
 */
function nlb(kit, s0, _e, gm, others) {
  const ring = simplify(s0.rings[0]);
  const s = { ...s0, rings: [ring] };
  const H = 11.4;
  const G = 4.4;
  const F2 = 7.9;
  body(kit, s, H, 'ochre', { pitched: 'hip' });
  band(kit, ring, gm - 0.3, gm + 0.4, 0.08, 'stone');
  band(kit, ring, gm + G, gm + G + 0.25, 0.16, 'plaster');
  band(kit, ring, gm + F2, gm + F2 + 0.15, 0.08, 'plaster');
  band(kit, ring, gm + H - 1.1, gm + H - 0.35, 0.03, 'ochre');
  band(kit, ring, gm + H - 0.35, gm + H, 0.5, 'plaster');
  const edges = openEdges(ring, others);
  const main = fronts(edges, SOKAK, 6)[0];
  const lane = fronts(edges, MART, 4)[0];
  const awning = (u, w) => {
    kit.add(new THREE.BoxGeometry(w, 0.06, 1.6), Kit.atE(u, 3.5, 0.8, 0.25, 0, 0), 'roof');
    kit.box(u, 3.0, 1.58, w, 0.34, 0.04, 'roof', 0, 0.2);
  };
  for (const e of edges) {
    if (e.len < 2.5 || e === main) continue;
    frameOn(kit, e, gm);
    const L = e.len;
    quoins(kit, L, 0.4, G, 'apricot', 0.55);
    const n = Math.max(1, Math.round(L / 2.8));
    for (let k = 0; k < n; k++) {
      const u = U(L, (k + 0.5) / n);
      windowAt(kit, u, G + 1.0, 1.05, 2.0, { frame: 'plaster', sillPart: 'plaster' });
      windowAt(kit, u, F2 + 0.7, 1.0, 1.6, { frame: 'plaster', sillPart: 'plaster' });
      if (e === lane) windowAt(kit, u, 0.4, Math.min(1.6, L / n - 0.8), 2.8, { frame: 'wood', bars: true, sill: false, lit: 0.9 });
    }
    if (e === lane) awning(0, L - 0.6);
  }
  if (!main) return;
  frameOn(kit, main, gm);
  const L = main.len;
  const at = (t) => U(L, t);
  for (const t of [0.015, 0.55, 0.8, 0.985]) {
    for (let y = 0.4, k = 0; y < G - 0.2; y += 0.55, k++) kit.box(at(t), y, 0.04, k % 2 ? 0.6 : 0.45, 0.5, 0.1, 'apricot');
  }
  // НЛБ: сива табла со логото
  kit.box(at(0.28), G - 1.05, 0.06, L * 0.5, 0.85, 0.08, 'metal');
  kit.add(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 16).rotateX(Math.PI / 2), Kit.at(at(0.12), G - 0.62, 0.13), 'water');
  kit.box(at(0.3), G - 0.75, 0.12, L * 0.22, 0.3, 0.02, 'plaster');
  windowAt(kit, at(0.16), 0.45, 2.3, 2.7, { arch: 'round', frame: 'wood', v: 0.04, bars: false, sill: false, lit: 0.9 });
  fan(kit, at(0.16), 0.45, 2.3, 2.7);
  windowAt(kit, at(0.39), 0.45, 2.2, 2.7, { frame: 'wood', v: 0.04, bars: true, sill: false, lit: 0.9 });
  // банкомат во лачен отвор и врата
  windowAt(kit, at(0.61), 0.3, 1.2, 2.6, { arch: 'round', frame: 'plaster', bars: false, sill: false, lit: 0.6 });
  fan(kit, at(0.61), 0.3, 1.2, 2.6, 'plaster');
  kit.box(at(0.61), 0.8, 0.18, 0.7, 1.2, 0.25, 'water', 0, 0.4);
  windowAt(kit, at(0.71), 0.2, 1.0, 2.6, { arch: 'round', frame: 'wood', bars: false, sill: false, lit: 0.3 });
  // аголот: тенда
  windowAt(kit, at(0.9), 0.3, L * 0.12, 2.8, { frame: 'wood', bars: true, sill: false, lit: 0.9 });
  awning(at(0.9), L * 0.2);
  // катови
  for (const t of [0.13, 0.3, 0.62, 0.72, 0.9]) {
    windowAt(kit, at(t), G + 1.05, 1.05, 2.1, { frame: 'plaster', v: 0.04, sillPart: 'plaster', lit: 0.6 });
    if (t < 0.5) pediment(kit, at(t), G + 3.35, 1.6);
    else kit.box(at(t), G + 3.3, 0.08, 1.5, 0.15, 0.2, 'plaster');
    windowAt(kit, at(t), F2 + 0.6, 0.95, 1.6, { frame: 'plaster', v: 0.04, sillPart: 'plaster', lit: 0.6 });
  }
  ironBalcony(kit, at(0.67), G + 0.95, L * 0.22, 0.9);
  for (let x = -L / 2 + 0.6; x < L / 2; x += 1.2) kit.box(x, H - 0.95, 0.04, 0.7, 0.45, 0.06, 'apricot');
  for (const t of [0.02, 0.98]) kit.box(at(t), G + 0.25, 0.03, 0.5, H - G - 1.3, 0.08, 'plaster');
}

/**
 * „Adam's“ (w1070708438), јужно од „27. Март“: крем, три ката, прозорци во кафени рамки (на
 * вториот кат кон улицата — лачни), црвени конзоли во парови под стреата, железни балкони на
 * леани конзоли, црвени огласни паноа во приземјето, темни тенди.
 */
function adams(kit, s0, _e, gm, others) {
  const ring = simplify(s0.rings[0]);
  const s = { ...s0, rings: [ring] };
  const H = 11.6;
  const G = 4.3;
  const F2 = 8.0;
  body(kit, s, H, 'plaster', { pitched: 'hip' });
  band(kit, ring, gm - 0.3, gm + 0.4, 0.08, 'stone');
  band(kit, ring, gm + G, gm + G + 0.3, 0.15, 'accent');
  band(kit, ring, gm + F2 - 0.05, gm + F2 + 0.1, 0.08, 'accent');
  band(kit, ring, gm + H - 0.3, gm + H, 0.55, 'accent');
  const edges = openEdges(ring, others);
  const street = fronts(edges, SOKAK, 5)[0];
  const lane = fronts(edges, MART, 5)[0];
  for (const e of edges) {
    if (e.len < 2.5) continue;
    frameOn(kit, e, gm);
    const L = e.len;
    for (let x = -L / 2 + 0.4; x < L / 2 - 0.2; x += 1.3) for (const dx of [0, 0.35]) kit.box(x + dx, H - 0.55, 0.15, 0.14, 0.28, 0.35, 'roof');
    for (const sg of [-1, 1]) for (let y = G + 0.3, k = 0; y < H - 0.6; y += 0.6, k++) kit.box(sg * (L / 2 - 0.3), y, 0.02, k % 2 ? 0.6 : 0.45, 0.55, 0.06, 'accent');
    const n = Math.max(1, Math.round(L / 2.4));
    for (let k = 0; k < n; k++) {
      const u = U(L, (k + 0.5) / n);
      windowAt(kit, u, G + 1.0, 1.05, 2.2, { frame: 'wood', sillPart: 'accent', lit: 0.6 });
      windowAt(kit, u, F2 + 0.6, 0.95, 2.2, { arch: e === street && k >= n / 2 ? 'round' : null, frame: 'wood', sillPart: 'accent', lit: 0.6 });
      kit.box(u, G + 3.35, 0.1, 1.4, 0.14, 0.18, 'roof');
    }
    if (e === street || e === lane) {
      kit.box(0, 0.0, 0.03, L - 0.6, G - 0.2, 0.06, 'roof');
      if (e === street) {
        const m = Math.max(1, Math.round(L / 3.2));
        for (let k = 0; k < m; k++) windowAt(kit, U(L, (k + 0.5) / m), 0.35, Math.min(2.2, L / m - 0.8), 2.9, { frame: 'plaster', v: 0.06, bars: true, sill: false, lit: 0.95 });
        kit.add(new THREE.BoxGeometry(L * 0.55, 0.05, 1.4), Kit.atE(U(L, 0.7), 3.6, 0.7, 0.3, 0, 0), 'granite');
        ironBalcony(kit, U(L, 0.45), G + 0.95, 2.6, 0.85);
      } else {
        ironBalcony(kit, U(L, 0.85), F2 + 0.55, 1.6, 0.75);
      }
    }
  }
}

// OSM id → рецепт (од Магнолија надолу)
const HOUSES = [
  { osm: 1070708435, build: lowWhite },
  { osm: 1070708434, build: adorabela },
  { osm: 1070708456, build: velvet },
  { osm: 1463976007, build: onix43 },
  { osm: 1070708436, build: nlb },
  { osm: 1070708438, build: adams },
];

/** Изгради ги куќите на Широк Сокак (ги додава во ctx.skip). */
export function sokakHouses(kit, ctx) {
  return buildHouses(kit, ctx, HOUSES, { tag: 'sokak' });
}
