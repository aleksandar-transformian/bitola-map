// Точки на светлата (прозорци на ѕидовите + улични светилки) за боке-дисковите
// (render/passes/bokeh.js). Прозорците во шејдерот се процедурални, па тука се бира
// сличен распоред: ќелии 3.2 × 3.1 m по секој ѕид, случајно светнати, во рамките на буџет.

import { buildingShape } from './buildings.js';

function hash(a, b, c) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/**
 * @param {object} buildings buildings.bin
 * @param {Float32Array} lampPos позиции на уличните светилки (x, y, z)
 * @param {{budget?: number, ratio?: number, skip?: Set<number>}} opts
 * @returns {{ position: Float32Array, power: Float32Array, count: number }}
 */
export function buildLightPoints(buildings, lampPos, { budget = 50000, ratio = 0.5, skip = null } = {}) {
  const n = buildings.meta.count;
  // прв премин: број на ќелии (за веројатноста според буџетот)
  let cells = 0;
  const shapes = new Array(n);
  for (let b = 0; b < n; b++) {
    if (skip?.has(b)) continue;
    const s = buildingShape(buildings, b);
    const floors = Math.max(1, Math.floor((s.h - 0.9) / 3.1));
    const ring = s.rings[0];
    let per = 0;
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 1) % ring.length];
      per += Math.floor(Math.hypot(bx - ax, bz - az) / 3.2);
    }
    cells += per * floors;
    shapes[b] = { s, floors };
  }
  const lamps = lampPos.length / 3;
  const p = Math.min(1, (budget - lamps) / Math.max(1, cells * ratio)) * ratio;

  const pos = [];
  const pow = [];
  for (let b = 0; b < n; b++) {
    const it = shapes[b];
    if (!it) continue;
    const { s, floors } = it;
    const ring = s.rings[0];
    // насока на прстенот → нормала нанадвор
    let area = 0;
    for (let i = 0; i < ring.length; i++) {
      const [x1, z1] = ring[i];
      const [x2, z2] = ring[(i + 1) % ring.length];
      area += x1 * z2 - x2 * z1;
    }
    const sign = area > 0 ? 1 : -1;
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 1) % ring.length];
      const len = Math.hypot(bx - ax, bz - az);
      const k = Math.floor(len / 3.2);
      if (!k) continue;
      const nx = (-(bz - az) / len) * sign;
      const nz = ((bx - ax) / len) * sign;
      for (let c = 0; c < k; c++) {
        for (let f = 0; f < floors; f++) {
          const h = hash(b, i * 64 + c, f);
          if (h >= p) continue;
          const t = (c + 0.5) / k;
          pos.push(ax + (bx - ax) * t + nx * 0.6, s.gmean + 0.9 + f * 3.1 + 1.55, az + (bz - az) * t + nz * 0.6);
          pow.push(0.55 + 0.45 * (h / p));
        }
      }
    }
  }
  for (let i = 0; i < lamps; i++) {
    pos.push(lampPos[i * 3], lampPos[i * 3 + 1], lampPos[i * 3 + 2]);
    pow.push(1.6);
  }
  return { position: Float32Array.from(pos), power: Float32Array.from(pow), count: pow.length };
}
