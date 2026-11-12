// Безистенот (покриен пазар) — рачно, според фотографии (улица и од воздух).
// Приземна зграда по неправилната OSM основа: светол малтер, розеви пиластри и венец; во секој
// распон сегментно-лачен излог со розова „веѓа“; тесни лачни прозорчиња на делови. Порти:
// со триаголен забат (југоисток, исток) и со барокен заоблен забат (југ, север), со камен лак.
// Покрив од сив лим: попречни сводови над дуќаните по периметарот, подолжни сводови со
// баџи над внатрешните улици и низа ниски куполи по средната улица.
// Околу него: летни тераси кон реката и два павилјона — влезови во подземниот пешачки премин.

import * as THREE from 'three';
import { Kit } from './kit.js';
import { pointInRing, ringArea, obb } from '../geom2d.js';

const PI = Math.PI;
const H = 5.0; // венец над тротоарот (највисоката точка на теренот)
const BAND = 7; // длабочина на дуќаните по периметарот
const CORE = 6.8; // покрив на внатрешните улици

// порти: светска точка (на фасадата) и вид — според фотографиите
const GATES = [
  { at: [24.4, -112.35], type: 'tri' }, // југ, втор распон од југоисточниот агол
  { at: [-12, -116.6], type: 'baroque' }, // југ, западна третина
  { at: [10, -159.6], type: 'baroque' }, // север
  { at: [32.4, -137], type: 'tri' }, // исток
];
// делови со тесни лачни прозорчиња наместо излози (светски точки)
const SLITS = [[-27, -118.3], [-22, -117.7], [32.2, -150], [32.5, -156]];

