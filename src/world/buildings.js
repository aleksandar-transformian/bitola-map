// Згради: истиснување на основите од buildings.bin во една споена геометрија.
// Ѕидовите и покривите се во посебни групи (два материјали).
//
// Варијанти на геометријата (ги бара стилот преку style.geometry.roofs):
//   'flat'   — сите покриви рамни (макета, модерен изглед)
//   'gabled' — куќите и пониските згради добиваат двоводен покрив
//   'hip'    — четиристрешни покриви (пирамидални кај квадратна основа) — „Low-poly“
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
 * @param {{roofs?: 'flat'|'gabled'|'hip', skip?: Set<number>}} opts  skip = индекси на згради што
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
    const type = roofs === 'gabled' ? 'gable' : roofs === 'hip' ? 'hip' : false;
    const pitched = type && wantsPitch(s.rings, kind[b], roof[b], s.h, s.minH) ? type : false;
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
 * Ѕидови + покрив во собирачите W и R. pitch: false | true | 'gable' | 'hip'
 * (true = 'gable'). Враќа true ако покривот е кос.
 * Го користат и знаменитостите (фасадите на Широк Сокак).
 */
export function shell(s, pitch, W, R, b = 0) {
  const { rings, top, bottom, gmean, h } = s;
  const type = pitch === true ? 'gable' : pitch;
  const roof = type && rings.length === 1 ? roofPlanes(rings[0], h, type) : null;
  if (roof) {
    const ring = splitAtCreases(rings[0], roof);
    const yAt = (p) => top + roofHeight(roof, p);
    W.walls(ring, bottom, yAt, b, gmean);
    roof.planes.forEach((pl, k) => {
      const part = clipToPlane(ring, roof, k);
      if (part.length < 3) return;
      const n = new THREE.Vector3(roof.slope * pl.nx, 1, roof.slope * pl.nz).normalize();
      R.cap([part], yAt, n, b, gmean);
    });
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
 * Кос покрив како најниската од неколку рамнини над најмалиот ориентиран правоаголник
 * околу основата. 'gable' = 2 рамнини (слеме по подолгата оска), 'hip' = 4 (четиристрешен;
 * кај квадратна основа — пирамида). Висина над врвот на ѕидот: min_k slope·(e_k − n_k·p).
 */
function roofPlanes(ring, h, type) {
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
  const { ux, uz, u0, u1, v0, v1 } = best;
  // оски: u = (ux, uz), v = (−uz, ux); краткиот правец ја дава ширината на стреата
  const lu = u1 - u0;
  const lv = v1 - v0;
  const hw = Math.min(lu, lv) / 2;
  if (hw < 1.5) return null;
  const rise = Math.min(MAX_RISE, hw * PITCH, Math.max(1.2, h * 0.45));
  const side = (nx, nz, e) => ({ nx, nz, e });
  const vPlanes = [side(-uz, ux, v1), side(uz, -ux, -v0)];
  const uPlanes = [side(ux, uz, u1), side(-ux, -uz, -u0)];
  let planes;
  if (type === 'hip') planes = [...vPlanes, ...uPlanes];
  else planes = lu >= lv ? vPlanes : uPlanes; // слемето по подолгата оска
  return { planes, slope: rise / hw };
}

const planeVal = (roof, k, [x, z]) => roof.slope * (roof.planes[k].e - (roof.planes[k].nx * x + roof.planes[k].nz * z));

function roofHeight(roof, p) {
  let m = Infinity;
  for (let k = 0; k < roof.planes.length; k++) m = Math.min(m, planeVal(roof, k, p));
  return Math.max(0, m);
}

/** Вметни точки каде што по работ се менува најниската рамнина (ѕидовите го следат покривот). */
function splitAtCreases(ring, roof) {
  const out = [];
  const P = roof.planes.length;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    out.push(a);
    const ts = [];
    for (let k = 0; k < P; k++) {
      for (let j = k + 1; j < P; j++) {
        const da = planeVal(roof, k, a) - planeVal(roof, j, a);
        const db = planeVal(roof, k, b) - planeVal(roof, j, b);
        if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
          const t = da / (da - db);
          const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          // само ако двете рамнини се навистина најниски во таа точка
          const v = planeVal(roof, k, p);
          if (Math.abs(roofHeight(roof, p) - v) < 1e-6 && t > 1e-4 && t < 1 - 1e-4) ts.push(t);
        }
      }
    }
    ts.sort((x, y) => x - y);
    for (const t of ts) out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

/** Делот од основата каде што рамнината k е најниска (Sutherland–Hodgman по полурамнини). */
function clipToPlane(ring, roof, k) {
  let poly = ring;
  const eps = 1e-6;
  for (let j = 0; j < roof.planes.length && poly.length >= 3; j++) {
    if (j === k) continue;
    const d = (p) => planeVal(roof, j, p) - planeVal(roof, k, p); // ≥ 0 = во регионот на k
    const input = poly;
    poly = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i];
      const b = input[(i + 1) % input.length];
      const da = d(a);
      const db = d(b);
      if (da >= -eps) poly.push(a);
      if ((da > eps && db < -eps) || (da < -eps && db > eps)) {
        const t = da / (da - db);
        poly.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
  }
  return poly;
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
