// Заеднички помошници за фасадите на рачните модели (Св. Димитрија, Св. Богородица, …).
// Рамката на моделот е u (по оската) / v (нормално); „лице“ е еден од четирите ѕида: '+u', '-u', '+v', '-v'.

import * as THREE from 'three';
import { Kit } from './kit.js';

const PI = Math.PI;

/** Матрица за „лице“ на ѕид: x по лицето, z нанадвор. n: '+v' | '-v' | '+u' | '-u'. */
const ROT = { '+v': 0, '-v': PI, '+u': PI / 2, '-u': -PI / 2 };
export function onFace(face, u, y, v) {
  return Kit.at(u, y, v, ROT[face]);
}
/** Точка на лицето: s = растојание по лицето (надесно гледано однадвор). */
export function facePos(face, c, s) {
  // c = координата на ѕидот (v за ±v, u за ±u)
  if (face === '+v') return [s, c];
  if (face === '-v') return [-s, c];
  if (face === '+u') return [c, -s];
  return [c, s];
}

export function disc(r, d, seg = 16) {
  return new THREE.CylinderGeometry(r, r, d, seg).rotateX(PI / 2);
}

/** Лачен прозорец (или отвор): правоаголник w×h од y0 + полукруг; рамка (rim) околу лакот. */
export function archWin(kit, face, c, s, y0, w, h, part = 'window', rim = 'mosaic1') {
  const [u, v] = facePos(face, c, s);
  const r = w / 2;
  kit.add(new THREE.BoxGeometry(w, h, 0.16).translate(0, h / 2, 0), onFace(face, u, y0, v), part);
  kit.add(disc(r, 0.16, 14), onFace(face, u, y0 + h, v), part);
  kit.add(new THREE.TorusGeometry(r + 0.14, 0.15, 4, 12, PI), onFace(face, u, y0 + h, v), rim);
}

/** Правоаголен прозорец со камена рамка. */
export function rectWin(kit, face, c, s, y0, w, h) {
  const [u, v] = facePos(face, c, s);
  kit.add(new THREE.BoxGeometry(w + 0.36, h + 0.36, 0.12).translate(0, h / 2, 0), onFace(face, u, y0, v), 'stone');
  kit.add(new THREE.BoxGeometry(w, h, 0.2).translate(0, h / 2 + 0.18, 0), onFace(face, u, y0 - 0.18, v), 'window');
}

/** Окулус (кружен прозорец) со камена рамка. */
export function oculus(kit, face, c, s, y, r) {
  const [u, v] = facePos(face, c, s);
  kit.add(disc(r + 0.25, 0.14), onFace(face, u, y, v), 'stone');
  kit.add(disc(r, 0.22), onFace(face, u, y, v), 'window');
}

