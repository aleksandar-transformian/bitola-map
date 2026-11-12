// Музејот на Битола (поранешна воена академија/касарна) — рачно, според фотографии и OSM
// (r17362023: основа со внатрешен двор). Жолта двокатна зграда околу двор: розовокафеав
// сокл со подрумски прозорчиња (кон улицата „Св. Климент Охридски“ теренот паѓа и соклот е
// од рустичен камен); бели рамки на прозорците, бели пиластри и камени аглови, бел венец меѓу
// катовите и под стреата; четиристрешен покрив од ќерамиди со многу оџаци. Главната фасада
// (југоисток) има среден ризалит: камено приземје со лачна врата и два лачни прозорци,
// табла над вратата, железен балкон на конзоли со фенери, три прозорци на катот и барокен
// забат со картуш. Пред неа градина со камен ѕид и железна ограда (OSM), порта со столбови
// и фенери, патека од калдрма и бистата на Даме Груев.
//
// Рамка: u по долгата страна кон југоисток (главната фасада е на +u), v кон југозапад;
// улицата е на −v. Мерките (m) се од OSM.

import * as THREE from 'three';
import { Kit } from './kit.js';
import { onFace, facePos, disc } from './facade.js';

const PI = Math.PI;
const AX = 0.84352; // долгата оска
const AZ = 0.53709;
const OU = 40.2; // надворешен правоаголник: половина должина
const OV = 24.9; //                          половина ширина
const IU = [-20.5, 21.9]; // двор (u)
const IV = [-12.1, 11.7]; // двор (v)
const RS = { u: 43.7, v0: -6.9, v1: 6.3 }; // ризалит на главната фасада (југоисток)
const RN = { u: -43.7, v0: -7.1, v1: 6.6 }; // заден ризалит (северозапад)
const SOCLE = 1.3;
const BELT = 5.6;
const EAVE = 10.4;
const RISE = 3.6; // висина на покривот

// ───────────────────────── прозорци ─────────────────────────

/** Прозорец со сегментен лак, бела рамка и клучен камен; решетка (бели летви). */
function win(kit, face, c, s, y0, w, h, { part = 'window' } = {}) {
  const [u, v] = facePos(face, c, s);
  const at = (y, z = 0) => onFace(face, u, y, v).multiply(new THREE.Matrix4().makeTranslation(0, 0, z));
  kit.add(new THREE.BoxGeometry(w + 0.5, h + 0.4, 0.08).translate(0, h / 2, 0), at(y0 - 0.2), 'accent');
  kit.add(disc((w + 0.5) / 2, 0.08, 14).scale(1, 0.38, 1), at(y0 + h + 0.2), 'accent');
  kit.add(new THREE.BoxGeometry(w, h, 0.14).translate(0, h / 2, 0), at(y0), part);
  kit.add(disc(w / 2, 0.14, 14).scale(1, 0.32, 1), at(y0 + h), part);
  kit.add(new THREE.BoxGeometry(0.06, h, 0.06).translate(0, h / 2, 0.09), at(y0), 'accent');
  kit.add(new THREE.BoxGeometry(w, 0.06, 0.06).translate(0, h * 0.62, 0.09), at(y0), 'accent');
  kit.add(new THREE.BoxGeometry(w + 0.7, 0.1, 0.22).translate(0, 0, 0.08), at(y0 - 0.25), 'accent'); // подпрозорник
}

/** Подрумско прозорче (темно, со решетка) во соклот. */
function cellar(kit, face, c, s, y) {
  const [u, v] = facePos(face, c, s);
  kit.add(new THREE.BoxGeometry(0.75, 0.32, 0.08).translate(0, 0.16, 0), onFace(face, u, y, v), 'metal');
}

/** Пиластер (бела вертикална лента) или камен агол. */
function pilaster(kit, face, c, s, y0, h, { w = 0.55, part = 'accent' } = {}) {
  const [u, v] = facePos(face, c, s);
  kit.add(new THREE.BoxGeometry(w, h, 0.16).translate(0, h / 2, 0.04), onFace(face, u, y0, v), part);
}

