// Куќите западно од Магнолија, кон Саат Кула (улиците 11 Октомври и Јорго Османо) — детални
// модели според фотографии од сопственикот (Street View). Не се знаменитости: немаат натпис,
// само ги заменуваат обичните кутии.
//
// Рамка на раб: u = по работ, v = нанадвор од ѕидот, y = над подлогата (види facade.js).

import * as THREE from 'three';
import { Kit } from './kit.js';
import { obb } from '../geom2d.js';
import { rnd, windowAt, balcony, wallLamp, band, frameOn, body, simplify, openEdges, buildHouses } from './facade.js';

// улицата пред Алта Банка и пицеријата (OSM w1463976011) — кон неа гледаат главните фасади
const STREET = [-66, 24];

/** Главниот раб: најдолгиот што гледа кон focus (face > 0.3). */
function mainEdge(edges, minLen = 4) {
  return edges.filter((e) => e.len >= minLen && e.face > 0.3).reduce((best, e) => (e.len * e.face > (best ? best.len * best.face : 0) ? e : best), null);
}

/** Плиток четиристрешен покрив над OBB на основата (со стреа). */
function lowHip(kit, ring, y, rise, over, part) {
  const f = obb(ring);
  kit.setFrame(f.cx, y, f.cz, f.ax, f.az);
  kit.hip(0, 0, 0, f.L + over * 2, rise, f.W + over * 2, part);
}

/** Железна решетка (китнеста): рамка, столбчиња, пречки и дијагонали. */
function grille(kit, u, y, w, h, v = 0.2) {
  const nv = Math.max(2, Math.round(w / 0.28));
  for (let k = 0; k <= nv; k++) kit.box(u - w / 2 + (w * k) / nv, y, v, 0.035, h, 0.035, 'metal');
  for (const t of [0.02, 0.35, 0.68, 0.98]) kit.box(u, y + h * t, v, w, 0.04, 0.035, 'metal');
  // ромбови во средниот дел
  const d = Math.hypot(w / 2, h * 0.33);
  const a = Math.atan2(h * 0.33, w / 2);
  for (const s of [-1, 1]) {
    for (const yy of [0.35, 0.68]) {
      kit.add(new THREE.BoxGeometry(d, 0.03, 0.03), Kit.atE(u - (s * w) / 4, y + h * (yy - 0.165), v, 0, 0, s * a), 'metal');
    }
  }
}