/** Спои речиси колинеарни рабови (агол < tol) — фасадите да се рамни. */
function simplify(ring, tol = 0.14) {
  let pts = ring.slice();
  if (pts.length > 1 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop();
  let changed = true;
  while (changed && pts.length > 4) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length];
      const b = pts[i];
      const c = pts[(i + 1) % pts.length];
      const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
      let d = Math.abs(a2 - a1);
      if (d > PI) d = 2 * PI - d;
      if (d < tol || Math.hypot(c[0] - b[0], c[1] - b[1]) < 1.5) {
        pts.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return pts;
}

/** Прстен поместен навнатре за d (пресек на поместените рабови). */
function inset(ring, d) {
  const s = Math.sign(ringArea(ring)) || 1;
  const n = ring.length;
  const lines = ring.map((a, i) => {
    const b = ring[(i + 1) % n];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const tx = (b[0] - a[0]) / l;
    const tz = (b[1] - a[1]) / l;
    // навнатре: (−tz, tx) кај позитивна површина (x исток, z југ)
    const nx = -s * tz;
    const nz = s * tx;
    return { p: [a[0] + nx * d, a[1] + nz * d], t: [tx, tz] };
  });
  return lines.map((L1, i) => {
    const L0 = lines[(i - 1 + n) % n];
    const den = L0.t[0] * L1.t[1] - L0.t[1] * L1.t[0];
    if (Math.abs(den) < 1e-6) return L1.p;
    const dx = L1.p[0] - L0.p[0];
    const dz = L1.p[1] - L0.p[1];
    const k = (dx * L1.t[1] - dz * L1.t[0]) / den;
    return [L0.p[0] + L0.t[0] * k, L0.p[1] + L0.t[1] * k];
  });
}

const disc = (r, d, seg = 16) => new THREE.CylinderGeometry(r, r, d, seg).rotateX(PI / 2);

/** Барокен забат: профил (ширина w, од висина 0 до h) — рамен дел, конкавно-конвексни криви, капа. */
function baroqueShape(w, h) {
  const hw = w / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  s.lineTo(hw, h * 0.3);
  s.bezierCurveTo(hw * 0.55, h * 0.3, hw * 0.7, h * 0.78, hw * 0.3, h * 0.84);
  s.quadraticCurveTo(hw * 0.18, h * 1.0, 0, h);
  s.quadraticCurveTo(-hw * 0.18, h * 1.0, -hw * 0.3, h * 0.84);
  s.bezierCurveTo(-hw * 0.7, h * 0.78, -hw * 0.55, h * 0.3, -hw, h * 0.3);
  s.closePath();
  return s;
}

export function bezisten(kit, item, ctx) {
  // тераси пред јужната фасада: ниски (тента на столбови, стаклена ограда)
  for (const k of ['terrace1', 'terrace2', 'terrace3']) {
    const T = item.parts?.[k];
    if (T) terrace(kit, ctx, T);
  }
  // павилјони на подземниот премин (од двете страни на улицата)
  for (const k of ['pavilion1', 'pavilion2']) {
    const P = item.parts?.[k];
    if (P) pavilion(kit, ctx, P);
  }
  const ring = simplify(item.polys[0][0]);
  const gmin = item.ground.min;
  const top = item.ground.max + H;
  const sgn = Math.sign(ringArea(ring)) || 1;
  // тело и рамен покрив (сив лим) по целата основа
  kit.slab([ring], gmin - 0.5, top, 'plaster');
  kit.slab([ring], top, top + 0.15, 'dome');

  // ── фасади ──
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 3) continue;
    const tx = (b[0] - a[0]) / L;
    const tz = (b[1] - a[1]) / L;
    const ox = sgn * tz; // нанадвор (спротивно од (−tz, tx) кај позитивна површина)
    const oz = -sgn * tx;
    const mx = (a[0] + b[0]) / 2;
    const mz = (a[1] + b[1]) / 2;
    const g = Math.min(ctx.hf.sample(a[0], a[1]), ctx.hf.sample(b[0], b[1]));
    // рамка: u по фасадата, v нанадвор (лице на ѕидот на v = 0)
    kit.setFrame(mx, 0, mz, tx, tz);
    const vsign = (-tz * ox + tx * oz) > 0 ? 1 : -1; // локалното v во светот е (−tz, tx)
    const V = (v) => v * vsign;
    const rotOut = vsign > 0 ? 0 : PI; // ротација околу y: локално z → нанадвор
    const at = (u, y, v = 0) => Kit.at(u, y, V(v), rotOut);
    // венец и подножје
    kit.box(0, top - 0.7, V(0.15), L + 0.3, 0.7, 0.3, 'wall2');
    kit.box(0, top - 0.95, V(0.08), L + 0.1, 0.18, 0.16, 'wall2');
    kit.box(0, gmin - 0.5, V(0.06), L, g - gmin + 0.85, 0.12, 'stone');
    // распони
    const nb = Math.max(1, Math.round(L / 4.6));
    const bw = L / nb;
    const gatesHere = [];
    for (const G of GATES) {
      const dx = G.at[0] - mx;
      const dz = G.at[1] - mz;
      const s = dx * tx + dz * tz;
      const d = Math.abs(dx * ox + dz * oz);
      if (d < 3 && Math.abs(s) < L / 2) gatesHere.push({ ...G, bay: Math.min(nb - 1, Math.max(0, Math.floor((s + L / 2) / bw))) });
    }
    for (let k = 0; k <= nb; k++) {
      const u = -L / 2 + k * bw;
      kit.add(new THREE.BoxGeometry(0.55, top - 0.95 - g, 0.24).translate(0, (top - 0.95 - g) / 2, 0), at(u, g, 0.02), 'wall2');
      if (k % 3 === 1 && k < nb) kit.add(new THREE.CylinderGeometry(0.09, 0.09, top - g, 5).translate(0, (top - g) / 2, 0.3), at(u + 0.45, g), 'eave');
    }
    for (let k = 0; k < nb; k++) {
      const u = -L / 2 + (k + 0.5) * bw;
      const gate = gatesHere.find((G) => G.bay === k);
      if (gate) {
        portal(kit, at, u, g, top, bw, gate.type);
        continue;
      }
      const wx = mx + tx * u;
      const wz = mz + tz * u;
      const slit = SLITS.some(([sx, sz]) => Math.hypot(sx - wx, sz - wz) < bw * 0.6);
      if (slit) {
        for (const du of [-0.9, 0, 0.9]) {
          kit.add(new THREE.BoxGeometry(0.42, 1.1, 0.12).translate(0, 0.55, 0), at(u + du, g + 2.0, 0.02), 'window');
          kit.add(disc(0.21, 0.12, 8), at(u + du, g + 3.1, 0.02), 'window');
        }
        continue;
      }
      // излог: правоаголник + сегментен лак, розова веѓа над него
      const w = Math.min(2.9, bw - 1.2);
      kit.add(new THREE.BoxGeometry(w, 2.5, 0.14).translate(0, 1.25, 0), at(u, g + 0.55, 0.02), 'window');
      kit.add(disc(w / 2, 0.14, 18).scale(1, 0.42, 1), at(u, g + 3.05, 0.02), 'window');
      kit.add(new THREE.TorusGeometry(w / 2 + 0.2, 0.16, 4, 16, PI).scale(1, 0.48, 1), at(u, g + 3.05, 0.05), 'wall2');
      // попречен свод над дуќанот (покривот)
      kit.add(
        new THREE.CylinderGeometry(bw * 0.42, bw * 0.42, BAND - 1, 12, 1, false, PI / 2, PI).rotateX(PI / 2).scale(1, 0.38, 1),
        at(u, top + 0.1, -(BAND - 1) / 2 - 0.6),
        'dome',
      );
    }
  }

  // ── внатрешни улици: подигнат дел, подолжни сводови, куполи ──
  const core = inset(ring, BAND);
  if (Math.abs(ringArea(core)) > 100) {
    kit.slab([core], top - 0.5, top + (CORE - H), 'plaster');
    kit.slab([core], top + (CORE - H), top + (CORE - H) + 0.15, 'dome');
    const y = top + (CORE - H) + 0.1;
    // оска: по јужната фасада (најдолгиот раб)
    let best = null;
    for (let i = 0; i < n; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % n];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!best || l > best.l) best = { l, t: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] };
    }
    const [ax, az] = best.t;
    const cx = core.reduce((s, p) => s + p[0], 0) / core.length;
    const cz = core.reduce((s, p) => s + p[1], 0) / core.length;
    kit.setFrame(cx, y, cz, ax, az);
    const W = (u, v) => [cx + ax * u - az * v, cz + az * u + ax * v];
    const inside = (u, v) => pointInRing(W(u, v), core);
    const R = 3.6;
    for (let uc = -18; uc <= 18; uc += 9) {
      // опсег по v каде што целата ширина на сводот е внатре
      let run = null;
      let cur = null;
      for (let v = -40; v <= 40; v += 0.5) {
        const ok = inside(uc - R * 0.9, v) && inside(uc + R * 0.9, v) && inside(uc, v);
        if (ok) cur = cur ? [cur[0], v] : [v, v];
        else if (cur) {
          if (!run || cur[1] - cur[0] > run[1] - run[0]) run = cur;
          cur = null;
        }
      }
      if (cur && (!run || cur[1] - cur[0] > run[1] - run[0])) run = cur;
      if (!run || run[1] - run[0] < 4) continue;
      const len = run[1] - run[0];
      const vm = (run[0] + run[1]) / 2;
      if (uc === 0) {
        // средна улица: низа ниски куполи
        const nd = Math.max(1, Math.floor(len / 7));
        for (let k = 0; k < nd; k++) {
          const v = run[0] + ((k + 0.5) * len) / nd;
          kit.cylinder(0, 0, v, R * 0.92, 0.5, 'plaster', { seg: 16 });
          kit.dome(0, 0.5, v, R * 0.92, 'dome', { ratio: 0.42, seg: 18 });
        }
        continue;
      }
      // свод по v (сплескан полуцилиндар) и баџи по слемето
      kit.add(new THREE.CylinderGeometry(R, R, len, 16, 1, false, PI / 2, PI).rotateX(PI / 2).scale(1, 0.55, 1), Kit.at(uc, 0, vm), 'dome');
      for (let v = run[0] + 2; v < run[1] - 1; v += 4) {
        for (const s of [-1, 1]) {
          kit.box(uc + s * 1.5, R * 0.42, v, 0.7, 0.5, 0.8, 'dome');
          kit.add(new THREE.BoxGeometry(0.06, 0.32, 0.55), Kit.at(uc + s * 1.86, R * 0.42 + 0.08, v), 'window');
        }
      }
    }
    // неколку оџаци од тули
    for (const [u, v] of [[-13, -6], [6, 4], [13, -10]]) if (inside(u, v)) kit.box(u, 0, v, 0.6, 1.6, 0.6, 'mosaic1');
  }
}

