// Смолево: манастирот Св. Атанасиј Велики и мотокрос патеката (според фотографии на сопственикот
// и OSM). Манастир: мала бела еднокорабна црква со двоводен покрив од ќерамида, фенерче на
// слемето и апсида; камбанарија од сив камен со редови тула, тулен крст и лачни отвори; бетонска
// лачна порта со железна врата и ниши со икони; ограда со столбови; знамиња; стари дабови.
// Портата и камбанаријата се на западната ограда (таму доаѓа патот, OSM w849461705).
// Мотокрос: OSM w849464969 (highway=raceway) — земјена лента, скокови, стартна рампа.

import * as THREE from 'three';
import { Kit } from './kit.js';
import { obb, pointInRing, ringArea } from '../geom2d.js';
import { fence } from './fence.js';

const TAU = Math.PI * 2;

// ───────────────────────── манастир Св. Атанасиј Велики ─────────────────────────
function smolevoChurch(kit, item, ctx) {
  const { hf } = ctx;
  const ring = item.polys[0][0];
  const f = obb(ring);
  // западот е кон патот: оската u гледа кон исток
  const ax = f.ax >= 0 ? f.ax : -f.ax;
  const az = f.ax >= 0 ? f.az : -f.az;
  const g = hf.sample(f.cx, f.cz);
  const L = f.L;
  const Wd = f.W;
  const H = 4.6;
  kit.setFrame(f.cx, g - 0.6, f.cz, ax, az);
  // ѕидови (сиво-син сокл, бел малтер), стреа, покрив
  kit.box(0, 0, 0, L, 1.8, Wd, 'plinth');
  kit.box(0, 1.8, 0, L - 0.02, H - 1.2, Wd - 0.02, 'plaster');
  kit.box(0, H + 0.6, 0, L + 0.3, 0.25, Wd + 0.5, 'wood');
  kit.gable(-0.6, H + 0.85, 0, L + 1.6, 2.4, Wd + 1.2, 'roof');
  // тесни прозорци на долгите ѕидови, врата и фенер на западната фасада
  for (const s of [-1, 1]) {
    for (const u of [-L * 0.22, L * 0.12, L * 0.36]) kit.box(u, 2.4, s * (Wd / 2 + 0.03), 0.6, 1.6, 0.06, 'window');
  }
  kit.box(-L / 2 - 0.03, 0.6, 0, 0.06, 2.3, 1.3, 'copper');
  kit.box(-L / 2 - 0.03, 3.3, 0, 0.06, 1.6, 1, 'window');
  kit.sphere(-L / 2 - 0.6, 3.1, -1.6, 0.18, 'light', { seg: 6 });
  // апсида на исток
  kit.cylinder(L / 2, 0, 0, Wd * 0.3, H - 0.4, 'plaster', { seg: 12 });
  kit.add(new THREE.ConeGeometry(Wd * 0.33, 1.3, 12, 1, false, 0, Math.PI).translate(0, 0.65, 0), Kit.at(L / 2, H - 0.4, 0), 'roof');
  // фенерче на слемето (западниот дел)
  const ry = H + 0.85 + 2.2;
  kit.box(-L * 0.28, ry - 0.8, 0, 1.5, 1.9, 1.5, 'plaster');
  for (const [du, dv, r] of [[0.76, 0, Math.PI / 2], [-0.76, 0, -Math.PI / 2], [0, 0.76, 0], [0, -0.76, Math.PI]]) kit.box(-L * 0.28 + du, ry - 0.2, dv, 0.45, 0.8, 0.06, 'window', r);
  kit.hip(-L * 0.28, ry + 1.1, 0, 1.9, 0.9, 1.9, 'roof');
  kit.cylinder(-L * 0.28, ry + 2, 0, 0.05, 0.9, 'metal', { seg: 4 });
  kit.box(-L * 0.28, ry + 2.6, 0, 0.06, 0.06, 0.5, 'metal');

  // ── двор: ограда со порта, камбанарија, знамиња, дабови ──
  const yard = item.parts?.yard?.polys?.[0]?.[0];
  if (!yard) return;
  // западната страна на оградата (споени речиси колинеарни рабови); портата на 32 %, а
  // камбанаријата на 88 % од северниот крај
  const n = yard.length;
  const west = westChain(yard);
  const G = west.at(0.32);
  const [gx, gz] = G.p;
  const [tx, tz] = G.t; // по редоследот на прстенот
  let nx = -tz;
  let nz = tx;
  if (!pointInRing([gx + nx * 3, gz + nz * 3], yard)) {
    nx = -nx;
    nz = -nz;
  }
  // ограда: од портата, наоколу, назад до портата (без отворот)
  const line = [[gx + tx * 2.4, gz + tz * 2.4]];
  for (let k = 1; k <= n; k++) line.push(yard[(G.i + k) % n]);
  line.push([gx - tx * 2.4, gz - tz * 2.4]);
  fence(kit, hf, line, { closed: false, h: 1.3, step: 2.6, part: 'wood', post: 0.32 });
  gate(kit, hf, gx, gz, tx, tz, nx, nz);
  // знамиња пред портата (државно и црвено)
  for (const [d, mk] of [[-3.6, true], [3.2, false]]) {
    const px = gx + tx * d - nx * 1.2;
    const pz = gz + tz * d - nz * 1.2;
    kit.setFrame(px, hf.sample(px, pz) - 0.2, pz, tx, tz);
    kit.cylinder(0, 0, 0, 0.05, 8.5, 'metal', { seg: 4 });
    kit.box(0.9, 6.9, 0, 1.8, 1.2, 0.04, 'roof');
    if (mk) kit.box(0.9, 7.3, 0, 0.5, 0.5, 0.06, 'ochre');
  }
  // згради во дворот: конакот (OSM) се црта посебно; малите детекции од сателит (без OSM id)
  // се камбанаријата — нејзиниот пирамидален покрив се гледа на снимката западно од црквата
  const pack = ctx.buildings;
  const q = pack.meta.q;
  const konakId = item.parts?.konak?.osmId;
  let tower = null;
  for (let bi = 0; bi < pack.meta.count; bi++) {
    const r0 = pack.arrays.ringPt[pack.arrays.polyRing[bi]];
    const r1 = pack.arrays.ringPt[pack.arrays.polyRing[bi] + 1];
    const pts = [];
    for (let k = r0; k < r1; k++) pts.push([pack.arrays.coords[k * 2] * q, pack.arrays.coords[k * 2 + 1] * q]);
    const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
    if (Math.abs(c[0] - f.cx) > 200 || Math.abs(c[1] - f.cz) > 200 || !pointInRing(c, yard)) continue;
    const id = pack.arrays.osmId[bi];
    if (id && id === konakId) ctx.skip.add(bi);
    else if (!id && Math.abs(ringArea(pts)) < 60) {
      ctx.skip.add(bi);
      tower = c;
    }
  }
  // камбанарија: детекцијата, или на западната ограда јужно од портата
  let bx;
  let bz;
  if (tower) [bx, bz] = tower;
  else {
    const T = west.at(0.88);
    bx = T.p[0] + nx * 2.8;
    bz = T.p[1] + nz * 2.8;
  }
  belfry(kit, hf.sample(bx, bz) - 0.4, bx, bz, -nx, -nz);
  const K = item.parts?.konak?.polys?.[0]?.[0];
  if (K) konak(kit, hf, K);

  // стари дабови и ореви: дворот е густо обраснат (сателит), без патеката од портата до црквата
  const yf = obb(yard);
  const clear = [ring, K].filter(Boolean);
  const far = (x, z, r) => clear.every((R) => !pointInRing([x, z], R) && R.every(([px, pz]) => Math.hypot(px - x, pz - z) > r));
  let t = 0;
  for (let i = -6; i <= 6; i++) {
    for (let j = -6; j <= 6; j++) {
      const x = yf.cx + i * 7 + ((j * 3) % 4);
      const z = yf.cz + j * 7 + ((i * 5) % 3);
      const h = Math.abs(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1;
      if (h > 0.42 || !pointInRing([x, z], yard) || !far(x, z, 4.5)) continue;
      if (Math.hypot(x - bx, z - bz) < 5 || Math.hypot(x - gx, z - gz) < 6) continue;
      const s = 0.8 + h * 0.8;
      kit.setFrame(x, hf.sample(x, z) - 0.2, z);
      kit.cylinder(0, 0, 0, 0.32 * s, 3.6 * s, 'trunk', { seg: 6 });
      kit.sphere(0, 5.8 * s, 0, 3.3 * s, 'green', { seg: 8, sy: 0.85 });
      kit.sphere(1.5 * s * (t++ % 2 ? 1 : -1), 4.8 * s, 0.7 * s, 2.2 * s, 'green', { seg: 7 });
    }
  }
}

/** Конак: бели ѕидови, четиристрешен покрив и предна стреа (сателит). */
function konak(kit, hf, K) {
  const f = obb(K);
  let gmin = Infinity;
  let gsum = 0;
  for (const [x, z] of K) {
    const y = hf.sample(x, z);
    gmin = Math.min(gmin, y);
    gsum += y;
  }
  const g = gsum / K.length;
  const H = 3.6;
  kit.slab([K], gmin - 0.5, g + H, 'plaster');
  kit.windows(K, [{ y: g + 1.1, h: 1.3 }], { spacing: 3.2, width: 1.0 });
  kit.setFrame(f.cx, g + H, f.cz, f.ax, f.az);
  kit.box(0, 0, 0, f.L + 0.8, 0.2, f.W + 0.8, 'wood');
  kit.hip(0, 0.2, 0, f.L + 1, 2.4, f.W + 1, 'roof');
  // попречна стреа на средината на јужната долга страна (кон црквата): +v е на југ кога ax > 0
  const side = f.ax >= 0 ? 1 : -1;
  kit.gable(-f.L * 0.05, 0.2, (side * f.W) / 2, f.W * 0.9, 1.9, 4.2, 'roof', Math.PI / 2);
}

/**
 * Западната страна на прстенот: рабовите се спојуваат во „страни“ (речиси колинеарни), се зема
 * страната со најмал x (подолгите имаат предност). at(t) = точка на t ∈ [0, 1] од северниот
 * крај: { p, t (насока по прстенот), i (индекс на работ во прстенот) }.
 */
function westChain(ring) {
  const n = ring.length;
  const dir = (i) => {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l, l];
  };
  const straight = (i, j) => {
    const [ax, az] = dir(i);
    const [bx, bz] = dir(j);
    return ax * bx + az * bz > 0.96;
  };
  let start = 0;
  for (let i = 0; i < n; i++) {
    if (!straight((i - 1 + n) % n, i)) {
      start = i;
      break;
    }
  }
  const chains = [];
  let cur = [start];
  for (let k = 1; k < n; k++) {
    const i = (start + k) % n;
    if (straight(cur[cur.length - 1], i)) cur.push(i);
    else {
      chains.push(cur);
      cur = [i];
    }
  }
  chains.push(cur);
  let best = null;
  for (const c of chains) {
    let L = 0;
    let mx = 0;
    for (const i of c) {
      const l = dir(i)[2];
      L += l;
      mx += ((ring[i][0] + ring[(i + 1) % n][0]) / 2) * l;
    }
    const score = mx / L - L * 0.3;
    if (!best || score < best.score) best = { score, c, L };
  }
  const { c, L } = best;
  const first = ring[c[0]];
  const last = ring[(c[c.length - 1] + 1) % n];
  const fromNorth = first[1] <= last[1];
  return {
    at(t) {
      let d = (fromNorth ? t : 1 - t) * L;
      for (const i of c) {
        const [dx, dz, l] = dir(i);
        if (d <= l || i === c[c.length - 1]) {
          const a = ring[i];
          return { p: [a[0] + dx * Math.min(d, l), a[1] + dz * Math.min(d, l)], t: [dx, dz], i };
        }
        d -= l;
      }
    },
  };
}

