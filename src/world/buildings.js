// Згради: истиснување на основите од buildings.bin во една споена геометрија.
// Ѕидовите и покривите се во посебни групи (два материјали).

import * as THREE from 'three';
import earcut from 'earcut';
import { BUILDING } from '../config/classes.js';

const SINK = 1.5; // колку ѕидовите тонат под најниската точка на теренот

/**
 * @param {{meta:object, arrays:object}} pack  buildings.bin
 * @param {object} style
 */
export function buildBuildings(pack, style) {
  const { meta, arrays } = pack;
  const { polyRing, ringPt, coords, height, minHeight, ground, kind, seed } = arrays;
  const q = meta.q;

  // Прво преброј темиња за да алоцираме еднаш.
  let wallVerts = 0;
  let roofVerts = 0;
  for (let b = 0; b < meta.count; b++) {
    for (let r = polyRing[b]; r < polyRing[b + 1]; r++) {
      const n = ringPt[r + 1] - ringPt[r];
      wallVerts += n * 6;
      roofVerts += n;
    }
  }
  const roofIdxEstimate = roofVerts * 3 + meta.count * 6;

  const pos = new Float32Array((wallVerts + roofVerts) * 3);
  const nor = new Float32Array((wallVerts + roofVerts) * 3);
  const shade = new Float32Array(wallVerts + roofVerts); // 0 = дно на ѕид, 1 = врв/покрив
  const bid = new Float32Array(wallVerts + roofVerts); // индекс на зградата
  let roofIndex = new Uint32Array(roofIdxEstimate);
  let roofIdxCount = 0;
  let v = 0;

  const flat = [];
  const holes = [];
  for (let b = 0; b < meta.count; b++) {
    const gmin = ground[b * 2];
    const gmean = ground[b * 2 + 1];
    const minH = minHeight[b] / 10;
    const top = gmean + height[b] / 10;
    const bottom = minH > 0 ? gmean + minH : gmin - SINK;
    const wallH = top - bottom;

    // Ѕидови
    for (let r = polyRing[b]; r < polyRing[b + 1]; r++) {
      const s = ringPt[r];
      const e = ringPt[r + 1];
      const n = e - s;
      for (let i = 0; i < n; i++) {
        const i2 = s + ((i + 1) % n);
        const ax = coords[(s + i) * 2] * q;
        const az = coords[(s + i) * 2 + 1] * q;
        const bx = coords[i2 * 2] * q;
        const bz = coords[i2 * 2 + 1] * q;
        let nx = bz - az;
        let nz = -(bx - ax);
        const l = Math.hypot(nx, nz) || 1;
        nx /= l;
        nz /= l;
        // a0, a1, b1, a0, b1, b0
        const quad = [
          [ax, bottom, az, 0],
          [ax, top, az, 1],
          [bx, top, bz, 1],
          [ax, bottom, az, 0],
          [bx, top, bz, 1],
          [bx, bottom, bz, 0],
        ];
        for (const [x, y, z, t] of quad) {
          pos[v * 3] = x;
          pos[v * 3 + 1] = y;
          pos[v * 3 + 2] = z;
          nor[v * 3] = nx;
          nor[v * 3 + 2] = nz;
          // засенчување по висина во метри (не во %), за високите згради да не се темни до горе
          shade[v] = t ? Math.min(1, wallH / 6) : 0;
          bid[v] = b;
          v++;
        }
      }
    }
  }
  const wallCount = v;

  // Покриви (рамни во фаза 1; формите на покривите доаѓаат со стиловите)
  for (let b = 0; b < meta.count; b++) {
    const top = ground[b * 2 + 1] + height[b] / 10;
    flat.length = 0;
    holes.length = 0;
    const first = v;
    for (let r = polyRing[b]; r < polyRing[b + 1]; r++) {
      if (r > polyRing[b]) holes.push(flat.length / 2);
      for (let i = ringPt[r]; i < ringPt[r + 1]; i++) {
        const x = coords[i * 2] * q;
        const z = coords[i * 2 + 1] * q;
        flat.push(x, z);
        pos[v * 3] = x;
        pos[v * 3 + 1] = top;
        pos[v * 3 + 2] = z;
        nor[v * 3 + 1] = 1;
        shade[v] = 1;
        bid[v] = b;
        v++;
      }
    }
    const tri = earcut(flat, holes.length ? holes : undefined, 2);
    if (roofIdxCount + tri.length > roofIndex.length) {
      const bigger = new Uint32Array((roofIndex.length + tri.length) * 2);
      bigger.set(roofIndex);
      roofIndex = bigger;
    }
    for (let t = 0; t < tri.length; t += 3) {
      // Ориентирај го триаголникот нагоре (CCW гледано одозгора во three.js).
      const a = tri[t];
      let b2 = tri[t + 1];
      let c = tri[t + 2];
      const cross = (flat[b2 * 2] - flat[a * 2]) * (flat[c * 2 + 1] - flat[a * 2 + 1]) - (flat[b2 * 2 + 1] - flat[a * 2 + 1]) * (flat[c * 2] - flat[a * 2]);
      if (cross > 0) [b2, c] = [c, b2];
      roofIndex[roofIdxCount++] = first + a;
      roofIndex[roofIdxCount++] = first + b2;
      roofIndex[roofIdxCount++] = first + c;
    }
  }

  // Индекси: ѕидовите се неиндексирани (0..wallCount), покривите со earcut.
  const index = new Uint32Array(wallCount + roofIdxCount);
  for (let i = 0; i < wallCount; i++) index[i] = i;
  index.set(roofIndex.subarray(0, roofIdxCount), wallCount);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, v * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, v * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(v * 3), 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.addGroup(0, wallCount, 0);
  geo.addGroup(wallCount, roofIdxCount, 1);
  geo.computeBoundingSphere();

  const info = { shade: shade.subarray(0, v), bid: bid.subarray(0, v), wallCount, kind, seed };
  applyBuildingColors(geo, info, style);

  const walls = new THREE.MeshLambertMaterial({ vertexColors: true });
  const roofs = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, [walls, roofs]);
  mesh.name = 'buildings';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.recolor = (s) => applyBuildingColors(geo, info, s);
  return mesh;
}

const tmp = new THREE.Color();
const tmp2 = new THREE.Color();

/** Пресметај бои по теме од стилот (се повикува и при смена на стил). */
export function applyBuildingColors(geo, info, style) {
  const S = style.buildings;
  const col = geo.attributes.color.array;
  const pal = BUILDING.map((k) => [new THREE.Color(S[k][0]), new THREE.Color(S[k][1])]);
  for (let i = 0; i < info.bid.length; i++) {
    const b = info.bid[i];
    const isWall = i < info.wallCount;
    tmp.copy(pal[info.kind[b]][isWall ? 0 : 1]);
    const r = info.seed[b] / 255 - 0.5;
    const f = 1 + r * 2 * S.variation;
    tmp.multiplyScalar(f);
    if (isWall) {
      const s = info.shade[i];
      tmp2.copy(tmp).multiplyScalar(S.ao);
      tmp.lerp(tmp2, 1 - s);
    }
    col[i * 3] = tmp.r;
    col[i * 3 + 1] = tmp.g;
    col[i * 3 + 2] = tmp.b;
  }
  geo.attributes.color.needsUpdate = true;
}
