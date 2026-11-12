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
import { obb, pointInRing, ringCentroid } from '../geom2d.js';

// Споменикот на Филип II (локални метри) — кон него гледаат главните фасади.
const FOCUS = [-10.1, 45.5];

// Летната тераса пред ресторанот „Грне“ (јужно од зградата, источно од споменикот). Overture/ML ја
// препознава тендата како зграда (≈ 9.6 × 7 m, 10 m висока „куќичка“) — таа се заменува со тераса.
const TERRACE = [11.1, 47.3];

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

/**
 * Летна тераса (според фотографиите): дрвен под, жардињери со чемпресчиња и цвеќе по рабовите,
 * маси со столчиња. Покривка: 'awning' — бела тенда на дрвен столб (со буре во подножјето) и
 * аголни столбови (пред „Грне“); 'umbrellas' — редови квадратни бели чадори со врв (пред Стаклена).
 */
function terrace(kit, ring, gm, cover = 'awning') {
  const f = obb(ring);
  const L = f.L;
  const W = f.W;
  kit.setFrame(f.cx, gm, f.cz, f.ax, f.az);
  kit.box(0, -0.3, 0, L, 0.45, W, 'wood');
  // жардињери по рабовите; отвор (влез) на средината на двете долги страни
  const gap = 1.8;
  const planter = (u, v, len, alongU) => {
    if (len < 0.4) return;
    kit.box(u, 0.15, v, alongU ? len : 0.5, 0.55, alongU ? 0.5 : len, 'wood');
    const n = Math.max(1, Math.round(len / 0.9));
    for (let k = 0; k < n; k++) {
      const t = -len / 2 + (len * (k + 0.5)) / n;
      const [pu, pv] = alongU ? [u + t, v] : [u, v + t];
      if (k % 2 === 0) kit.cone(pu, 0.7, pv, 0.3, 1.1 + rnd(pu, pv) * 0.5, 'green', { seg: 6 });
      else kit.sphere(pu, 0.8, pv, 0.24, 'blossom', { seg: 6, sy: 0.8 });
    }
  };
  const half = (L - gap) / 2;
  for (const sv of [-1, 1]) {
    for (const su of [-1, 1]) planter(su * (gap / 2 + half / 2), sv * (W / 2 - 0.25), half, true);
  }
  for (const su of [-1, 1]) planter(su * (L / 2 - 0.25), 0, W - 1, false);
  // маси (портокалови плочи) со по две столчиња
  const table = (u, v) => {
    kit.cylinder(u, 0.15, v, 0.05, 0.6, 'metal', { seg: 5 });
    kit.box(u, 0.75, v, 0.85, 0.06, 0.85, 'ochre');
    for (const s of [-1, 1]) {
      kit.box(u + s * 0.7, 0.15, v, 0.45, 0.45, 0.45, 'trunk');
      kit.box(u + s * 0.9, 0.6, v, 0.08, 0.45, 0.45, 'trunk');
    }
  };
  if (cover === 'umbrellas') {
    // квадратни чадори (≈ 4 m) во мрежа; под секој по две маси
    const nu = Math.max(1, Math.round((L - 1) / 4.2));
    const nv = Math.max(1, Math.round((W - 1) / 4.2));
    const a = Math.min((L - 1) / nu, (W - 1) / nv) - 0.15;
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const u = -(L - 1) / 2 + ((L - 1) * (i + 0.5)) / nu;
        const v = -(W - 1) / 2 + ((W - 1) * (j + 0.5)) / nv;
        kit.cylinder(u, 0.15, v, 0.05, 2.6, 'metal', { seg: 5 });
        kit.hip(u, 2.35, v, a, 0.95, a, 'plaster');
        kit.box(u, 2.15, v, a, 0.22, a, 'plaster');
        kit.cone(u, 3.25, v, 0.28, 0.45, 'plaster', { seg: 4 });
        for (const s of [-1, 1]) table(u + s * a * 0.24, v - s * a * 0.22);
      }
    }
    return;
  }
  for (let u = -L / 2 + 1.6; u <= L / 2 - 1.5; u += 2.1) {
    for (let v = -W / 2 + 1.5; v <= W / 2 - 1.4; v += 2.0) {
      if (Math.abs(u) < 1.1 && Math.abs(v) < 1.1) continue;
      table(u, v);
    }
  }
  // средишен столб на буре, аголни столбови, бела тенда со раб
  kit.cylinder(0, 0.15, 0, 0.42, 0.9, 'wood', { seg: 10 });
  kit.cylinder(0, 1.05, 0, 0.17, 2.3, 'wood', { seg: 8 });
  const TL = L - 0.8;
  const TW = W - 0.8;
  for (const [su, sv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) kit.cylinder((su * TL) / 2, 0.15, (sv * TW) / 2, 0.08, 2.75, 'wood', { seg: 6 });
  kit.hip(0, 2.9, 0, TL + 0.4, 0.75, TW + 0.4, 'accent');
  kit.box(0, 2.6, (TW + 0.4) / 2, TL + 0.4, 0.3, 0.04, 'accent');
  kit.box(0, 2.6, -(TW + 0.4) / 2, TL + 0.4, 0.3, 0.04, 'accent');
  kit.box((TL + 0.4) / 2, 2.6, 0, 0.04, 0.3, TW + 0.4, 'accent');
  kit.box(-(TL + 0.4) / 2, 2.6, 0, 0.04, 0.3, TW + 0.4, 'accent');
  // светилки под тендата (ноќе)
  for (const [su, sv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) kit.box((su * TL) / 4, 2.55, (sv * TW) / 4, 0.25, 0.2, 0.25, 'light');
}

// ─────────────────────────── Ресторан „Грне“ ───────────────────────────
// OSM w38572955, североисточно од споменикот. Според фотографиите: стара двокатна градска куќа —
// камено приземје (варовник) над низок сокл со отвори за подрумот, бел кат, широки кафени рамки
// околу прозорците со „веѓи“, кафен појас меѓу катовите и пиластри на аглите, плиток четиристрешен
// покрив со стреа, соларни панели и оџак. Јужната фасада (кон летната тераса): балкон со метална
// ограда над влезот, скали, надстрешница, зелени натписи („Грне“, „Restaurant“) и знаменца.

/** Прозорец на „Грне“: широка кафена рамка, бела рамка, стакло; opt. решетка и веѓа. */
function grneWindow(kit, u, y, w, h, { grille = false, hood = true, lit = 0.7 } = {}) {
  kit.box(u, y - 0.28, 0.0, w + 0.62, h + 0.5, 0.07, 'wood');
  windowAt(kit, u, y, w, h, { frame: 'plaster', v: 0.07, sill: false, lit });
  kit.box(u, y - 0.38, 0.1, w + 0.8, 0.1, 0.22, 'wood');
  if (hood) kit.box(u, y + h + 0.26, 0.1, w + 0.9, 0.16, 0.24, 'wood');
  if (grille) for (let k = -2; k <= 2; k++) kit.box(u + (k * w) / 5.2, y, 0.24, 0.035, h, 0.035, 'metal');
}

function grne(kit, s0, _edges, gm, others) {
  const ring = simplify(s0.rings[0]);
  const s = { ...s0, rings: [ring] };
  const H = 9.0;
  const G = 4.4; // висина на каменото приземје
  body(kit, s, H, 'plaster', { pitched: 'hip' });
  band(kit, ring, gm - 0.3, gm + 1.0, 0.1, 'plinth');
  band(kit, ring, gm + 1.0, gm + G, 0.06, 'stone');
  for (let y = 1.6; y < G - 0.2; y += 0.6) band(kit, ring, gm + y, gm + y + 0.04, 0.08, 'plinth');
  band(kit, ring, gm + G, gm + G + 0.3, 0.14, 'wood');
  band(kit, ring, gm + H - 0.4, gm + H - 0.15, 0.12, 'wood');
  band(kit, ring, gm + H - 0.15, gm + H + 0.05, 0.6, 'wood'); // стреа
  const edges = openEdges(ring, others);
  // главна фасада: кон летната тераса
  const main = edges.reduce((best, e) => {
    const d = (TERRACE[0] - e.m[0]) * e.nx + (TERRACE[1] - e.m[1]) * e.nz;
    return e.len > 8 && d > (best?.d ?? 0) ? { e, d } : best;
  }, null)?.e;
  for (const e of edges) {
    if (e.len < 3) continue;
    frameOn(kit, e, gm);
    const L = e.len;
    // пиластри на аглите (катот) и камени квадери (приземјето)
    for (const sg of [-1, 1]) {
      kit.box(sg * (L / 2 - 0.35), G + 0.3, 0.02, 0.7, H - G - 0.7, 0.12, 'wood');
      for (let y = 1.0; y < G; y += 0.6) kit.box(sg * (L / 2 - (y % 1.2 < 0.6 ? 0.35 : 0.55)), y, 0.03, y % 1.2 < 0.6 ? 0.7 : 1.1, 0.52, 0.1, 'stone');
    }
    const n = Math.max(1, Math.round((L - 1.4) / 2.35));
    for (let k = 0; k < n; k++) {
      const u = -(L - 1.4) / 2 + ((L - 1.4) * (k + 0.5)) / n;
      const centre = e === main && Math.abs(u) < (L - 1.4) / n / 2 + 0.01;
      if (centre) continue; // влез и балкон
      grneWindow(kit, u, 5.35, 1.05, 2.05);
      grneWindow(kit, u, 1.65, 1.05, 1.95, { grille: true, hood: false, lit: 0.85 });
      kit.box(u, 0.25, 0.04, 0.7, 0.35, 0.05, 'metal'); // отвор за подрумот
    }
    if (e !== main) continue;
    // ── главна фасада: влез, скали, надстрешница, натписи, балкон, знаменца ──
    windowAt(kit, 0, 1.0, 1.5, 2.9, { frame: 'wood', bars: false, sill: false, lit: 0.9 });
    kit.box(0, 0.72, 0.0, 2.3, 3.6, 0.07, 'wood');
    for (let k = 0; k < 4; k++) kit.box(0, -0.3 + k * 0.25, 0.4 + (3 - k) * 0.3, 3.0, 0.3, 0.32, 'stone');
    kit.add(new THREE.BoxGeometry(3.2, 0.08, 1.3), Kit.atE(0, 4.05, 0.65, 0.18, 0, 0), 'green');
    kit.box(0, 3.95, 0.08, 3.0, 0.42, 0.08, 'green'); // „Грне на Широк Сокак“
    kit.box(-L / 4, 3.75, 0.08, 3.4, 0.38, 0.06, 'green'); // „Restaurant“
    wallLamp(kit, 1.7, 3.6);
    wallLamp(kit, -1.7, 3.6);
    // балкон со француска врата
    windowAt(kit, 0, 4.85, 1.3, 2.75, { frame: 'plaster', v: 0.07, bars: true, sill: false, lit: 0.8 });
    kit.box(0, 4.6, 0.0, 1.95, 3.4, 0.07, 'wood');
    kit.box(0, 7.85, 0.1, 2.2, 0.16, 0.24, 'wood');
    balcony(kit, 0, 4.85, 3.4, 0.95, { slab: 'stone', rail: 'metal', h: 1.0, step: 0.14 });
    // знаменца (коси копја од катот)
    for (const sg of [-1, 1]) {
      const fu = sg * ((L - 1.4) / n) * 1.0;
      kit.add(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5).translate(0, 1.1, 0), Kit.atE(fu, 7.6, 0.15, 0.6, 0, 0), 'metal');
      kit.add(new THREE.BoxGeometry(0.04, 0.75, 1.1), Kit.atE(fu, 8.35, 1.25, 0.6, 0, 0), 'roof');
    }
  }
  // соларни панели на јужната падина на покривот (покрај слемето) и оџак
  if (main) {
    const W = Math.min(...edges.filter((e) => e !== main && e.len > 3).map((e) => e.len), 20);
    const hw = W / 2;
    const rise = Math.min(4.5, hw * Math.tan(Math.PI / 6), Math.max(1.2, H * 0.45));
    const th = Math.atan2(rise, hw);
    frameOn(kit, main, gm);
    const count = Math.max(4, Math.floor((main.len - 2 * (hw * 0.7)) / 1.08));
    const d = hw * 0.62;
    for (let k = 0; k < count; k++) {
      const u = (k - (count - 1) / 2) * 1.08;
      kit.add(new THREE.BoxGeometry(1.0, 0.07, 1.6), Kit.atE(u, H + d * Math.tan(th) + 0.12, -d, th, 0, 0), 'metal');
    }
    kit.box(main.len / 4, H + rise * 0.55, -hw * 0.6, 0.7, rise * 0.45 + 1.4, 0.7, 'plaster');
    kit.box(main.len / 4, H + rise + 0.85, -hw * 0.6, 0.9, 0.15, 0.9, 'wood');
  }
}

