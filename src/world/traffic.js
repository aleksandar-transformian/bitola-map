// „Живот на мапата“: автомобили по улиците и пешаци по Широк Сокак и пешачките патеки.
// Инстанцирани мешеви (едно цртање за сите автомобили, едно за сите пешаци), движење на CPU.
// Ноќе автомобилите имаат фарови (бело напред, црвено назад) — адитивни точки.
//
// Мрежата не е вистински граф: секоја OSM линија е „патека“, а на крајот возилото продолжува
// на друга патека што почнува/завршува во истата точка (или се враќа назад).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROAD_ID, ROAD_FLAG } from '../config/classes.js';

const CAR = new Set([ROAD_ID.motorway, ROAD_ID.trunk, ROAD_ID.primary, ROAD_ID.secondary, ROAD_ID.tertiary, ROAD_ID.residential]);
const SPEED = { [ROAD_ID.motorway]: 20, [ROAD_ID.trunk]: 16, [ROAD_ID.primary]: 12, [ROAD_ID.secondary]: 11, [ROAD_ID.tertiary]: 9.5, [ROAD_ID.residential]: 6.5 };
const WEIGHT = { [ROAD_ID.motorway]: 2.5, [ROAD_ID.trunk]: 3, [ROAD_ID.primary]: 4, [ROAD_ID.secondary]: 3, [ROAD_ID.tertiary]: 2.5, [ROAD_ID.residential]: 1 };
const STEP = 15; // m — патеките се згуснуваат за да го следат релјефот

const DEFAULT_COLORS = {
  cars: ['#d64545', '#f2f2f2', '#3a3d44', '#2f6db5', '#e0b23c', '#7a8c99', '#8a2d2d', '#e8e1d4', '#1f1f22'],
  people: ['#c0392b', '#2c3e50', '#e67e22', '#16a085', '#8e44ad', '#f1c40f', '#7f8c8d', '#d35400', '#2980b9', '#ecf0f1'],
};

function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Патеки од roads.bin: згуснати точки, кумулативна должина, височина од релјефот. */
function buildTracks(roads, hf, accept, keep = () => true) {
  const { linePt, coords, cls, width, flags } = roads.arrays;
  const q = roads.meta.q;
  const tracks = [];
  for (let l = 0; l < roads.meta.count; l++) {
    if (!accept(cls[l], l) || flags[l] & ROAD_FLAG.tunnel) continue;
    const xs = [];
    const zs = [];
    for (let i = linePt[l]; i < linePt[l + 1]; i++) {
      const x = coords[i * 2] * q;
      const z = coords[i * 2 + 1] * q;
      if (xs.length) {
        const px = xs[xs.length - 1];
        const pz = zs[zs.length - 1];
        const len = Math.hypot(x - px, z - pz);
        if (len < 0.05) continue;
        const k = Math.ceil(len / STEP);
        for (let j = 1; j < k; j++) {
          xs.push(px + ((x - px) * j) / k);
          zs.push(pz + ((z - pz) * j) / k);
        }
      }
      xs.push(x);
      zs.push(z);
    }
    if (xs.length < 2) continue;
    const n = xs.length;
    const cum = new Float32Array(n);
    const ys = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      ys[i] = hf.sample(xs[i], zs[i]);
      if (i) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]);
    }
    const t = { xs: Float32Array.from(xs), zs: Float32Array.from(zs), ys, cum, len: cum[n - 1], cls: cls[l], width: width[l] / 10 };
    if (keep(t)) tracks.push(t); // филтер пред соседите — индексите во next мора да се во оваа низа
  }
  // крајните точки → соседи (заеднички крај во радиус од ~3 m)
  const key = (x, z) => `${Math.round(x / 3)},${Math.round(z / 3)}`;
  const ends = new Map();
  tracks.forEach((t, i) => {
    for (const end of [0, 1]) {
      const k = end ? t.xs.length - 1 : 0;
      const kk = key(t.xs[k], t.zs[k]);
      if (!ends.has(kk)) ends.set(kk, []);
      ends.get(kk).push({ t: i, end });
    }
  });
  for (const t of tracks) {
    const n = t.xs.length - 1;
    t.next = [ends.get(key(t.xs[0], t.zs[0])) || [], ends.get(key(t.xs[n], t.zs[n])) || []];
  }
  return tracks;
}