/**
 * Фасада по отсечка [s0, s1] на лицето: прозорци на два ката на чекор `step`, пиластри на
 * секои `group` прозорци, подрумски прозорчиња; skip(s) = без прозорец (ризалит).
 */
function facadeRun(kit, face, c, s0, s1, { step = 3.4, group = 4, gl, skip = () => false, cellars = true } = {}) {
  const n = Math.max(1, Math.floor((s1 - s0) / step));
  const st = (s1 - s0) / n;
  for (let i = 0; i < n; i++) {
    const s = s0 + (i + 0.5) * st;
    if (skip(s)) continue;
    win(kit, face, c, s, 1.8, 1.15, 2.3);
    win(kit, face, c, s, BELT + 1.0, 1.15, 2.3);
    if (!cellars) continue;
    cellar(kit, face, c, s, 0.35);
    if (gl < -0.6) cellar(kit, face, c, s, -0.9); // повисок сокл кон улицата
  }
  for (let i = 0; i <= n; i += group) pilaster(kit, face, c, s0 + i * st, SOCLE, EAVE - SOCLE - 0.7);
}

// ───────────────────────── покрив ─────────────────────────

/** Четиристрешен покрив околу двор: надворешни и внатрешни коси површини до слеме по средина. */
function ringRoof(kit, out, inn, y, rise, over) {
  const O = [[out[0] - over, out[2] - over], [out[1] + over, out[2] - over], [out[1] + over, out[3] + over], [out[0] - over, out[3] + over]];
  const I = [[inn[0] + over, inn[2] + over], [inn[1] - over, inn[2] + over], [inn[1] - over, inn[3] - over], [inn[0] + over, inn[3] - over]];
  const R = O.map((o, k) => [(o[0] + I[k][0]) / 2, (o[1] + I[k][1]) / 2]);
  const pos = [];
  const nor = [];
  const tri = (a, b, c) => {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const C = new THREE.Vector3(...c);
    const n = B.clone().sub(A).cross(C.clone().sub(A)).normalize();
    if (n.y < 0) {
      n.negate();
      pos.push(...a, ...c, ...b);
    } else pos.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k++) nor.push(n.x, n.y, n.z);
  };
  const ye = y - over * (rise / ((out[1] - inn[1]) / 2)); // стреата малку пониско
  for (let k = 0; k < 4; k++) {
    const k2 = (k + 1) % 4;
    for (const [E, ey] of [[O, ye], [I, ye]]) {
      const a = [E[k][0], ey, E[k][1]];
      const b = [E[k2][0], ey, E[k2][1]];
      const c = [R[k2][0], y + rise, R[k2][1]];
      const d = [R[k][0], y + rise, R[k][1]];
      tri(a, b, c);
      tri(a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  kit.add(g, Kit.at(0, 0, 0), 'roof');
  return R;
}

/** Барокен забат: средишен заоблен дел со „уши“ и картуш (во рамнината x–y). */
function baroque(w, h) {
  const s = new THREE.Shape();
  const hw = w / 2;
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  s.quadraticCurveTo(hw * 0.75, h * 0.15, hw * 0.62, h * 0.45);
  s.quadraticCurveTo(hw * 0.45, h * 0.5, hw * 0.42, h * 0.62);
  s.quadraticCurveTo(hw * 0.3, h * 1.02, 0, h);
  s.quadraticCurveTo(-hw * 0.3, h * 1.02, -hw * 0.42, h * 0.62);
  s.quadraticCurveTo(-hw * 0.45, h * 0.5, -hw * 0.62, h * 0.45);
  s.quadraticCurveTo(-hw * 0.75, h * 0.15, -hw, 0);
  return new THREE.ExtrudeGeometry(s, { depth: 0.45, bevelEnabled: false, curveSegments: 8 });
}

function lantern(kit, u, y, v) {
  kit.cylinder(u, y, v, 0.18, 0.5, 'light', { top: 0.24, seg: 4, rotY: PI / 4 });
  kit.cone(u, y + 0.5, v, 0.28, 0.3, 'metal', { seg: 4, rotY: PI / 4 });
}

// ───────────────────────── зграда ─────────────────────────

function building(kit, item, ctx, toWorld, g0) {
  const gy = (u, v) => ctx.hf.sample(...toWorld(u, v)) - g0;
  const outer = item.polys[0][0];
  const holes = item.polys[0].slice(1);
  const gmin = item.ground.min - g0;
  // маса: сокл (розово-кафеав), ѕид (жолт), венци
  kit.slab([outer, ...holes], item.ground.min - 0.6, g0 + SOCLE, 'peach');
  kit.slab([outer, ...holes], g0 + SOCLE, g0 + EAVE, 'ochre');
  const keep = kit.frame.clone();
  // венци и рустика на соклот (во рамката, по надворешниот правоаголник и дворот)
  const band = (y, h, d, part) => {
    for (const [u0, u1, v0, v1] of [[-OU, OU, -OV, OV]]) {
      kit.box((u0 + u1) / 2, y, v0 - d / 2 + 0.02, u1 - u0 + 2 * d, h, d, part);
      kit.box((u0 + u1) / 2, y, v1 + d / 2 - 0.02, u1 - u0 + 2 * d, h, d, part);
      kit.box(u0 - d / 2 + 0.02, y, (v0 + v1) / 2, d, h, v1 - v0, part);
      kit.box(u1 + d / 2 - 0.02, y, (v0 + v1) / 2, d, h, v1 - v0, part);
    }
    // ризалитите
    for (const R of [RS, RN]) {
      const sg = Math.sign(R.u);
      kit.box(R.u + sg * (d / 2 - 0.02), y, (R.v0 + R.v1) / 2, d, h, R.v1 - R.v0 + 2 * d, part);
      for (const v of [R.v0 - d / 2 + 0.02, R.v1 + d / 2 - 0.02]) kit.box((R.u + sg * OU) / 2, y, v, Math.abs(R.u) - OU + d, h, d, part);
    }
  };
  band(BELT, 0.32, 0.22, 'accent');
  band(EAVE - 0.75, 0.25, 0.25, 'accent');
  band(EAVE - 0.45, 0.45, 0.6, 'accent');
  band(SOCLE - 0.15, 0.2, 0.16, 'accent');
  // рустика кон улицата (повисок камен сокл)
  for (let y = gmin - 0.3; y < SOCLE - 0.3; y += 0.5) kit.box(0, y, -OV - 0.05, 2 * OU, 0.05, 0.1, 'plinth');

  // ── фасади ──
  const glStreet = gy(0, -OV - 2);
  facadeRun(kit, '-v', -OV - 0.02, -OU + 1, OU - 1, { gl: glStreet }); // улица (североисток): s = −u
  facadeRun(kit, '+v', OV + 0.02, -OU + 1, OU - 1, { gl: 0 }); // југозапад
  // главна фасада (+u): крила од двете страни на ризалитот (s = −v)
  facadeRun(kit, '+u', OU + 0.02, -OV + 0.8, -RS.v1 - 0.6, { step: 3.5, group: 10, gl: 0 });
  facadeRun(kit, '+u', OU + 0.02, -RS.v0 + 0.6, OV - 0.8, { step: 3.5, group: 10, gl: 0 });
  facadeRun(kit, '-u', -OU - 0.02, -OV + 0.8, RN.v0 - 0.6, { step: 3.5, group: 10, gl: 0 });
  facadeRun(kit, '-u', -OU - 0.02, RN.v1 + 0.6, OV - 0.8, { step: 3.5, group: 10, gl: 0 });
  // заден ризалит: три прозорци на кат
  for (const v of [RN.v0 + 2.6, (RN.v0 + RN.v1) / 2, RN.v1 - 2.6]) {
    win(kit, '-u', RN.u - 0.02, v, 1.8, 1.15, 2.3);
    win(kit, '-u', RN.u - 0.02, v, BELT + 1.0, 1.15, 2.3);
  }
  // камени аглови (бели) на аглите на зградата и ризалитите
  for (const [u, v] of [[-OU, -OV], [OU, -OV], [OU, OV], [-OU, OV], [RS.u, RS.v0], [RS.u, RS.v1], [RN.u, RN.v0], [RN.u, RN.v1]]) {
    for (let y = SOCLE; y < EAVE - 0.8; y += 0.7) kit.box(u, y, v, 0.85 + ((y * 10) % 2 > 1 ? 0.3 : 0), 0.62, 0.85, 'accent');
  }
  // ── внатрешен двор (според фотографии): бетон со трева, сив сокл, прозорци со рамки, лачни
  // врати со бели рамки и скали, на задната страна подигнато бетонско плато со врата ──
  kit.frame.copy(keep);
  const [iu0, iu1] = IU;
  const [iv0, iv1] = IV;
  kit.box((iu0 + iu1) / 2, -0.3, (iv0 + iv1) / 2, iu1 - iu0, 0.36, iv1 - iv0, 'paving');
  for (const [x, z, w, d] of [[-6, -3, 9, 3], [8, 4, 7, 2.5], [2, -7, 5, 2]]) kit.box(x, -0.26, z, w, 0.34, d, 'green');
  const doorAt = new Set(['+v', '-v']); // по една лачна врата на долгите страни
  for (const [face, c, s0, s1] of [
    ['+v', iv0 + 0.02, iu0 + 1, iu1 - 1],
    ['-v', iv1 - 0.02, -iu1 + 1, -iu0 - 1],
    ['+u', iu0 + 0.02, -iv1 + 1, -iv0 - 1],
    ['-u', iu1 - 0.02, iv0 + 1, iv1 - 1],
  ]) {
    const sd = (s0 + s1) / 2 + 4; // место за вратата
    facadeRun(kit, face, c, s0, s1, { step: 2.9, group: 5, cellars: false, skip: (s) => doorAt.has(face) && Math.abs(s - sd) < 1.8 });
    const [mu, mv] = facePos(face, c, (s0 + s1) / 2);
    kit.add(new THREE.BoxGeometry(s1 - s0 + 2, 1.0, 0.06).translate(0, 0.4, 0.02), onFace(face, mu, 0, mv), 'stone'); // сив сокл
    if (doorAt.has(face)) {
      const [u, v] = facePos(face, c, sd);
      const at = (y, z = 0) => onFace(face, u, y, v).multiply(new THREE.Matrix4().makeTranslation(0, 0, z));
      kit.add(new THREE.BoxGeometry(2.0, 2.4, 0.16).translate(0, 1.2, 0), at(0.45), 'wood');
      kit.add(disc(1.0, 0.16, 14), at(2.85), 'wood');
      kit.add(new THREE.TorusGeometry(1.2, 0.2, 4, 14, PI), at(2.85, 0.06), 'accent');
      for (const ds of [-1.2, 1.2]) kit.add(new THREE.BoxGeometry(0.4, 2.4, 0.16).translate(ds, 1.2, 0.06), at(0.45), 'accent');
      kit.add(new THREE.BoxGeometry(3.2, 0.45, 1.4).translate(0, 0.22, 0.7), at(0), 'stone');
    }
  }
  // плато пред задното крило (кон дворот), со врата и две слепи ниши
  kit.box(iu0 + 2.2, -0.2, (iv0 + iv1) / 2, 4.4, 0.85, 12, 'stone');
  for (let i = 0; i < 3; i++) kit.box(iu0 + 4.6 + i * 0.35, -0.2, (iv0 + iv1) / 2, 0.36, 0.65 - i * 0.2, 6, 'stone');

  // ── покрив, оџаци ──
  kit.frame.copy(keep);
  const R = ringRoof(kit, [-OU, OU, -OV, OV], [IU[0], IU[1], IV[0], IV[1]], EAVE, RISE, 0.6);
  for (const R2 of [RS, RN]) {
    const sg = Math.sign(R2.u);
    kit.hip(R2.u - sg * 3.5, EAVE - 0.05, (R2.v0 + R2.v1) / 2, 8.5, RISE * 0.85, R2.v1 - R2.v0 + 1.2, 'roof');
  }
  // оџаци по слемето
  for (let k = 0; k < 4; k++) {
    const a = R[k];
    const b = R[(k + 1) % 4];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.round(len / 9);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      kit.box(a[0] + (b[0] - a[0]) * t, EAVE + RISE - 0.6, a[1] + (b[1] - a[1]) * t, 0.7, 2.0, 0.9, 'mosaic1');
      kit.box(a[0] + (b[0] - a[0]) * t, EAVE + RISE + 1.4, a[1] + (b[1] - a[1]) * t, 0.9, 0.15, 1.1, 'accent');
    }
  }

  // ── главен ризалит ──
  const vc = (RS.v0 + RS.v1) / 2;
  const c = RS.u + 0.02;
  const sc = -vc; // s на лицето '+u'
  // камено приземје
  kit.box(RS.u - 1.6, gmin - 0.5, vc, 3.4, BELT - gmin + 0.5, RS.v1 - RS.v0 + 0.1, 'stone');
  for (let y = SOCLE; y < BELT; y += 0.55) kit.box(RS.u + 0.06, y, vc, 0.1, 0.05, RS.v1 - RS.v0, 'plinth');
  // лачна врата со камен лак и скали
  const [du, dv] = facePos('+u', c, sc);
  kit.add(new THREE.BoxGeometry(2.0, 2.6, 0.18).translate(0, 1.3, 0.04), onFace('+u', du, SOCLE - 0.4, dv), 'wood');
  kit.add(disc(1.0, 0.18, 16), onFace('+u', du, SOCLE + 2.2, dv).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.04)), 'window');
  kit.add(new THREE.TorusGeometry(1.25, 0.28, 4, 16, PI), onFace('+u', du, SOCLE + 2.2, dv).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.1)), 'accent');
  for (const ds of [-1.25, 1.25]) pilaster(kit, '+u', c + 0.06, sc + ds, SOCLE - 0.4, 2.6, { w: 0.5 });
  for (let i = 0; i < 3; i++) kit.box(RS.u + 0.5 + i * 0.4, gmin - 0.5, vc, 0.45, SOCLE - gmin - i * 0.4 + 0.1, 4 - i * 0.3, 'stone');
  // табла над вратата (зелено-златна)
  kit.add(new THREE.BoxGeometry(2.6, 0.7, 0.08), onFace('+u', du, BELT - 0.5, dv).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.08)), 'crestGold');
  // два лачни прозорци долу
  for (const ds of [-3.4, 3.4]) win(kit, '+u', c, sc + ds, 1.9, 1.4, 2.6);
  // кат: три прозорци, железен балкон на конзоли, фенери
  for (const ds of [-3.4, 0, 3.4]) win(kit, '+u', c, sc + ds, BELT + 1.0, 1.2, 2.3);
  const bw = RS.v1 - RS.v0 - 0.6;
  kit.box(RS.u + 0.75, BELT + 0.25, vc, 1.5, 0.18, bw, 'stone');
  for (const t of [-0.45, -0.15, 0.15, 0.45]) kit.box(RS.u + 0.4, BELT - 0.35, vc + t * bw, 0.8, 0.6, 0.2, 'metal');
  kit.box(RS.u + 1.45, BELT + 1.35, vc, 0.06, 0.06, bw, 'metal');
  for (let t = -bw / 2; t <= bw / 2; t += 0.25) kit.box(RS.u + 1.45, BELT + 0.43, vc + t, 0.04, 0.92, 0.04, 'metal');
  for (const t of [-bw / 2, bw / 2]) kit.box(RS.u + 0.75, BELT + 1.35, vc + t, 1.5, 0.06, 0.06, 'metal');
  for (const t of [-0.48, -0.22, 0.22, 0.48]) lantern(kit, RS.u + 0.6, BELT - 1.2, vc + t * bw);
  // барокен забат со картуш, оџаци до него
  kit.add(baroque(7.2, 2.8), onFace('+u', RS.u - 0.4, EAVE, vc).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0)), 'accent');
  kit.add(disc(0.7, 0.2, 14).scale(0.8, 1, 1), onFace('+u', RS.u + 0.06, EAVE + 1.3, vc), 'crestGold');
  kit.box(RS.u - 1.2, EAVE + 2.6, vc, 0.7, 1.4, 0.7, 'mosaic1');
  for (const t of [-0.42, 0.42]) kit.box(RS.u - 1.5, EAVE + 0.6, vc + t * (RS.v1 - RS.v0), 0.7, 1.9, 0.7, 'mosaic1');
}