// ─────────────────────────── Трговски центар „Стаклена“ ───────────────────────────
// OSM w38573441 („ГП Пелистер“), источно од „Грне“. Според фотографиите: висок западен дел
// (5 ката стаклена фасада со метална мрежа, повлечено приземје со дуќани, закосен горен раб,
// конзолна стаклена кутија на северната фасада, пентхаус со надстрешница), стаклен цилиндар
// (скали) на северниот агол со камена облога горе и пониско источно крило со закосена стаклена
// „круна“. Пред северната фасада — гранитни жардињери со зеленило.

/** Отсечи прстен со полурамнина x ≤ x0 (keep = -1) или x ≥ x0 (keep = 1). */
function clipX(ring, x0, keep) {
  const out = [];
  const inside = (p) => (p[0] - x0) * keep >= 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) {
      const t = (x0 - a[0]) / (b[0] - a[0]);
      out.push([x0, a[1] + (b[1] - a[1]) * t]);
    }
  }
  // отстрани двојни точки и точки на права (по сечењето по вертикален раб на основата)
  let r = out.filter((p, i) => {
    const q = out[(i + 1) % out.length];
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05;
  });
  return simplify(r);
}

/** Отстрани точки што се (речиси) на права меѓу соседите (sin на аголот < tol). */
function simplify(ring, tol = 0.02) {
  let r = ring;
  for (let changed = true; changed && r.length > 3; ) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i - 1 + r.length) % r.length];
      const p = r[i];
      const b = r[(i + 1) % r.length];
      const l1 = Math.hypot(p[0] - a[0], p[1] - a[1]);
      const l2 = Math.hypot(b[0] - p[0], b[1] - p[1]);
      const cross = (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]);
      if (l1 < 1e-6 || l2 < 1e-6 || Math.abs(cross) / (l1 * l2) < tol) {
        r = r.filter((_, k) => k !== i);
        changed = true;
        break;
      }
    }
  }
  return r;
}

