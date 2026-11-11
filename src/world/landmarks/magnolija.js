// Зградите околу плоштадот Магнолија и влезот на Широк Сокак — детални модели според
// фотографии од сопственикот (поглед од споменикот на Филип II кон Широк Сокак).
//
// Секоја зграда е OSM основа (по id) + „рецепт“: катови, прозорци, балкони, корнизи, покрив.
// Фасадата се гради по секој „отворен“ раб на основата (раб што не е заеднички ѕид со сосед);
// главниот раб (свртен кон споменикот) ги добива посебните детали.
//
// Рамка на раб: u = по работ, v = нанадвор од ѕидот (v = 0 е рамнината на ѕидот), y = над подлогата.

import * as THREE from 'three';
import { Kit } from './kit.js';
import { buildingShape, shell, Writer } from '../buildings.js';
import { pointInRing, ringCentroid } from '../geom2d.js';

// Споменикот на Филип II (локални метри) — кон него гледаат главните фасади.
const FOCUS = [-10.1, 45.5];

// ─────────────────────────── примитиви за фасада ───────────────────────────

/** Профил на прозорец/отвор: правоаголник со (опционален) лак горе. */
function openingShape(w, h, arch) {
  const hw = w / 2;
  const s = new THREE.Shape();
  if (arch === 'round') {
    const sp = h - hw;
    s.moveTo(-hw, 0);
    s.lineTo(hw, 0);
    s.lineTo(hw, sp);
    s.absarc(0, sp, hw, 0, Math.PI, false);
    s.lineTo(-hw, 0);
  } else if (arch === 'pointed') {
    // зашилен (готски) лак: два лака со радиус w, центри на спротивните почетоци
    const sp = h - w * 0.866;
    s.moveTo(-hw, 0);
    s.lineTo(hw, 0);
    s.lineTo(hw, sp);
    const n = 8;
    for (let i = 1; i <= n; i++) {
      const a = (i / n) * (Math.PI / 3);
      s.lineTo(-hw + w * Math.cos(a), sp + w * Math.sin(a));
    }
    for (let i = n - 1; i >= 0; i--) {
      const a = (i / n) * (Math.PI / 3);
      s.lineTo(hw - w * Math.cos(a), sp + w * Math.sin(a));
    }
    s.lineTo(-hw, 0);
  } else {
    s.moveTo(-hw, 0);
    s.lineTo(hw, 0);
    s.lineTo(hw, h);
    s.lineTo(-hw, h);
    s.lineTo(-hw, 0);
  }
  return s;
}

/** Плоча по профил, истисната нанадвор (v од v0 до v0 + d). */
function plate(kit, shape, u, y, v0, d, part, glow) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 8 });
  kit.add(g, Kit.at(u, y, v0), part, glow);
}

