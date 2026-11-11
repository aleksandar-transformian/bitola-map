// Згради: истиснување на основите од buildings.bin во една споена геометрија.
// Ѕидовите и покривите се во посебни групи (два материјали).
//
// Варијанти на геометријата (ги бара стилот преку style.geometry.roofs):
//   'flat'   — сите покриви рамни (макета, модерен изглед)
//   'gabled' — куќите и пониските згради добиваат двоводен покрив
//
// Секое теме има атрибут aBase (подлогата на зградата) за анимацијата „растење“.

import * as THREE from 'three';
import earcut from 'earcut';
import { BUILDING, BUILDING_ID, ROOF_ID } from '../config/classes.js';
import { convexHull } from './geom2d.js';

const SINK = 1.5; // колку ѕидовите тонат под најниската точка на теренот
const PITCH = Math.tan((30 * Math.PI) / 180);
const MAX_RISE = 4.5;

const PITCHED_KINDS = new Set([BUILDING_ID.generic, BUILDING_ID.house, BUILDING_ID.civic, BUILDING_ID.religious, BUILDING_ID.historic, BUILDING_ID.small, BUILDING_ID.commercial]);

/**
 * @param {{meta:object, arrays:object}} pack  buildings.bin
 * @param {{roofs?: 'flat'|'gabled', skip?: Set<number>}} opts  skip = индекси на згради што
 *        ги црта друг слој (знаменитости, фасади на Широк Сокак)
 * @returns {THREE.BufferGeometry} со geometry.userData.info за боење
 */
export function buildBuildingGeometry(pack, { roofs = 'flat', skip = null } = {}) {
  const { meta, arrays } = pack;
  const { kind, roof } = arrays;

  const W = new Writer(); // ѕидови
  const R = new Writer(); // покриви
  const pitchedFlag = new Uint8Array(meta.count);

  for (let b = 0; b < meta.count; b++) {
    if (skip?.has(b)) continue;
    const s = buildingShape(pack, b);
    const pitched = roofs === 'gabled' && wantsPitch(s.rings, kind[b], roof[b], s.h, s.minH);
    if (shell(s, pitched, W, R, b)) pitchedFlag[b] = 1;
  }

  const wallCount = W.count;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(W.pos.concat(R.pos), 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(W.nor.concat(R.nor), 3));
  geo.setAttribute('aBase', new THREE.Float32BufferAttribute(W.base.concat(R.base), 1));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(W.count * 3 + R.count * 3), 3));
  geo.addGroup(0, wallCount, 0);
  geo.addGroup(wallCount, R.count, 1);
  geo.computeBoundingSphere();
  geo.userData.info = {
    wallCount,
    shade: Float32Array.from(W.shade.concat(R.shade)),
    bid: Uint32Array.from(W.bid.concat(R.bid)),
    kind,
    seed: arrays.seed,
    roofs,
    pitched: pitchedFlag,
  };
  return geo;
}

const UP = new THREE.Vector3(0, 1, 0);

/** Основа и висини на зградата со индекс b. */
export function buildingShape(pack, b) {
  const { polyRing, ringPt, coords, height, minHeight, ground } = pack.arrays;
  const q = pack.meta.q;
  const gmin = ground[b * 2];
  const gmean = ground[b * 2 + 1];
  const minH = minHeight[b] / 10;
  const h = height[b] / 10;
  const rings = [];
  for (let r = polyRing[b]; r < polyRing[b + 1]; r++) {
    const ring = [];
    for (let i = ringPt[r]; i < ringPt[r + 1]; i++) ring.push([coords[i * 2] * q, coords[i * 2 + 1] * q]);
    rings.push(ring);
  }
  return { rings, h, minH, gmin, gmean, top: gmean + h, bottom: minH > 0 ? gmean + minH : gmin - SINK };
}

/**
 * Ѕидови + покрив (рамен или двоводен) во собирачите W и R. Враќа true ако е двоводен.
 * Го користат и знаменитостите (фасадите на Широк Сокак).
 */
