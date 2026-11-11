// Ленти (ribbons) положени врз релјефот: улици, железница, водотеци.

import * as THREE from 'three';
import { ROAD, ROAD_FLAG, WATERWAY } from '../config/classes.js';

const MAX_SEG = 10; // m — подолги отсечки се делат за да го следат релјефот

/**
 * Изгради лента за секоја полилинија.
 * @param {object} o
 * @param {Uint32Array} o.linePt
 * @param {Int16Array} o.coords
 * @param {number} o.q
 * @param {(l:number)=>number} o.width   ширина во m
 * @param {(l:number)=>number} o.lift    кревање над теренот во m
 * @param {(l:number)=>boolean} [o.skip]
 * @param {(l:number)=>boolean} [o.bridge] мост: висината се интерполира меѓу краевите
 * @param {(l:number)=>number} o.group  индекс за боја (атрибут „cls“)
 * @param {import('./heightfield.js').Heightfield} hf
 */
export function buildRibbons(o, hf) {
  const P = [];
  const N = [];
  const C = [];
  const I = [];
  const n = o.linePt.length - 1;
  for (let l = 0; l < n; l++) {
    if (o.skip?.(l)) continue;
    const s = o.linePt[l];
    const e = o.linePt[l + 1];
    if (e - s < 2) continue;
    // Згусни ја линијата.
    const pts = [];
    for (let i = s; i < e; i++) {
      const x = o.coords[i * 2] * o.q;
      const z = o.coords[i * 2 + 1] * o.q;
      if (pts.length) {
        const [px, pz] = pts[pts.length - 1];
        const len = Math.hypot(x - px, z - pz);
        if (len < 0.05) continue;
        const k = Math.ceil(len / MAX_SEG);
        for (let j = 1; j < k; j++) pts.push([px + ((x - px) * j) / k, pz + ((z - pz) * j) / k]);
      }
      pts.push([x, z]);
    }
    if (pts.length < 2) continue;
    const hw = o.width(l) / 2;
    const lift = o.lift(l);
    const isBridge = o.bridge?.(l);
    const cls = o.group(l);
    // Продолжи ги краевите за половина ширина (покривање на раскрсниците).
    extend(pts, 0, 1, hw * 0.6);
    extend(pts, pts.length - 1, pts.length - 2, hw * 0.6);
    const yStart = hf.sample(pts[0][0], pts[0][1]);
    const yEnd = hf.sample(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    let total = 0;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push((total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])));

    const base = P.length / 3;
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      let tx = next[0] - prev[0];
      let tz = next[1] - prev[1];
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl;
      tz /= tl;
      // Митра: на остри агли ограничи го продолжувањето.
      let m = 1;
      if (i > 0 && i < pts.length - 1) {
        const ax = pts[i][0] - prev[0];
        const az = pts[i][1] - prev[1];
        const al = Math.hypot(ax, az) || 1;
        const dot = (ax / al) * tx + (az / al) * tz;
        m = 1 / Math.max(0.5, dot);
      }
      const nx = -tz * hw * m;
      const nz = tx * hw * m;
      const [x, z] = pts[i];
      for (const side of [1, -1]) {
        const px = x + nx * side;
        const pz = z + nz * side;
        let y;
        if (isBridge) y = yStart + ((yEnd - yStart) * cum[i]) / (total || 1) + 0.6;
        else y = Math.max(hf.sample(px, pz), hf.sample(x, z));
        P.push(px, y + lift, pz);
        N.push(0, 1, 0);
        C.push(cls);
      }
      if (i > 0) {
        const a = base + (i - 1) * 2;
        // a=лево претходно, a+1=десно претходно, a+2=лево, a+3=десно
        I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('cls', new THREE.Float32BufferAttribute(C, 1));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(C.length * 3), 3));
  geo.setIndex(P.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
  fixWinding(geo);
  geo.computeBoundingSphere();
  return geo;
}