/** Детерминистички „случај“ (0–1). */
function rnd(a, b) {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Прозорец: рамка + стакло (свети ноќе) + крст од пречки + подпрозорник.
 * o: { arch, frame, sill, bars, shutter (дел за ролетна горе), hood (дел за натпрозорник) }
 */
function windowAt(kit, u, y, w, h, o = {}) {
  const frame = o.frame || 'accent';
  const v = o.v || 0;
  const lit = rnd(u * 3.1 + y, w) < (o.lit ?? 0.7);
  plate(kit, openingShape(w + 0.26, h + 0.2, o.arch), u, y - 0.1, v, 0.1, frame);
  // големите излози светат помеко (инаку се рамни светли плочи ноќе)
  const glow = lit ? (w * h > 4 ? 0.45 : 0.8) : 0;
  plate(kit, openingShape(w, h, o.arch), u, y, v + 0.1, 0.03, 'window', glow);
  if (o.shutter) kit.box(u, y + h * 0.62, v + 0.135, w, h * 0.38 - (o.arch ? w / 2 : 0.02), 0.02, o.shutter);
  if (o.bars !== false) {
    kit.box(u, y, v + 0.14, 0.06, h - (o.arch ? w * 0.4 : 0), 0.03, frame);
    kit.box(u, y + h * 0.58, v + 0.14, w, 0.06, 0.03, frame);
  }
  if (o.sill !== false) kit.box(u, y - 0.16, v + 0.12, w + 0.5, 0.1, 0.25, o.sillPart || frame);
  if (o.hood) kit.box(u, y + h + 0.12, v + 0.14, w + 0.6, 0.18, 0.28, o.hood);
}

/** Балкон: плоча, конзоли, огради (столбчиња) со рачка. */
function balcony(kit, u, y, w, d, { slab = 'stone', rail = 'metal', h = 1.0, step = 0.16, solid = false } = {}) {
  kit.box(u, y - 0.18, d / 2, w, 0.18, d, slab);
  for (const s of [-1, 1]) kit.box(u + s * (w / 2 - 0.2), y - 0.6, 0.2, 0.14, 0.42, 0.4, slab);
  if (solid) {
    // зидана балустрада: ниски столбчиња + плоча горе
    for (let x = -w / 2 + 0.12; x <= w / 2 - 0.1; x += 0.24) kit.cylinder(u + x, y, d - 0.12, 0.06, h - 0.12, rail, { seg: 6, top: 0.045 });
    kit.box(u, y + h - 0.12, d - 0.12, w, 0.12, 0.2, rail);
    return;
  }
  kit.box(u, y + h - 0.05, d - 0.04, w, 0.05, 0.05, rail);
  kit.box(u, y + 0.08, d - 0.04, w, 0.04, 0.04, rail);
  for (let x = -w / 2; x <= w / 2 + 1e-3; x += step) kit.box(u + x, y, d - 0.04, 0.025, h, 0.025, rail);
  for (const s of [-1, 1]) {
    kit.box(u + s * (w / 2), y + h - 0.05, d / 2, 0.05, 0.05, d, rail);
    for (let z = 0.15; z < d; z += step) kit.box(u + s * (w / 2), y, z, 0.025, h, 0.025, rail);
  }
}

/** Ѕидна светилка (фенер) со конзола — свети ноќе. */
function wallLamp(kit, u, y) {
  kit.box(u, y, 0.2, 0.06, 0.06, 0.4, 'metal');
  kit.box(u, y - 0.42, 0.42, 0.24, 0.36, 0.24, 'light');
  kit.box(u, y - 0.06, 0.42, 0.3, 0.08, 0.3, 'metal');
}

/** Хоризонтален венец по целиот прстен (корниз, појас) — ги следи и заоблените агли. */
function band(kit, ring, y0, y1, out, part) {
  kit.slab([grow(ring, out)], y0, y1, part);
}

/** Прстен поместен нанадвор за d (отсечки по нормалите, спојување на аглите). */
function grow(ring, d) {
  const n = ring.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = ring[(i - 1 + n) % n];
    const c = ring[i];
    const q = ring[(i + 1) % n];
    const n1 = norm(c[0] - p[0], c[1] - p[1]);
    const n2 = norm(q[0] - c[0], q[1] - c[1]);
    let mx = n1[1] + n2[1];
    let mz = -n1[0] - n2[0];
    const l = Math.hypot(mx, mz) || 1;
    mx /= l;
    mz /= l;
    const k = Math.max(0.5, mx * n2[1] - mz * n2[0]);
    out.push([c[0] + (mx * d) / k, c[1] + (mz * d) / k]);
  }
  return out;
}
function norm(x, z) {
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
}

// ─────────────────────────── рабови на основата ───────────────────────────

/** Отворени рабови (без заеднички ѕид): рамка, должина, колку гледаат кон споменикот. */
function openEdges(ring, others) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.5) continue;
    const tx = (b[0] - a[0]) / len;
    const tz = (b[1] - a[1]) / len;
    const nx = tz;
    const nz = -tx;
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const probe = [m[0] + nx * 1.2, m[1] + nz * 1.2];
    if (others.some((r) => pointInRing(probe, r))) continue;
    const fx = FOCUS[0] - m[0];
    const fz = FOCUS[1] - m[1];
    out.push({ i, a, b, len, m, nx, nz, face: (nx * fx + nz * fz) / Math.hypot(fx, fz) });
  }
  return out;
}