export function shell(s, wantGable, W, R, b = 0) {
  const { rings, top, bottom, gmean, h } = s;
  const gable = wantGable && rings.length === 1 ? gableFrame(rings[0], h) : null;
  if (gable) {
    const ring = splitAtRidge(rings[0], gable);
    const yAt = (p) => top + gable.rise * Math.max(0, 1 - Math.abs(gable.d(p)) / gable.hw);
    W.walls(ring, bottom, yAt, b, gmean);
    for (const side of [1, -1]) {
      const half = clipHalf(ring, gable, side);
      if (half.length < 3) continue;
      const k = (side * gable.rise) / gable.hw;
      const n = new THREE.Vector3(k * gable.nx, 1, k * gable.nz).normalize();
      R.cap([half], yAt, n, b, gmean);
    }
    return true;
  }
  for (const ring of rings) W.walls(ring, bottom, () => top, b, gmean);
  R.cap(rings, () => top, UP, b, gmean);
  return false;
}

export { wantsPitch };

/** Дали зградата добива кос покрив. */
function wantsPitch(rings, k, roofTag, h, minH) {
  // Забелешка: build.mjs запишува „flat“ и кога нема таг roof:shape, па „flat“ не е одлучувачки.
  if (roofTag === ROOF_ID.gabled || roofTag === ROOF_ID.hipped) return rings.length === 1;
  if (!PITCHED_KINDS.has(k)) return false;
  if (rings.length !== 1 || minH > 0) return false;
  if (h > 14) return false;
  const n = rings[0].length;
  if (n > 16) return false;
  const area = Math.abs(ringArea(rings[0]));
  return area >= 25 && area <= 450;
}

function ringArea(r) {
  let a = 0;
  for (let i = 0, n = r.length; i < n; i++) {
    const [x1, z1] = r[i];
    const [x2, z2] = r[(i + 1) % n];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

/**
 * Рамка за двоводен покрив: најмал ориентиран правоаголник околу основата;
 * слемето оди по подолгата оска низ центарот.
 */
function gableFrame(ring, h) {
  const hull = convexHull(ring);
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const [ax, az] = hull[i];
    const [bx, bz] = hull[(i + 1) % hull.length];
    const l = Math.hypot(bx - ax, bz - az);
    if (l < 1e-6) continue;
    const ux = (bx - ax) / l;
    const uz = (bz - az) / l;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, z] of hull) {
      const u = x * ux + z * uz;
      const v = -x * uz + z * ux;
      if (u < u0) u0 = u;
      if (u > u1) u1 = u;
      if (v < v0) v0 = v;
      if (v > v1) v1 = v;
    }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) best = { area, ux, uz, u0, u1, v0, v1 };
  }
  if (!best) return null;
  const lu = best.u1 - best.u0;
  const lv = best.v1 - best.v0;
  // n = нормала на слемето (преку пократката страна)
  let nx, nz, mid, hw;
  if (lu >= lv) {
    nx = -best.uz;
    nz = best.ux;
    mid = (best.v0 + best.v1) / 2;
    hw = lv / 2;
  } else {
    nx = best.ux;
    nz = best.uz;
    mid = (best.u0 + best.u1) / 2;
    hw = lu / 2;
  }
  if (hw < 1.5) return null;
  const rise = Math.min(MAX_RISE, hw * PITCH, Math.max(1.2, h * 0.45));
  return { nx, nz, hw, rise, d: ([x, z]) => x * nx + z * nz - mid };
}

/** Вметни точки каде што рабовите го сечат слемето (за ѕидовите да го следат покривот). */
function splitAtRidge(ring, g) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    out.push(a);
    const da = g.d(a);
    const db = g.d(b);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** Половина од основата од едната страна на слемето (side = ±1). */
