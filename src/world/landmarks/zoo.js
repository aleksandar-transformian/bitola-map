// Зоолошка градина (OSM w511459556, tourism=zoo): шумовит парк на падината над Буковска.
// Ограда по границата, влезна порта со каса кај Буковска, кафуле и детско игралиште до влезот,
// и огради за животните покрај главната патека (OSM w804397519): езерце со птици, мечки (камења,
// пештера), елени во дрвена ограда, птичарник, големи мачки (висока ограда, песок).
// Распоредот е стилизиран — OSM ги нема оградите одделно.

import * as THREE from 'three';
import { Kit } from './kit.js';
import { pointInRing, distToPolyline, obb } from '../geom2d.js';
import { fence } from './fence.js';
import { walk } from './models.js';

const TAU = Math.PI * 2;

export function zoo(kit, item, ctx) {
  const { hf } = ctx;
  const site = item.polys[0][0];
  fence(kit, hf, site, { h: 2.2, step: 5, part: 'metal' });

  // ── влез: порта, каса, кафуле, игралиште ──
  const gate = item.parts?.entry?.line;
  if (gate && gate.length >= 2) {
    // крајот кај Буковска = поблискиот до оградата (насоката на прстенот не е сигурна)
    const near = (p) => Math.min(...site.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1])));
    const g = near(gate[0]) < near(gate[gate.length - 1]) ? [...gate].reverse() : gate;
    const [ex, ez] = g[g.length - 1];
    const [px, pz] = g[Math.max(0, g.length - 3)];
    const L = Math.hypot(ex - px, ez - pz) || 1;
    const tx = (ex - px) / L; // кон излезот
    const tz = (ez - pz) / L;
    kit.setFrame(ex - tx * 2, hf.sample(ex, ez) - 0.2, ez - tz * 2, tx, tz);
    for (const v of [-3.2, 3.2]) kit.box(0, 0, v, 1.1, 4.2, 1.1, 'stone');
    kit.box(0, 4.2, 0, 1.4, 0.5, 8.2, 'wood');
    kit.box(0.3, 4.7, 0, 0.2, 1.3, 5.2, 'accent'); // табла со името
    kit.box(0, 4.75, -2, 0.25, 0.9, 0.9, 'green');
    // каса и кафуле внатре
    kit.setFrame(ex - tx * 9 + tz * 6, hf.sample(ex - tx * 9, ez - tz * 9) - 0.3, ez - tz * 9 - tx * 6, tx, tz);
    kit.box(0, 0, 0, 3, 2.7, 3, 'wall');
    kit.hip(0, 2.7, 0, 3.8, 1.3, 3.8, 'roof');
    kit.box(1.55, 1, 0, 0.06, 1, 1.6, 'window');
    const cx = ex - tx * 18 - tz * 9;
    const cz = ez - tz * 18 + tx * 9;
    kit.setFrame(cx, hf.sample(cx, cz) - 0.3, cz, tx, tz);
    kit.box(0, 0, 0, 7, 3.2, 11, 'wall2');
    kit.gable(0, 3.2, 0, 7.8, 1.8, 11.8, 'roof', Math.PI / 2);
    for (let i = -1; i <= 1; i++) kit.box(3.53, 0.9, i * 3.3, 0.06, 1.5, 1.8, 'window');
    for (let i = 0; i < 4; i++) {
      // маси со чадори на терасата
      const u = 6;
      const v = -4.5 + i * 3;
      kit.cylinder(u, 0, v, 0.05, 2.2, 'metal', { seg: 4 });
      kit.cone(u, 2.0, v, 1.2, 0.5, i % 2 ? 'accent' : 'roof', { seg: 8 });
      kit.cylinder(u, 0, v, 0.5, 0.75, 'wood', { seg: 8 });
    }
    // игралиште: лулашка и тобоган
    const gx = ex - tx * 30 + tz * 10;
    const gz = ez - tz * 30 - tx * 10;
    kit.setFrame(gx, hf.sample(gx, gz) - 0.1, gz, tx, tz);
    kit.cylinder(0, -0.7, 0, 5, 0.8, 'sand', { seg: 14 });
    for (const v of [-1.6, 1.6]) {
      kit.add(new THREE.BoxGeometry(0.12, 2.6, 0.12).translate(0, 1.3, 0), Kit.atE(-1.2, 0, v, 0.25, 0, 0), 'wood');
      kit.add(new THREE.BoxGeometry(0.12, 2.6, 0.12).translate(0, 1.3, 0), Kit.atE(-1.2, 0, v, -0.25, 0, 0), 'wood');
    }
    kit.box(-1.2, 2.45, 0, 0.12, 0.12, 3.4, 'wood');
    kit.box(2, 0, 1, 1.2, 1.8, 1.2, 'roof');
    kit.add(new THREE.BoxGeometry(3, 0.1, 0.8), Kit.atE(3.3, 1, 1, 0, 0, -0.55), 'facade5');
  }

  // ── огради за животните покрај главната патека ──
  const placed = [];
  let n = 0;
  /** Обиди се да постави ограда со центар (x, z) и оска (tx, tz); врати true ако успее. */
  const tryAt = (x, z, tx, tz, off) => {
    const kind = n % 5;
    const w = [24, 22, 20, 15, 18][kind];
    const d = [16, 16, 15, 15, 14][kind];
    // off = растојание од патеката (нормално, (-tz, tx))
    const cx = x - tz * (off ? Math.sign(off) * (d / 2 + Math.abs(off)) : 0);
    const cz = z + tx * (off ? Math.sign(off) * (d / 2 + Math.abs(off)) : 0);
    const P = (u, v) => [cx + u * tx - v * tz, cz + u * tz + v * tx];
    const corners = [P(-w / 2, -d / 2), P(w / 2, -d / 2), P(w / 2, d / 2), P(-w / 2, d / 2)];
    if (!corners.every((c) => pointInRing(c, site))) return false;
    if ([...corners, [cx, cz]].some(([qx, qz]) => onPath(qx, qz))) return false;
    if (placed.some(([px, pz, r]) => Math.hypot(px - cx, pz - cz) < r + Math.hypot(w, d) / 2 + 3)) return false;
    placed.push([cx, cz, Math.hypot(w, d) / 2]);
    enclosure(kit, hf, kind, cx, cz, tx, tz, w, d, corners, n);
    n++;
    return true;
  };
  // патеките (OSM): оградите не смеат да ги сечат
  const lines = ['path', 'north'].map((k) => item.parts?.[k]?.line).filter(Boolean);
  const onPath = (x, z) => lines.some((l) => distToPolyline([x, z], l) < 3);
  // 1) покрај патеките, наизменично лево/десно
  let side = 1;
  for (const line of lines) {
    walk(line, 30, (x, z, tx, tz) => {
      if (tryAt(x, z, tx, tz, 4 * side) || tryAt(x, z, tx, tz, -4 * side)) side = -side;
    });
  }
  // 2) остатокот од градината: мрежа по долгата оска
  const f = obb(site);
  for (let i = -8; i <= 8; i++) {
    for (let j = -5; j <= 5; j++) {
      const x = f.cx + f.ax * i * 26 - f.az * j * 24;
      const z = f.cz + f.az * i * 26 + f.ax * j * 24;
      if (pointInRing([x, z], site)) tryAt(x, z, f.ax, f.az, 0);
    }
  }
}

