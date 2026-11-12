// „Ракометното игралиште“ (OSM w38165657) — отворен простор што повремено служи за концерти.
// Според сателит и фотографии: асфалтна површина со линии од игралишта; бетонски трибини
// (скали за седење) по источната и северната страна, со заоблен северозападен агол; на јужниот
// крај бетонска бина и сива помошна зграда; рефлектори на високи столбови. На западната страна,
// кон шеталиштето, низа бутки (трафики, брза храна) со тенди и чадори.
// OSM го води како зграда (building=public) — обичната истисната зграда се прескокнува.
//
// Рамка: u по источната страна (кон југ-југоисток), v кон запад; почеток = средината на опсегот.

import * as THREE from 'three';
import { Kit } from './kit.js';

const PI = Math.PI;
const ROWS = 8; // редови на трибините
const ROW_D = 0.9; // длабочина на ред
const ROW_H = 0.42; // висина на ред

/** Трибина по права a → b (во рамката): редови навнатре кон in (единичен вектор), највисоко на работ. */
function stand(kit, a, b, inU, inV) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const rot = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  for (let k = 0; k < ROWS; k++) {
    const off = (k + 0.5) * ROW_D;
    const u = (a[0] + b[0]) / 2 + inU * off;
    const v = (a[1] + b[1]) / 2 + inV * off;
    const h = (ROWS - k) * ROW_H;
    kit.add(new THREE.BoxGeometry(len - k * 0.4, h + 0.3, ROW_D).translate(0, (h + 0.3) / 2 - 0.3, 0), Kit.at(u, 0, v, rot), 'stone');
  }
  // ѕид зад трибината
  kit.add(new THREE.BoxGeometry(len, ROWS * ROW_H + 1.4, 0.3).translate(0, (ROWS * ROW_H + 1.4) / 2 - 0.3, 0), Kit.at((a[0] + b[0]) / 2 - inU * 0.15, 0, (a[1] + b[1]) / 2 - inV * 0.15, rot), 'plinth');
}

/** Бела линија (тенка плоча) од (u0, v0) до (u1, v1). */
function line(kit, u0, v0, u1, v1, y) {
  const len = Math.hypot(u1 - u0, v1 - v0);
  kit.add(new THREE.BoxGeometry(len, 0.04, 0.14), Kit.at((u0 + u1) / 2, y, (v0 + v1) / 2, Math.atan2(-(v1 - v0), u1 - u0)), 'accent');
}

/** Круг (линија) со центар (u, v), радиус r, од агол a0 со опсег da. */
function ring(kit, u, v, r, y, a0 = 0, da = 2 * PI) {
  kit.add(new THREE.TorusGeometry(r, 0.06, 3, 24, da).rotateX(PI / 2).rotateY(-a0).scale(1, 0.25, 1), Kit.at(u, y, v), 'accent');
}