/** Избери патека пропорционално на тежината. */
function picker(tracks, weight) {
  const cum = [];
  let total = 0;
  for (const t of tracks) cum.push((total += weight(t)));
  return (r) => {
    const v = r * total;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
}

function carGeometry() {
  const paint = (g, c) => {
    g = g.toNonIndexed();
    const a = new Float32Array(g.attributes.position.count * 3).fill(c);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  };
  const body = new THREE.BoxGeometry(4.2, 0.85, 1.8).translate(0, 0.65, 0);
  const cabin = new THREE.BoxGeometry(2.3, 0.65, 1.62).translate(-0.25, 1.4, 0);
  const g = mergeGeometries([paint(body, 1), paint(cabin, 0.62)]);
  g.scale(1.5, 1.5, 1.5); // малку поголеми од вистински — да се гледаат од висина
  return g;
}

function personGeometry() {
  const paint = (g, c) => {
    g = g.toNonIndexed();
    const col = new THREE.Color(c);
    const a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) a.set([col.r, col.g, col.b], i);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  };
  // облеката (бело × боја на инстанцата), лицето во боја на кожа (не зависи премногу од инстанцата)
  const body = new THREE.CylinderGeometry(0.2, 0.26, 1.25, 6).translate(0, 0.72, 0);
  const head = new THREE.SphereGeometry(0.19, 6, 4).translate(0, 1.55, 0);
  const g = mergeGeometries([paint(body, '#ffffff'), paint(head, '#f3d6c1')]);
  g.scale(2.1, 2.1, 2.1); // стилизирани фигури (како на макета)
  return g;
}

function lightSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.7)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * @param {object} roads roads.bin
 * @param {import('./heightfield.js').Heightfield} hf
 * @param {{night:{value:number}}} env
 * @param {{cars?: number, people?: number}} opts
 */