function frameOn(kit, e, y) {
  kit.setFrame(e.m[0], y, e.m[1], e.nz, -e.nx);
}

/** Тело на зградата: ѕидови по основата + рамен или кос покрив. */
function body(kit, s, h, part, { pitched = false, roof = 'roof', top = 'stone' } = {}) {
  const W = new Writer();
  const R = new Writer();
  const isPitched = shell({ ...s, h, top: s.gmean + h }, pitched, W, R, 0);
  kit.raw(W.pos, W.nor, part);
  kit.raw(R.pos, R.nor, isPitched ? roof : top);
}

/** Прозорци на споредните отворени рабови (едноставно, по кат). */
function plainWindows(kit, edges, floors, { spacing = 2.6, w = 1.0, h = 1.7, frame = 'accent', minLen = 2.4, skipMain = null } = {}) {
  for (const e of edges) {
    if (e === skipMain || e.len < minLen) continue;
    const n = Math.max(1, Math.floor(e.len / spacing));
    frameOn(kit, e, 0);
    for (let k = 0; k < n; k++) {
      const u = -e.len / 2 + (e.len * (k + 0.5)) / n;
      for (const y of floors) windowAt(kit, u, y, w, h, { frame, sill: false, bars: e.len > 4 });
    }
  }
}

// ─────────────────────────── рецепти ───────────────────────────

/** Бела аголна зграда: дуќани, висок кат, заоблен агол, атика со столбчиња и вазни. */
function whiteCorner(kit, s, edges, gm) {
  const H = 9.6;
  body(kit, s, H, 'plaster');
  const ring = s.rings[0];
  band(kit, ring, gm + 4.4, gm + 4.75, 0.18, 'plaster');
  band(kit, ring, gm + 8.7, gm + 9.0, 0.3, 'plaster');
  band(kit, ring, gm + 9.0, gm + 9.6, 0.12, 'plaster');
  band(kit, ring, gm + 9.6, gm + 10.5, 0.02, 'plaster');
  band(kit, ring, gm + 10.5, gm + 10.68, 0.12, 'plaster');
  band(kit, ring, gm - 0.3, gm + 0.35, 0.1, 'stone');
  for (const e of edges) {
    frameOn(kit, e, gm);
    if (e.len < 2.4) continue;
    const front = e.face > 0;
    const n = Math.max(1, Math.round(e.len / 2.6));
    for (let k = 0; k < n; k++) {
      const u = -e.len / 2 + (e.len * (k + 0.5)) / n;
      // дуќани: големи излози со темна рамка
      if (front) windowAt(kit, u, 0.5, Math.min(2.2, e.len / n - 0.5), 3.3, { frame: 'metal', sill: false, bars: false, lit: 0.9 });
      windowAt(kit, u, 5.4, 1.15, 2.3, { frame: 'metal', sillPart: 'plaster', hood: 'plaster' });
    }
    // столбчиња на атиката со вазни
    for (let k = 0; k <= n; k++) {
      const u = -e.len / 2 + (e.len * k) / n;
      kit.box(u, 9.6, 0.1, 0.45, 1.15, 0.45, 'plaster');
      kit.cylinder(u, 10.75, 0.1, 0.14, 0.18, 'plaster', { seg: 8 });
      kit.sphere(u, 11.15, 0.1, 0.24, 'plaster', { seg: 10, sy: 1.15 });
    }
    if (front && e.len > 5) balcony(kit, -e.len / 2 + e.len / (2 * n), 5.25, 1.6, 0.55, { slab: 'plaster', rail: 'metal' });
  }
}