function clipHalf(ring, g, side) {
  const out = [];
  const eps = 1e-6;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const da = side * g.d(a);
    const db = side * g.d(b);
    if (da >= -eps) out.push(a);
    if ((da > eps && db < -eps) || (da < -eps && db > eps)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** Собирач на неиндексирани триаголници. */
export class Writer {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.base = [];
    this.shade = [];
    this.bid = [];
  }
  get count() {
    return this.pos.length / 3;
  }
  vert(x, y, z, nx, ny, nz, s, b, base) {
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.shade.push(s);
    this.bid.push(b);
    this.base.push(base);
  }
  /** Ѕидови по прстен; topAt(p) = висина на врвот на ѕидот во точката. */
  walls(ring, bottom, topAt, b, base) {
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = ring[i];
      const c = ring[(i + 1) % n];
      let nx = c[1] - a[1];
      let nz = -(c[0] - a[0]);
      const l = Math.hypot(nx, nz) || 1;
      nx /= l;
      nz /= l;
      const ta = topAt(a);
      const tc = topAt(c);
      // засенчување на дното: 0 на дното, 1 по ~6 m
      const sa = Math.min(1, (ta - bottom) / 6);
      const sc = Math.min(1, (tc - bottom) / 6);
      this.vert(a[0], bottom, a[1], nx, 0, nz, 0, b, base);
      this.vert(a[0], ta, a[1], nx, 0, nz, sa, b, base);
      this.vert(c[0], tc, c[1], nx, 0, nz, sc, b, base);
      this.vert(a[0], bottom, a[1], nx, 0, nz, 0, b, base);
      this.vert(c[0], tc, c[1], nx, 0, nz, sc, b, base);
      this.vert(c[0], bottom, c[1], nx, 0, nz, 0, b, base);
    }
  }
  /** Покрив (рамнина) преку прстени; yAt(p) = висина; normal = нормала на рамнината. */
  cap(rings, yAt, normal, b, base) {
    const flat = [];
    const holes = [];
    const pts = [];
    for (let r = 0; r < rings.length; r++) {
      if (r > 0) holes.push(pts.length);
      for (const p of rings[r]) {
        flat.push(p[0], p[1]);
        pts.push(p);
      }
    }
    const tri = earcut(flat, holes.length ? holes : undefined, 2);
    for (let t = 0; t < tri.length; t += 3) {
      let i0 = tri[t];
      let i1 = tri[t + 1];
      let i2 = tri[t + 2];
      const cross = (pts[i1][0] - pts[i0][0]) * (pts[i2][1] - pts[i0][1]) - (pts[i1][1] - pts[i0][1]) * (pts[i2][0] - pts[i0][0]);
      if (cross > 0) [i1, i2] = [i2, i1]; // front face нагоре
      for (const i of [i0, i1, i2]) {
        const p = pts[i];
        this.vert(p[0], yAt(p), p[1], normal.x, normal.y, normal.z, 1, b, base);
      }
    }
  }
}

const tmp = new THREE.Color();
const tmp2 = new THREE.Color();

/**
 * Пресметај бои по теме од палетата на стилот.
 * palette.buildings: { <класа>: [ѕид, рамен покрив], variation, ao, roofAlt? (бои за косите покриви) }
 */
export function colorBuildings(geo, P) {
  const info = geo.userData.info;
  const col = geo.attributes.color.array;
  const pal = BUILDING.map((k) => [new THREE.Color(P[k][0]), new THREE.Color(P[k][1])]);
  const roofAlt = P.roofAlt ? P.roofAlt.map((c) => new THREE.Color(c)) : null;
  for (let i = 0; i < info.bid.length; i++) {
    const b = info.bid[i];
    const isWall = i < info.wallCount;
    const seed = info.seed[b] / 255;
    if (!isWall && roofAlt && info.pitched[b]) {
      // коси покриви: ќерамиди со разновидност
      tmp.copy(roofAlt[Math.floor(seed * 997) % roofAlt.length]);
    } else {
      tmp.copy(pal[info.kind[b]][isWall ? 0 : 1]);
    }
    tmp.multiplyScalar(1 + (seed - 0.5) * 2 * P.variation);
    if (isWall) {
      tmp2.copy(tmp).multiplyScalar(P.ao);
      tmp.lerp(tmp2, 1 - info.shade[i]);
    }
    col[i * 3] = tmp.r;
    col[i * 3 + 1] = tmp.g;
    col[i * 3 + 2] = tmp.b;
  }
  geo.attributes.color.needsUpdate = true;
}
