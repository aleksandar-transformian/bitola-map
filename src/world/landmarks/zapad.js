// Куќите западно од Магнолија, кон Саат Кула (улиците 11 Октомври и Јорго Османо) — детални
// модели според фотографии од сопственикот (Street View). Не се знаменитости: немаат натпис,
// само ги заменуваат обичните кутии.
//
// Рамка на раб: u = по работ, v = нанадвор од ѕидот, y = над подлогата (види house-kit.js).

import * as THREE from 'three';
import { Kit } from './kit.js';
import { distToPolyline, obb } from '../geom2d.js';
import { rnd, windowAt, balcony, wallLamp, band, grow, frameOn, body, simplify, openEdges, openingShape, plate, buildHouses } from './house-kit.js';

// улицата пред Алта Банка и пицеријата (OSM w1463976011) — кон неа гледаат главните фасади
const STREET = [-66, 24];

// „Јорго Османо“ (Google; во OSM продолжение на „Широк Сокак“, w37726204): од аголот на банката
// на северозапад покрај паркот на Саат Кула до раскрсницата со „Стерјо Георгиев“
const OSMANO = [[-121.7, -50.4], [-119.2, -46.3], [-111.9, -31.8], [-102.9, -12.5], [-97.8, 2.8], [-91.8, 13], [-85.3, 16.1]];
// средиштето на редот дуќани (w1070708391) — до него е лачниот прозорец на „Јорго Османо 8“
const SHOPS = [-103.4, 10.0];
// „Стерјо Георгиев“ (w37900718), последниот дел до раскрсницата
const STERJO = [[-144.8, -19.6], [-137.9, -23.1], [-131.4, -25.6], [-113.1, -31.4], [-111.9, -31.8]];

// „Петар Петровиќ-Његош“ (w1463130141 и w36954171) околу раскрсницата со Јорго Османо
const NJEGOS = [[-169.4, -41.9], [-161.1, -43.9], [-146.4, -46.7], [-133.3, -48.6], [-121.7, -50.4], [-102.2, -57.3], [-99.4, -60.1]];

/** Рабови свртени кон улицата (линија), од најблискиот; minLen = најкраток раб. */
function roadEdges(edges, line, minLen = 3) {
  return edges
    .filter((e) => e.len >= minLen)
    .map((e) => ({ e, d0: distToPolyline(e.m, line), d1: distToPolyline([e.m[0] + e.nx * 1.5, e.m[1] + e.nz * 1.5], line) }))
    .filter((o) => o.d1 < o.d0 - 0.5 && o.d0 < 14)
    .sort((a, b) => a.d0 - b.d0)
    .map((o) => o.e);
}

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
  band(kit, ring, gm - 0.3, gm + 0.45, 0.06, 'basalt');
  band(kit, ring, gm + F - 0.25, gm + F + 0.15, 0.12, 'basalt');
  band(kit, ring, gm + H - 0.35, gm + H, 0.85, 'basalt'); // стреа
  const edges = openEdges(ring, others);
  for (const e of edges) {
    if (e.len < 1.5) continue;
    frameOn(kit, e, gm);
    const L = e.len;
    const n = Math.max(1, Math.round(L / 1.9));
    for (let k = 0; k <= n; k++) {
      const u = -L / 2 + (L * k) / n;
      kit.box(u, 0, 0.06, 0.22, H - 0.3, 0.16, 'basalt');
    }
    for (let k = 0; k < n; k++) {
      const u = -L / 2 + (L * (k + 0.5)) / n;
      const w = L / n - 0.3;
      kit.box(u, 0.45, 0.08, w, 0.06, 0.05, 'basalt');
      kit.box(u, 2.35, 0.08, w, 0.06, 0.05, 'basalt');
      kit.box(u, F + 1.0, 0.08, w, 0.06, 0.05, 'basalt');
      kit.box(u, F + 2.4, 0.08, w, 0.06, 0.05, 'basalt');
      kit.box(u, 0.45, 0.07, 0.05, F - 0.7, 0.04, 'basalt');
      // жардињера на катот со црвени цвеќиња
      kit.box(u, F + 0.15, 0.32, w, 0.32, 0.36, 'basalt');
      for (let t = -w / 2 + 0.2; t < w / 2 - 0.1; t += 0.35) {
        kit.sphere(u + t, F + 0.6, 0.34, 0.16, rnd(u + t, e.m[0]) < 0.55 ? 'roof' : 'green', { seg: 5, sy: 0.9 });
      }
    }
    // ограда на катот
    kit.box(0, F + 1.05, 0.5, L, 0.05, 0.05, 'basalt');
    for (let t = -L / 2; t <= L / 2; t += 0.3) kit.box(t, F + 0.15, 0.5, 0.03, 0.9, 0.03, 'basalt');
  }
}