/**
 * Највисоката куќичка (кон споменикот): излог и врата, кат со пет зашилени прозорци и
 * балкончиња, лоѓија со дрвен балкон и столбови, широка стреа и стрмен украсен забат.
 */
function consulate(kit, s, edges, gm) {
  const H = 12.4;
  body(kit, s, H, 'plaster');
  const ring = s.rings[0];
  band(kit, ring, gm - 0.3, gm + 0.4, 0.1, 'stone');
  band(kit, ring, gm + 4.45, gm + 4.75, 0.2, 'plaster');
  const main = edges.reduce((best, e) => (e.face > (best?.face ?? -2) ? e : best), null);
  plainWindows(kit, edges, [5.3, 9.0], { skipMain: main, frame: 'wood', w: 0.9, h: 2.0 });
  if (!main) return;
  const L = main.len;
  frameOn(kit, main, gm);
  // приземје: излог, врата, натпис
  windowAt(kit, -0.5, 0.5, 2.8, 3.0, { frame: 'wood', sill: false, bars: false, lit: 1 });
  windowAt(kit, L / 2 - 0.95, 0.3, 0.95, 2.6, { frame: 'wood', sill: false, bars: false, lit: 0 });
  windowAt(kit, -L / 2 + 0.75, 0.5, 0.8, 3.0, { frame: 'wood', sill: false, bars: false, lit: 0.5 });
  kit.box(-0.5, 3.55, 0.12, 3.2, 0.75, 0.06, 'ochre');
  wallLamp(kit, L / 2 - 0.2, 3.9);
  // прв кат: пет зашилени прозорци, балкончиња под 1., 3. и 5.
  const step = Math.min(1.18, (L - 0.9) / 4.6);
  for (let k = -2; k <= 2; k++) {
    const u = k * step;
    windowAt(kit, u, 5.3, 0.82, 2.45, { arch: 'pointed', frame: 'wood', sill: k % 2 !== 0, sillPart: 'plaster' });
    if (k % 2 === 0) balcony(kit, u, 5.2, 0.95, 0.42, { slab: 'plaster', rail: 'wood', h: 0.8, step: 0.12 });
  }
  // втор кат: лоѓија — широк дрвен балкон на конзоли, три зашилени отвори, столбови
  const bw = L + 0.5;
  balcony(kit, 0, 8.7, bw, 1.1, { slab: 'wood', rail: 'wood', h: 1.0, step: 0.13 });
  for (let k = -2; k <= 2; k++) {
    // конзоли (косници) под балконот
    kit.add(new THREE.BoxGeometry(0.14, 1.2, 0.14), Kit.atE(k * (bw / 5), 8.0, 0.45, 0.75, 0, 0), 'wood');
  }
  for (let k = -1; k <= 1; k++) windowAt(kit, k * 1.75, 9.1, 1.15, 2.7, { arch: 'pointed', frame: 'wood', sill: false, lit: 0.9 });
  for (const u of [-bw / 2 + 0.1, -bw / 6, bw / 6, bw / 2 - 0.1]) kit.box(u, 8.7, 1.0, 0.16, 3.7, 0.16, 'wood');
  // стреа и украсен забат (фронтон кон плоштадот)
  kit.box(0, 12.4, 0.1, L + 1.6, 0.22, 2.2, 'wood');
  kit.box(0, 12.62, 0.0, L + 0.6, 0.12, 1.6, 'wood');
  // длабочина на зградата зад главната фасада (од основата)
  const d = Math.max(...ring.map((p) => -((p[0] - main.m[0]) * main.nx + (p[1] - main.m[1]) * main.nz)));
  // стрм покрив: слеме нормално на фасадата
  kit.gable(0, 12.7, -d / 2 + 0.6, d + 0.2, 4.6, L + 0.8, 'roof', Math.PI / 2);
  // фронтон: „кокошник“ — стрм триаголник со извиени страни, рамка од дрво, врв
  const tri = new THREE.Shape();
  const hw = L / 2 - 0.2;
  tri.moveTo(-hw, 0);
  tri.lineTo(hw, 0);
  tri.quadraticCurveTo(hw * 0.25, 1.6, 0.0, 4.4);
  tri.quadraticCurveTo(-hw * 0.25, 1.6, -hw, 0);
  plate(kit, tri, 0, 12.7, 0.68, 0.12, 'plaster');
  // кровни ќерамиди на фронтонот: два дрвени раба
  for (const sgn of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      // квадратна Безиерова крива од (sgn*hw, 0) преку (sgn*hw*0.25, 1.6) до (0, 4.4)
      const x = (1 - t) * (1 - t) * sgn * hw + 2 * (1 - t) * t * sgn * hw * 0.25;
      const y = 2 * (1 - t) * t * 1.6 + t * t * 4.4;
      pts.push([x, y]);
    }
    for (let i = 0; i < 8; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const ang = Math.atan2(y1 - y0, x1 - x0);
      kit.add(new THREE.BoxGeometry(len + 0.06, 0.18, 0.3), Kit.atE((x0 + x1) / 2, 12.7 + (y0 + y1) / 2, 0.75, 0, 0, ang), 'wood');
    }
  }
  // мали прозорци во фронтонот и врв
  windowAt(kit, 0, 13.3, 0.7, 1.6, { arch: 'pointed', frame: 'wood', sill: false, bars: false, v: 0.8 });
  kit.cylinder(0, 17.0, 0.7, 0.06, 1.3, 'metal', { seg: 6, top: 0.01 });
  kit.sphere(0, 17.2, 0.7, 0.12, 'metal', { seg: 8 });
  // мали забатчиња на страните на стреата (како на фотографијата)
  for (const sgn of [-1, 1]) kit.gable(sgn * (L / 2 + 0.2), 12.62, 0.4, 1.2, 0.8, 0.9, 'wood', Math.PI / 2);
}

