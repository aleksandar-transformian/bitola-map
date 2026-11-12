// Спортската сала „Боро Чурлевски“ („Младост“) — рачно, според фотографии и OSM (w38006427).
// Модернистичка сала: ниско главно тело од сив ребрест бетон; над него вовлечена висока сала
// со појас од сини лимени панели и наборен бетонски венец (вертикални наборени плочи, горниот
// раб скалесто се крева и спушта); рамен покрив со ленти светларници. Напред (кон паркингот,
// север-северозапад) и назад приземни предворја: стаклени фасади со зелени рамки и обоени
// полиња, конзолна стреа со наборен венец, широки скали; пред салата знамиња.
//
// Рамка: u по предната фасада, v кон паркингот (напред); почеток = центарот на главното тело.
// Мерките се од OSM основата (главно тело 75.6 × 69.5 m, предворја 54.6 × 8.5 m).

import * as THREE from 'three';
import { Kit } from './kit.js';

const PI = Math.PI;
const AX = Math.cos((153.5 * PI) / 180); // оската u (по фасадата)
const AZ = Math.sin((153.5 * PI) / 180);
const HU = 37.8; // главно тело: половина должина (u)
const HV = 34.75; // главно тело: половина длабочина (v)
const LOBBY = [
  { u0: -25.6, u1: 29.0, v0: HV, v1: 43.0, front: true },
  { u0: -24.6, u1: 28.9, v0: -43.0, v1: -HV, front: false },
];
const H_BODY = 6.6; // ниско тело (над стреата на предворјето се гледа само тесен појас)
const IN = 7.0; // вовлекување на високата сала
const H_PANEL = 10.6; // горен раб на сините панели
const H_CROWN = 13.9; // просечна висина на наборениот венец
const H_LOBBY = 5.3;
const FLOOR = 1.1; // под на предворјето (скали)

/**
 * Наборен венец по права линија (во локалната рамка): плочи широки w, наизменично свртени ±,
 * висината скокнува на секои `group` плочи (скалест горен раб).
 */
function folded(kit, a, b, y0, h, { w = 2.4, tilt = 0.32, group = 3, step = 1.0, part = 'accent', t = 0.25 } = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tu = (b[0] - a[0]) / len;
  const tv = (b[1] - a[1]) / len;
  const n = Math.max(1, Math.round(len / w));
  const ww = len / n;
  const rot = Math.atan2(-tv, tu); // локалната x-оска на кутијата по правецот a → b
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) * ww;
    const u = a[0] + tu * s;
    const v = a[1] + tv * s;
    const hh = h + (Math.floor(i / group) % 2 ? -step : 0);
    const yaw = rot + (i % 2 ? tilt : -tilt);
    kit.add(new THREE.BoxGeometry(ww / Math.cos(tilt) + 0.05, hh, t).translate(0, hh / 2, 0), Kit.at(u, y0, v, yaw), part);
  }
}

/** Правоаголник во рамката по четирите страни: fn(a, b) за секоја страна (обратно од стрелките). */
function sides(u0, u1, v0, v1, fn) {
  fn([u0, v1], [u1, v1]);
  fn([u1, v1], [u1, v0]);
  fn([u1, v0], [u0, v0]);
  fn([u0, v0], [u0, v1]);
}