// ─────────────────────────── Јорго Османо (кон Саат Кула) ───────────────────────────

/** Прозорец со ролетна (спуштена до половина) и бела рамка. */
function shutterWindow(kit, u, y, w, h, { frame = 'plaster', drop = 0.45, lit = 0.6 } = {}) {
  windowAt(kit, u, y, w, h, { frame, sill: true, sillPart: frame, bars: false, lit });
  kit.box(u, y + h * (1 - drop), 0.12, w, h * drop, 0.03, 'stone');
  kit.box(u, y + h, 0.08, w + 0.26, 0.28, 0.18, frame); // кутија за ролетната
}

/**
 * Книжарница (w1070708390): двокатна, крем приземје со излози во кафени рамки, врата со
 * полукружна зелена тенда и зелен натпис; жолт појас; праскова кат со два прозорци со ролетни;
 * профилиран венец.
 */
function knizarnica(kit, s0, _edges, gm, others) {
  const ring = simplify(s0.rings[0]);
  const s = { ...s0, rings: [ring] };
  const H = 7.8;
  const G = 3.9;
  body(kit, s, H, 'peach', { pitched: 'hip' });
  band(kit, ring, gm - 0.3, gm + G, 0.05, 'plaster');
  band(kit, ring, gm + G, gm + G + 0.35, 0.16, 'ochre');
  band(kit, ring, gm + H - 0.55, gm + H - 0.3, 0.1, 'peach');
  band(kit, ring, gm + H - 0.3, gm + H, 0.42, 'peach');
  const edges = openEdges(ring, others);
  const front = roadEdges(edges, OSMANO, 5)[0];
  for (const e of edges) {
    if (e.len < 3) continue;
    frameOn(kit, e, gm);
    const L = e.len;
    const n = Math.max(1, Math.round(L / 3.4));
    for (let k = 0; k < n; k++) shutterWindow(kit, -L / 2 + (L * (k + 0.5)) / n, G + 1.1, 1.15, 1.7, { drop: 0.6 + rnd(k, L) * 0.3 });
    if (e !== front) continue;
    // приземје: два излоза, врата во средина
    for (const sg of [-1, 1]) {
      kit.box(sg * L * 0.27, 0.35, 0.0, L * 0.3 + 0.3, 2.75, 0.06, 'wood');
      windowAt(kit, sg * L * 0.27, 0.5, L * 0.3, 2.45, { frame: 'wood', v: 0.06, bars: true, sill: false, lit: 0.9 });
    }
    windowAt(kit, 0, 0.05, 1.3, 2.6, { frame: 'plaster', bars: false, sill: false, lit: 1 });
    // полукружна зелена тенда над вратата
    kit.add(new THREE.CylinderGeometry(0.95, 0.95, 0.9, 12, 1, false, -Math.PI / 2, Math.PI), Kit.atE(0, 2.95, 0.45, Math.PI / 2, 0, 0), 'green');
    kit.box(0, G - 0.62, 0.08, L * 0.62, 0.5, 0.06, 'green'); // „КНИЖАРНИЦА“
    kit.box(-L * 0.12, 0.05, 0.25, 0.07, 3.0, 0.07, 'green'); // столбче со натпис „фотокопир“
  }
}