/** Порта во распон: камен лак, темна врата, пиластри; забат — триаголен или барокен. */
function portal(kit, at, u, g, top, bw, type) {
  const w = 3.1;
  // испакнат дел (ризалит) со пиластри
  kit.add(new THREE.BoxGeometry(bw - 0.2, top - g + 0.2, 0.35).translate(0, (top - g + 0.2) / 2, 0), at(u, g - 0.2, 0.05), 'plaster');
  for (const s of [-1, 1]) kit.add(new THREE.BoxGeometry(0.6, top - g, 0.5).translate(0, (top - g) / 2, 0), at(u + s * (bw / 2 - 0.4), g, 0.1), 'wall2');
  kit.add(new THREE.BoxGeometry(w, 3.0, 0.2).translate(0, 1.5, 0), at(u, g, 0.3), 'copper');
  kit.add(disc(w / 2, 0.2, 16), at(u, g + 3.0, 0.3), 'copper');
  kit.add(new THREE.TorusGeometry(w / 2 + 0.22, 0.24, 4, 16, PI), at(u, g + 3.0, 0.36), 'stone');
  for (const s of [-1, 1]) kit.add(new THREE.BoxGeometry(0.45, 3.0, 0.3), at(u + s * (w / 2 + 0.22), g + 1.5, 0.36), 'stone');
  // скали
  kit.add(new THREE.BoxGeometry(w + 1.4, 0.3, 1.4).translate(0, 0.15, 0), at(u, g - 0.15, 1.0), 'stone');
  const pw = bw + 0.6;
  if (type === 'tri') {
    // триаголен забат: двоводен покрив нормално на фасадата, калкан со розова рамка
    const h = 2.4;
    const geo = new THREE.Shape([new THREE.Vector2(-pw / 2, 0), new THREE.Vector2(pw / 2, 0), new THREE.Vector2(0, h)]);
    kit.add(new THREE.ExtrudeGeometry(geo, { depth: 0.3, bevelEnabled: false }), at(u, top - 0.7, 0.05), 'wall2');
    const inner = new THREE.Shape([new THREE.Vector2(-pw / 2 + 0.55, 0.25), new THREE.Vector2(pw / 2 - 0.55, 0.25), new THREE.Vector2(0, h - 0.4)]);
    kit.add(new THREE.ExtrudeGeometry(inner, { depth: 0.1, bevelEnabled: false }), at(u, top - 0.7, 0.32), 'plaster');
    const roof = new THREE.Shape([new THREE.Vector2(-pw / 2 - 0.2, 0), new THREE.Vector2(pw / 2 + 0.2, 0), new THREE.Vector2(0, h + 0.15)]);
    kit.add(new THREE.ExtrudeGeometry(roof, { depth: 6, bevelEnabled: false }), at(u, top - 0.7, -6 + 0.02), 'dome');
  } else {
    const h = 3.3;
    kit.add(new THREE.ExtrudeGeometry(baroqueShape(pw, h), { depth: 0.35, bevelEnabled: false }), at(u, top - 0.8, 0.05), 'wall2');
    kit.add(new THREE.ExtrudeGeometry(baroqueShape(pw - 1.0, h - 0.6), { depth: 0.1, bevelEnabled: false }), at(u, top - 0.6, 0.38), 'plaster');
    kit.add(new THREE.BoxGeometry(pw, 0.8, 4).translate(0, 0.4, -2), at(u, top - 0.8, 0.0), 'plaster');
  }
}