/** Лачна бетонска порта со железна врата; t = насока по оградата, n = навнатре. */
function gate(kit, hf, x, z, tx, tz, nx, nz) {
  kit.setFrame(x, hf.sample(x, z) - 0.3, z, nx, nz); // u = навнатре, v = по оградата (обратно)
  for (const s of [-1, 1]) {
    kit.box(0, 0, s * 2.2, 1.2, 3.2, 1.1, 'stone');
    kit.box(-0.62, 1.2, s * 2.2, 0.06, 0.9, 0.55, 'window'); // ниша со икона
    kit.box(0, 3.2, s * 2.2, 0.3, 0.9, 0.12, 'accent'); // крст
    kit.box(0, 3.5, s * 2.2, 0.3, 0.12, 0.55, 'accent');
  }
  const arch = new THREE.TorusGeometry(1.9, 0.32, 5, 12, Math.PI).scale(1, 0.75, 1).rotateY(Math.PI / 2);
  kit.add(arch, Kit.at(0, 3.0, 0), 'stone');
  kit.box(0, 0, 0, 0.08, 2.6, 3.2, 'metal');
  kit.box(0, 4.65, 0, 0.3, 0.8, 0.12, 'accent');
  kit.box(0, 4.9, 0, 0.3, 0.12, 0.6, 'accent');
}