export function openArena(kit, item, ctx) {
  const poly = item.polys[0][0];
  // оска: источната страна е најдолгиот раб
  let best = null;
  for (let i = 0; i < poly.length - 1; i++) {
    const dx = poly[i + 1][0] - poly[i][0];
    const dz = poly[i + 1][1] - poly[i][1];
    const l = Math.hypot(dx, dz);
    if (!best || l > best.l) best = { l, ax: dx / l, az: dz / l };
  }
  // насока кон југ (z расте)
  const ax = best.az < 0 ? -best.ax : best.ax;
  const az = best.az < 0 ? -best.az : best.az;
  const us = poly.map(([x, z]) => x * ax + z * az);
  const vs = poly.map(([x, z]) => -x * az + z * ax);
  const um = (Math.min(...us) + Math.max(...us)) / 2;
  const vm = (Math.min(...vs) + Math.max(...vs)) / 2;
  const cx = um * ax - vm * az;
  const cz = um * az + vm * ax;
  const g = item.ground.max;
  const HU = (Math.max(...us) - Math.min(...us)) / 2; // ~32.4
  const HV = (Math.max(...vs) - Math.min(...vs)) / 2; // ~24.6

  // асфалт по основата
  kit.slab([poly], item.ground.min - 0.5, g + 0.08, 'metal');
  kit.setFrame(cx, g + 0.08, cz, ax, az);

  // трибини по рабовите на основата: источниот раб и северниот со заоблениот северозападен агол
  const loc = poly.map(([x, z]) => [(x - cx) * ax + (z - cz) * az, -(x - cx) * az + (z - cz) * ax]);
  const sgn = Math.sign(loc.reduce((a, p, i) => {
    const q = loc[(i + 1) % loc.length];
    return a + p[0] * q[1] - q[0] * p[1];
  }, 0));
  for (let i = 0; i < loc.length; i++) {
    const a = loc[i];
    const b = loc[(i + 1) % loc.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1) continue;
    const mu = (a[0] + b[0]) / 2;
    const mv = (a[1] + b[1]) / 2;
    const east = mv < -HV + 1 && mu < HU - 12;
    const north = mu < -HU + 14 && mv < HV - 1;
    if (!east && !north) continue;
    // нормала навнатре
    const nu = (-sgn * (b[1] - a[1])) / len;
    const nv = (sgn * (b[0] - a[0])) / len;
    stand(kit, a, b, nu, nv);
  }

  // игралишта: ракомет (40 × 20) и кошарка, линиите се преклопуваат како на снимката
  const y = 0.05;
  const [c0, c1, d0, d1] = [-14, 26, -9, 11];
  line(kit, c0, d0, c1, d0, y);
  line(kit, c0, d1, c1, d1, y);
  line(kit, c0, d0, c0, d1, y);
  line(kit, c1, d0, c1, d1, y);
  line(kit, (c0 + c1) / 2, d0, (c0 + c1) / 2, d1, y);
  ring(kit, (c0 + c1) / 2, (d0 + d1) / 2, 3, y);
  ring(kit, c0, (d0 + d1) / 2, 6, y, -PI / 2, PI);
  ring(kit, c1, (d0 + d1) / 2, 6, y, PI / 2, PI);
  for (const s of [-1, 1]) line(kit, c0 + 2 + 0, (d0 + d1) / 2 + s * 7.5, c1 - 2, (d0 + d1) / 2 + s * 7.5, y);

  // бина на јужниот крај и сива помошна зграда зад неа
  kit.box(HU - 6.5, -0.1, 2, 6, 1.3, 15, 'stone');
  kit.box(HU - 3, -0.1, 2, 2.5, 3.6, 17, 'plinth');
  kit.box(HU - 3, 3.5, 2, 2.9, 0.2, 17.4, 'accent');
  kit.box(HU - 5, -0.1, -15, 7, 3.2, 6, 'plinth');
  kit.box(HU - 5, 3.1, -15, 7.6, 0.2, 6.6, 'dome');

  // бутки (трафики, брза храна) по западната страна, кон шеталиштето: OSM ги води како една зграда
  const K = item.parts?.kiosks;
  if (K) {
    skipOsm(ctx, K.osmId);
    const kv = K.polys[0][0].map(([x, z]) => -(x - cx) * az + (z - cz) * ax);
    const v0 = HV + 0.3;
    const v1 = Math.max(...kv) - 0.5;
    const d = Math.min(5, v1 - v0 - 1.5);
    const cols = ['facade1', 'green', 'mosaic1', 'facade5', 'crestGold'];
    let k = 0;
    for (let u = -HU + 4; u < HU - 2; u += 4.6) {
      const c = cols[k++ % cols.length];
      kit.box(u, -0.1, v0 + d / 2, 4.2, 2.9, d, 'facade4');
      kit.box(u, 2.8, v0 + d / 2, 4.5, 0.25, d + 0.3, 'tin');
      kit.box(u, 2.1, v0 + d + 0.5, 4.2, 0.6, 1.0, c); // тенда кон шеталиштето
      kit.box(u, 0.9, v0 + d + 0.03, 3.4, 1.2, 0.06, 'window', 0, 0.6); // излог
      if (k % 2) {
        // чадор (син-бел) со маси пред бутката
        const vu = v0 + d + 2.6;
        kit.cylinder(u, -0.1, vu, 0.05, 2.4, 'metal', { seg: 4 });
        kit.cone(u, 2.0, vu, 1.6, 0.6, k % 4 === 1 ? 'crestBlue' : 'accent', { seg: 8 });
      }
    }
  }

  // рефлектори на столбови
  for (const [u, v] of [[-18, -HV + 9], [HU - 12, -HV + 9], [-10, HV - 3], [HU - 12, HV - 3]]) {
    kit.cylinder(u, 0, v, 0.14, 13, 'metal', { seg: 6 });
    kit.box(u, 13, v, 1.6, 0.9, 0.3, 'light');
  }
}

function skipOsm(ctx, osmId) {
  const ids = ctx.buildings.arrays.osmId;
  for (let b = 0; b < ids.length; b++) if (ids[b] === osmId) ctx.skip.add(b);
}