/** Закосен раб: од прстенот на y0 до прстенот вовлечен за inset на y0 + h, со капак горе. */
function chamfer(kit, ring, y0, h, inset, part) {
  const inner = grow(ring, -inset);
  const pos = [];
  const nor = [];
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const a = ring[i];
    const b = ring[j];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-3) continue;
    const nx = (b[1] - a[1]) / len;
    const nz = -(b[0] - a[0]) / len;
    const l = Math.hypot(h, inset);
    const n = [(nx * h) / l, inset / l, (nz * h) / l];
    const A = [a[0], y0, a[1]];
    const B = [b[0], y0, b[1]];
    const C = [inner[j][0], y0 + h, inner[j][1]];
    const D = [inner[i][0], y0 + h, inner[i][1]];
    for (const p of [A, B, C, A, C, D]) {
      pos.push(...p);
      nor.push(...n);
    }
  }
  kit.raw(pos, nor, part);
  kit.slab([inner], y0 + h - 0.05, y0 + h, 'stone');
}

/** Стаклена фасада: стакло, хоризонтални појаси по кат, вертикални профили, „канцеларии“ ноќе. */
function curtainWall(kit, ring, edges, gm, y0, y1, { module = 1.6, floor = 3.3 } = {}) {
  kit.slab([ring], gm + y0, gm + y1, 'glass');
  for (let y = y0; y < y1 - 0.5; y += floor) band(kit, ring, gm + y, gm + y + 0.14, 0.05, 'metal');
  band(kit, ring, gm + y1 - 0.18, gm + y1, 0.06, 'metal');
  for (const e of edges) {
    if (e.len < 1.2) continue;
    frameOn(kit, e, gm);
    const n = Math.max(1, Math.round(e.len / module));
    for (let k = 0; k <= n; k++) kit.box(-e.len / 2 + (e.len * k) / n, y0, 0.03, 0.09, y1 - y0, 0.07, 'metal');
    // осветлени полиња (ноќе): иста боја како стаклото — дење не се разликуваат
    for (let k = 0; k < n; k++) {
      for (let y = y0 + 0.4; y < y1 - 2.4; y += floor) {
        const u = -e.len / 2 + (e.len * (k + 0.5)) / n;
        if (rnd(u + e.m[0], y + e.m[1]) < 0.3) kit.box(u, y, 0.02, e.len / n - 0.15, floor - 0.6, 0.02, 'glass', 0, 0.65);
      }
    }
  }
}