/** Камбанарија: сив камен со редови тула, тулен крст, лачни отвори, пирамидален покрив. */
function belfry(kit, y, x, z, fx, fz) {
  kit.setFrame(x, y, z, fx, fz); // u = кон надвор (кон патот)
  const s = 3.1;
  const H = 8.4;
  kit.box(0, 0, 0, s, H, s, 'rubble');
  for (const h of [2.6, 5.2, 6.4, H - 0.15]) kit.box(0, h, 0, s + 0.08, 0.22, s + 0.08, 'brick');
  // тулен крст на предната страна
  kit.box(s / 2 + 0.03, 2.95, 0, 0.06, 2, 0.42, 'brick');
  kit.box(s / 2 + 0.03, 4.0, 0, 0.06, 0.42, 1.4, 'brick');
  // ѕвонара со лачни отвори на сите страни
  kit.box(0, H, 0, s, 2.6, s, 'rubble');
  for (const [du, dv, r] of [[s / 2 + 0.03, 0, Math.PI / 2], [-s / 2 - 0.03, 0, -Math.PI / 2], [0, s / 2 + 0.03, 0], [0, -s / 2 - 0.03, Math.PI]]) {
    kit.box(du, H + 0.4, dv, 1.1, 1.5, 0.06, 'copper', r);
    kit.add(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), Kit.at(du, H + 1.9, dv, r), 'copper');
    kit.add(new THREE.TorusGeometry(0.68, 0.12, 4, 10, Math.PI), Kit.at(du * 1.02, H + 1.9, dv * 1.02, r), 'brick');
  }
  kit.box(0, H + 2.6, 0, s + 0.5, 0.2, s + 0.5, 'wood');
  kit.hip(0, H + 2.8, 0, s + 0.5, 1.6, s + 0.5, 'roof');
  kit.cylinder(0, H + 4.4, 0, 0.05, 1.1, 'metal', { seg: 4 });
  kit.box(0, H + 5.1, 0, 0.06, 0.06, 0.6, 'metal');
}

