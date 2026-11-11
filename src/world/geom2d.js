// 2Д геометрија во рамнината x–z (локални метри).

export function ringArea(r) {
  let a = 0;
  for (let i = 0, n = r.length; i < n; i++) {
    const [x1, z1] = r[i];
    const [x2, z2] = r[(i + 1) % n];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

export function ringCentroid(r) {
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0, n = r.length; i < n; i++) {
    const [x1, z1] = r[i];
    const [x2, z2] = r[(i + 1) % n];
    const f = x1 * z2 - x2 * z1;
    a += f;
    cx += (x1 + x2) * f;
    cz += (z1 + z2) * f;
  }
  if (Math.abs(a) < 1e-9) return [r[0][0], r[0][1]];
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

export function distToPolyline([px, pz], pts) {
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

export function convexHull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * Најмал ориентиран правоаголник: центар, оска по подолгата страна (ax, az),
 * должина L (по оската) и ширина W.
 */
export function obb(ring) {
  const hull = convexHull(ring);
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const [x0, z0] = hull[i];
    const [x1, z1] = hull[(i + 1) % hull.length];
    const l = Math.hypot(x1 - x0, z1 - z0);
    if (l < 1e-6) continue;
    const ux = (x1 - x0) / l;
    const uz = (z1 - z0) / l;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, z] of hull) {
      const u = x * ux + z * uz;
      const v = -x * uz + z * ux;
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) best = { area, ux, uz, u0, u1, v0, v1 };
  }
  let { ux, uz, u0, u1, v0, v1 } = best;
  const uc = (u0 + u1) / 2;
  const vc = (v0 + v1) / 2;
  const cx = uc * ux - vc * uz;
  const cz = uc * uz + vc * ux;
  let L = u1 - u0;
  let W = v1 - v0;
  if (W > L) {
    // оската по подолгата страна
    [ux, uz] = [-uz, ux];
    [L, W] = [W, L];
  }
  return { cx, cz, ax: ux, az: uz, L, W };
}

/** Најдолгиот раб на прстенот: [a, b, должина]. */
export function longestEdge(ring) {
  let best = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!best || l > best[2]) best = [a, b, l];
  }
  return best;
}
