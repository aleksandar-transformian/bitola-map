#!/usr/bin/env node
// Ги обработува сировите податоци (data/raw/osm.json.gz + кеш од Terrain Tiles)
// во компактни бинарни фајлови во public/data/:
//   terrain.bin   — мрежа со висини
//   buildings.bin — основи на згради (полигони) + висини и класи
//   roads.bin     — улици/патишта како полилинии
//   lines.bin     — железница и водотеци
//   areas.bin     — површини (landuse, паркови, вода…) за цртање на подлогата
//   trees.bin     — поединечни дрвја
//   pois.json     — именувани точки (знаменитости, населби) за натписи
//   meta.json     — опфат, број на објекти, време на генерирање

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { PNG } from 'pngjs';
import { REGION, makeProjection, bboxMeters } from '../../src/config/region.js';
import { ZONES } from '../../src/config/zones.js';
import { LANDMARKS } from '../../src/config/landmarks.js';
import { ROAD_ID, ROAD_FLAG, RAIL_ID, WATERWAY_ID, AREA_ID, BUILDING_ID, ROOF_ID } from '../../src/config/classes.js';
import { encodePack } from '../../src/lib/pack.js';
import { Heightfield } from '../../src/world/heightfield.js';
import { indexOsm, wayLatLons, isClosed, assembleRings } from './lib/osm.mjs';
import { lonToTileX, latToTileY, tileRange } from './lib/tiles.mjs';
import * as G from './lib/geom.mjs';

const OUT = 'public/data';
const Q = 0.25; // квантизација на координатите: 1 единица = 0.25 m (Int16 → ±8.19 km)
const t0 = Date.now();
const proj = makeProjection();
const rect = bboxMeters();
const stats = {};

await mkdir(OUT, { recursive: true });

// ───────────────────────────── Релјеф ─────────────────────────────

async function buildTerrain() {
  const z = REGION.terrain.zoom;
  const { x0, x1, y0, y1 } = tileRange(REGION.bbox, z);
  const tiles = new Map();
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const file = `data/cache/terrain/${z}-${x}-${y}.png`;
      let buf;
      try {
        buf = await readFile(file);
      } catch {
        throw new Error(`Недостасува ${file} — пушти „npm run data:fetch:terrain“.`);
      }
      tiles.set(`${x}/${y}`, PNG.sync.read(buf));
    }
  }
  // Висина во пиксел (глобални пиксел координати на зум z).
  const px = (gx, gy) => {
    const tx = Math.floor(gx / 256);
    const ty = Math.floor(gy / 256);
    const t = tiles.get(`${Math.min(x1, Math.max(x0, tx))}/${Math.min(y1, Math.max(y0, ty))}`);
    const ix = Math.min(255, Math.max(0, gx - tx * 256));
    const iy = Math.min(255, Math.max(0, gy - ty * 256));
    const o = (iy * 256 + ix) * 4;
    return t.data[o] * 256 + t.data[o + 1] + t.data[o + 2] / 256 - 32768;
  };
  const elevAt = (lat, lon) => {
    const gx = lonToTileX(lon, z) * 256 - 0.5;
    const gy = latToTileY(lat, z) * 256 - 0.5;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const fx = gx - ix;
    const fy = gy - iy;
    const a = px(ix, iy);
    const b = px(ix + 1, iy);
    const c = px(ix, iy + 1);
    const d = px(ix + 1, iy + 1);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };

  const step = REGION.terrain.gridStep;
  const cols = Math.ceil((rect.maxX - rect.minX) / step) + 1;
  const rows = Math.ceil((rect.maxZ - rect.minZ) / step) + 1;
  const heights = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const [lat, lon] = proj.toLatLon(rect.minX + i * step, rect.minZ + j * step);
      heights[j * cols + i] = elevAt(lat, lon);
    }
  }
  // Лесно измазнување (3×3) — Terrarium има шум и „скалила“ на рамнината.
  const smooth = new Float32Array(heights.length);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let s = 0;
      let n = 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= cols || jj >= rows) continue;
          const w = di === 0 && dj === 0 ? 4 : di === 0 || dj === 0 ? 2 : 1;
          s += heights[jj * cols + ii] * w;
          n += w;
        }
      }
      smooth[j * cols + i] = s / n;
    }
  }
  const grid = { cols, rows, minX: rect.minX, minZ: rect.minZ, step };
  const hf = new Heightfield(grid, smooth);
  // Зачувај во дециметри (Uint16) релативно на минимумот.
  const base = Math.floor(hf.minH);
  const q = new Uint16Array(smooth.length);
  for (let k = 0; k < smooth.length; k++) q[k] = Math.round((smooth[k] - base) * 10);
  await writeFile(`${OUT}/terrain.bin`, encodePack({ meta: { ...grid, base, scale: 0.1 }, arrays: { heights: q } }));
  stats.terrain = { cols, rows, step, minH: +hf.minH.toFixed(1), maxH: +hf.maxH.toFixed(1) };
  return hf;
}

// ───────────────────────────── OSM ─────────────────────────────