// ───────────────────────── мотокрос патека ─────────────────────────
function motocross(kit, item, ctx) {
  const { hf } = ctx;
  const ring = item.polys[0][0];
  // погуста линија (на 2.5 m)
  const pts = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / 2.5));
    for (let k = 0; k < n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  const N = pts.length;
  const half = 3.4;
  const side = pts.map((p, i) => {
    const q0 = pts[(i - 1 + N) % N];
    const q1 = pts[(i + 1) % N];
    const tx = q1[0] - q0[0];
    const tz = q1[1] - q0[1];
    const l = Math.hypot(tx, tz) || 1;
    return [tx / l, tz / l];
  });
  const V = (i, s) => {
    const [x, z] = pts[i];
    const [tx, tz] = side[i];
    const px = x - tz * half * s;
    const pz = z + tx * half * s;
    return [px, hf.sample(px, pz) + 0.14, pz];
  };
  const pos = [];
  const nor = [];
  const tri = (a, b, c) => {
    // нормалата нагоре: ако триаголникот гледа надолу, смени го редоследот
    const ux = b[0] - a[0];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vz = c[2] - a[2];
    const up = uz * vx - ux * vz;
    for (const p of up >= 0 ? [a, b, c] : [a, c, b]) pos.push(...p);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  };
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const l0 = V(i, -1);
    const r0 = V(i, 1);
    const l1 = V(j, -1);
    const r1 = V(j, 1);
    tri(l0, r0, l1);
    tri(l1, r0, r1);
  }
  kit.raw(pos, nor, 'plinth');

  // скокови на правите делови, бали сено на кривините, стартна рампа
  let last = -99;
  for (let i = 0; i < N; i++) {
    const [tx, tz] = side[i];
    const [ux, uz] = side[(i + 4) % N];
    const straight = tx * ux + tz * uz > 0.97;
    const [x, z] = pts[i];
    if (straight && i - last > 18) {
      last = i;
      kit.setFrame(x, hf.sample(x, z) - 0.3, z, tx, tz);
      kit.add(new THREE.SphereGeometry(1, 10, 5, 0, TAU, 0, Math.PI / 2), Kit.at(0, 0, 0, 0, 3.6, 1.9, half + 0.4), 'sand');
    } else if (!straight && i % 7 === 0) {
      // надворешната страна на кривината
      const cross = tx * uz - tz * ux;
      const s = cross > 0 ? -1 : 1;
      const px = x - tz * (half + 1) * s;
      const pz = z + tx * (half + 1) * s;
      kit.setFrame(px, hf.sample(px, pz) - 0.1, pz, tx, tz);
      kit.box(0, 0, 0, 1.2, 0.6, 0.6, 'ochre');
      kit.box(0.4, 0.6, 0, 1.0, 0.5, 0.55, 'ochre');
    }
  }
  // старт: метална рампа и табла на најдолгата права (почеток на прстенот во OSM)
  const [sx, sz] = pts[2];
  const [tx, tz] = side[2];
  kit.setFrame(sx, hf.sample(sx, sz) - 0.1, sz, tx, tz);
  for (const s of [-1, 1]) kit.cylinder(0, 0, s * (half + 0.6), 0.12, 3.6, 'metal', { seg: 5 });
  kit.box(0, 3.3, 0, 0.3, 0.9, half * 2 + 1.2, 'accent');
  kit.box(-0.5, 0, 0, 0.6, 0.5, half * 2, 'metal');
  // паркинг за возачите: неколку контејнери до стартот
  for (let k = 0; k < 3; k++) {
    const d = half + 8 + k * 3.2;
    const px = sx - tz * d;
    const pz = sz + tx * d;
    kit.setFrame(px, hf.sample(px, pz) - 0.2, pz, tx, tz);
    kit.box(0, 0, 0, 6, 2.5, 2.4, k === 1 ? 'facade5' : 'ochre');
  }
}

export const SMOLEVO_MODELS = { smolevoChurch, motocross };