/** Неокласична праскова зграда: рустика, лачни прозорци, пиластри, балкон, тимпанон. */
function neoclassic(kit, s, edges, gm) {
  const H = 10.4;
  body(kit, s, H, 'peach');
  const ring = s.rings[0];
  band(kit, ring, gm - 0.3, gm + 0.8, 0.12, 'stone');
  // рустика во приземјето (жлебови)
  for (let y = 0.85; y < 4.6; y += 0.55) band(kit, ring, gm + y, gm + y + 0.48, 0.05, 'peach');
  band(kit, ring, gm + 4.7, gm + 5.05, 0.22, 'plaster');
  band(kit, ring, gm + 9.3, gm + 9.5, 0.12, 'plaster');
  band(kit, ring, gm + 10.15, gm + 10.45, 0.42, 'plaster');
  band(kit, ring, gm + 10.45, gm + 11.2, 0.0, 'peach');
  band(kit, ring, gm + 11.2, gm + 11.35, 0.1, 'plaster');
  const main = edges.reduce((best, e) => (e.face > (best?.face ?? -2) ? e : best), null);
  plainWindows(kit, edges, [1.4, 5.8], { skipMain: main, frame: 'plaster', w: 1.0, h: 2.0 });
  if (!main) return;
  const L = main.len;
  frameOn(kit, main, gm);
  const step = L / 3.6;
  // приземје: три лачни прозорци и лачна врата
  for (let k = -1; k <= 1; k++) windowAt(kit, k * step - 0.4, 1.2, 1.3, 2.7, { arch: 'round', frame: 'plaster', shutter: 'wood' });
  windowAt(kit, L / 2 - 0.95, 0.3, 1.2, 3.4, { arch: 'round', frame: 'plaster', bars: false, sill: false, lit: 0.3, shutter: 'wood' });
  // кат: пиластри, три прозорци со натпрозорници, централен балкон со балустрада
  for (let k = 0; k <= 3; k++) {
    const u = -L / 2 + 0.6 + ((L - 1.2) * k) / 3;
    kit.box(u, 5.05, 0.08, 0.55, 4.25, 0.16, 'plaster');
    kit.box(u, 9.0, 0.1, 0.7, 0.3, 0.22, 'plaster');
  }
  for (let k = -1; k <= 1; k++) {
    const u = k * step - 0.4;
    windowAt(kit, u, 5.9, 1.25, 2.4, { frame: 'plaster', shutter: 'wood', hood: 'plaster', sill: k !== 0 });
    // украсни плочки во фризот
    kit.box(u, 9.55, 0.06, 1.6, 0.45, 0.08, 'plaster');
  }
  balcony(kit, -0.4, 5.75, 3.0, 0.8, { slab: 'plaster', rail: 'plaster', h: 0.95, solid: true });
  // тимпанон над средишниот дел и „вазна“ на врвот
  const tri = new THREE.Shape();
  tri.moveTo(-2.4, 0);
  tri.lineTo(2.4, 0);
  tri.lineTo(0, 1.5);
  tri.lineTo(-2.4, 0);
  plate(kit, tri, -0.4, 11.2, -0.1, 0.42, 'peach');
  for (const sgn of [-1, 1]) kit.add(new THREE.BoxGeometry(2.8, 0.16, 0.55), Kit.atE(-0.4 + sgn * 1.2, 11.2 + 0.72, 0.1, 0, 0, -sgn * Math.atan2(1.5, 2.4)), 'plaster');
  kit.cylinder(-0.4, 12.7, 0.0, 0.25, 0.35, 'plaster', { seg: 10 });
  kit.sphere(-0.4, 13.3, 0.0, 0.33, 'plaster', { seg: 12 });
  wallLamp(kit, -L / 2 + 0.3, 4.2);
}

