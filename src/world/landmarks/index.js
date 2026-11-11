// Знаменитости: една споена геометрија за сите модели + множество згради што ги заменуваат.

import * as THREE from 'three';
import { Kit, PARTS } from './kit.js';
import { MODELS } from './models.js';

/**
 * @param {object[]} items  landmarks.json
 * @param {object} buildings  buildings.bin (пакет)
 * @param {import('../heightfield.js').Heightfield} hf
 * @returns {{ geometry: THREE.BufferGeometry, skip: Set<number>, items: object[] }}
 */
export function buildLandmarks(items, buildings, hf) {
  const skip = new Set();
  // OSM зградите што се заменуваат со модел
  const byOsm = new Map();
  const ids = buildings.arrays.osmId;
  for (let b = 0; b < ids.length; b++) if (ids[b]) byOsm.set(ids[b], b);
  for (const it of items) if (it.osmId && byOsm.has(it.osmId)) skip.add(byOsm.get(it.osmId));

  const kit = new Kit();
  const ctx = { hf, buildings, skip };
  for (const it of items) {
    const model = MODELS[it.model];
    if (!model) continue;
    kit.setFrame(0, 0, 0);
    try {
      model(kit, it, ctx);
    } catch (err) {
      console.warn(`[landmarks] ${it.id}:`, err);
    }
  }
  return { geometry: kit.toGeometry(), skip, items };
}

const c = new THREE.Color();

/** Бои по дел (part) од палетата style.landmarks. */
export function colorLandmarks(geo, palette) {
  const part = geo.attributes.part.array;
  const col = geo.attributes.color.array;
  const pal = PARTS.map((p) => new THREE.Color(palette[p] || '#ff00ff'));
  for (let i = 0; i < part.length; i++) {
    c.copy(pal[part[i]]);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.attributes.color.needsUpdate = true;
}
