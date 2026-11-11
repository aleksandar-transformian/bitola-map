#!/usr/bin/env node
// Ги симнува зградите од Overture Maps (GeoParquet на AWS S3, лиценца ODbL) за опфатот
// и ги зачувува САМО оние што НЕ доаѓаат од OpenStreetMap (OSM зградите ги имаме директно
// од Overpass). Во Битола тоа се главно Microsoft ML Buildings.
//
//   data/raw/overture-buildings.json.gz  (се комитува; build.mjs ги спојува со OSM)
//
// Се читаат само row-групите чија bbox статистика го сече опфатот (HTTP range барања).

import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { asyncBufferFromUrl, parquetMetadataAsync, parquetReadObjects } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import { REGION } from '../../src/config/region.js';

const BUCKET = 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com';
const { south, west, north, east } = REGION.bbox;
const release = process.argv[2] || (await latestRelease());
const prefix = `release/${release}/theme=buildings/type=building/`;
const t0 = Date.now();

async function listS3(params) {
  const keys = [];
  const prefixes = [];
  let token = null;
  do {
    const q = new URLSearchParams({ 'list-type': '2', ...params });
    if (token) q.set('continuation-token', token);
    const xml = await (await fetch(`${BUCKET}/?${q}`)).text();
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(m[1]);
    for (const m of xml.matchAll(/<Prefix>([^<]+)<\/Prefix>/g)) prefixes.push(m[1]);
    token = xml.match(/<NextContinuationToken>([^<]+)</)?.[1] ?? null;
  } while (token);
  return { keys, prefixes };
}

async function latestRelease() {
  const { prefixes } = await listS3({ prefix: 'release/', delimiter: '/' });
  const rel = prefixes
    .map((p) => p.match(/^release\/([^/]+)\/$/)?.[1])
    .filter(Boolean)
    .sort();
  if (!rel.length) throw new Error('Не најдов изданија на Overture');
  return rel[rel.length - 1];
}

/** min/max статистика за колона (на пр. 'bbox.xmin') во row-група. */
function stat(rowGroup, path) {
  const col = rowGroup.columns.find((c) => c.meta_data?.path_in_schema.join('.') === path);
  const s = col?.meta_data?.statistics;
  return s ? [Number(s.min_value ?? s.min), Number(s.max_value ?? s.max)] : null;
}

const { keys } = await listS3({ prefix });
const files = keys.filter((k) => k.endsWith('.parquet') || !k.endsWith('/'));
console.log(`[overture] издание ${release}: ${files.length} фајлови`);

const out = [];
const bySource = {};
let groupsRead = 0;

async function processFile(key) {
  const file = await asyncBufferFromUrl({ url: `${BUCKET}/${key}` });
  const metadata = await parquetMetadataAsync(file);
  let rowStart = 0;
  for (const rg of metadata.row_groups) {
    const n = Number(rg.num_rows);
    const xmin = stat(rg, 'bbox.xmin');
    const xmax = stat(rg, 'bbox.xmax');
    const ymin = stat(rg, 'bbox.ymin');
    const ymax = stat(rg, 'bbox.ymax');
    const hit = xmin && xmax && ymin && ymax ? xmin[0] <= east && xmax[1] >= west && ymin[0] <= north && ymax[1] >= south : false;
    if (hit) {
      groupsRead++;
      const rows = await parquetReadObjects({
        file,
        metadata,
        compressors,
        rowStart,
        rowEnd: rowStart + n,
        columns: ['id', 'bbox', 'geometry', 'height', 'num_floors', 'sources'],
      });
      for (const r of rows) {
        const b = r.bbox;
        if (!b || b.xmin < west || b.xmax > east || b.ymin < south || b.ymax > north) continue;
        const src = r.sources?.[0]?.dataset || 'непознат';
        bySource[src] = (bySource[src] || 0) + 1;
        if (src === 'OpenStreetMap') continue;
        const g = r.geometry;
        const polys = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
        for (const poly of polys) {
          out.push({
            id: r.id,
            src,
            h: r.height ?? null,
            f: r.num_floors ?? null,
            // [lat, lon] со 7 децимали (~1 cm)
            rings: poly.map((ring) => ring.map(([lon, lat]) => [+lat.toFixed(7), +lon.toFixed(7)])),
          });
        }
      }
    }
    rowStart += n;
  }
}

// Паралелно, по 16 фајлови.
let done = 0;
for (let i = 0; i < files.length; i += 16) {
  await Promise.all(files.slice(i, i + 16).map(processFile));
  done = Math.min(files.length, i + 16);
  process.stdout.write(`\r[overture] прегледани ${done}/${files.length} фајлови, прочитани ${groupsRead} row-групи`);
}
process.stdout.write('\n');

out.sort((a, b) => (a.id < b.id ? -1 : 1));
await mkdir('data/raw', { recursive: true });
// Без време на симнување — исто издание дава идентичен фајл (нема празни diff-ови).
const payload = { source: `Overture Maps ${release} (buildings), без извор OpenStreetMap`, release, bySource, buildings: out };
const gz = gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });
await writeFile('data/raw/overture-buildings.json.gz', gz);
console.log(`[overture] по извор во опфатот: ${JSON.stringify(bySource)}`);
console.log(`[overture] зачувани ${out.length} згради (не-OSM) → data/raw/overture-buildings.json.gz ${(gz.length / 1e6).toFixed(2)} MB за ${((Date.now() - t0) / 1000).toFixed(0)} s`);