const raw = JSON.parse(gunzipSync(await readFile('data/raw/osm.json.gz')));
const osm = indexOsm(raw.elements);
const hf = await buildTerrain();

const toXZ = (ll) => proj.toXZ(ll[0], ll[1]);
const wayXZ = (w) => {
  const ll = wayLatLons(w, osm.nodes);
  return ll ? ll.map(toXZ) : null;
};
const ringXZ = (ids) => {
  const out = [];
  for (const id of ids) {
    const n = osm.nodes.get(id);
    if (!n) return null;
    out.push(proj.toXZ(n.lat, n.lon));
  }
  return out;
};

/** Полигони (низа од прстени, [0] = надворешен) за затворена линија или multipolygon. */
function polygonsOf(el) {
  if (el.type === 'way') {
    if (!isClosed(el)) return [];
    const r = wayXZ(el);
    return r ? [[G.cleanRing(r)]] : [];
  }
  if (el.type === 'relation') {
    const outers = assembleRings(el, osm.ways, 'outer').map(ringXZ).filter(Boolean).map((r) => G.cleanRing(r));
    const inners = assembleRings(el, osm.ways, 'inner').map(ringXZ).filter(Boolean).map((r) => G.cleanRing(r));
    return outers.map((o) => {
      const holes = inners.filter((h) => G.pointInRing(h[0], o));
      return [o, ...holes];
    });
  }
  return [];
}

/** Нормализирај ориентација: надворешен прстен со позитивна плоштина, дупки негативна. */
function orient(rings) {
  return rings.map((r, i) => {
    const a = G.signedArea(r);
    return (i === 0 ? a < 0 : a > 0) ? [...r].reverse() : r;
  });
}

const quant = (v) => {
  const q = Math.round(v / Q);
  if (q < -32767 || q > 32767) throw new Error(`Координата надвор од опсег: ${v} m`);
  return q;
};

/** Пакувач за полигони со дупки. */
class PolyWriter {
  constructor() {
    this.polyRing = [0];
    this.ringPt = [0];
    this.coords = [];
  }
  add(rings) {
    for (const r of rings) {
      for (const [x, z] of r) this.coords.push(quant(x), quant(z));
      this.ringPt.push(this.coords.length / 2);
    }
    this.polyRing.push(this.ringPt.length - 1);
  }
  get count() {
    return this.polyRing.length - 1;
  }
  arrays() {
    return {
      polyRing: Uint32Array.from(this.polyRing),
      ringPt: Uint32Array.from(this.ringPt),
      coords: Int16Array.from(this.coords),
    };
  }
}

/** Пакувач за полилинии. */
class LineWriter {
  constructor() {
    this.linePt = [0];
    this.coords = [];
  }
  add(pts) {
    for (const [x, z] of pts) this.coords.push(quant(x), quant(z));
    this.linePt.push(this.coords.length / 2);
  }
  get count() {
    return this.linePt.length - 1;
  }
  arrays() {
    return { linePt: Uint32Array.from(this.linePt), coords: Int16Array.from(this.coords) };
  }
}

const inRect = ([x, z], m = 0) => x >= rect.minX - m && x <= rect.maxX + m && z >= rect.minZ - m && z <= rect.maxZ + m;
const num = (s) => {
  if (s == null) return NaN;
  const m = String(s).replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
};

// ─────────────── Површини (landuse и сл.) ───────────────

function areaClass(t) {
  if (t.building) return null;
  const lu = t.landuse;
  const n = t.natural;
  const le = t.leisure;
  const am = t.amenity;
  if (n === 'water' || lu === 'reservoir' || lu === 'basin' || t.water || t.waterway === 'riverbank') return 'water';
  if (n === 'wetland') return 'wetland';
  if (['sand', 'bare_rock', 'scree', 'shingle'].includes(n) || lu === 'quarry') return 'sand';
  if (t.highway === 'pedestrian' || t.place === 'square' || (t.highway && t.area === 'yes' && t.highway !== 'service')) return 'plaza';
  if (am === 'parking' || t.parking) return 'parking';
  if (['pitch', 'stadium', 'sports_centre', 'track', 'swimming_pool'].includes(le)) return 'sports';
  if (['park', 'garden', 'recreation_ground', 'playground', 'dog_park'].includes(le) || lu === 'recreation_ground') return 'park';
  if (lu === 'grass' || lu === 'village_green' || lu === 'flowerbed') return 'grass';
  if (lu === 'cemetery' || am === 'grave_yard') return 'cemetery';
  if (['school', 'university', 'college', 'kindergarten', 'hospital', 'clinic'].includes(am) || lu === 'education') return 'education';
  if (lu === 'military') return 'military';
  if (['industrial', 'railway', 'construction', 'brownfield', 'landfill', 'depot', 'garages'].includes(lu)) return 'industrial';
  if (lu === 'commercial' || lu === 'retail') return 'commercial';
  if (lu === 'residential') return 'residential';
  if (lu === 'forest' || n === 'wood') return 'forest';
  if (n === 'scrub' || n === 'heath') return 'scrub';
  if (lu === 'orchard' || lu === 'vineyard' || lu === 'plant_nursery') return 'orchard';
  if (['meadow', 'greenfield'].includes(lu) || n === 'grassland') return 'meadow';
  if (lu === 'farmland' || lu === 'farmyard' || lu === 'allotments') return 'farmland';
  return null;
}