/** Една ограда за животни; рамка: u по патеката, v нормално. */
function enclosure(kit, hf, kind, cx, cz, tx, tz, w, d, corners, seed) {
  const P = (u, v) => [cx + u * tx - v * tz, cz + u * tz + v * tx];
  const at = (u, v, dy = 0) => {
    const [x, z] = P(u, v);
    kit.setFrame(x, hf.sample(x, z) + dy, z, tx, tz);
  };
  const flat = (u0, u1, v0, v1, part, lift = 0.06) => {
    // подлога што го следи релјефот (по 4 m)
    const nu = Math.max(1, Math.ceil((u1 - u0) / 4));
    const nv = Math.max(1, Math.ceil((v1 - v0) / 4));
    const pos = [];
    const nor = [];
    const V = (i, j) => {
      const [x, z] = P(u0 + ((u1 - u0) * i) / nu, v0 + ((v1 - v0) * j) / nv);
      return [x, hf.sample(x, z) + lift, z];
    };
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        for (const p of [V(i, j), V(i, j + 1), V(i + 1, j), V(i + 1, j), V(i, j + 1), V(i + 1, j + 1)]) {
          pos.push(...p);
          nor.push(0, 1, 0);
        }
      }
    }
    kit.raw(pos, nor, part);
  };
  const shelter = (u, v, sw, sd, h = 2.4) => {
    at(u, v, -0.3);
    kit.box(0, 0, 0, sw, h, sd, 'wood');
    kit.gable(0, h, 0, sw + 0.6, 1.1, sd + 0.6, 'roof');
    kit.box(0, 0, sd / 2 + 0.03, 1.2, 1.6, 0.06, 'copper');
  };

  if (kind === 0) {
    // езерце со птици (лебеди, патки)
    fence(kit, hf, corners, { h: 1.1, step: 3, part: 'wood', post: 0.12 });
    flat(-w * 0.32, w * 0.22, -d * 0.28, d * 0.3, 'water', 0.12);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + seed;
      const u = -1 + Math.cos(a) * w * 0.18;
      const v = Math.sin(a) * d * 0.15;
      at(u, v, 0);
      kit.sphere(0, 0.3, 0, 0.32, 'accent', { seg: 6, sy: 0.7 });
      kit.cylinder(0.25, 0.35, 0, 0.06, 0.45, 'accent', { seg: 4 });
    }
    shelter(w / 2 - 3, -d / 2 + 2.5, 3.5, 2.6, 1.8);
  } else if (kind === 1) {
    // мечки: камен ѕид, карпи, пештера
    flat(-w / 2 + 0.5, w / 2 - 0.5, -d / 2 + 0.5, d / 2 - 0.5, 'sand');
    for (let i = 0; i < 4; i++) {
      const [a, b] = [corners[i], corners[(i + 1) % 4]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const lo = Math.min(hf.sample(...a), hf.sample(...b)) - 0.3;
      kit.setFrame((a[0] + b[0]) / 2, lo, (a[1] + b[1]) / 2, b[0] - a[0], b[1] - a[1]);
      kit.box(0, 0, 0, len, 1.6 + Math.abs(hf.sample(...a) - hf.sample(...b)), 0.7, 'stone');
    }
    at(w / 2 - 5, d / 2 - 4, -0.4);
    kit.dome(0, 0, 0, 3.2, 'stone', { seg: 10, ratio: 0.7 });
    kit.box(-2.4, 0, 0, 1, 1.6, 1.6, 'copper');
    for (const [u, v, r] of [[-6, -3, 1.4], [-3, 3, 1], [2, -4, 1.2], [-8, 4, 0.9]]) {
      at(u, v, -0.3);
      kit.sphere(0, 0, 0, r, 'stone', { seg: 6, sy: 0.7 });
    }
    for (const [u, v] of [[-1, 0], [4, 2]]) bear(kit, at, u, v);
  } else if (kind === 2) {
    // елени: дрвена ограда, засолниште, сено
    fence(kit, hf, corners, { h: 1.6, step: 3, part: 'wood', post: 0.14 });
    shelter(-w / 2 + 4, -d / 2 + 3, 5, 3.5);
    at(w / 2 - 4, -d / 2 + 3, -0.1);
    kit.cylinder(0, 0, 0, 0.8, 1, 'ochre', { seg: 8 });
    for (const [u, v, r] of [[2, 1, 0.4], [-2, 3, -0.6], [5, -2, 1.9]]) deer(kit, at, u, v, r);
  } else if (kind === 3) {
    // птичарник: висока мрежа на столбови со лак
    const R = Math.min(w, d) / 2 - 1;
    at(0, 0, -0.2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      kit.cylinder(Math.cos(a) * R, 0, Math.sin(a) * R, 0.1, 5, 'metal', { seg: 4 });
    }
    kit.add(new THREE.TorusGeometry(R, 0.08, 4, 24).rotateX(Math.PI / 2), Kit.at(0, 5, 0), 'metal');
    for (let i = 0; i < 6; i++) {
      kit.add(new THREE.TorusGeometry(R, 0.06, 3, 16, Math.PI).rotateY((i / 6) * Math.PI), Kit.at(0, 5, 0, 0, 1, 0.45, 1), 'metal');
    }
    kit.cylinder(0, 0, 0, 0.3, 2.6, 'trunk', { seg: 5 });
    kit.sphere(0, 3.6, 0, 1.8, 'green', { seg: 7 });
  } else {
    // големи мачки: висока метална ограда, песок, карпа и засолниште
    flat(-w / 2 + 0.3, w / 2 - 0.3, -d / 2 + 0.3, d / 2 - 0.3, 'sand');
    fence(kit, hf, corners, { h: 3.4, step: 2.5, part: 'metal', post: 0.12 });
    at(2, 1, -0.4);
    kit.box(0, 0, 0, 5, 1.6, 3.5, 'stone', 0.3);
    shelter(-w / 2 + 3.5, d / 2 - 3, 4, 3, 2.2);
    cat(kit, at, 2, 1, 1.4);
    cat(kit, at, -3, -3, 0, 0.3);
  }
}