// ─────────────────────────── Алта Банка ───────────────────────────
// OSM w1070708388. Китнеста неокласична зграда: висок рустичен сутерен со решеткасти прозорчиња,
// приземје со хоризонтални фуги и прозорци со китнести железни решетки и натпрозорници, фриз,
// кат со профилирани рамки (кафени прозорци), силен венец со црвено обоени конзоли, плиток покрив.
// На главната фасада (кон улицата) — влез со скали и балкон на заоблена конзола над него.
function altaBanka(kit, s0, _edges, gm, others) {
  const ring = simplify(s0.rings[0]);
  const s = { ...s0, rings: [ring] };
  const B = 1.6; // сутерен
  const G = 5.8; // врв на приземјето
  const H = 11.6; // венец
  body(kit, s, H, 'plaster', { top: 'roof' });
  band(kit, ring, gm - 0.3, gm + B, 0.14, 'plinth');
  band(kit, ring, gm + 0.75, gm + 0.8, 0.16, 'stone');
  for (let y = B + 0.5; y < G - 0.3; y += 0.55) band(kit, ring, gm + y, gm + y + 0.05, 0.02, 'stone');
  band(kit, ring, gm + B - 0.1, gm + B + 0.1, 0.18, 'plaster');
  band(kit, ring, gm + G, gm + G + 0.3, 0.2, 'plaster');
  band(kit, ring, gm + G + 0.3, gm + G + 0.8, 0.06, 'stone'); // фриз
  band(kit, ring, gm + H - 1.4, gm + H - 1.25, 0.12, 'plaster');
  band(kit, ring, gm + H - 1.25, gm + H - 0.55, 0.05, 'stone'); // горен фриз
  band(kit, ring, gm + H - 0.25, gm + H + 0.05, 0.85, 'plaster'); // венец
  lowHip(kit, ring, gm + H + 0.05, 2.2, 0.85, 'roof');
  const edges = openEdges(ring, others, STREET);
  const main = mainEdge(edges, 8);
  for (const e of edges) {
    if (e.len < 3) continue;
    frameOn(kit, e, gm);
    const L = e.len;
    // аглови: квадери (сутерен и приземје), пиластри со капители (кат)
    for (const sg of [-1, 1]) {
      for (let y = B, k = 0; y < G; y += 0.55, k++) kit.box(sg * (L / 2 - (k % 2 ? 0.55 : 0.4)), y, 0.03, k % 2 ? 1.1 : 0.8, 0.5, 0.14, 'plaster');
      kit.box(sg * (L / 2 - 0.45), G + 0.8, 0.05, 0.9, H - G - 2.2, 0.16, 'plaster');
      kit.box(sg * (L / 2 - 0.45), H - 1.45, 0.06, 1.1, 0.25, 0.25, 'plaster');
    }
    // црвени конзоли под венецот
    const nb = Math.round((L + 1.4) / 0.62);
    for (let k = 0; k <= nb; k++) kit.box(-L / 2 - 0.7 + ((L + 1.4) * k) / nb, H - 0.58, 0.32, 0.16, 0.34, 0.62, 'roof');
    // прозорци по ос
    const ent = e === main ? -L * 0.25 : null; // влезот: 3/4 од северниот агол кон исток
    const n = Math.max(1, Math.round((L - 2.4) / 2.7));
    for (let k = 0; k < n; k++) {
      const u = -(L - 2.4) / 2 + ((L - 2.4) * (k + 0.5)) / n;
      if (ent !== null && Math.abs(u - ent) < (L - 2.4) / n / 2) continue;
      // сутерен: мало прозорче со решетка
      kit.box(u, 0.45, 0.06, 0.9, 0.75, 0.04, 'window');
      grille(kit, u, 0.45, 0.8, 0.75, 0.12);
      // приземје: висок прозорец со китнеста решетка и натпрозорник на конзоли
      kit.box(u, B + 0.3, 0.0, 1.75, 3.45, 0.08, 'plaster');
      windowAt(kit, u, B + 0.5, 1.2, 2.75, { frame: 'wood', v: 0.08, bars: false, sill: false, lit: 0.6 });
      grille(kit, u, B + 0.5, 1.15, 2.75, 0.26);
      kit.box(u, B + 0.3, 0.12, 1.95, 0.14, 0.3, 'plaster');
      kit.box(u, B + 3.45, 0.1, 2.1, 0.22, 0.34, 'plaster');
      for (const sg of [-1, 1]) kit.box(u + sg * 0.95, B + 3.05, 0.14, 0.16, 0.4, 0.22, 'plaster');
      // кат: профилирана рамка, кафен прозорец, натпрозорник со фронтон, плоча под прозорецот
      kit.box(u, G + 1.0, 0.0, 1.85, 3.5, 0.09, 'plaster');
      windowAt(kit, u, G + 1.25, 1.2, 2.75, { frame: 'wood', v: 0.09, sill: false, lit: 0.7 });
      for (const sg of [-1, 1]) kit.box(u + sg * 0.85, G + 1.0, 0.1, 0.18, 3.1, 0.14, 'plaster');
      kit.box(u, G + 4.1, 0.12, 2.2, 0.2, 0.36, 'plaster');
      const tri = new THREE.Shape([new THREE.Vector2(-1.05, 0), new THREE.Vector2(1.05, 0), new THREE.Vector2(0, 0.45)]);
      kit.add(new THREE.ExtrudeGeometry(tri, { depth: 0.3, bevelEnabled: false }), Kit.at(u, G + 4.3, 0.0), 'plaster');
      kit.box(u, G + 0.55, 0.06, 1.6, 0.4, 0.1, 'stone');
    }
    if (ent === null) continue;
    // ── влез: скали, врата со рамка, црвен натпис, балкон на заоблена конзола ──
    for (let k = 0; k < 5; k++) kit.box(ent, -0.3 + k * 0.32, 0.35 + (4 - k) * 0.32, 2.6, 0.32, 0.34, 'stone');
    kit.box(ent, 1.1, 0.0, 2.4, 4.4, 0.12, 'plaster');
    windowAt(kit, ent, 1.3, 1.5, 3.3, { frame: 'wood', v: 0.12, bars: false, sill: false, lit: 0.9 });
    kit.box(ent, 4.85, 0.16, 2.6, 0.55, 0.08, 'roof');
    wallLamp(kit, ent - 1.5, 4.2);
    kit.cylinder(ent, G - 0.3, 0.2, 0.45, 1.0, 'plaster', { seg: 12, top: 1.1 });
    balcony(kit, ent, G + 0.75, 2.6, 1.05, { slab: 'plaster', rail: 'metal', h: 1.0, step: 0.12 });
    windowAt(kit, ent, G + 0.8, 1.25, 3.1, { frame: 'wood', bars: true, sill: false, lit: 0.8 });
  }
}