const areas = [];
for (const el of [...osm.ways.values(), ...osm.relations.values()]) {
  if (!el.tags) continue;
  const cls = areaClass(el.tags);
  if (!cls) continue;
  for (const poly of polygonsOf(el)) {
    let rings = poly
      .map((r) => G.clipRingToRect(r, { minX: rect.minX - 20, maxX: rect.maxX + 20, minZ: rect.minZ - 20, maxZ: rect.maxZ + 20 }))
      .map((r) => G.simplifyRing(G.cleanRing(r), 0.6))
      .filter((r) => r.length >= 3);
    if (!rings.length || rings[0] !== rings[0]) continue;
    // Ако надворешниот е исечен до ништо, прескокни.
    if (Math.abs(G.signedArea(rings[0])) < 4) continue;
    rings = orient(rings);
    areas.push({ cls, id: AREA_ID[cls], rings, area: Math.abs(G.signedArea(rings[0])) });
  }
}
// Цртај по класа, а во иста класа поголемите прво.
areas.sort((a, b) => a.id - b.id || b.area - a.area);
{
  const w = new PolyWriter();
  const cls = [];
  for (const a of areas) {
    w.add(a.rings);
    cls.push(a.id);
  }
  await writeFile(`${OUT}/areas.bin`, encodePack({ meta: { q: Q, count: w.count }, arrays: { ...w.arrays(), cls: Uint8Array.from(cls) } }));
  stats.areas = w.count;
}

// Индекс за индустриски површини (за проценка на висини).
const industrialIdx = new G.GridIndex(250);
for (const a of areas) if (a.cls === 'industrial') industrialIdx.insert(a, G.ringBounds(a.rings[0]));

// ─────────────── Улици ───────────────

function roadClass(t) {
  const h = t.highway;
  if (!h || t.area === 'yes') return null;
  if (['proposed', 'construction', 'abandoned', 'platform', 'raceway', 'bus_stop', 'elevator', 'corridor'].includes(h)) return null;
  if (h.endsWith('_link')) return roadClass({ ...t, highway: h.replace('_link', '') });
  if (h === 'motorway') return 'motorway';
  if (h === 'trunk') return 'trunk';
  if (h === 'primary') return 'primary';
  if (h === 'secondary') return 'secondary';
  if (h === 'tertiary') return 'tertiary';
  if (['residential', 'unclassified', 'living_street', 'road'].includes(h)) return 'residential';
  if (h === 'service') return 'service';
  if (h === 'pedestrian') return 'pedestrian';
  if (['footway', 'path', 'steps', 'cycleway', 'bridleway'].includes(h)) return 'footway';
  if (h === 'track') return 'track';
  return null;
}
const ROAD_WIDTH = { motorway: 16, trunk: 13, primary: 11, secondary: 9.5, tertiary: 8, residential: 6, service: 4, pedestrian: 7, footway: 2.2, track: 3 };

const names = [];
const nameIdx = new Map();
const nameId = (n) => {
  if (!n) return -1;
  if (!nameIdx.has(n)) {
    nameIdx.set(n, names.length);
    names.push(n);
  }
  return nameIdx.get(n);
};

const shirokLines = [];
{
  const w = new LineWriter();
  const cls = [];
  const width = [];
  const flags = [];
  const layer = [];
  const name = [];
  for (const way of osm.ways.values()) {
    const t = way.tags;
    if (!t) continue;
    const c = roadClass(t);
    if (!c) continue;
    const pts = wayXZ(way);
    if (!pts) continue;
    if (t.name === ZONES.shirokSokak.streetName && (t.highway === 'pedestrian' || t.highway === 'footway')) shirokLines.push(pts);
    let wd = num(t.width);
    if (!(wd > 1 && wd < 40)) {
      const lanes = num(t.lanes);
      wd = lanes > 0 && ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential'].includes(c) ? Math.max(ROAD_WIDTH[c] * 0.7, lanes * 3.4 + 1.5) : ROAD_WIDTH[c];
    }
    let f = 0;
    if (t.bridge && t.bridge !== 'no') f |= ROAD_FLAG.bridge;
    if (t.tunnel && t.tunnel !== 'no') f |= ROAD_FLAG.tunnel;
    if (t.oneway === 'yes') f |= ROAD_FLAG.oneway;
    for (const part of G.clipLineToRect(pts, rect)) {
      w.add(G.simplifyLine(part, 0.3));
      cls.push(ROAD_ID[c]);
      width.push(Math.round(wd * 10));
      flags.push(f);
      layer.push(Math.max(-5, Math.min(5, num(t.layer) || 0)));
      name.push(nameId(t.name));
    }
  }
  await writeFile(
    `${OUT}/roads.bin`,
    encodePack({
      meta: { q: Q, count: w.count, names },
      arrays: { ...w.arrays(), cls: Uint8Array.from(cls), width: Uint16Array.from(width), flags: Uint8Array.from(flags), layer: Int8Array.from(layer), name: Int16Array.from(name) },
    }),
  );
  stats.roads = w.count;
}