/** Ниска жолта зграда: дуќани со тенда, кат со прозорци, коси ќерамиди. */
function lowYellow(kit, s, edges, gm) {
  body(kit, s, 7.4, 'ochre', { pitched: true });
  const ring = s.rings[0];
  band(kit, ring, gm + 3.9, gm + 4.15, 0.15, 'plaster');
  band(kit, ring, gm + 7.1, gm + 7.4, 0.35, 'plaster');
  for (const e of edges) {
    if (e.len < 2.4) continue;
    frameOn(kit, e, gm);
    const n = Math.max(1, Math.round(e.len / 2.8));
    for (let k = 0; k < n; k++) {
      const u = -e.len / 2 + (e.len * (k + 0.5)) / n;
      windowAt(kit, u, 4.7, 0.95, 1.6, { frame: 'plaster', sillPart: 'plaster' });
      if (e.face > 0) windowAt(kit, u, 0.4, Math.min(2.0, e.len / n - 0.6), 2.8, { frame: 'metal', sill: false, bars: false, lit: 0.9 });
    }
    if (e.face > 0.3) {
      // тенда над дуќаните
      kit.add(new THREE.BoxGeometry(e.len * 0.55, 0.08, 1.4), Kit.atE(e.len * 0.18, 3.55, 0.7, 0.32, 0, 0), 'wall2');
    }
  }
}

/** Аголна окер зграда („vip“): три ката, заоблен агол, натпрозорници, балкони, мансарда. */
function cornerOchre(kit, s, edges, gm) {
  body(kit, s, 11.2, 'ochre', { pitched: true });
  const ring = s.rings[0];
  band(kit, ring, gm - 0.3, gm + 0.4, 0.1, 'stone');
  band(kit, ring, gm + 4.2, gm + 4.55, 0.2, 'plaster');
  band(kit, ring, gm + 7.75, gm + 7.95, 0.1, 'plaster');
  band(kit, ring, gm + 10.8, gm + 11.25, 0.45, 'plaster');
  for (const e of edges) {
    if (e.len < 2.0) continue;
    frameOn(kit, e, gm);
    const n = Math.max(1, Math.round(e.len / 2.4));
    for (let k = 0; k < n; k++) {
      const u = -e.len / 2 + (e.len * (k + 0.5)) / n;
      windowAt(kit, u, 0.5, Math.min(1.9, e.len / n - 0.5), 3.1, { frame: 'metal', sill: false, bars: false, lit: 0.9 });
      for (const y of [5.0, 8.4]) {
        windowAt(kit, u, y, 0.95, 1.85, { frame: 'plaster', sillPart: 'plaster' });
        // лачен натпрозорник („веѓа“)
        plate(kit, openingShape(1.4, 0.45, 'round'), u, y + 1.9, 0.0, 0.2, 'plaster');
      }
    }
    if (e.face > 0.6 && e.len > 6) balcony(kit, e.len / 2 - 1.4, 4.9, 2.0, 0.7, { slab: 'plaster', rail: 'metal' });
    if (e.face > 0.6) wallLamp(kit, -e.len / 2 + 0.4, 4.0);
  }
}