// ─────────────────────────── Пицерија на аголот (11 Октомври) ───────────────────────────
// OSM w1070708389 (Pizza Metro). Жолта еднокатна зграда со висок кат: пиластри, високи врати и
// прозорци со кафени рамки, профилиран венец, четиристрешен покрив; црвено-бели тенди долж
// улиците, жардињери и маси пред нив; вертикален натпис „PIZZA“ на закосениот агол.

/** Тенда со пруги: коса плоча од ѕидот (y) нанадвор до d, пруги по u, ресни напред. */
function stripedAwning(kit, u0, u1, y, d, drop = 0.9) {
  const w = 0.45;
  const n = Math.max(2, Math.round((u1 - u0) / w));
  const ang = Math.atan2(drop, d);
  const len = Math.hypot(d, drop);
  for (let k = 0; k < n; k++) {
    const u = u0 + ((u1 - u0) * (k + 0.5)) / n;
    const part = k % 2 ? 'plaster' : 'roof';
    kit.add(new THREE.BoxGeometry((u1 - u0) / n, 0.05, len), Kit.atE(u, y - drop / 2, d / 2, ang, 0, 0), part);
    kit.box(u, y - drop - 0.32, d, (u1 - u0) / n, 0.32, 0.03, part);
  }
  // носачи
  for (const u of [u0 + 0.2, u1 - 0.2]) kit.add(new THREE.BoxGeometry(0.04, 0.04, len), Kit.atE(u, y - drop / 2 - 0.05, d / 2, ang, 0, 0), 'metal');
}

function pizzaCorner(kit, s0, _edges, gm, others) {
  const ring = simplify(s0.rings[0], 0.05);
  const s = { ...s0, rings: [ring] };
  const H = 6.6;
  body(kit, s, H, 'ochre', { pitched: 'hip' });
  band(kit, ring, gm - 0.3, gm + 0.5, 0.1, 'stone');
  band(kit, ring, gm + H - 1.0, gm + H - 0.8, 0.1, 'plaster');
  band(kit, ring, gm + H - 0.8, gm + H - 0.35, 0.04, 'ochre');
  band(kit, ring, gm + H - 0.35, gm + H, 0.38, 'plaster');
  const edges = openEdges(ring, others, STREET);
  // тенди: фасадата кон улицата; натпис: на најдолгиот краток раб (закосениот агол)
  const front = edges.filter((e) => e.len > 6 && e.face > 0.2);
  const corner = edges.filter((e) => e.len >= 1.2 && e.len < 3).reduce((b, e) => (e.len > (b?.len ?? 0) ? e : b), null);
  for (const e of edges) {
    if (e.len < 1.2) continue;
    frameOn(kit, e, gm);
    const L = e.len;
    if (L < 3) {
      if (e !== corner) continue;
      // закосен агол: вертикален натпис „PIZZA“
      kit.box(0, 2.6, 0.25, 0.55, 2.6, 0.18, 'roof', 0, 0.4);
      kit.box(0, 2.75, 0.35, 0.35, 2.3, 0.03, 'plaster');
      continue;
    }
    const n = Math.max(1, Math.round((L - 1) / 2.4));
    const step = (L - 1) / n;
    for (let k = 0; k <= n; k++) {
      const u = -(L - 1) / 2 + step * k;
      kit.box(u, 0.5, 0.04, 0.5, H - 1.5, 0.14, 'ochre');
      kit.box(u, H - 1.1, 0.06, 0.65, 0.25, 0.2, 'plaster');
    }
    for (let k = 0; k < n; k++) {
      const u = -(L - 1) / 2 + step * (k + 0.5);
      const door = front.includes(e) && k % 2 === 0;
      windowAt(kit, u, door ? 0.5 : 1.0, Math.min(1.5, step - 0.8), door ? 3.2 : 2.7, { frame: 'wood', bars: !door, sill: !door, sillPart: 'plaster', lit: door ? 1 : 0.8 });
      kit.box(u, 4.35, 0.08, Math.min(1.9, step - 0.4), 0.18, 0.2, 'plaster');
    }
    if (!front.includes(e)) continue;
    // тенди, жардињери, маси
    stripedAwning(kit, -L / 2 + 0.6, L / 2 - 0.6, 4.1, 2.4);
    for (let u = -L / 2 + 1.2; u < L / 2 - 0.8; u += 2.2) {
      kit.box(u, 0, 3.4, 1.6, 0.5, 0.45, 'roof');
      kit.box(u, -0.3, 3.4, 1.5, 0.3, 0.3, 'metal');
      for (const du of [-0.5, 0, 0.5]) kit.sphere(u + du, 0.65, 3.4, 0.28, 'green', { seg: 6, sy: 0.8 });
      if (u + 1.1 < L / 2 - 0.8) {
        kit.cylinder(u + 1.1, 0, 1.6, 0.05, 0.75, 'metal', { seg: 5 });
        kit.cylinder(u + 1.1, 0.75, 1.6, 0.4, 0.05, 'wood', { seg: 10 });
      }
    }
  }
}