// ─────────────── Железница и водотеци ───────────────

{
  const rail = new LineWriter();
  const railCls = [];
  const water = new LineWriter();
  const waterCls = [];
  const waterWidth = [];
  const waterFlags = [];
  for (const way of osm.ways.values()) {
    const t = way.tags;
    if (!t) continue;
    let rc = null;
    if (['rail', 'light_rail', 'narrow_gauge', 'preserved'].includes(t.railway)) rc = 'rail';
    else if (['disused', 'abandoned'].includes(t.railway)) rc = 'disused';
    else if (t.railway === 'tram') rc = 'tram';
    let wc = null;
    if (t.waterway === 'river') wc = 'river';
    else if (t.waterway === 'stream') wc = 'stream';
    else if (t.waterway === 'canal') wc = 'canal';
    else if (['ditch', 'drain'].includes(t.waterway)) wc = 'ditch';
    if (!rc && !wc) continue;
    if (t.service === 'siding' || t.service === 'yard' || t.service === 'spur') rc = rc && 'rail';
    const pts = wayXZ(way);
    if (!pts) continue;
    for (const part of G.clipLineToRect(pts, rect)) {
      const s = G.simplifyLine(part, 0.5);
      if (rc) {
        rail.add(s);
        railCls.push(RAIL_ID[rc]);
      } else {
        water.add(s);
        waterCls.push(WATERWAY_ID[wc]);
        let wd = num(t.width);
        if (!(wd > 0.5 && wd < 60)) wd = { river: 9, stream: 3, canal: 5, ditch: 1.5 }[wc];
        waterWidth.push(Math.round(wd * 10));
        waterFlags.push(t.tunnel && t.tunnel !== 'no' ? ROAD_FLAG.tunnel : 0);
      }
    }
  }
  const ra = rail.arrays();
  const wa = water.arrays();
  await writeFile(
    `${OUT}/lines.bin`,
    encodePack({
      meta: { q: Q, rail: rail.count, water: water.count },
      arrays: {
        railLinePt: ra.linePt,
        railCoords: ra.coords,
        railCls: Uint8Array.from(railCls),
        waterLinePt: wa.linePt,
        waterCoords: wa.coords,
        waterCls: Uint8Array.from(waterCls),
        waterWidth: Uint16Array.from(waterWidth),
        waterFlags: Uint8Array.from(waterFlags),
      },
    }),
  );
  stats.rail = rail.count;
  stats.waterways = water.count;
}

// ─────────────── Згради ───────────────

// Индекс на основите на зградите (за дрвјата да не паѓаат во згради).
const buildingIdx = new G.GridIndex(60);

const zoneBazaar = { c: proj.toXZ(ZONES.oldBazaar.lat, ZONES.oldBazaar.lon), r: ZONES.oldBazaar.radius };
const zoneCenter = { c: proj.toXZ(ZONES.center.lat, ZONES.center.lon), r: ZONES.center.radius };
const near = (p, z) => Math.hypot(p[0] - z.c[0], p[1] - z.c[1]) < z.r;
const inShirok = (p) => shirokLines.some((l) => G.distToLine(p, l) < ZONES.shirokSokak.buffer);
const inIndustrial = (p) => industrialIdx.query(p).some((a) => G.pointInPolygon(p, a.rings));

function buildingKind(t) {
  const b = t.building || t['building:part'];
  if (t.historic && t.historic !== 'no') return 'historic';
  if (['house', 'detached', 'semidetached_house', 'terrace', 'bungalow', 'farm', 'cabin', 'villa'].includes(b)) return 'house';
  if (['apartments', 'dormitory', 'residential'].includes(b)) return 'apartments';
  if (['commercial', 'retail', 'office', 'hotel', 'supermarket', 'kiosk'].includes(b)) return 'commercial';
  if (['industrial', 'warehouse', 'factory', 'manufacture', 'hangar', 'barn', 'farm_auxiliary', 'greenhouse', 'storage_tank', 'silo'].includes(b)) return 'industrial';
  if (['school', 'university', 'college', 'kindergarten', 'hospital', 'public', 'civic', 'government', 'train_station', 'transportation', 'fire_station', 'sports_hall', 'stadium', 'grandstand'].includes(b)) return 'civic';
  if (['church', 'mosque', 'cathedral', 'chapel', 'religious', 'synagogue', 'temple', 'monastery'].includes(b) || t.amenity === 'place_of_worship') return 'religious';
  if (['garage', 'garages', 'shed', 'roof', 'carport', 'hut', 'toilets', 'service', 'container', 'cowshed', 'sty', 'stable', 'transformer_tower'].includes(b)) return 'small';
  return 'generic';
}

const pick = (seed, [lo, hi]) => lo + Math.floor(seed * (hi - lo + 1));
const LEVEL_H = 3.1;

