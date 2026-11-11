// Подлога на релјефот: површините (landuse, паркови, вода…) се цртаат во canvas
// и се лепат на теренот како текстура. Смена на стил = ново цртање, без нова геометрија.
//
// Начинот на цртање го бира стилот: style.ground.painter = 'flat' | 'watercolor'.

import * as THREE from 'three';
import { AREA, WATERWAY } from '../config/classes.js';

/**
 * @param {object} data   вчитаните податоци (areas, lines)
 * @param {object} rect   опфат во метри {minX,maxX,minZ,maxZ}
 * @param {number} size   најголема димензија на canvas во пиксели
 */
export function createGround(data, rect, size = 4096) {
  const w = rect.maxX - rect.minX;
  const d = rect.maxZ - rect.minZ;
  const scale = size / Math.max(w, d); // пиксели по метар
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(d * scale);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  // Патеките се градат еднаш и се користат при секое цртање.
  const areas = [];
  {
    const { meta, arrays } = data.areas;
    const { polyRing, ringPt, coords, cls } = arrays;
    for (let p = 0; p < meta.count; p++) {
      const path = new Path2D();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let r = polyRing[p]; r < polyRing[p + 1]; r++) {
        for (let i = ringPt[r]; i < ringPt[r + 1]; i++) {
          const x = (coords[i * 2] * meta.q - rect.minX) * scale;
          const y = (coords[i * 2 + 1] * meta.q - rect.minZ) * scale;
          if (i === ringPt[r]) path.moveTo(x, y);
          else path.lineTo(x, y);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        path.closePath();
      }
      areas.push({ cls: AREA[cls[p]], path, size: Math.max(maxX - minX, maxY - minY) });
    }
  }
  const waterways = [];
  {
    const L = data.lines;
    const q = L.meta.q;
    for (let l = 0; l < L.meta.water; l++) {
      const kind = WATERWAY[L.arrays.waterCls[l]];
      const path = new Path2D();
      for (let i = L.arrays.waterLinePt[l]; i < L.arrays.waterLinePt[l + 1]; i++) {
        const x = (L.arrays.waterCoords[i * 2] * q - rect.minX) * scale;
        const y = (L.arrays.waterCoords[i * 2 + 1] * q - rect.minZ) * scale;
        if (i === L.arrays.waterLinePt[l]) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      waterways.push({ kind, path, width: (L.arrays.waterWidth[l] / 10) * scale });
    }
  }

  const ctx = canvas.getContext('2d');
  const api = { ctx, canvas, scale, areas, waterways };

  function paint(style) {
    const painter = PAINTERS[style.ground.painter] || PAINTERS.flat;
    ctx.save();
    painter(api, style);
    ctx.restore();
    texture.needsUpdate = true;
  }

  return { canvas, texture, paint, metersPerPixel: 1 / scale };
}

// ───────────────────────────── Сликари ─────────────────────────────

const PAINTERS = { flat: paintFlat, watercolor: paintWatercolor };

/** Рамни бои, остри рабови. */
function paintFlat({ ctx, canvas, areas, waterways, scale }, style) {
  const g = style.ground;
  ctx.fillStyle = g.base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const a of areas) {
    ctx.fillStyle = g.areas[a.cls] || g.base;
    ctx.fill(a.path, 'evenodd');
  }
  ctx.strokeStyle = g.areas.water;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const w of waterways) {
    if (w.kind === 'ditch') continue;
    ctx.lineWidth = Math.max(1.2, w.width);
    ctx.stroke(w.path);
  }
  if (g.outline) {
    // тенки рабови на површините (на пр. исечени листови кај макетата)
    ctx.strokeStyle = g.outline;
    ctx.lineWidth = Math.max(0.6, 0.5 * scale);
    for (const a of areas) if (a.cls !== 'residential' && a.cls !== 'farmland') ctx.stroke(a.path);
  }
}

/**
 * Акварел: слоевити, полупроѕирни намази, потемнети рабови каде што се собира пигментот,
 * и неколку широки „перења“ преку хартијата за нерамномерен тон.
 */
function paintWatercolor({ ctx, canvas, areas, waterways, scale }, style) {
  const g = style.ground;
  const rnd = mulberry32(20261111);
  const px = Math.max(1, scale); // пиксели по метар (≥1)

  ctx.fillStyle = g.base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Широки перења (нерамномерност на подлогата).
  for (const [color, alpha] of g.washes || []) {
    for (let i = 0; i < 60; i++) {
      const x = rnd() * canvas.width;
      const y = rnd() * canvas.height;
      const r = (0.04 + rnd() * 0.12) * canvas.width;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, withAlpha(color, alpha * (0.5 + rnd() * 0.5)));
      grd.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = grd;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const a of areas) {
    const color = g.areas[a.cls];
    if (!color) continue;
    const off = Math.min(3, a.size * 0.01) * px;
    // два намаза со мало поместување — неизедначен раб
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = color;
    ctx.fill(a.path, 'evenodd');
    ctx.save();
    ctx.translate((rnd() - 0.5) * off, (rnd() - 0.5) * off);
    ctx.globalAlpha = 0.3;
    ctx.fill(a.path, 'evenodd');
    ctx.restore();
    // пигментот се собира на рабовите
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = shade(color, 0.72);
    ctx.lineWidth = Math.max(1, 1.6 * px);
    ctx.stroke(a.path);
  }

  // Водотеци: мек раб + посветла средина.
  ctx.globalAlpha = 1;
  for (const w of waterways) {
    if (w.kind === 'ditch') continue;
    const width = Math.max(1.4, w.width);
    ctx.strokeStyle = withAlpha(shade(g.areas.water, 0.8), 0.55);
    ctx.lineWidth = width + 2.5 * px;
    ctx.stroke(w.path);
    ctx.strokeStyle = g.areas.water;
    ctx.lineWidth = width;
    ctx.stroke(w.path);
  }
  ctx.globalAlpha = 1;
}

// ───────────────────────────── помошни ─────────────────────────────

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}
