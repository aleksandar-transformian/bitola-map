// Дрвја: еден InstancedMesh (стебло + крошна), големина и нијанса по дрво.
// Обликот го бира стилот (style.geometry.trees): 'round' | 'lollipop' | 'cone'.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// kind: 0 = OSM, 1 = парк, 2 = шума, 3 = овоштарник/грмушки → [мин. висина, опсег] во метри
const SIZE = [
  [6, 4],
  [6, 5],
  [8, 7],
  [3.2, 1.5],
];

function hash(n) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Геометрија на едно дрво со висина 1 (се скалира по инстанца). Бојата на стеблото е во теме. */
function treeGeometry(shape, detail) {
  const trunkC = new THREE.Color(0.42, 0.33, 0.26);
  let trunk;
  let crown;
  if (shape === 'cone') {
    trunk = new THREE.CylinderGeometry(0.035, 0.05, 0.25, 5).translate(0, 0.125, 0);
    crown = new THREE.ConeGeometry(0.3, 0.8, detail ? 7 : 5).translate(0, 0.6, 0);
  } else if (shape === 'lollipop') {
    trunk = new THREE.CylinderGeometry(0.018, 0.018, 0.55, 5).translate(0, 0.275, 0);
    crown = new THREE.IcosahedronGeometry(0.26, 0).translate(0, 0.72, 0);
  } else {
    trunk = new THREE.CylinderGeometry(0.04, 0.06, 0.45, 5).translate(0, 0.225, 0);
    crown = new THREE.IcosahedronGeometry(0.34, 0).translate(0, 0.66, 0);
    crown.scale(1, 0.95, 1);
  }
  const paint = (g, col) => {
    const n = g.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g.index ? g.toNonIndexed() : g;
  };
  const g = mergeGeometries([paint(trunk, trunkC), paint(crown, new THREE.Color(1, 1, 1))]);
  g.computeVertexNormals();
  return g;
}

/**
 * @param {{meta:object, arrays:{coords:Int16Array, kind:Uint8Array}}} pack trees.bin
 * @param {import('./heightfield.js').Heightfield} hf
 * @param {{every?: number}} opts every = секое n-то дрво (телефони)
 */
export function createTrees(pack, hf, { every = 1, detail = true } = {}) {
  const { coords, kind } = pack.arrays;
  const q = pack.meta.q;
  const list = [];
  for (let i = 0; i < pack.meta.count; i += every) list.push(i);
  const mesh = new THREE.InstancedMesh(treeGeometry('round', detail), new THREE.MeshLambertMaterial({ vertexColors: true }), list.length);
  mesh.name = 'trees';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const m = new THREE.Matrix4();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const rq = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const seeds = new Float32Array(list.length);
  list.forEach((i, k) => {
    const x = coords[i * 2] * q;
    const z = coords[i * 2 + 1] * q;
    const r = hash(i + 1);
    const [h0, hr] = SIZE[kind[i]] || SIZE[0];
    const h = h0 + hr * r;
    s.set(h * (0.85 + hash(i + 7) * 0.3), h, h * (0.85 + hash(i + 11) * 0.3));
    p.set(x, hf.sample(x, z) - 0.2, z);
    rq.setFromAxisAngle(up, r * Math.PI * 2);
    m.compose(p, rq, s);
    mesh.setMatrixAt(k, m);
    seeds[k] = hash(i + 3);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
  mesh.userData = { shape: 'round', detail, seeds, kinds: list.map((i) => kind[i]) };
  return mesh;
}

/** Смени облик (ако стилот бара друг) — инстанците остануваат. */
export function setTreeShape(mesh, shape) {
  if (mesh.userData.shape === shape) return false;
  const old = mesh.geometry;
  mesh.geometry = treeGeometry(shape, mesh.userData.detail);
  old.dispose();
  mesh.userData.shape = shape;
  return true;
}

/** Бои на крошните: палета [боја, …] по вид (style.trees.crowns), случајно по дрво. */
export function colorTrees(mesh, trees) {
  const { seeds, kinds } = mesh.userData;
  const c = new THREE.Color();
  const pal = trees.crowns.map((h) => new THREE.Color(h));
  const forest = (trees.forest || trees.crowns).map((h) => new THREE.Color(h));
  for (let k = 0; k < seeds.length; k++) {
    const set = kinds[k] === 2 ? forest : pal;
    c.copy(set[Math.floor(seeds[k] * set.length) % set.length]);
    c.multiplyScalar(0.92 + seeds[k] * 0.16);
    mesh.instanceColor.setXYZ(k, c.r, c.g, c.b);
  }
  mesh.instanceColor.needsUpdate = true;
}