export function createTraffic(roads, hf, env, { cars = 700, people = 320 } = {}) {
  const r = rng(20261112);
  const group = new THREE.Group();
  group.name = 'traffic';

  // ── автомобили ──
  const carTracks = buildTracks(roads, hf, (c) => CAR.has(c));
  const pickCar = picker(carTracks, (t) => {
    const cx = t.xs[0];
    const cz = t.zs[0];
    const d = Math.hypot(cx, cz) / 900;
    return (t.len * WEIGHT[t.cls]) / (1 + d * d); // многу повеќе сообраќај во центарот
  });
  const carMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const carMesh = new THREE.InstancedMesh(carGeometry(), carMat, cars);
  carMesh.name = 'cars';
  carMesh.castShadow = false;
  carMesh.frustumCulled = false;
  carMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cars * 3), 3);
  const C = [];
  for (let i = 0; i < cars && carTracks.length; i++) {
    const t = pickCar(r());
    const tr = carTracks[t];
    C.push({ t, s: r() * tr.len, dir: r() < 0.5 ? 1 : -1, v: SPEED[tr.cls] * (0.8 + r() * 0.4), seg: 0, seed: r() });
  }

  // фарови: бело напред, црвено назад
  const sprite = lightSprite();
  const mkLights = (color, size) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cars * 3), 3));
    const mat = new THREE.PointsMaterial({ color, size, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const p = new THREE.Points(geo, mat);
    p.frustumCulled = false;
    p.visible = false;
    return p;
  };
  const heads = mkLights('#fff2d0', 9);
  const tails = mkLights('#ff3a2a', 6);

  // ── пешаци ──
  const pedTracks = buildTracks(
    roads,
    hf,
    (c) => c === ROAD_ID.pedestrian || c === ROAD_ID.footway,
    (t) => t.len > 8 && Math.hypot(t.xs[0], t.zs[0]) < 1600,
  );
  const pickPed = picker(pedTracks, (t) => t.len * (t.cls === ROAD_ID.pedestrian ? 6 : 1));
  const pedMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const pedMesh = new THREE.InstancedMesh(personGeometry(), pedMat, people);
  pedMesh.name = 'people';
  pedMesh.frustumCulled = false;
  pedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(people * 3), 3);
  const P = [];
  for (let i = 0; i < people && pedTracks.length; i++) {
    const t = pickPed(r());
    const tr = pedTracks[t];
    const half = Math.max(0, tr.width / 2 - 0.6);
    P.push({ t, s: r() * tr.len, dir: r() < 0.5 ? 1 : -1, v: 1.1 + r() * 0.5, seg: 0, off: (r() * 2 - 1) * half, seed: r() });
  }

  group.add(carMesh, heads, tails, pedMesh);

  const m = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);
  const UP = new THREE.Vector3(0, 1, 0);
  let time = 0;
  let enabled = true;

  /** Позиција и правец на агент на патеката (s во метри). */
  function sample(tr, a) {
    const { cum } = tr;
    let i = Math.min(a.seg, cum.length - 2);
    while (i < cum.length - 2 && cum[i + 1] < a.s) i++;
    while (i > 0 && cum[i] > a.s) i--;
    a.seg = i;
    const segLen = cum[i + 1] - cum[i] || 1;
    const k = Math.min(1, Math.max(0, (a.s - cum[i]) / segLen));
    const dx = (tr.xs[i + 1] - tr.xs[i]) / segLen;
    const dz = (tr.zs[i + 1] - tr.zs[i]) / segLen;
    return {
      x: tr.xs[i] + (tr.xs[i + 1] - tr.xs[i]) * k,
      z: tr.zs[i] + (tr.zs[i + 1] - tr.zs[i]) * k,
      y: tr.ys[i] + (tr.ys[i + 1] - tr.ys[i]) * k,
      dx: dx * a.dir,
      dz: dz * a.dir,
    };
  }

  /** На крајот на патеката: продолжи на соседна (или сврти). */
  function advance(tracks, a, rand, filter) {
    const tr = tracks[a.t];
    const atEnd = a.s > tr.len ? 1 : 0;
    const options = tr.next[atEnd].filter((o) => o.t !== a.t && (!filter || filter(tracks[o.t])));
    if (options.length) {
      const o = options[Math.floor(rand() * options.length)];
      const nt = tracks[o.t];
      a.t = o.t;
      a.dir = o.end === 0 ? 1 : -1;
      a.s = o.end === 0 ? 0.01 : nt.len - 0.01;
      a.seg = o.end === 0 ? 0 : nt.cum.length - 2;
    } else {
      a.dir = -a.dir;
      a.s = Math.min(tr.len, Math.max(0, a.s));
    }
  }

  function update(dt, camDist) {
    if (!enabled) return;
    dt = Math.min(dt, 0.1);
    time += dt;
    const night = env.night.value;
    // далеку од градот автомобилите се под еден пиксел — не ги ажурирај
    carMesh.visible = camDist < 7000;
    pedMesh.visible = camDist < 1800;
    heads.visible = tails.visible = carMesh.visible && night > 0.02;
    heads.material.opacity = tails.material.opacity = Math.min(1, night * 1.2);

    if (carMesh.visible) {
      const hp = heads.geometry.attributes.position.array;
      const tp = tails.geometry.attributes.position.array;
      C.forEach((a, i) => {
        a.s += a.dir * a.v * dt;
        if (a.s > carTracks[a.t].len || a.s < 0) advance(carTracks, a, r, (t) => CAR.has(t.cls));
        const tr = carTracks[a.t];
        const p = sample(tr, a);
        const lane = Math.max(1.8, tr.width / 4);
        const x = p.x - p.dz * lane;
        const z = p.z + p.dx * lane;
        pos.set(x, p.y + 0.15, z);
        quat.setFromAxisAngle(UP, Math.atan2(-p.dz, p.dx));
        m.compose(pos, quat, scl);
        carMesh.setMatrixAt(i, m);
        hp[i * 3] = x + p.dx * 3.3;
        hp[i * 3 + 1] = p.y + 1.1;
        hp[i * 3 + 2] = z + p.dz * 3.3;
        tp[i * 3] = x - p.dx * 3.3;
        tp[i * 3 + 1] = p.y + 1.1;
        tp[i * 3 + 2] = z - p.dz * 3.3;
      });
      carMesh.instanceMatrix.needsUpdate = true;
      heads.geometry.attributes.position.needsUpdate = true;
      tails.geometry.attributes.position.needsUpdate = true;
    }

    if (pedMesh.visible) {
      P.forEach((a, i) => {
        a.s += a.dir * a.v * dt;
        if (a.s > pedTracks[a.t].len || a.s < 0) advance(pedTracks, a, r);
        const tr = pedTracks[a.t];
        const p = sample(tr, a);
        const x = p.x - p.dz * a.off;
        const z = p.z + p.dx * a.off;
        const bob = Math.abs(Math.sin((time * a.v * 2.4 + a.seed * 10) * Math.PI)) * 0.08;
        pos.set(x, p.y + 0.3 + bob, z);
        quat.setFromAxisAngle(UP, Math.atan2(-p.dz, p.dx));
        m.compose(pos, quat, scl);
        pedMesh.setMatrixAt(i, m);
      });
      pedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Бои од стилот (style.traffic.cars / people) или стандардни. */
  function restyle(style) {
    const cols = { ...DEFAULT_COLORS, ...(style.traffic || {}) };
    const c = new THREE.Color();
    const carPal = cols.cars.map((h) => new THREE.Color(h));
    const pedPal = cols.people.map((h) => new THREE.Color(h));
    C.forEach((a, i) => {
      c.copy(carPal[Math.floor(a.seed * carPal.length) % carPal.length]);
      carMesh.instanceColor.setXYZ(i, c.r, c.g, c.b);
    });
    P.forEach((a, i) => {
      c.copy(pedPal[Math.floor(a.seed * pedPal.length) % pedPal.length]);
      pedMesh.instanceColor.setXYZ(i, c.r, c.g, c.b);
    });
    carMesh.instanceColor.needsUpdate = true;
    pedMesh.instanceColor.needsUpdate = true;
    carMat.flatShading = pedMat.flatShading = !!style.traffic?.flat;
    carMat.needsUpdate = pedMat.needsUpdate = true;
  }

  function setEnabled(on) {
    enabled = on;
    group.visible = on;
  }

  update(0, 0);
  return { group, update, restyle, setEnabled, get enabled() { return enabled; }, counts: { cars: C.length, people: P.length, carTracks: carTracks.length, pedTracks: pedTracks.length } };
}