// ───────────────────────── градина ─────────────────────────

/**
 * Камен ѕид со железна ограда по отсечка (во рамката), со отвор [g0, g1] по должината.
 * Се дели на делови од ~3 m; секој дел е наведнат од висината на теренот на почетокот до
 * онаа на крајот, па ѕидот, капакот и решетката се непрекинати (без скалила меѓу деловите).
 */
function fence(kit, gy, a, b, wallH, gap) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tu = (b[0] - a[0]) / len;
  const tv = (b[1] - a[1]) / len;
  const rot = Math.atan2(-tv, tu);
  const pieces = [];
  for (const [p0, p1] of gap ? [[0, gap[0]], [gap[1], len]] : [[0, len]]) {
    const n = Math.max(1, Math.round((p1 - p0) / 3));
    for (let k = 0; k < n; k++) pieces.push([p0 + ((p1 - p0) * k) / n, p0 + ((p1 - p0) * (k + 1)) / n]);
  }
  const yAt = (d) => gy(a[0] + tu * d, a[1] + tv * d);
  for (const [s0, s1] of pieces) {
    const L = s1 - s0;
    if (L < 0.3) continue;
    const m = (s0 + s1) / 2;
    const u = a[0] + tu * m;
    const v = a[1] + tv * m;
    const ya = yAt(s0);
    const yb = yAt(s1);
    const y = (ya + yb) / 2;
    const k = (yb - ya) / L; // наклон по должината
    // геометријата се „наведнува“: секое теме добива k·x по висина
    const shear = (g) => {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + k * p.getX(i));
      g.computeVertexNormals();
      return g;
    };
    const add = (g, dy, part) => kit.add(shear(g.translate(0, dy, 0)), Kit.at(u, y, v, rot), part);
    add(new THREE.BoxGeometry(L, wallH + 1.2, 0.55).translate(0, (wallH + 1.2) / 2, 0), -1.2, 'stone');
    add(new THREE.BoxGeometry(L + 0.02, 0.14, 0.65), wallH, 'stone');
    add(new THREE.BoxGeometry(L, 0.05, 0.05), wallH + 0.25, 'metal');
    add(new THREE.BoxGeometry(L, 0.05, 0.05), wallH + 1.45, 'metal');
    for (let d = -L / 2 + 0.1; d < L / 2; d += 0.2) add(new THREE.BoxGeometry(0.035, 1.55, 0.035).translate(d, 0.78, 0), wallH, 'metal');
    add(new THREE.BoxGeometry(0.08, 1.75, 0.08).translate(-L / 2, 0.88, 0), wallH, 'metal');
  }
}

