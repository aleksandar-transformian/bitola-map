// Улични светилки: светли точки над улиците што се палат ноќе (адитивно, без сенки).
// Секоја светилка благо трепери во свој ритам (styles/shared/flicker.js).

import * as THREE from 'three';
import { ROAD_ID } from '../config/classes.js';
import { FLICKER_GLSL, flickerUniforms, seedOf } from '../styles/shared/flicker.js';

// растојание меѓу светилки по класа (m); 0 = без светилки
const STEP = {
  [ROAD_ID.motorway]: 45,
  [ROAD_ID.trunk]: 40,
  [ROAD_ID.primary]: 32,
  [ROAD_ID.secondary]: 32,
  [ROAD_ID.tertiary]: 34,
  [ROAD_ID.residential]: 42,
  [ROAD_ID.pedestrian]: 16,
};

function sprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,240,210,0.85)');
  grd.addColorStop(0.5, 'rgba(255,200,130,0.18)');
  grd.addColorStop(1, 'rgba(255,180,100,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * @param {object} roads roads.bin
 * @param {import('./heightfield.js').Heightfield} hf
 * @param {{night:{value:number}, lamp:{value:THREE.Color}, time, flicker, broken}} env
 */
export function createLamps(roads, hf, env, { density = 1 } = {}) {
  const { linePt, coords, cls, flags } = roads.arrays;
  const q = roads.meta.q;
  const P = [];
  for (let l = 0; l < roads.meta.count; l++) {
    const step = STEP[cls[l]] / density;
    if (!step || flags[l] & 2) continue;
    let carry = step * 0.5;
    for (let i = linePt[l]; i + 1 < linePt[l + 1]; i++) {
      const ax = coords[i * 2] * q;
      const az = coords[i * 2 + 1] * q;
      const bx = coords[i * 2 + 2] * q;
      const bz = coords[i * 2 + 3] * q;
      const len = Math.hypot(bx - ax, bz - az);
      let d = carry;
      for (; d < len; d += step) {
        const x = ax + ((bx - ax) * d) / len;
        const z = az + ((bz - az) * d) / len;
        P.push(x, hf.sample(x, z) + 6, z);
      }
      carry = d - len;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  const seeds = new Float32Array(P.length / 3);
  for (let i = 0; i < seeds.length; i++) seeds[i] = seedOf(i);
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const mat = new THREE.PointsMaterial({
    size: 16,
    map: sprite(),
    color: env.lamp.value,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  mat.onBeforeCompile = (shader) => {
    flickerUniforms(shader, env);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${FLICKER_GLSL}\nattribute float aSeed;\nvarying float vFk;`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvFk = fkTwinkle(aSeed, -mvPosition.z) * fkBroken(aSeed);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFk;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vFk;');
  };
  const points = new THREE.Points(geo, mat);
  points.name = 'lamps';
  points.frustumCulled = false;
  points.visible = false;
  points.userData.update = (night) => {
    mat.opacity = Math.min(1, night * 1.1);
    mat.color.copy(env.lamp.value);
    points.visible = night > 0.02;
  };
  return points;
}