// ─────────────────────────── Mickey Burger & Grill ───────────────────────────
// OSM w1070708420 и соседната w1465425549 (еден павилјон на две основи). Темна дрвена
// конструкција со големи стакла на двата ката, ограда со жардињери со црвени цвеќиња на катот,
// темен четиристрешен покрив (лим/шиндра) со широка стреа.
function mickey(kit, s0, _edges, gm, others) {
  const ring = simplify(s0.rings[0], 0.05);
  const s = { ...s0, rings: [ring] };
  const H = 7.0;
  const F = 3.6; // кат
  body(kit, s, H, 'window', { pitched: 'hip', roof: 'dome' });
  band(kit, ring, gm - 0.3, gm + 0.45, 0.06, 'granite');
  band(kit, ring, gm + F - 0.25, gm + F + 0.15, 0.12, 'granite');
  band(kit, ring, gm + H - 0.35, gm + H, 0.85, 'granite'); // стреа
  const edges = openEdges(ring, others);
  for (const e of edges) {
    if (e.len < 1.5) continue;
    frameOn(kit, e, gm);
    const L = e.len;
    const n = Math.max(1, Math.round(L / 1.9));
    for (let k = 0; k <= n; k++) {
      const u = -L / 2 + (L * k) / n;
      kit.box(u, 0, 0.06, 0.22, H - 0.3, 0.16, 'granite');
    }
    for (let k = 0; k < n; k++) {
      const u = -L / 2 + (L * (k + 0.5)) / n;
      const w = L / n - 0.3;
      kit.box(u, 0.45, 0.08, w, 0.06, 0.05, 'granite');
      kit.box(u, 2.35, 0.08, w, 0.06, 0.05, 'granite');
      kit.box(u, F + 1.0, 0.08, w, 0.06, 0.05, 'granite');
      kit.box(u, F + 2.4, 0.08, w, 0.06, 0.05, 'granite');
      kit.box(u, 0.45, 0.07, 0.05, F - 0.7, 0.04, 'granite');
      // жардињера на катот со црвени цвеќиња
      kit.box(u, F + 0.15, 0.32, w, 0.32, 0.36, 'granite');
      for (let t = -w / 2 + 0.2; t < w / 2 - 0.1; t += 0.35) {
        kit.sphere(u + t, F + 0.6, 0.34, 0.16, rnd(u + t, e.m[0]) < 0.55 ? 'roof' : 'green', { seg: 5, sy: 0.9 });
      }
    }
    // ограда на катот
    kit.box(0, F + 1.05, 0.5, L, 0.05, 0.05, 'granite');
    for (let t = -L / 2; t <= L / 2; t += 0.3) kit.box(t, F + 0.15, 0.5, 0.03, 0.9, 0.03, 'granite');
  }
}

// OSM id → рецепт
const HOUSES = [
  { osm: 1070708388, build: altaBanka },
  { osm: 1070708389, build: pizzaCorner },
  { osm: 1070708420, build: mickey },
  { osm: 1465425549, build: mickey },
];

/** Изгради ги куќите западно од Магнолија (ги додава во ctx.skip). */
export function westHouses(kit, ctx) {
  return buildHouses(kit, ctx, HOUSES, { tag: 'zapad' });
}