function garden(kit, item, gy) {
  const FU = 57; // предната ограда (OSM w1349538634/5)
  const FV0 = -29.2; // кон улицата
  const FV1 = 20.3;
  const vc = (RS.v0 + RS.v1) / 2;
  const gw = 1.8 + 2.5; // портата + заоблените ѕидови
  fence(kit, gy, [FU, FV0], [FU, FV1], 0.8, [vc - FV0 - gw, vc - FV0 + gw]);
  fence(kit, gy, [OU - 3, FV0], [FU, FV0], 1.3); // по улицата
  fence(kit, gy, [OU + 1, FV1], [FU, FV1], 0.8);
  // порта (според фотографијата): вовлечена 2.5 m во градината; од столбовите кон оградата
  // заоблени ниски ѕидови со решетка (вдлабнатина кон улицата), со камени столбчиња на краевите
  const GI = 2.5; // вовлекување
  const GW = 1.8; // половина ширина на портата
  for (const s of [-1, 1]) {
    // заоблен ѕид: четвртина круг со центар на оградата
    const cu = FU;
    const cv = vc + s * GW;
    const N = 5;
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * (PI / 2);
      const a1 = ((k + 1) / N) * (PI / 2);
      const p0 = [cu - GI * Math.cos(a0), cv + s * GI * Math.sin(a0)];
      const p1 = [cu - GI * Math.cos(a1), cv + s * GI * Math.sin(a1)];
      fence(kit, gy, p0, p1, 0.8);
    }
    // столб на крајот на ѕидот (на линијата на оградата)
    const ev = vc + s * (GW + GI);
    const ye = gy(FU, ev);
    kit.box(FU, ye - 0.5, ev, 0.8, 2.0, 0.8, 'stone');
    kit.box(FU, ye + 1.5, ev, 0.95, 0.15, 0.95, 'accent');
    // столб на портата со фенер
    const pv = vc + s * GW;
    const pu = FU - GI;
    const y = gy(pu, pv);
    kit.box(pu, y - 0.5, pv, 1.0, 3.1, 1.0, 'stone');
    kit.box(pu, y + 2.6, pv, 1.2, 0.2, 1.2, 'accent');
    lantern(kit, pu, y + 2.8, pv);
    // крило на портата, отворено навнатре
    kit.add(new THREE.BoxGeometry(0.06, 2.3, GW - 0.5).translate(0, 1.15, -s * (GW - 0.5) / 2), Kit.at(pu - 0.5, y, pv, s * 1.1), 'metal');
  }
  // патека од калдрма до вратата
  kit.box((RS.u + FU) / 2, gy((RS.u + FU) / 2, vc) - 0.25, vc, FU - RS.u, 0.32, 3.2, 'paving');
  // бистата на Даме Груев (OSM n12329728344)
  const B = item.parts?.bust;
  if (B) {
    const [bu, bv] = B.local;
    const y = gy(bu, bv);
    kit.box(bu, y - 0.3, bv, 0.8, 1.9, 0.8, 'stone');
    kit.box(bu, y + 1.6, bv, 0.95, 0.15, 0.95, 'accent');
    kit.sphere(bu, y + 2.1, bv, 0.3, 'bronze', { seg: 8, sy: 1.2 });
    kit.sphere(bu, y + 1.8, bv, 0.4, 'bronze', { seg: 8, sy: 0.6 });
  }
}

