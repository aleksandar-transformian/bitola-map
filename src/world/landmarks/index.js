// Знаменитости: една споена геометрија за сите модели + множество згради што ги заменуваат.

import * as THREE from 'three';
import { Kit, PARTS } from './kit.js';
import { MODELS } from './models.js';
import { EXTRA_MODELS } from './extra.js';
import { CIVIC_MODELS } from './civic.js';
import { heraclea } from './heraclea.js';
import { zoo } from './zoo.js';
import { SMOLEVO_MODELS } from './smolevo.js';

const ALL = { ...MODELS, ...EXTRA_MODELS, ...CIVIC_MODELS, ...SMOLEVO_MODELS, heraclea, zoo };

/**
 * @param {object[]} items  landmarks.json
 * @param {object} buildings  buildings.bin (пакет)
 * @param {import('../heightfield.js').Heightfield} hf
 * @param {object} [lines] lines.bin (пругата — за перонот на станицата)
 * @returns {{ geometry: THREE.BufferGeometry, skip: Set<number>, items: object[] }}
 */
export function buildLandmarks(items, buildings, hf, lines) {
  const skip = new Set();
  // OSM зградите што се заменуваат со модел
  const byOsm = new Map();
  const ids = buildings.arrays.osmId;
  for (let b = 0; b < ids.length; b++) if (ids[b]) byOsm.set(ids[b], b);
  for (const it of items) if (it.osmId && byOsm.has(it.osmId)) skip.add(byOsm.get(it.osmId));

  const kit = new Kit();
  const rails = [];
  if (lines) {
    const { railLinePt, railCoords } = lines.arrays;
    const q = lines.meta.q;
    for (let l = 0; l < lines.meta.rail; l++) {
      const pts = [];
      for (let i = railLinePt[l]; i < railLinePt[l + 1]; i++) pts.push([railCoords[i * 2] * q, railCoords[i * 2 + 1] * q]);
      rails.push(pts);
    }
  }
  const hedges = [];
  if (lines?.arrays.hedgeLinePt) {
    const { hedgeLinePt, hedgeCoords } = lines.arrays;
    const q = lines.meta.q;
    for (let l = 0; l < (lines.meta.hedge || 0); l++) {
      const pts = [];
      for (let i = hedgeLinePt[l]; i < hedgeLinePt[l + 1]; i++) pts.push([hedgeCoords[i * 2] * q, hedgeCoords[i * 2 + 1] * q]);
      hedges.push(pts);
    }
  }
  const ctx = { hf, buildings, skip, rails, items };
  for (const it of items) {
    const model = ALL[it.model];
    if (!model) continue;
    kit.setFrame(0, 0, 0);
    try {
      model(kit, it, ctx);
    } catch (err) {
      console.warn(`[landmarks] ${it.id}:`, err);
    }
  }
  hedgeWalls(kit, hedges, hf);
  return { geometry: kit.toGeometry(), skip, items };
}

/**
 * Живи огради (OSM barrier=hedge): поткастрен зелен ѕид (≈ 1.1 m висок, 0.8 m широк) по линијата,
 * сегмент по сегмент, на висината на релјефот; благо заоблени со потемно подножје.
 */
function hedgeWalls(kit, lines, hf) {
  for (const pts of lines) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.2) continue;
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      kit.setFrame(mx, hf.sample(mx, mz), mz, (bx - ax) / len, (bz - az) / len);
      kit.box(0, -0.2, 0, len + 0.4, 1.25, 0.8, 'green');
      kit.box(0, 1.05, 0, len + 0.3, 0.12, 0.6, 'green');
    }
  }
  kit.setFrame(0, 0, 0);
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
