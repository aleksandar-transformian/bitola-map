#!/usr/bin/env node
// Ги симнува OSM податоците за опфатот од src/config/region.js преку Overpass API
// и ги зачувува (gzip) во data/raw/osm.json.gz. Сировиот фајл се комитува,
// за обработката (npm run data:build) да работи и без пристап до Overpass.

import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { REGION } from '../../src/config/region.js';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const { south: s, west: w, north: n, east: e } = REGION.bbox;
const bb = `${s},${w},${n},${e}`;

// Само тоа што ни треба: релации само од тип multipolygon (за да не се повлечат
// административни граници со илјадници членови).
const MAIN_QUERY = `
[out:json][timeout:300][maxsize:536870912][bbox:${bb}];
(
  way[building];
  way["building:part"];
  relation[building][type=multipolygon];
  relation["building:part"][type=multipolygon];
  way[highway];
  way[railway];
  way[aeroway];
  way[landuse];
  relation[landuse][type=multipolygon];
  way[natural];
  relation[natural][type=multipolygon];
  way[leisure];
  relation[leisure][type=multipolygon];
  way[waterway];
  way[water];
  relation[water][type=multipolygon];
  way[amenity];
  relation[amenity][type=multipolygon];
  way[historic];
  relation[historic][type=multipolygon];
  way[tourism];
  way[man_made];
  way[barrier];
  way[place];
  relation[place][type=multipolygon];
  node[place];
  node[natural];
  node[historic];
  node[tourism];
  node[amenity];
  node[leisure];
  node[man_made];
  node[highway];
  node[railway];
);
out body;
>;
out skel qt;
`;

// Населбите во поширока околина — само за проверка дали опфатот е добар.
const PLACES_QUERY = `
[out:json][timeout:60];
node[place](${s - 0.04},${w - 0.06},${n + 0.04},${e + 0.06});
out body;
`;

async function overpass(query, label) {
  let lastErr;
  for (const url of ENDPOINTS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const t0 = Date.now();
        console.log(`[osm] ${label}: ${url} (обид ${attempt})`);
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'bitola-map data script (https://github.com/aleksandar-transformian/bitola-map)',
          },
          body: 'data=' + encodeURIComponent(query),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const json = await res.json();
        if (json.remark && /error|timed out/i.test(json.remark)) throw new Error(json.remark);
        console.log(`[osm] ${label}: ${json.elements.length} елементи за ${((Date.now() - t0) / 1000).toFixed(1)} s`);
        return json;
      } catch (err) {
        lastErr = err;
        console.warn(`[osm] неуспех: ${err.message}`);
        await new Promise((r) => setTimeout(r, 5000 * attempt));
      }
    }
  }
  throw lastErr;
}

const main = await overpass(MAIN_QUERY, 'главен');
const places = await overpass(PLACES_QUERY, 'населби');

await mkdir('data/raw', { recursive: true });
const payload = {
  fetchedAt: new Date().toISOString(),
  bbox: REGION.bbox,
  osm3s: main.osm3s,
  elements: main.elements,
};
const gz = gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });
await writeFile('data/raw/osm.json.gz', gz);
console.log(`[osm] data/raw/osm.json.gz: ${(gz.length / 1e6).toFixed(2)} MB`);

const placeList = places.elements
  .filter((el) => el.tags?.name)
  .map((el) => ({
    name: el.tags.name,
    nameEn: el.tags['name:en'] || null,
    place: el.tags.place,
    lat: el.lat,
    lon: el.lon,
    inBBox: el.lat >= s && el.lat <= n && el.lon >= w && el.lon <= e,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'mk'));
await writeFile('data/raw/places-wide.json', JSON.stringify(placeList, null, 1));
for (const p of placeList) {
  console.log(`[osm] ${p.inBBox ? '✓' : '·'} ${p.place.padEnd(14)} ${p.name} (${p.lat.toFixed(4)}, ${p.lon.toFixed(4)})`);
}