function extend(pts, i, j, d) {
  const dx = pts[i][0] - pts[j][0];
  const dz = pts[i][1] - pts[j][1];
  const l = Math.hypot(dx, dz) || 1;
  pts[i] = [pts[i][0] + (dx / l) * d, pts[i][1] + (dz / l) * d];
}

/** Сите триаголници да гледаат нагоре (front face одозгора). */
function fixWinding(geo) {
  const p = geo.attributes.position.array;
  const idx = geo.index.array;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3;
    const b = idx[t + 1] * 3;
    const c = idx[t + 2] * 3;
    const cross = (p[b] - p[a]) * (p[c + 2] - p[a + 2]) - (p[b + 2] - p[a + 2]) * (p[c] - p[a]);
    if (cross > 0) {
      const tmp = idx[t + 1];
      idx[t + 1] = idx[t + 2];
      idx[t + 2] = tmp;
    }
  }
}

/** Обои ги лентите според палета индексирана со „cls“. */
export function colorRibbons(geo, palette) {
  const cls = geo.attributes.cls.array;
  const col = geo.attributes.color.array;
  const c = new THREE.Color();
  const cache = palette.map((p) => new THREE.Color(p));
  for (let i = 0; i < cls.length; i++) {
    c.copy(cache[cls[i]]);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.attributes.color.needsUpdate = true;
}

// Редослед на исцртување: поважните улици малку повисоко (без z-fighting на раскрсници).
const ROAD_LIFT = [0.55, 0.52, 0.5, 0.48, 0.46, 0.42, 0.38, 0.4, 0.34, 0.3];

export function buildRoads(pack, hf, style) {
  const { arrays, meta } = pack;
  const geo = buildRibbons(
    {
      linePt: arrays.linePt,
      coords: arrays.coords,
      q: meta.q,
      width: (l) => arrays.width[l] / 10,
      lift: (l) => ROAD_LIFT[arrays.cls[l]] + Math.max(0, arrays.layer[l]) * 0.05,
      skip: (l) => (arrays.flags[l] & ROAD_FLAG.tunnel) !== 0,
      bridge: (l) => (arrays.flags[l] & ROAD_FLAG.bridge) !== 0,
      group: (l) => arrays.cls[l],
    },
    hf,
  );
  const palette = () => ROAD.map((k) => style.roads[k]);
  colorRibbons(geo, palette());
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'roads';
  mesh.receiveShadow = true;
  mesh.userData.recolor = (s) => colorRibbons(geo, ROAD.map((k) => s.roads[k]));
  return mesh;
}

export function buildRail(pack, hf, style) {
  const { arrays, meta } = pack;
  const geo = buildRibbons(
    {
      linePt: arrays.railLinePt,
      coords: arrays.railCoords,
      q: meta.q,
      width: (l) => (arrays.railCls[l] === 1 ? 2.2 : 3.2),
      lift: () => 0.5,
      group: () => 0,
    },
    hf,
  );
  colorRibbons(geo, [style.rail.color]);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'rail';
  mesh.receiveShadow = true;
  mesh.userData.recolor = (s) => colorRibbons(geo, [s.rail.color]);
  return mesh;
}

export function buildWaterways(pack, hf, style) {
  const { arrays, meta } = pack;
  const geo = buildRibbons(
    {
      linePt: arrays.waterLinePt,
      coords: arrays.waterCoords,
      q: meta.q,
      width: (l) => arrays.waterWidth[l] / 10,
      lift: () => 0.25,
      skip: (l) => (arrays.waterFlags[l] & ROAD_FLAG.tunnel) !== 0 || WATERWAY[arrays.waterCls[l]] === 'ditch',
      group: () => 0,
    },
    hf,
  );
  colorRibbons(geo, [style.water.color]);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'waterways';
  mesh.userData.recolor = (s) => colorRibbons(geo, [s.water.color]);
  return mesh;
}