// Стилизирани животни (неколку кутии/топки) — видливи одблиску.
function bear(kit, at, u, v) {
  at(u, v, 0);
  kit.sphere(0, 0.75, 0, 0.8, 'trunk', { seg: 7, sy: 0.75 });
  kit.sphere(0.85, 0.95, 0, 0.42, 'trunk', { seg: 6 });
  for (const [a, b] of [[-0.4, -0.35], [-0.4, 0.35], [0.4, -0.35], [0.4, 0.35]]) kit.cylinder(a, 0, b, 0.16, 0.5, 'trunk', { seg: 4 });
}

function deer(kit, at, u, v, rot) {
  at(u, v, 0);
  kit.box(0, 0.75, 0, 1.2, 0.5, 0.4, 'ochre', rot);
  const c = Math.cos(rot);
  const s = -Math.sin(rot);
  kit.box(0.55 * c, 1.1, 0.55 * s, 0.22, 0.6, 0.22, 'ochre', rot);
  kit.box(0.7 * c, 1.55, 0.7 * s, 0.4, 0.22, 0.2, 'ochre', rot);
  for (const [a, b] of [[-0.45, -0.12], [-0.45, 0.12], [0.45, -0.12], [0.45, 0.12]]) {
    kit.box(a * c - b * s, 0, a * s + b * c, 0.08, 0.78, 0.08, 'trunk', rot);
  }
}

function cat(kit, at, u, v, y = 0, rot = 0) {
  at(u, v, y);
  kit.box(0, 0.35, 0, 1.5, 0.5, 0.5, 'ochre', rot);
  kit.sphere(0.85 * Math.cos(rot), 0.75, -0.85 * Math.sin(rot), 0.33, 'ochre', { seg: 6 });
}
