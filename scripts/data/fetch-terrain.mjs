#!/usr/bin/env node
// Ги симнува Terrarium плочките (AWS Terrain Tiles) што го покриваат опфатот.
// Плочките се кешираат во data/cache/terrain/ (не се комитуваат);
// обработката (build.mjs) од нив прави мрежа со висини во public/data/terrain.bin.

import { mkdir, writeFile, access } from 'node:fs/promises';
import { REGION } from '../../src/config/region.js';
import { tileRange } from './lib/tiles.mjs';

const URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const DIR = 'data/cache/terrain';

const z = REGION.terrain.zoom;
const { x0, x1, y0, y1 } = tileRange(REGION.bbox, z);
await mkdir(DIR, { recursive: true });

let fetched = 0;
let cached = 0;
const jobs = [];
for (let x = x0; x <= x1; x++) {
  for (let y = y0; y <= y1; y++) {
    jobs.push({ x, y });
  }
}

async function get({ x, y }) {
  const file = `${DIR}/${z}-${x}-${y}.png`;
  try {
    await access(file);
    cached++;
    return;
  } catch {}
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(URL(z, x, y));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      fetched++;
      return;
    } catch (err) {
      if (attempt >= 4) throw new Error(`${file}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}

// По 8 паралелно.
for (let i = 0; i < jobs.length; i += 8) {
  await Promise.all(jobs.slice(i, i + 8).map(get));
}
console.log(`[terrain] z${z}: ${jobs.length} плочки (${fetched} симнати, ${cached} од кеш)`);