/** Висина (m) и катови; source: 0 = OSM висина, 1 = OSM катови, 2 = проценка. */
function estimateHeight(t, kind, area, c, seed) {
  const roofLevels = num(t['roof:levels']) || 0;
  const h = num(t.height);
  if (h > 1 && h < 200) return { height: h, source: 0 };
  const lv = num(t['building:levels']);
  if (lv > 0 && lv < 60) return { height: (lv + roofLevels * 0.6) * LEVEL_H + 0.6, source: 1 };

  let levels;
  if (kind === 'small') return { height: 2.6 + seed * 0.8, source: 2 };
  if (kind === 'industrial') return { height: 6 + seed * 4, source: 2 };
  if (kind === 'religious') return { height: 10 + seed * 4, source: 2 };
  if (inShirok(c)) levels = pick(seed, ZONES.shirokSokak.levels);
  else if (near(c, zoneBazaar)) levels = pick(seed, ZONES.oldBazaar.levels);
  else if (kind === 'house') levels = area < 90 ? pick(seed, [1, 2]) : pick(seed, [2, 3]);
  else if (kind === 'apartments') levels = area < 250 ? pick(seed, [3, 4]) : area < 700 ? pick(seed, [4, 7]) : pick(seed, [6, 10]);
  else if (kind === 'commercial') levels = area > 1500 ? pick(seed, [1, 2]) : pick(seed, [2, 4]);
  else if (kind === 'civic') levels = pick(seed, [2, 4]);
  else if (inIndustrial(c)) return { height: 5 + seed * 4, source: 2 };
  else if (near(c, zoneCenter) && area > 150) levels = area > 600 ? pick(seed, [4, 8]) : pick(seed, ZONES.center.levels);
  else if (area < 60) levels = 1;
  else if (area < 160) levels = pick(seed, [1, 2]);
  else if (area < 320) levels = pick(seed, [2, 3]);
  else if (area < 800) levels = pick(seed, [3, 6]);
  else levels = pick(seed, [4, 8]);
  return { height: levels * LEVEL_H + 0.6, source: 2 };
}

function roofShape(t) {
  const r = t['roof:shape'];
  if (!r) return ROOF_ID.flat;
  if (r === 'gabled' || r === 'saltbox' || r === 'gambrel') return ROOF_ID.gabled;
  if (r === 'hipped' || r === 'half-hipped' || r === 'mansard') return ROOF_ID.hipped;
  if (r === 'pyramidal') return ROOF_ID.pyramidal;
  if (r === 'dome' || r === 'onion') return ROOF_ID.dome;
  if (r === 'flat') return ROOF_ID.flat;
  return ROOF_ID.other;
}