export function museum(kit, item, ctx) {
  const outer = item.polys[0][0];
  const us = outer.map(([x, z]) => x * AX + z * AZ);
  const vs = outer.map(([x, z]) => -x * AZ + z * AX);
  const um = (Math.min(...us) + Math.max(...us)) / 2;
  const vm = (Math.min(...vs) + Math.max(...vs)) / 2;
  const cx = um * AX - vm * AZ;
  const cz = um * AZ + vm * AX;
  const g0 = item.ground.mean;
  const toWorld = (u, v) => [cx + AX * u - AZ * v, cz + AZ * u + AX * v];
  const gy = (u, v) => ctx.hf.sample(...toWorld(u, v)) - g0;
  if (item.parts?.bust) {
    const [x, z] = item.parts.bust.center;
    item.parts.bust.local = [(x - cx) * AX + (z - cz) * AZ, -(x - cx) * AZ + (z - cz) * AX];
  }
  kit.setFrame(cx, g0, cz, AX, AZ);
  building(kit, item, ctx, toWorld, g0);
  kit.setFrame(cx, g0, cz, AX, AZ);
  garden(kit, item, gy);
  kit.setFrame(cx, g0, cz, AX, AZ);
  fountainPlaza(kit, gy);
}

/**
 * Плоштадот со фонтаните пред музејот (кон аголот „Св. Климент Охридски“ / „Партизанска“):
 * поплочен простор, два правоаголни камени базени со млазови, дрвени клупи, долга леа со
 * чемпреси и цвеќе (обрабена со клупи), тревници со цвеќе и топчести грмушки, светилки.
 * Во OSM нема — местото е од сателит (меѓу тротоарите на двете улици).
 */