function body(kit) {
  // ниско тело од сив бетон, со вертикални ребра
  kit.box(0, -0.6, 0, 2 * HU, H_BODY + 0.6, 2 * HV, 'stone');
  kit.box(0, H_BODY, 0, 2 * HU + 0.4, 0.35, 2 * HV + 0.4, 'accent');
  for (let u = -HU + 1; u < HU; u += 2.2) for (const v of [-HV - 0.06, HV + 0.06]) kit.box(u, 0, v, 0.18, H_BODY, 0.12, 'plinth');
  for (let v = -HV + 1; v < HV; v += 2.2) for (const u of [-HU - 0.06, HU + 0.06]) kit.box(u, 0, v, 0.12, H_BODY, 0.18, 'plinth');

  // висока сала: појас од сини панели со столбови, рамен покрив со светларници
  const su = HU - IN;
  const sv = HV - IN;
  kit.box(0, H_BODY, 0, 2 * su, H_PANEL - H_BODY, 2 * sv, 'dome');
  for (let u = -su; u <= su + 0.01; u += (2 * su) / 10) for (const v of [-sv - 0.08, sv + 0.08]) kit.box(u, H_BODY, v, 0.25, H_PANEL - H_BODY, 0.2, 'metal');
  for (let v = -sv; v <= sv + 0.01; v += (2 * sv) / 9) for (const u of [-su - 0.08, su + 0.08]) kit.box(u, H_BODY, v, 0.2, H_PANEL - H_BODY, 0.25, 'metal');
  kit.box(0, H_PANEL, 0, 2 * su - 0.6, H_CROWN - H_PANEL - 0.9, 2 * sv - 0.6, 'stone'); // покрив
  for (let v = -sv + 5; v < sv - 3; v += 7) kit.box(0, H_CROWN - 0.9, v, 2 * su - 6, 0.35, 1.2, 'window', 0, 0.2); // светларници
  // наборен венец околу салата (малку истурен над панелите)
  sides(-su - 0.4, su + 0.4, -sv - 0.4, sv + 0.4, (a, b) => folded(kit, a, b, H_PANEL - 0.2, H_CROWN - H_PANEL + 0.2));
}

function lobby(kit, { u0, u1, v0, v1, front }) {
  const out = front ? 1 : -1; // нанадвор по v
  const vo = front ? v1 : v0; // надворешното лице
  const cu = (u0 + u1) / 2;
  const cv = (v0 + v1) / 2;
  const w = u1 - u0;
  const d = v1 - v0;
  kit.box(cu, -0.6, cv, w, FLOOR + 0.6, d, 'stone'); // подиум
  kit.box(cu, FLOOR, cv - out * 0.6, w - 0.4, H_LOBBY - FLOOR, d - 1.2, 'window', 0, 0.35); // стаклена фасада (вовлечена)
  // обоени полиња долу (лево црвено, десно жолто) и зелени рамки
  const vf = vo - out * 1.15;
  kit.box(cu - w / 4, FLOOR, vf, w / 2 - 0.6, 1.6, 0.1, 'mosaic1');
  kit.box(cu + w / 4, FLOOR, vf, w / 2 - 0.6, 1.6, 0.1, 'ochre');
  for (let u = u0 + 0.2; u <= u1; u += 2.7) kit.box(u, FLOOR, vf + out * 0.06, 0.14, H_LOBBY - FLOOR, 0.14, 'green');
  kit.box(cu, FLOOR + 2.6, vf + out * 0.06, w - 0.4, 0.14, 0.14, 'green');
  // конзолна стреа со наборен венец
  const vs = vo + out * 1.8;
  kit.box(cu, H_LOBBY, (vs + (front ? v0 : v1)) / 2, w + 3, 0.35, Math.abs(vs - (front ? v0 : v1)), 'accent');
  folded(kit, front ? [u0 - 1.5, vs] : [u1 + 1.5, vs], front ? [u1 + 1.5, vs] : [u0 - 1.5, vs], H_LOBBY - 0.15, 1.05, { w: 1.5, tilt: 0.38, group: 1000, step: 0 });
  // скали (по целата ширина на предворјето)
  for (let i = 0; i < 6; i++) {
    const h = FLOOR - (i * FLOOR) / 6;
    kit.box(cu, -0.6, vo + out * (0.25 + i * 0.4), w - 6, h + 0.6, 0.42, 'stone');
  }
}

export function sportsHall(kit, item) {
  // центар: средина на опсегот на основата во (u, v) (предворјата се речиси симетрични)
  const ring = item.polys[0][0];
  const us = ring.map(([x, z]) => x * AX + z * AZ);
  const vs = ring.map(([x, z]) => -x * AZ + z * AX);
  const um = (Math.min(...us) + Math.max(...us)) / 2;
  const vm = (Math.min(...vs) + Math.max(...vs)) / 2;
  const cx = um * AX - vm * AZ;
  const cz = um * AZ + vm * AX;
  kit.setFrame(cx, item.ground.min, cz, AX, AZ);
  body(kit);
  for (const L of LOBBY) lobby(kit, L);
  // знамиња пред салата
  for (const u of [-18, -6]) {
    kit.cylinder(u, 0, 48.5, 0.08, 9, 'metal', { seg: 5 });
    kit.box(u + 0.7, 7.4, 48.5, 1.4, 1.5, 0.04, 'mosaic1');
  }
}