{
  // Прво собери ги деловите (building:part) за да ги исфрлиме обвивките што ги содржат.
  const raw = [];
  for (const el of [...osm.ways.values(), ...osm.relations.values()]) {
    const t = el.tags;
    if (!t) continue;
    const isPart = !!t['building:part'] && t['building:part'] !== 'no';
    const isBuilding = !!t.building && t.building !== 'no';
    if (!isPart && !isBuilding) continue;
    for (const poly of polygonsOf(el)) {
      const rings = orient(poly.filter((r) => r.length >= 3));
      if (!rings.length) continue;
      const area = Math.abs(G.signedArea(rings[0]));
      if (area < 6) continue;
      const c = G.centroid(rings[0]);
      if (!inRect(c)) continue;
      raw.push({ el, t, rings, area, c, isPart });
    }
  }
  // Дополнителни основи: data/raw/overture-buildings.json.gz (fetch-overture.mjs) — згради
  // што ги нема во OSM (Microsoft ML Buildings преку Overture Maps, ODbL). Се додаваат само
  // ако не се преклопуваат со OSM зграда (OSM е поново и има предност).
  const osmIdx = new G.GridIndex(100);
  for (const b of raw) osmIdx.insert(b, G.ringBounds(b.rings[0]));
  let extraAdded = 0;
  let extraSkipped = 0;
  let extraSource = null;
  const extraBySource = {};
  try {
    const extra = JSON.parse(gunzipSync(await readFile('data/raw/overture-buildings.json.gz')));
    extraSource = extra.source;
    for (const e of extra.buildings) {
      const rings = orient(e.rings.map((r) => G.cleanRing(r.map((ll) => proj.toXZ(ll[0], ll[1])))).filter((r) => r.length >= 3));
      if (!rings.length) continue;
      const area = Math.abs(G.signedArea(rings[0]));
      if (area < 6) continue;
      const c = G.centroid(rings[0]);
      if (!inRect(c)) continue;
      const hit = osmIdx.query(c).some((o) => G.pointInPolygon(c, o.rings) || G.pointInPolygon(o.c, rings));
      if (hit) {
        extraSkipped++;
        continue;
      }
      let id = 0;
      for (const ch of e.id) id = (Math.imul(id, 31) + ch.charCodeAt(0)) | 0;
      const t = { building: 'yes' };
      if (e.h) t.height = String(e.h);
      if (e.f) t['building:levels'] = String(e.f);
      raw.push({ el: { type: 'extra', id: Math.abs(id) }, t, rings, area, c, isPart: false, extra: true });
      extraBySource[e.src] = (extraBySource[e.src] || 0) + 1;
      extraAdded++;
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const partIdx = new G.GridIndex(100);
  for (const b of raw) if (b.isPart) partIdx.insert(b, { minX: b.c[0], maxX: b.c[0], minZ: b.c[1], maxZ: b.c[1] });

  const w = new PolyWriter();
  const A = { height: [], minHeight: [], ground: [], kind: [], roof: [], source: [], seed: [], osmId: [] };
  let skippedOutlines = 0;
  const bySource = [0, 0, 0];
  for (const b of raw) {
    if (!b.isPart) {
      const bb = G.ringBounds(b.rings[0]);
      const parts = new Set();
      for (let x = bb.minX; x <= bb.maxX + 100; x += 100) for (let z = bb.minZ; z <= bb.maxZ + 100; z += 100) for (const p of partIdx.query([Math.min(x, bb.maxX), Math.min(z, bb.maxZ)])) parts.add(p);
      if ([...parts].some((p) => G.pointInPolygon(p.c, b.rings))) {
        skippedOutlines++;
        continue;
      }
    }
    const seed = G.hash01(b.el.id);
    const kind = buildingKind(b.t);
    const { height, source } = estimateHeight(b.t, kind, b.area, b.c, seed);
    let minH = num(b.t.min_height);
    if (!(minH >= 0)) minH = (num(b.t['building:min_level']) || 0) * LEVEL_H;
    // Подлога: минимум под основата (ѕидовите тонат малку во релјефот).
    let gmin = Infinity;
    let gsum = 0;
    for (const [x, z] of b.rings[0]) {
      const g = hf.sample(x, z);
      gmin = Math.min(gmin, g);
      gsum += g;
    }
    const gmean = gsum / b.rings[0].length;
    buildingIdx.insert(b.rings, G.ringBounds(b.rings[0]));
    w.add(b.rings.map((r) => G.simplifyRing(r, 0.15)));
    A.height.push(Math.round(Math.max(height, minH + 1) * 10));
    A.minHeight.push(Math.round(minH * 10));
    A.ground.push(gmin, gmean);
    A.kind.push(BUILDING_ID[kind]);
    A.roof.push(roofShape(b.t));
    A.source.push(b.extra ? 3 : source);
    A.seed.push(Math.floor(seed * 255));
    A.osmId.push(b.extra ? 0 : b.el.type === 'relation' ? -b.el.id : b.el.id);
    bySource[source]++;
  }
  await writeFile(
    `${OUT}/buildings.bin`,
    encodePack({
      meta: { q: Q, count: w.count },
      arrays: {
        ...w.arrays(),
        height: Uint16Array.from(A.height),
        minHeight: Uint16Array.from(A.minHeight),
        ground: Float32Array.from(A.ground),
        kind: Uint8Array.from(A.kind),
        roof: Uint8Array.from(A.roof),
        source: Uint8Array.from(A.source),
        seed: Uint8Array.from(A.seed),
        osmId: Float64Array.from(A.osmId),
      },
    }),
  );
  stats.buildings = { count: w.count, heightFromOsm: bySource[0], levelsFromOsm: bySource[1], estimated: bySource[2], outlinesReplacedByParts: skippedOutlines, extra: extraAdded, extraBySource, extraOverlappingOsm: extraSkipped, extraSource };
}

// ─────────────── Дрвја ───────────────
// kind: 0 = поединечно/дрворед од OSM, 1 = парк/гробишта, 2 = шума, 3 = овоштарник/грмушки.
// Површините се полнат со растресена мрежа (детерминистички), без дрвја во згради.

{
  const pts = [];
  const kinds = [];
  const push = (p, k) => {
    pts.push(p);
    kinds.push(k);
  };
  for (const n of osm.nodes.values()) {
    if (n.tags?.natural !== 'tree') continue;
    const p = proj.toXZ(n.lat, n.lon);
    if (inRect(p)) push(p, 0);
  }
  for (const way of osm.ways.values()) {
    if (way.tags?.natural !== 'tree_row') continue;
    const line = wayXZ(way);
    if (!line) continue;
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, az] = line[i];
      const [bx, bz] = line[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 8));
      for (let k = 0; k < n; k++) {
        const p = [ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n];
        if (inRect(p)) push(p, 0);
      }
    }
  }
  const singles = pts.length;
  // m² по дрво; шумите подалеку од центарот се поретки
  const DENSITY = { park: [1, 110], cemetery: [1, 160], grass: [1, 900], forest: [2, 220], orchard: [3, 70], scrub: [3, 500] };
  const inBuilding = (p) => buildingIdx.query(p).some((rings) => G.pointInPolygon(p, rings));
  // без семплирани дрвја во воените гробишта и стадионот (таму се модели со крстови/трибини)
  const NO_TREES = new Set(['totenburg', 'warCemetery', 'stadium']);
  const noTreeRings = [];
  for (const L of LANDMARKS) {
    if (!NO_TREES.has(L.model) || !L.osm) continue;
    const el = L.osm[0] === 'w' ? osm.ways.get(+L.osm.slice(1)) : osm.relations.get(+L.osm.slice(1));
    if (el) for (const poly of polygonsOf(el)) noTreeRings.push(poly);
  }
  const excluded = (p) => noTreeRings.some((rings) => G.pointInPolygon(p, rings));
  const MAX = 40000;
  const sorted = [...areas].filter((a) => DENSITY[a.cls]).sort((a, b) => {
    const da = Math.hypot(...G.centroid(a.rings[0]));
    const db = Math.hypot(...G.centroid(b.rings[0]));
    return da - db; // поблиските прво (ако се стигне границата)
  });
  let seed = 1;
  for (const a of sorted) {
    const [kind, per] = DENSITY[a.cls];
    const c = G.centroid(a.rings[0]);
    const far = Math.hypot(c[0], c[1]) > 2500 && a.cls === 'forest';
    const step = Math.sqrt(far ? per * 3.5 : per);
    const bb = G.ringBounds(a.rings[0]);
    for (let x = bb.minX + step / 2; x < bb.maxX; x += step) {
      for (let z = bb.minZ + step / 2; z < bb.maxZ; z += step) {
        const jx = (G.hash01(seed++) - 0.5) * step * 0.85;
        const jz = (G.hash01(seed++) - 0.5) * step * 0.85;
        const p = [x + jx, z + jz];
        if (!inRect(p) || !G.pointInPolygon(p, a.rings) || inBuilding(p) || excluded(p)) continue;
        if (pts.length >= MAX) break;
        push(p, kind);
      }
    }
  }
  const coords = new Int16Array(pts.length * 2);
  pts.forEach(([x, z], i) => {
    coords[i * 2] = quant(x);
    coords[i * 2 + 1] = quant(z);
  });
  await writeFile(`${OUT}/trees.bin`, encodePack({ meta: { q: Q, count: pts.length }, arrays: { coords, kind: Uint8Array.from(kinds) } }));
  stats.trees = { total: pts.length, osm: singles, sampled: pts.length - singles };
}