/** Ред ниски дуќани (w1070708391): еднокатни, стаклени витрини и ролетни, стреа над тротоарот. */
function lowShops(kit, s0, _edges, gm, others) {
  const ring = simplify(s0.rings[0]);
  const s = { ...s0, rings: [ring] };
  const H = 4.2;
  body(kit, s, H, 'plaster', { pitched: 'hip' });
  band(kit, ring, gm - 0.3, gm + 0.3, 0.06, 'stone');
  band(kit, ring, gm + H - 0.3, gm + H, 0.3, 'plaster');
  const edges = openEdges(ring, others);
  const front = roadEdges(edges, OSMANO, 5)[0];
  if (!front) return;
  frameOn(kit, front, gm);
  const L = front.len;
  const n = Math.max(1, Math.round(L / 2.8));
  const signs = ['window', 'accent', 'green', 'roof'];
  for (let k = 0; k < n; k++) {
    const u = -L / 2 + (L * (k + 0.5)) / n;
    const w = L / n - 0.5;
    kit.box(u, 0.25, 0.0, w + 0.3, 2.95, 0.06, 'basalt');
    windowAt(kit, u, 0.3, w, 2.75, { frame: 'basalt', v: 0.06, bars: true, sill: false, lit: 0.9 });
    if (rnd(u, L) < 0.35) kit.box(u, 1.5, 0.14, w, 1.55, 0.03, 'metal'); // спуштена ролетна
    kit.box(u, 3.1, 0.2, Math.min(1.6, w), 0.45, 0.06, signs[k % signs.length], 0, 0.3);
  }
  // стреа (настрешница) над тротоарот
  kit.add(new THREE.BoxGeometry(L, 0.12, 1.8), Kit.atE(0, 3.55, 0.9, 0.12, 0, 0), 'roof');
  kit.box(0, 3.3, 1.75, L, 0.2, 0.06, 'basalt');
}

/**
 * „Јорго Османо 8“ (w1070708392): трикатна стара градска куќа — бел малтер, долниот дел
 * потемнет (окер), сутерен со прозорчиња, прозорци со бели рамки и ролетни, појаси меѓу катовите
 * на мали конзоли, четиристрешен покрив; на крајот кон дуќаните — лачен прозорец со црвено-бела
 * завеса и дрвена двокрилна врата.
 */
function osmano8(kit, s0, _edges, gm, others) {
  const ring = simplify(s0.rings[0]);
  const s = { ...s0, rings: [ring] };
  const H = 10.6;
  body(kit, s, H, 'plaster', { pitched: 'hip' });
  band(kit, ring, gm - 0.3, gm + 3.6, 0.04, 'ochre');
  band(kit, ring, gm - 0.3, gm + 0.9, 0.1, 'plinth');
  for (const y of [3.6, 7.0]) band(kit, ring, gm + y, gm + y + 0.22, 0.14, 'plaster');
  band(kit, ring, gm + H - 0.3, gm + H, 0.5, 'plaster');
  const edges = openEdges(ring, others);
  const front = roadEdges(edges, OSMANO, 5)[0];
  for (const e of edges) {
    if (e.len < 3) continue;
    frameOn(kit, e, gm);
    const L = e.len;
    const n = Math.max(1, Math.round(L / 3.2));
    // крајот на фасадата кон дуќаните (југоисток): таму се лачниот прозорец и вратата
    let endU = null;
    if (e === front) {
      const at = (u) => [e.m[0] + e.nz * u, e.m[1] - e.nx * u]; // u → свет (оската u = (nz, −nx))
      const d = (u) => Math.hypot(at(u)[0] - SHOPS[0], at(u)[1] - SHOPS[1]);
      endU = (d(L / 2) < d(-L / 2) ? 1 : -1) * (L / 2 - 1.4);
    }
    for (let k = 0; k < n; k++) {
      const u = -L / 2 + (L * (k + 0.5)) / n;
      if (endU !== null && Math.abs(u - endU) < L / n / 2) continue;
      kit.box(u, 0.25, 0.06, 0.8, 0.45, 0.04, 'metal');
      shutterWindow(kit, u, 1.3, 1.1, 1.8, { drop: 0.2 + rnd(u, 1) * 0.5 });
      shutterWindow(kit, u, 4.5, 1.1, 1.8, { drop: 0.2 + rnd(u, 2) * 0.5 });
      shutterWindow(kit, u, 7.9, 1.1, 1.7, { drop: 0.2 + rnd(u, 3) * 0.5 });
    }
    for (let k = 0; k <= n; k++) for (const y of [3.42, 6.82]) kit.box(-L / 2 + (L * k) / n, y, 0.1, 0.16, 0.2, 0.22, 'plaster');
    if (endU === null) continue;
    // дрвена двокрилна врата со фронтончиња и лачен прозорец со црвено-бела завеса над неа
    kit.box(endU, 0.0, 0.02, 2.2, 2.9, 0.08, 'wood');
    for (const sg of [-1, 1]) kit.box(endU + sg * 0.5, 0.2, 0.1, 0.85, 2.3, 0.04, 'copper');
    plate(kit, openingShape(1.9, 2.8, 'round'), endU, 4.2, 0.0, 0.08, 'plaster');
    plate(kit, openingShape(1.6, 2.6, 'round'), endU, 4.3, 0.05, 0.04, 'window', 0.7);
    for (let k = 0; k < 5; k++) kit.box(endU - 0.64 + k * 0.32, 4.6, 0.1, 0.16, 1.6, 0.02, k % 2 ? 'plaster' : 'roof');
  }
}