/** Тераса на кафеана/ресторан: тента (рамен лим) на столбови и ниска стаклена ограда. */
function terrace(kit, ctx, T) {
  const ids = ctx.buildings.arrays.osmId;
  for (let b = 0; b < ids.length; b++) if (ids[b] === T.osmId) ctx.skip.add(b);
  const ring = T.polys[0][0];
  const [cx, cz] = T.center;
  const g = ctx.hf.sample(cx, cz);
  kit.slab([ring], g - 0.3, g + 0.15, 'paving');
  kit.slab([ring], g + 2.75, g + 2.95, 'eave');
  const pts = ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.5) continue;
    kit.setFrame((a[0] + b[0]) / 2, g, (a[1] + b[1]) / 2, (b[0] - a[0]) / L, (b[1] - a[1]) / L);
    kit.box(0, 0.15, 0, L, 0.9, 0.06, 'window', 0, 0.15);
    const n = Math.max(1, Math.round(L / 3));
    for (let k = 0; k <= n; k++) kit.box(-L / 2 + (k * L) / n, 0.15, 0, 0.1, 2.6, 0.1, 'metal');
  }
}

/**
 * Павилјон (влез во подземниот премин, сега дуќан): бел кубус со широк рамен препуштен покрив;
 * на секоја страна лососови сегментни лаци од агол до агол, со железна решетка во отворот.
 */