// ─────────────── Знаменитости ───────────────
// Основи (локални метри, ориентирани) и подлога за моделите во src/world/landmarks/.

{
  const out = [];
  const ringsOf = (ref) => {
    const el = ref[0] === 'w' ? osm.ways.get(+ref.slice(1)) : osm.relations.get(+ref.slice(1));
    if (!el) throw new Error(`Знаменитост: не најдов ${ref} во OSM`);
    return { el, polys: polygonsOf(el).map(orient) };
  };
  const groundOf = (ring) => {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const [x, z] of ring) {
      const g = hf.sample(x, z);
      min = Math.min(min, g);
      max = Math.max(max, g);
      sum += g;
    }
    return { min: +min.toFixed(2), max: +max.toFixed(2), mean: +(sum / ring.length).toFixed(2) };
  };
  const r1 = (ring) => ring.map(([x, z]) => [+x.toFixed(2), +z.toFixed(2)]);
  for (const L of LANDMARKS) {
    const item = { id: L.id, name: L.name, model: L.model, opts: L.opts || {}, rank: L.rank ?? 1 };
    if (L.label === false) item.label = false;
    if (L.group) item.group = L.group;
    if (L.view) item.view = L.view;
    if (L.inside) item.inside = true;
    if (L.node) {
      // точка (на пр. статуа): центар + подлога
      const n = osm.nodes.get(+L.node.slice(1));
      if (!n) throw new Error(`Знаменитост: не најдов ${L.node} во OSM`);
      const [x, z] = proj.toXZ(n.lat, n.lon);
      item.center = [+x.toFixed(2), +z.toFixed(2)];
      const g = +hf.sample(x, z).toFixed(2);
      item.ground = { min: g, max: g, mean: g };
    }
    if (L.roundabout) {
      // кружен тек: сите делови (junction=roundabout) во близина → центар и радиус
      const first = osm.ways.get(+L.roundabout.slice(1));
      if (!first) throw new Error(`Знаменитост: не најдов ${L.roundabout} во OSM`);
      const seed = wayXZ(first);
      const sx = seed.reduce((a, p) => a + p[0], 0) / seed.length;
      const sz = seed.reduce((a, p) => a + p[1], 0) / seed.length;
      const pts = [];
      for (const way of osm.ways.values()) {
        if (way.tags?.junction !== 'roundabout') continue;
        const line = wayXZ(way);
        if (line && line.some(([x, z]) => Math.hypot(x - sx, z - sz) < 40)) pts.push(...line);
      }
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
      const cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      item.center = [+cx.toFixed(2), +cz.toFixed(2)];
      item.radius = +(pts.reduce((a, p) => a + Math.hypot(p[0] - cx, p[1] - cz), 0) / pts.length).toFixed(2);
      const g = +hf.sample(cx, cz).toFixed(2);
      item.ground = { min: g, max: g, mean: g };
    }
    if (L.osm) {
      const { el, polys } = ringsOf(L.osm);
      // најголемиот полигон е основата
      polys.sort((a, b) => Math.abs(G.signedArea(b[0])) - Math.abs(G.signedArea(a[0])));
      item.osm = L.osm;
      item.osmId = el.type === 'relation' ? -el.id : el.id;
      item.polys = polys.map((p) => p.map(r1));
      item.center = G.centroid(polys[0][0]).map((v) => +v.toFixed(2));
      item.ground = groundOf(polys[0][0]);
    }
    if (L.street) {
      item.lines = [];
      for (const way of osm.ways.values()) {
        const t = way.tags;
        if (t?.name !== L.street || !['pedestrian', 'footway'].includes(t.highway) || t.footway === 'crossing') continue;
        const line = wayXZ(way);
        if (line && line.length >= 2) item.lines.push(r1(line));
      }
      item.buffer = L.buffer;
      const all = item.lines.flat();
      item.center = [all.reduce((a, p) => a + p[0], 0) / all.length, all.reduce((a, p) => a + p[1], 0) / all.length].map((v) => +v.toFixed(2));
    }
    if (L.at) {
      // рачна позиција (WGS84) — има предност пред OSM (на пр. точна локација од сопственикот)
      const [x, z] = proj.toXZ(L.at.lat, L.at.lon);
      if (L.inside) {
        // „inside“: основата е двор/парцела — не се поместува; at ја посочува самата зграда
        item.pick = [+x.toFixed(2), +z.toFixed(2)];
      } else if (item.polys) {
        // помести ја основата заедно со центарот
        const dx = x - item.center[0];
        const dz = z - item.center[1];
        item.polys = item.polys.map((p) => p.map((r) => r.map(([px, pz]) => [+(px + dx).toFixed(2), +(pz + dz).toFixed(2)])));
      }
      item.center = [+x.toFixed(2), +z.toFixed(2)];
      const g = +hf.sample(x, z).toFixed(2);
      item.ground = { min: g, max: g, mean: g };
      item.at = L.at;
    }
    for (const [k, ref] of Object.entries(L.parts || {})) {
      const { el, polys } = ringsOf(ref);
      item.parts = item.parts || {};
      item.parts[k] = { osmId: el.type === 'relation' ? -el.id : el.id, polys: polys.map((p) => p.map(r1)), center: G.centroid(polys[0][0]).map((v) => +v.toFixed(2)) };
    }
    out.push(item);
  }
  await writeFile(`${OUT}/landmarks.json`, JSON.stringify(out));
  stats.landmarks = out.length;
}