function fountainPlaza(kit, gy) {
  const P = [[70, -37], [70, 10], [97, -14], [99, -22], [86, -39]];
  const y0 = (u, v) => gy(u, v);
  // поплочување по многуаголникот (во рамката: плоча со истиснат облик)
  const sh = new THREE.Shape(P.map(([u, v]) => new THREE.Vector2(u, -v)));
  // плоча доволно длабока за да не „лебди“ над теренот што паѓа кон улицата
  const ys = P.map(([u, v]) => y0(u, v));
  const top = Math.max(...ys) + 0.08;
  const geo = new THREE.ExtrudeGeometry(sh, { depth: top - Math.min(...ys) + 0.6, bevelEnabled: false }).rotateX(-PI / 2);
  kit.add(geo, Kit.at(0, Math.min(...ys) - 0.6, 0), 'paving');
  const y = () => top;
  // тревници со цвеќе по западниот раб (кон градината на музејот) и кон улицата
  for (const [u, v, w, d] of [[73, -8, 5, 22], [80, -35.5, 9, 3]]) {
    kit.box(u, y(u, v) - 0.25, v, w, 0.4, d, 'green');
    for (let k = -1; k <= 1; k++) kit.box(u, y(u, v) + 0.15, v + (k * d) / 4, w * 0.6, 0.12, 0.8, 'mosaic1');
    for (const s of [-1, 1]) kit.sphere(u + s * (w / 2 - 0.8), y(u, v) + 0.6, v + s * (d / 2 - 1), 0.65, 'green', { seg: 8 });
  }
  // два камени базени со млазови, свртени по улицата
  for (const [u, v] of [[79, -26], [91, -24]]) {
    const yy = y(u, v);
    kit.box(u, yy - 0.3, v, 9, 1.1, 3.6, 'stone', 0.25);
    kit.box(u, yy + 0.72, v, 8.4, 0.05, 3.0, 'water', 0.25);
    for (let k = -3; k <= 3; k++) {
      const du = k * 1.1;
      kit.cylinder(u + du * Math.cos(0.25), yy + 0.75, v - du * Math.sin(0.25), 0.08, 1.4 + (k % 2 ? 0 : 0.5), 'water', { top: 0.02, seg: 5 });
    }
  }
  // долга леа со чемпреси и цвеќе, обрабена со дрвени клупи
  {
    const [u, v] = [84, -12];
    const yy = y(u, v);
    kit.box(u, yy - 0.2, v, 2.6, 0.7, 9, 'wood', -0.6);
    kit.box(u, yy + 0.45, v, 1.6, 0.1, 8, 'trunk', -0.6);
    for (let k = -1; k <= 1; k++) {
      const d = k * 2.8;
      kit.cone(u + d * Math.sin(-0.6), yy + 0.5, v + d * Math.cos(-0.6), 0.45, 2.6, 'green', { seg: 7 });
      kit.box(u + (d + 1.3) * Math.sin(-0.6), yy + 0.55, v + (d + 1.3) * Math.cos(-0.6), 0.9, 0.12, 0.6, 'mosaic1', -0.6);
    }
  }
  // самостојни клупи и светилки
  for (const [u, v, r] of [[76, -19, 0.25], [92, -17, 0.25], [88, -32, 0.25]]) {
    kit.box(u, y(u, v) + 0.1, v, 3.2, 0.42, 0.7, 'wood', r);
    kit.box(u, y(u, v) - 0.1, v, 2.6, 0.25, 0.4, 'stone', r);
  }
  for (const [u, v] of [[73, -30], [74, 4], [95, -19]]) {
    kit.cylinder(u, y(u, v), v, 0.08, 4.2, 'metal', { seg: 6 });
    kit.cylinder(u, y(u, v) + 4.2, v, 0.5, 0.12, 'light', { top: 0.2, seg: 8 });
  }
}