function pavilion(kit, ctx, P) {
  const ids = ctx.buildings.arrays.osmId;
  for (let b = 0; b < ids.length; b++) if (ids[b] === P.osmId) ctx.skip.add(b);
  const f = obb(P.polys[0][0]);
  const g = ctx.hf.sample(f.cx, f.cz);
  kit.setFrame(f.cx, g, f.cz, f.ax, f.az);
  const HT = 3.4; // долен раб на покривот
  kit.box(0, -0.4, 0, f.L - 0.5, HT + 0.4, f.W - 0.5, 'plaster');
  kit.box(0, HT - 0.12, 0, f.L + 1.6, 0.14, f.W + 1.6, 'wall2'); // долна страна на стреата
  kit.box(0, HT, 0, f.L + 1.7, 0.5, f.W + 1.7, 'accent'); // плоча
  kit.box(0, HT + 0.5, 0, f.L + 1.2, 0.18, f.W + 1.2, 'accent');
  // лаци на четирите страни
  for (const [len, depth, rot] of [[f.L, f.W, 0], [f.L, f.W, PI], [f.W, f.L, PI / 2], [f.W, f.L, -PI / 2]]) {
    const n = len > 10 ? 2 : 1;
    const span = (len - 0.5) / n;
    for (let i = 0; i < n; i++) {
      const c = -len / 2 + 0.25 + (i + 0.5) * span;
      const base = 0.3;
      const rise = HT - 0.5 - base;
      const w = span - 0.5;
      const R = (w * w) / 4 / (2 * rise) + rise / 2;
      const half = Math.asin(Math.min(1, w / 2 / R));
      const cy = base + rise - R;
      // решетка во отворот (сегмент од круг)
      const sh = new THREE.Shape();
      sh.moveTo(-w / 2, base);
      sh.absarc(0, cy, R, PI / 2 + half, PI / 2 - half, true);
      sh.lineTo(w / 2, base);
      sh.closePath();
      const grille = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false });
      const ring = new THREE.TorusGeometry(R + 0.2, 0.24, 4, 24, 2 * half).rotateZ(PI / 2 - half);
      // рамка: лице на ѕидот на растојание depth/2 − 0.25 од центарот
      const off = depth / 2 - 0.25;
      const m = new THREE.Matrix4().makeRotationY(rot);
      const place = (geo, z, y = 0) => {
        geo.translate(c, y, off + z);
        geo.applyMatrix4(m);
        return geo;
      };
      kit.add(place(grille, 0.02), Kit.at(0, 0, 0), 'metal');
      kit.add(place(ring, 0.12, cy), Kit.at(0, 0, 0), 'wall2');
      // столбови во аглите / меѓу лаците
      kit.add(place(new THREE.BoxGeometry(0.5, 1.2, 0.5).translate(-span / 2 + 0.05, 0.4, 0), 0.05), Kit.at(0, 0, 0), 'wall2');
      if (i === n - 1) kit.add(place(new THREE.BoxGeometry(0.5, 1.2, 0.5).translate(span / 2 - 0.05, 0.4, 0), 0.05), Kit.at(0, 0, 0), 'wall2');
    }
  }
}
