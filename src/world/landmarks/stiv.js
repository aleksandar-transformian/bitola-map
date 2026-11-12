// Споменикот на народниот херој Стеван Наумов-Стив (1920–1942), во паркот кај Офицерскиот дом.
// Според фотографии: бронзена фигура на бос млад човек во кошула со засукани ракави и
// панталони, левата рака стисната во тупаница, десната отворена; на двостепен постамент од
// црвен гранит, бронзена плоча на коса камена плоча пред него; поплочен простор околу.
// Фигурата гледа од Офицерскиот дом кон северозапад (позицијата е од OSM, n2316156278).

import * as THREE from 'three';
import { Kit } from './kit.js';

const PI = Math.PI;
const SCALE = 1.5; // природна големина × 1.5 — да се гледа од далеку

/** Цилиндар меѓу две точки (u, y, v) со радиуси r0 → r1. */
function limb(kit, a, b, r0, r1, part) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r1, r0, len, 8).translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  kit.add(g, new THREE.Matrix4().compose(A, q, new THREE.Vector3(1, 1, 1)), part);
}

/** Стоечка фигура (висина ~2.3 m), лицето кон +u. */
function figure(kit) {
  const B = 'bronze';
  kit.box(0, 0, 0, 1.0, 0.1, 0.8, B); // бронзена плоча под нозете
  for (const s of [-1, 1]) {
    const v = s * 0.15;
    kit.box(0.06, 0.1, v, 0.3, 0.09, 0.12, B); // боси стапала
    limb(kit, [0, 0.15, v], [0, 0.6, v * 0.95], 0.085, 0.1, B); // потколеница
    limb(kit, [0, 0.58, v * 0.95], [0, 1.08, v * 0.75], 0.1, 0.13, B); // бут
    kit.add(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8), Kit.at(0, 0.2, v), B); // засукани ногавици
  }
  // колк, појас, торзо (пошироко во рамениците)
  kit.add(new THREE.CylinderGeometry(0.2, 0.19, 0.22, 10).scale(1, 1, 1.3), Kit.at(0, 1.06, 0), B);
  kit.add(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 10).scale(1, 1, 1.3), Kit.at(0, 1.16, 0), 'metal');
  kit.add(new THREE.CylinderGeometry(0.25, 0.19, 0.55, 10).scale(0.75, 1, 1.25).translate(0, 0.275, 0), Kit.at(0, 1.18, 0), B);
  kit.add(new THREE.SphereGeometry(0.25, 10, 6).scale(0.8, 0.45, 1.35), Kit.at(0, 1.72, 0), B); // рамена
  limb(kit, [0, 1.75, 0], [0, 1.92, 0], 0.07, 0.06, B); // врат
  kit.add(new THREE.BoxGeometry(0.16, 0.05, 0.22).translate(0, 0, 0), Kit.at(0.03, 1.8, 0), B); // јака
  kit.sphere(0.01, 2.04, 0, 0.12, B, { seg: 10, sy: 1.15 }); // глава
  for (const s of [-1, 1]) {
    const v = s * 0.33;
    limb(kit, [0, 1.7, v], [0.02, 1.38, v * 1.08], 0.075, 0.07, B); // надлактица
    kit.add(new THREE.CylinderGeometry(0.075, 0.075, 0.08, 8), Kit.at(0.02, 1.36, v * 1.08), B); // засукан ракав
    limb(kit, [0.02, 1.36, v * 1.08], [0.05, 1.02, v * 1.12], 0.06, 0.05, B); // подлактица
  }
  kit.sphere(0.06, 0.96, -0.37, 0.07, B, { seg: 8 }); // лева тупаница
  kit.add(new THREE.BoxGeometry(0.1, 0.18, 0.04).rotateX(-0.5), Kit.at(0.08, 0.92, 0.39), B); // десна отворена дланка
}

export function stivMonument(kit, item, ctx) {
  const [cx, cz] = item.center;
  const g = ctx.hf.sample(cx, cz);
  // насока: од Офицерскиот дом кон споменикот
  const home = ctx.items?.find((it) => it.id === 'oficerski-dom');
  let ax = -0.66;
  let az = -0.75;
  if (home) {
    const dx = cx - home.center[0];
    const dz = cz - home.center[1];
    const l = Math.hypot(dx, dz);
    ax = dx / l;
    az = dz / l;
  }
  kit.setFrame(cx, g, cz, ax, az);
  kit.box(0, -0.3, 0, 10, 0.36, 10, 'paving'); // поплочен простор
  kit.frame.scale(new THREE.Vector3(SCALE, SCALE, SCALE));
  // постамент од црвен гранит: долен дел со корниз, горен дел со корниз
  const R = 'granite';
  kit.box(0, 0, 0, 1.25, 1.0, 1.25, R);
  kit.box(0, 1.0, 0, 1.4, 0.1, 1.4, R);
  kit.box(0, 1.1, 0, 1.05, 0.62, 1.05, R);
  kit.box(0, 1.72, 0, 1.18, 0.08, 1.18, R);
  // коса плоча со бронзена табла пред постаментот (кон +u)
  kit.add(new THREE.BoxGeometry(0.3, 0.55, 0.8).rotateZ(-0.25).translate(0, 0.27, 0), Kit.at(0.72, 0, 0), R);
  kit.add(new THREE.BoxGeometry(0.03, 0.3, 0.55).rotateZ(-0.25), Kit.at(0.84, 0.36, 0), 'bronze');
  // фигурата на врвот
  const keep = kit.frame.clone();
  kit.frame.multiply(new THREE.Matrix4().makeTranslation(0, 1.8, 0));
  figure(kit);
  kit.frame.copy(keep);
}