// ─────────────── Именувани точки ───────────────

{
  const pois = [];
  const add = (el, lat, lon) => {
    const t = el.tags;
    const [x, z] = proj.toXZ(lat, lon);
    if (!inRect([x, z])) return;
    let type = null;
    if (t.place) type = 'place:' + t.place;
    else if (t.historic && t.historic !== 'no') type = 'historic';
    else if (t.amenity === 'place_of_worship') type = 'worship';
    else if (t.tourism && ['attraction', 'museum', 'viewpoint', 'artwork', 'gallery'].includes(t.tourism)) type = 'tourism';
    else if (t.leisure === 'stadium' || t.leisure === 'park') type = 'leisure';
    else if (t.man_made === 'tower') type = 'tower';
    if (!type) return;
    pois.push({ id: `${el.type[0]}${el.id}`, name: t.name, type, x: +x.toFixed(1), z: +z.toFixed(1), y: +hf.sample(x, z).toFixed(1) });
  };
  for (const n of osm.nodes.values()) if (n.tags?.name) add(n, n.lat, n.lon);
  for (const el of [...osm.ways.values(), ...osm.relations.values()]) {
    if (!el.tags?.name) continue;
    const polys = polygonsOf(el);
    if (!polys.length) continue;
    const [x, z] = G.centroid(polys[0][0]);
    const [lat, lon] = proj.toLatLon(x, z);
    add(el, lat, lon);
  }
  pois.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, 'mk'));
  await writeFile(`${OUT}/pois.json`, JSON.stringify(pois));
  stats.pois = pois.length;
}

// ─────────────── Мета ───────────────

const meta = {
  region: REGION,
  rect,
  osmTimestamp: raw.osm3s?.timestamp_osm_base || raw.fetchedAt,
  generatedAt: new Date().toISOString(),
  stats,
  attribution: [
    '© соработниците на OpenStreetMap (ODbL)',
    ...(stats.buildings.extra ? ['Згради: Overture Maps Foundation, Microsoft (ODbL)'] : []),
    'Релјеф: Terrain Tiles (Mapzen, AWS Open Data)',
  ],
};
await writeFile(`${OUT}/meta.json`, JSON.stringify(meta, null, 1));

const files = await readdir(OUT);
let total = 0;
for (const f of files) {
  const s = (await readFile(`${OUT}/${f}`)).length;
  total += s;
  console.log(`  ${f.padEnd(15)} ${(s / 1024).toFixed(0).padStart(6)} KB`);
}
console.log(`  вкупно          ${(total / 1024).toFixed(0).padStart(6)} KB`);
console.log(JSON.stringify(stats, null, 1));
console.log(`Готово за ${((Date.now() - t0) / 1000).toFixed(1)} s`);