/** Жолта зграда со кос покрив спроти споменикот („Zegin“): два ката, дуќани. */
function eastYellow(kit, s, edges, gm) {
  body(kit, s, 8.0, 'ochre', { pitched: true });
  const ring = s.rings[0];
  band(kit, ring, gm + 3.9, gm + 4.2, 0.15, 'plaster');
  band(kit, ring, gm + 7.7, gm + 8.0, 0.4, 'plaster');
  for (const e of edges) {
    if (e.len < 2.2) continue;
    frameOn(kit, e, gm);
    const n = Math.max(1, Math.round(e.len / 2.4));
    for (let k = 0; k < n; k++) {
      const u = -e.len / 2 + (e.len * (k + 0.5)) / n;
      windowAt(kit, u, 4.8, 0.95, 1.8, { frame: 'plaster', sillPart: 'plaster' });
      if (e.face > 0.4) windowAt(kit, u, 0.4, Math.min(1.8, e.len / n - 0.5), 2.8, { frame: 'metal', sill: false, bars: false, lit: 0.9 });
    }
  }
}

// OSM id → рецепт
const HOUSES = [
  { osm: 1464455357, build: whiteCorner },
  { osm: 1070708427, build: consulate },
  { osm: 1070708424, build: neoclassic },
  { osm: 1070708421, build: lowYellow },
  { osm: 1463976005, build: cornerOchre },
  { osm: 1070708439, build: eastYellow },
];

/**
 * Изгради ги зградите на Магнолија (ги додава во ctx.skip — обичниот слој не ги црта).
 * @returns {Set<number>} индекси на изградените згради
 */
export function magnoliaHouses(kit, ctx) {
  const pack = ctx.buildings;
  const ids = pack.arrays.osmId;
  const want = new Map(HOUSES.map((h) => [h.osm, h]));
  const found = [];
  for (let b = 0; b < ids.length; b++) if (want.has(ids[b])) found.push([b, want.get(ids[b])]);
  if (!found.length) return new Set();
  // соседите (за заедничките ѕидови): сите основи во близина
  const [cx, cz] = ringCentroid(buildingShape(pack, found[0][0]).rings[0]);
  const near = [];
  const q = pack.meta.q;
  for (let b = 0; b < pack.meta.count; b++) {
    const r0 = pack.arrays.ringPt[pack.arrays.polyRing[b]];
    const x = pack.arrays.coords[r0 * 2] * q;
    const z = pack.arrays.coords[r0 * 2 + 1] * q;
    if (Math.abs(x - cx) < 150 && Math.abs(z - cz) < 150) near.push(b);
  }
  const done = new Set();
  for (const [b, h] of found) {
    const s = buildingShape(pack, b);
    const others = near.filter((o) => o !== b).map((o) => buildingShape(pack, o).rings[0]);
    const edges = openEdges(s.rings[0], others);
    try {
      h.build(kit, s, edges, s.gmean);
      ctx.skip.add(b);
      done.add(b);
    } catch (err) {
      console.warn(`[magnolija] w${h.osm}:`, err);
    }
    kit.setFrame(0, 0, 0);
  }
  return done;
}
