// Мрежа на релјефот (со бочни страни, како макета) и вчитување на Heightfield.

import * as THREE from 'three';
import { Heightfield } from './heightfield.js';

/** Од пакуваниот terrain.bin направи Heightfield. */
export function heightfieldFromPack({ meta, arrays }) {
  const h = new Float32Array(arrays.heights.length);
  for (let i = 0; i < h.length; i++) h[i] = meta.base + arrays.heights[i] * meta.scale;
  return new Heightfield(meta, h);
}

/**
 * @param {Heightfield} hf
 * @param {{stride?: number, skirtDepth?: number}} opts stride>1 = поретка мрежа (телефони)
 */
export function buildTerrainGeometry(hf, { stride = 1, skirtDepth = 60 } = {}) {
  const cols = Math.floor((hf.cols - 1) / stride) + 1;
  const rows = Math.floor((hf.rows - 1) / stride) + 1;
  const sx = hf.step * stride;
  const width = hf.maxX - hf.minX;
  const depth = hf.maxZ - hf.minZ;

  const pos = new Float32Array(cols * rows * 3);
  const uv = new Float32Array(cols * rows * 2);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      const x = hf.minX + i * sx;
      const z = hf.minZ + j * sx;
      pos[k * 3] = x;
      pos[k * 3 + 1] = hf.heights[j * stride * hf.cols + i * stride];
      pos[k * 3 + 2] = z;
      uv[k * 2] = (x - hf.minX) / width;
      uv[k * 2 + 1] = 1 - (z - hf.minZ) / depth;
    }
  }
  const idx = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let n = 0;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      // дијагонала b–c (иста како Heightfield.sample)
      idx[n++] = a;
      idx[n++] = c;
      idx[n++] = b;
      idx[n++] = b;
      idx[n++] = c;
      idx[n++] = d;
    }
  }
  const top = new THREE.BufferGeometry();
  top.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  top.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  top.setIndex(new THREE.BufferAttribute(idx, 1));
  top.computeVertexNormals();

  // Бочни страни (како пресек на макета).
  const bottom = hf.minH - skirtDepth;
  const edge = [];
  for (let i = 0; i < cols; i++) edge.push([i, 0]);
  for (let j = 1; j < rows; j++) edge.push([cols - 1, j]);
  for (let i = cols - 2; i >= 0; i--) edge.push([i, rows - 1]);
  for (let j = rows - 2; j >= 0; j--) edge.push([0, j]);
  const sp = [];
  const sn = [];
  for (let e = 0; e < edge.length; e++) {
    const [i0, j0] = edge[e];
    const [i1, j1] = edge[(e + 1) % edge.length];
    const a = (j0 * cols + i0) * 3;
    const b = (j1 * cols + i1) * 3;
    const ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
    const bx = pos[b], by = pos[b + 1], bz = pos[b + 2];
    // Обиколката оди во насока на стрелките на часовникот гледано одозгора → нормала нанадвор.
    const nx = bz - az;
    const nz = -(bx - ax);
    const l = Math.hypot(nx, nz) || 1;
    sp.push(ax, ay, az, ax, bottom, az, bx, bottom, bz, ax, ay, az, bx, bottom, bz, bx, by, bz);
    for (let k = 0; k < 6; k++) sn.push(nx / l, 0, nz / l);
  }
  const skirt = new THREE.BufferGeometry();
  skirt.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  skirt.setAttribute('normal', new THREE.Float32BufferAttribute(sn, 3));
  return { top, skirt, bottom };
}