/**
 * Coffee house на аголот (w1463976012): сиво приземје со големи стакла во кафени рамки и натпис;
 * катот од неизмазнети тули во бетонска рамка, препуштен над приземјето кон улиците; два бели
 * прозорци; четиристрешен покрив со широка стреа.
 */
function coffeeHouse(kit, s0, _edges, gm, others) {
  const ring = simplify(s0.rings[0]);
  const G = 3.4;
  const H = 6.6;
  const edges = openEdges(ring, others);
  const streets = [...roadEdges(edges, OSMANO, 2), ...roadEdges(edges, STERJO, 2)];
  // приземје: малку вовлечено; катот го покрива целиот прстен (препуст)
  kit.slab([grow(ring, -0.6)], gm - 0.3, gm + G, 'metal');
  kit.slab([ring], gm + G - 0.05, gm + G + 0.3, 'stone');
  kit.slab([ring], gm + G + 0.3, gm + H - 0.3, 'roof');
  for (let y = G + 0.55; y < H - 0.4; y += 0.32) band(kit, ring, gm + y, gm + y + 0.03, 0.01, 'plaster'); // фуги
  kit.slab([grow(ring, 0.05)], gm + H - 0.3, gm + H, 'stone');
  lowHip(kit, ring, gm + H, 2.0, 0.9, 'roof');
  kit.setFrame(0, 0, 0);
  kit.slab([grow(ring, 0.8)], gm + H - 0.05, gm + H + 0.02, 'stone'); // стреа
  for (const e of edges) {
    if (e.len < 2) continue;
    frameOn(kit, e, gm);
    const L = e.len;
    const street = streets.includes(e);
    // бетонски столбови во аглите на катот
    for (const sg of [-1, 1]) kit.box(sg * (L / 2 - 0.2), G + 0.3, 0.02, 0.4, H - G - 0.6, 0.06, 'stone');
    const n = Math.max(1, Math.round(L / 3.4));
    for (let k = 0; k < n; k++) {
      const u = -L / 2 + (L * (k + 0.5)) / n;
      windowAt(kit, u, G + 0.9, 1.2, 1.4, { frame: 'plaster', v: 0.02, bars: true, sill: true, sillPart: 'stone', lit: 0.6 });
      if (!street) continue;
      // приземје: стакла во кафени рамки (вовлечени 0.6 m)
      kit.box(u, 0.1, -0.56, L / n - 0.4, 2.9, 0.05, 'wood');
      windowAt(kit, u, 0.2, L / n - 0.7, 2.6, { frame: 'wood', v: -0.5, bars: true, sill: false, lit: 0.95 });
    }
    if (street && e === streets[0]) kit.box(-L / 4, G - 0.05, 0.08, Math.min(3.2, L / 2), 0.55, 0.12, 'basalt', 0, 0.3); // натпис
  }
}

