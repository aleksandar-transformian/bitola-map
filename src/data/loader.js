// Вчитување на податоците од public/data/ со следење на напредокот.

import { decodePack } from '../lib/pack.js';

const FILES = {
  meta: 'meta.json',
  terrain: 'terrain.bin',
  areas: 'areas.bin',
  roads: 'roads.bin',
  lines: 'lines.bin',
  buildings: 'buildings.bin',
  trees: 'trees.bin',
  pois: 'pois.json',
  landmarks: 'landmarks.json',
};

/**
 * @param {(fraction:number)=>void} onProgress
 * @returns {Promise<Record<string, any>>}
 */
export async function loadData(onProgress = () => {}) {
  const base = `${import.meta.env.BASE_URL}data/`;
  const names = Object.keys(FILES);
  let done = 0;
  const results = await Promise.all(
    names.map(async (name) => {
      const file = FILES[name];
      const res = await fetch(base + file);
      if (!res.ok) throw new Error(`Не можам да го вчитам ${file} (${res.status})`);
      const out = file.endsWith('.json') ? await res.json() : decodePack(await res.arrayBuffer());
      onProgress(++done / names.length);
      return [name, out];
    }),
  );
  return Object.fromEntries(results);
}

/** Помошник: координати на i-тата точка од пакувани Int16 координати. */
export function dequant(coords, q, i) {
  return [coords[i * 2] * q, coords[i * 2 + 1] * q];
}