function staklena(kit, s, _edges, gm, others) {
  const ring = s.rings[0];
  // поделба: висок западен дел (до цилиндерот на северниот агол) и пониско источно крило
  const xs = ring.map((p) => p[0]);
  const SPLIT = Math.min(...xs) + 24;
  const west = clipX(ring, SPLIT, -1);
  const east = clipX(ring, SPLIT, 1);
  const H = 17.6; // 5 ката
  const H2 = 10.6; // источното крило: 3 ката
  for (const [part, h, other] of [[west, H, east], [east, H2, west]]) {
    if (part.length < 3) continue;
    const ed = openEdges(part, [...others, other]);
    // приземје: темно повлечено стакло (дуќани — светат ноќе) и гранитен сокл
    kit.slab([grow(part, -0.9)], gm - 0.3, gm + 4.0, 'window', 0.45);
    kit.slab([part], gm + 3.7, gm + 4.0, 'metal');
    curtainWall(kit, part, ed, gm, 4.0, h);
    // закосен горен раб (западниот дел — низок, источното крило — стаклена „круна“)
    if (h === H) chamfer(kit, part, gm + h, 1.0, 0.7, 'glass');
    else chamfer(kit, part, gm + h, 2.2, 2.0, 'glass');
  }
  // северен агол: стаклен цилиндар со темни прстени и камена облога горе
  const north = openEdges(ring, others).filter((e) => e.len > 2 && e.len < 6 && e.nz < -0.3 && e.nx > 0.3);
  if (north.length) {
    const e = north[0];
    const cx = e.m[0] + e.nx * 0.6;
    const cz = e.m[1] + e.nz * 0.6;
    kit.setFrame(cx, gm, cz);
    kit.cylinder(0, -0.3, 0, 2.3, H + 0.3 - 2.6, 'glass', { seg: 24 });
    for (let y = 1.6; y < H - 2.6; y += 1.6) kit.cylinder(0, y, 0, 2.36, 0.16, 'metal', { seg: 24 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      kit.box(Math.cos(a) * 2.3, 0, Math.sin(a) * 2.3, 0.1, H - 2.6, 0.1, 'metal', -a);
    }
    kit.cylinder(0, H - 2.6, 0, 2.4, 5.2, 'plinth', { seg: 24 });
    kit.cylinder(0, H + 2.6, 0, 2.5, 0.25, 'stone', { seg: 24 });
  }
  // северна фасада на високиот дел: конзолна стаклена кутија до цилиндерот (на 4–5 кат) и
  // гранитни жардињери со зеленило на најдолгиот раб
  const westEdges = openEdges(west, [...others, east]).filter((e) => e.nz < -0.8 && e.len > 4);
  const nearCyl = westEdges.reduce((best, e) => (e.m[0] > (best?.m[0] ?? -Infinity) ? e : best), null);
  if (nearCyl) {
    frameOn(kit, nearCyl, gm);
    // u расте кон запад; кутијата почнува кај цилиндерот и оди ≈ 12 m на запад
    const bw = 12;
    const bu = -nearCyl.len / 2 + bw / 2;
    kit.box(bu, 10.6, 1.2, bw, 4.6, 2.6, 'glass');
    kit.box(bu, 10.45, 1.2, bw + 0.1, 0.18, 2.7, 'metal');
    kit.box(bu, 15.2, 1.2, bw + 0.1, 0.18, 2.7, 'metal');
    for (let k = 0; k <= 8; k++) kit.box(bu - bw / 2 + (bw * k) / 8, 10.6, 2.5, 0.08, 4.6, 0.06, 'metal');
  }
  const longN = westEdges.reduce((best, e) => (e.len > (best?.len ?? 0) ? e : best), null);
  if (longN) {
    frameOn(kit, longN, gm);
    for (let u = -longN.len / 2 + 1.5; u < longN.len / 2 - 1; u += 3.2) {
      kit.box(u, -0.3, 2.6, 2.8, 1.0, 1.4, 'granite');
      kit.sphere(u - 0.6, 1.0, 2.6, 0.7, 'green', { seg: 7, sy: 0.6 });
      kit.sphere(u + 0.6, 1.1, 2.6, 0.6, 'green', { seg: 7, sy: 0.7 });
    }
  }
  // пентхаус на западниот крај: повлечен стаклен кат со надстрешница на столбови
  const f = obb(west);
  kit.setFrame(f.cx, gm + H, f.cz, f.ax, f.az);
  const pu = -f.L / 2 + 6.5;
  kit.box(pu, 0, 0, 9, 3.0, Math.min(10, f.W - 4), 'glass');
  kit.box(pu, 2.9, 0, 9.2, 0.12, Math.min(10, f.W - 4) + 0.2, 'metal');
  const cw = Math.min(13, f.W - 1);
  kit.add(new THREE.BoxGeometry(11.5, 0.22, cw), Kit.atE(pu - 0.5, 4.1, 0, 0, 0, 0.12), 'metal');
  for (const [du, dv] of [[-5.2, 1], [-5.2, -1], [4.6, 1], [4.6, -1]]) kit.box(pu + du, 0, (dv * (cw - 0.6)) / 2, 0.16, 4.3 - du * 0.06, 0.16, 'metal');
  // ограда на покривот
  kit.box(pu, 0, (cw - 0.2) / 2, 11, 1.0, 0.05, 'metal');
  kit.box(pu, 0, -(cw - 0.2) / 2, 11, 1.0, 0.05, 'metal');
}

// OSM id → рецепт
const HOUSES = [
  { osm: 1464455357, build: whiteCorner },
  { osm: 1070708427, build: consulate },
  { osm: 1070708424, build: neoclassic },
  { osm: 1070708421, build: lowYellow },
  { osm: 1463976005, build: cornerOchre },
  { osm: 1070708439, build: eastYellow },
  { osm: 38573441, build: staklena },
  { osm: 38572955, build: grne },
  // кафулето пред Стаклена (OSM „building“, 6.8 m) е всушност тераса со бели чадори
  { osm: 1464455360, build: (kit, s) => terrace(kit, s.rings[0], s.gmean, 'umbrellas') },
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
  // летната тераса: ML-основата (без OSM id) на местото на тендата
  for (const b of near) {
    if (ids[b]) continue;
    const s = buildingShape(pack, b);
    if (!pointInRing(TERRACE, s.rings[0])) continue;
    try {
      terrace(kit, s.rings[0], s.gmean);
      ctx.skip.add(b);
      done.add(b);
    } catch (err) {
      console.warn('[magnolija] тераса:', err);
    }
    kit.setFrame(0, 0, 0);
  }
  for (const [b, h] of found) {
    const s = buildingShape(pack, b);
    const others = near.filter((o) => o !== b).map((o) => buildingShape(pack, o).rings[0]);
    const edges = openEdges(s.rings[0], others);
    try {
      h.build(kit, s, edges, s.gmean, others);
      ctx.skip.add(b);
      done.add(b);
    } catch (err) {
      console.warn(`[magnolija] w${h.osm}:`, err);
    }
    kit.setFrame(0, 0, 0);
  }
  return done;
}