/** Розова куќа до coffee house (w1070708393): двокатна, бели рамки, кафени прозорци и врата. */
function pinkHouse(kit, s0, _edges, gm, others) {
  const ring = simplify(s0.rings[0]);
  const s = { ...s0, rings: [ring] };
  const H = 8.2;
  body(kit, s, H, 'peach', { pitched: 'hip' });
  band(kit, ring, gm - 0.3, gm + 0.6, 0.08, 'plaster');
  band(kit, ring, gm + 3.9, gm + 4.15, 0.12, 'plaster');
  band(kit, ring, gm + H - 0.35, gm + H, 0.45, 'plaster');
  const edges = openEdges(ring, others);
  const front = roadEdges(edges, STERJO, 5)[0];
  for (const e of edges) {
    if (e.len < 3) continue;
    frameOn(kit, e, gm);
    const L = e.len;
    const n = Math.max(1, Math.round(L / 3.0));
    for (let k = 0; k < n; k++) {
      const u = -L / 2 + (L * (k + 0.5)) / n;
      for (const y of [1.2, 4.9]) {
        kit.box(u, y - 0.25, 0.0, 1.55, 2.5, 0.07, 'plaster');
        windowAt(kit, u, y, 1.05, 1.95, { frame: 'wood', v: 0.07, sill: true, sillPart: 'plaster', lit: 0.6 });
      }
    }
    for (const sg of [-1, 1]) kit.box(sg * (L / 2 - 0.3), 0.6, 0.03, 0.6, H - 1.0, 0.08, 'plaster');
    if (e === front) windowAt(kit, L / 2 - 1.3, 0.1, 1.2, 2.5, { frame: 'plaster', bars: false, sill: false, lit: 0.3 });
  }
}

// ─────────────────────────── Раскрсницата со „Петар Петровиќ-Његош“ ───────────────────────────

/**
 * Кебапчилница „Охрид“ (w1464872234): ниска приземна, малтер со испакнати полиња, прозорци со
 * плакати, лимена надстрешница над тротоарот кон Јорго Османо со голем жолт натпис и зелен
 * амблем, чадори (Pepsi) и маси со портокалови столчиња.
 */
function kebab(kit, s0, _edges, gm, others) {
  const ring = simplify(s0.rings[0]);
  const s = { ...s0, rings: [ring] };
  const H = 3.5;
  body(kit, s, H, 'peach', { top: 'metal' });
  band(kit, ring, gm - 0.3, gm + 0.35, 0.06, 'plinth');
  band(kit, ring, gm + H - 0.25, gm + H, 0.12, 'plinth');
  const edges = openEdges(ring, others);
  const front = roadEdges(edges, OSMANO, 3)[0];
  const side = roadEdges(edges, NJEGOS, 3)[0];
  for (const e of edges) {
    if (e.len < 2) continue;
    frameOn(kit, e, gm);
    const L = e.len;
    // испакнати полиња (пиластри) и прозорци со плакати
    const n = Math.max(1, Math.round(L / 2.0));
    for (let k = 0; k <= n; k++) kit.box(-L / 2 + (L * k) / n, 0.35, 0.03, 0.3, H - 0.6, 0.06, 'plinth');
    for (let k = 0; k < n; k++) {
      const u = -L / 2 + (L * (k + 0.5)) / n;
      if (e === front && k === Math.floor(n / 2)) {
        windowAt(kit, u, 0.2, 1.1, 2.4, { frame: 'wood', bars: false, sill: false, lit: 1 });
        continue;
      }
      windowAt(kit, u, 0.9, Math.min(1.2, L / n - 0.6), 1.6, { frame: 'wood', bars: false, sill: false, lit: 0.9 });
      if (e === side || rnd(u, L) < 0.5) kit.box(u, 0.95, 0.13, Math.min(1.0, L / n - 0.7), 1.4, 0.02, k % 2 ? 'ochre' : 'accent');
    }
    if (e !== front) continue;
    // лимена надстрешница со натпис, амблем, чадори, маси
    kit.add(new THREE.BoxGeometry(L + 2.4, 0.08, 2.6), Kit.atE(-0.6, H + 0.15, 1.2, 0.14, 0, 0), 'metal');
    kit.box(-0.6, H - 0.35, 2.5, L + 2.4, 0.75, 0.08, 'ochre', 0, 0.35); // „ОХРИД кебапчилница“
    kit.box(-0.6, H - 0.12, 2.56, L * 0.55, 0.32, 0.02, 'basalt');
    kit.box(L / 2 - 0.2, H - 0.45, 2.56, 1.4, 0.95, 0.06, 'green'); // „Скопско“
    for (const [du, dv] of [[-L / 2 - 1.2, 3.2], [-L / 2 + 1.6, 3.6]]) {
      kit.cylinder(du, 0, dv, 0.04, 2.3, 'metal', { seg: 5 });
      kit.add(new THREE.ConeGeometry(1.35, 0.55, 8), Kit.at(du, 2.4, dv), 'water');
      kit.cylinder(du + 0.6, 0, dv - 0.3, 0.38, 0.72, 'basalt', { seg: 8 });
      for (const a of [0, 2.1, 4.2]) kit.box(du + 0.6 + Math.cos(a) * 0.65, 0, dv - 0.3 + Math.sin(a) * 0.65, 0.42, 0.85, 0.42, 'roof');
    }
  }
}

