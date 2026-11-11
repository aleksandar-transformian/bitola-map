// Подлога на релјефот: површините (landuse, паркови, вода…) се цртаат во canvas
// и се лепат на теренот како текстура. Смена на стил = ново цртање, без нова геометрија.

import * as THREE from 'three';
import { AREA, WATERWAY } from '../config/classes.js';

/**
 * @param {object} data   вчитаните податоци (areas, lines)
 * @param {object} rect   опфат во метри {minX,maxX,minZ,maxZ}
 * @param {object} style
 * @param {number} size   најголема димензија на canvas во пиксели
 */
export function createGround(data, rect, style, size = 4096) {
  const w = rect.maxX - rect.minX;
  const d = rect.maxZ - rect.minZ;
  const scale = size / Math.max(w, d);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(d * scale);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  function paint(style) {
    const ctx = canvas.getContext('2d');
    const g = style.ground;
    ctx.fillStyle = g.base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tx = (x) => (x - rect.minX) * scale;
    const tz = (z) => (z - rect.minZ) * scale;

    const { meta, arrays } = data.areas;
    const { polyRing, ringPt, coords, cls } = arrays;
    const q = meta.q;
    for (let p = 0; p < meta.count; p++) {
      ctx.beginPath();
      for (let r = polyRing[p]; r < polyRing[p + 1]; r++) {
        for (let i = ringPt[r]; i < ringPt[r + 1]; i++) {
          const x = tx(coords[i * 2] * q);
          const z = tz(coords[i * 2 + 1] * q);
          if (i === ringPt[r]) ctx.moveTo(x, z);
          else ctx.lineTo(x, z);
        }
        ctx.closePath();
      }
      ctx.fillStyle = g.areas[AREA[cls[p]]] || g.base;
      ctx.fill('evenodd');
    }

    // Водотеци — и во подлогата, за да се гледаат и од далеку.
    const L = data.lines;
    const wq = L.meta.q;
    ctx.strokeStyle = g.areas.water;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let l = 0; l < L.meta.water; l++) {
      if (WATERWAY[L.arrays.waterCls[l]] === 'ditch') continue;
      ctx.lineWidth = Math.max(1.2, (L.arrays.waterWidth[l] / 10) * scale);
      ctx.beginPath();
      for (let i = L.arrays.waterLinePt[l]; i < L.arrays.waterLinePt[l + 1]; i++) {
        const x = tx(L.arrays.waterCoords[i * 2] * wq);
        const z = tz(L.arrays.waterCoords[i * 2 + 1] * wq);
        if (i === L.arrays.waterLinePt[l]) ctx.moveTo(x, z);
        else ctx.lineTo(x, z);
      }
      ctx.stroke();
    }
    texture.needsUpdate = true;
  }

  paint(style);
  return { canvas, texture, paint, metersPerPixel: 1 / scale };
}
