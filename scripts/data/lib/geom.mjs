// Геометриски помошни функции за обработка (сите во локални метри, [x, z]).

/** Двојна плоштина со знак (позитивна = една ориентација, негативна = друга). */
export function signedArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[(i + 1) % n];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

export function centroid(ring) {
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[(i + 1) % n];
    const f = x1 * z2 - x2 * z1;
    a += f;
    cx += (x1 + x2) * f;
    cz += (z1 + z2) * f;
  }
  if (Math.abs(a) < 1e-9) {
    // Дегенериран прстен — просек од точките.
    const s = ring.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
    return [s[0] / ring.length, s[1] / ring.length];
  }
  return [cx / (3 * a), cz / (3 * a)];
}

export function pointInRing([x, z], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Точка во полигон со дупки: rings[0] = надворешен. */
export function pointInPolygon(p, rings) {
  if (!pointInRing(p, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (pointInRing(p, rings[i])) return false;
  return true;
}

export function ringBounds(ring) {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, minZ, maxX, maxZ };
}

/** Тргни ја затворачката точка и точките поблиску од eps. */
export function cleanRing(ring, eps = 0.05) {
  const out = [];
  for (const p of ring) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > eps) out.push(p);
  }
  while (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= eps) out.pop();
    else break;
  }
  return out;
}

/** Douglas–Peucker за линија (отворена). */
export function simplifyLine(pts, tol) {
  if (pts.length <= 2 || tol <= 0) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop();
    const [ax, az] = pts[i0];
    const [bx, bz] = pts[i1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let maxD = -1;
    let idx = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const [px, pz] = pts[i];
      let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol) {
      keep[idx] = 1;
      stack.push([i0, idx], [idx, i1]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Douglas–Peucker за затворен прстен (без затворачка точка). */
export function simplifyRing(ring, tol) {
  if (ring.length <= 4 || tol <= 0) return ring;
  // Подели го на две половини за да се задржи формата.
  const mid = Math.floor(ring.length / 2);
  const a = simplifyLine(ring.slice(0, mid + 1), tol);
  const b = simplifyLine([...ring.slice(mid), ring[0]], tol);
  const out = [...a.slice(0, -1), ...b.slice(0, -1)];
  return out.length >= 3 ? out : ring;
}

/** Sutherland–Hodgman: исечи прстен со правоаголник. */
export function clipRingToRect(ring, r) {
  const edges = [
    (p) => p[0] >= r.minX,
    (p) => p[0] <= r.maxX,
    (p) => p[1] >= r.minZ,
    (p) => p[1] <= r.maxZ,
  ];
  const isect = [
    (a, b) => lerpAt(a, b, (r.minX - a[0]) / (b[0] - a[0])),
    (a, b) => lerpAt(a, b, (r.maxX - a[0]) / (b[0] - a[0])),
    (a, b) => lerpAt(a, b, (r.minZ - a[1]) / (b[1] - a[1])),
    (a, b) => lerpAt(a, b, (r.maxZ - a[1]) / (b[1] - a[1])),
  ];
  let out = ring;
  for (let e = 0; e < 4 && out.length; e++) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const cin = edges[e](cur);
      const pin = edges[e](prev);
      if (cin) {
        if (!pin) out.push(isect[e](prev, cur));
        out.push(cur);
      } else if (pin) {
        out.push(isect[e](prev, cur));
      }
    }
  }
  return out;
}

function lerpAt(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Liang–Barsky: исечи полилинија со правоаголник; враќа список од делови. */
export function clipLineToRect(pts, r) {
  const parts = [];
  let cur = null;
  for (let i = 0; i + 1 < pts.length; i++) {
    const seg = clipSegment(pts[i], pts[i + 1], r);
    if (!seg) {
      if (cur) parts.push(cur);
      cur = null;
      continue;
    }
    const [a, b, aClipped] = seg;
    if (!cur || aClipped) {
      if (cur) parts.push(cur);
      cur = [a];
    }
    cur.push(b);
    if (seg[3]) {
      parts.push(cur);
      cur = null;
    }
  }
  if (cur) parts.push(cur);
  return parts.filter((p) => p.length >= 2);
}

function clipSegment(a, b, r) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dz, dz];
  const q = [a[0] - r.minX, r.maxX - a[0], a[1] - r.minZ, r.maxZ - a[1]];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return null;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return null;
        if (t < t1) t1 = t;
      }
    }
  }
  return [lerpAt(a, b, t0), lerpAt(a, b, t1), t0 > 0, t1 < 1];
}

/** Мерка за растојание од точка до полилинија. */
export function distToLine([px, pz], pts) {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(px - (ax + t * dx), pz - (az + t * dz)));
  }
  return best;
}

/** Едноставен просторен индекс (мрежа) за bbox-ови. */
export class GridIndex {
  constructor(cell = 200) {
    this.cell = cell;
    this.map = new Map();
  }
  key(i, j) {
    return i * 100003 + j;
  }
  insert(item, b) {
    const c = this.cell;
    for (let i = Math.floor(b.minX / c); i <= Math.floor(b.maxX / c); i++) {
      for (let j = Math.floor(b.minZ / c); j <= Math.floor(b.maxZ / c); j++) {
        const k = this.key(i, j);
        let arr = this.map.get(k);
        if (!arr) this.map.set(k, (arr = []));
        arr.push(item);
      }
    }
  }
  query([x, z]) {
    return this.map.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell))) || [];
  }
}

/** Детерминистички псевдо-случаен број [0,1) од цел број (OSM id). */
export function hash01(n) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