/** Стари приземни дуќани (до кебапчилницата): крем малтер, лачни врати, венец, ќерамиди. */
function oldShops(kit, s0, _edges, gm, others) {
  const ring = simplify(s0.rings[0]);
  const s = { ...s0, rings: [ring] };
  const H = 4.4;
  body(kit, s, H, 'plaster', { pitched: 'hip' });
  band(kit, ring, gm - 0.3, gm + 0.4, 0.08, 'stone');
  band(kit, ring, gm + H - 0.5, gm + H, 0.3, 'ochre');
  const edges = openEdges(ring, others);
  for (const e of roadEdges(edges, NJEGOS, 3)) {
    frameOn(kit, e, gm);
    const L = e.len;
    const n = Math.max(1, Math.round(L / 2.6));
    for (let k = 0; k < n; k++) {
      const u = -L / 2 + (L * (k + 0.5)) / n;
      plate(kit, openingShape(1.7, 3.2, 'round'), u, 0.2, 0.0, 0.06, 'ochre');
      windowAt(kit, u, 0.3, 1.35, 2.9, { arch: 'round', frame: 'wood', v: 0.06, bars: true, sill: false, lit: 0.8 });
    }
    kit.box(0, 3.45, 0.12, Math.min(3.5, L - 1), 0.4, 0.05, 'accent', 0, 0.3); // натпис (менувачница)
  }
}

/**
 * Излитена трикатна зграда зад кебапчилницата (w1070708394): ѕидови од тула, фасадите кон
 * улиците бело измалтерисани (со потемнети места), бели прозорци, мал балкон, два високи оџаци.
 */
function weathered(kit, s0, _edges, gm, others) {
  const ring = simplify(s0.rings[0]);
  const s = { ...s0, rings: [ring] };
  const H = 9.8;
  body(kit, s, H, 'roof', { pitched: 'hip', roof: 'roof' });
  for (let y = 0.4; y < H - 0.3; y += 0.36) band(kit, ring, gm + y, gm + y + 0.03, 0.01, 'stone'); // фуги
  const edges = openEdges(ring, others);
  const streets = [...roadEdges(edges, OSMANO, 3), ...roadEdges(edges, STERJO, 3)];
  for (const e of edges) {
    if (e.len < 2.5) continue;
    frameOn(kit, e, gm);
    const L = e.len;
    if (streets.includes(e)) {
      kit.box(0, -0.3, 0.03, L, H + 0.1, 0.05, 'plaster');
      kit.box(-L * 0.2, 0.0, 0.07, L * 0.35, 3.2, 0.02, 'ochre'); // потемнет малтер
    }
    const n = Math.max(1, Math.round(L / 3.2));
    for (let k = 0; k < n; k++) {
      const u = -L / 2 + (L * (k + 0.5)) / n;
      for (const y of [1.0, 4.2, 7.3]) windowAt(kit, u, y, 0.95, 1.6, { frame: 'plaster', v: 0.08, sill: true, sillPart: 'plaster', lit: 0.5 });
    }
    if (e === streets[0]) balcony(kit, L / 4, 4.0, 1.8, 0.8, { slab: 'stone', rail: 'metal', h: 1.0 });
  }
  const f = obb(ring);
  kit.setFrame(f.cx, gm + H, f.cz, f.ax, f.az);
  for (const du of [-f.L * 0.25, f.L * 0.2]) kit.box(du, 0, f.W * 0.15, 0.7, 3.4, 0.6, 'roof');
}

/**
 * Зграда „ROOMS“ (w1070708405): двокатна, тула од страните, бела фасада кон Његош со стар дуќан во
 * приземјето, балкон со метална ограда на аголот и вертикален светлечки натпис „ROOMS“.
 */
function rooms(kit, s0, _edges, gm, others) {
  const ring = simplify(s0.rings[0]);
  const s = { ...s0, rings: [ring] };
  const H = 7.6;
  body(kit, s, H, 'roof', { pitched: 'hip' });
  for (let y = 0.4; y < H - 0.3; y += 0.36) band(kit, ring, gm + y, gm + y + 0.03, 0.01, 'stone');
  const edges = openEdges(ring, others);
  const front = roadEdges(edges, NJEGOS, 3)[0];
  for (const e of edges) {
    if (e.len < 2.5) continue;
    frameOn(kit, e, gm);
    const L = e.len;
    const isFront = e === front;
    if (isFront) {
      kit.box(0, -0.3, 0.03, L, H + 0.1, 0.05, 'plaster');
      kit.box(0, 3.6, 0.08, L, 0.25, 0.16, 'ochre');
    }
    const n = Math.max(1, Math.round(L / 2.8));
    for (let k = 0; k < n; k++) {
      const u = -L / 2 + (L * (k + 0.5)) / n;
      windowAt(kit, u, 4.5, 1.0, 1.7, { frame: 'plaster', v: 0.08, sill: true, sillPart: 'plaster', lit: 0.7 });
      if (isFront) windowAt(kit, u, 0.3, Math.min(1.6, L / n - 0.6), 2.8, { frame: 'wood', v: 0.08, bars: true, sill: false, lit: 0.9 });
    }
    if (!isFront) continue;
    balcony(kit, L / 2 - 1.1, 4.3, 1.8, 0.9, { slab: 'stone', rail: 'metal', h: 1.0 });
    kit.box(L / 2 - 0.25, 3.0, 0.45, 0.4, 3.8, 0.14, 'ochre', 0, 0.8); // „ROOMS“
  }
}

/** Стара двокатна куќа покрај Његош (w1463658176, w1463658177): крем малтер, кафени прозорци. */
function oldHouse(kit, s0, _edges, gm, others) {
  const ring = simplify(s0.rings[0]);
  const s = { ...s0, rings: [ring] };
  const H = s0.h > 5 ? 7.2 : 4.0;
  body(kit, s, H, 'plaster', { pitched: 'hip' });
  band(kit, ring, gm - 0.3, gm + 0.5, 0.08, 'stone');
  band(kit, ring, gm + H - 0.3, gm + H, 0.35, 'plaster');
  const edges = openEdges(ring, others);
  for (const e of edges) {
    if (e.len < 2.5) continue;
    frameOn(kit, e, gm);
    const n = Math.max(1, Math.round(e.len / 2.8));
    for (let k = 0; k < n; k++) {
      const u = -e.len / 2 + (e.len * (k + 0.5)) / n;
      windowAt(kit, u, 1.1, 0.95, 1.6, { frame: 'wood', sill: true, sillPart: 'plaster', lit: 0.6 });
      if (H > 5) windowAt(kit, u, 4.6, 0.95, 1.6, { frame: 'wood', sill: true, sillPart: 'plaster', lit: 0.6 });
    }
  }
}

// OSM id → рецепт
const HOUSES = [
  { osm: 1070708388, build: altaBanka },
  { osm: 1070708389, build: pizzaCorner },
  { osm: 1070708420, build: mickey },
  { osm: 1465425549, build: mickey },
  // Јорго Османо, од банката кон Саат Кула
  { osm: 1070708390, build: knizarnica },
  { osm: 1070708391, build: lowShops },
  { osm: 1070708392, build: osmano8 },
  { osm: 1463976012, build: coffeeHouse },
  { osm: 1070708393, build: pinkHouse },
  // раскрсницата со „Петар Петровиќ-Његош“
  { osm: 1464872234, build: kebab },
  { osm: 1464872233, build: oldShops },
  { osm: 1070708395, build: oldShops },
  { osm: 1070708394, build: weathered },
  { osm: 1070708405, build: rooms },
  { osm: 1463658177, build: oldHouse },
  { osm: 1463658176, build: oldHouse },
];

/** Изгради ги куќите западно од Магнолија (ги додава во ctx.skip). */
export function westHouses(kit, ctx) {
  return buildHouses(kit, ctx, HOUSES, { tag: 'zapad' });
}
