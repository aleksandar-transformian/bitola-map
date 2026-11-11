// „Кит“ за процедурално моделирање: примитиви од three.js се поставуваат во локална рамка
// (u = по оската на објектот, v = нормално на неа, y = нагоре) и се спојуваат во една
// геометрија. Секое теме носи „дел“ (part → боја од палетата на стилот) и сјај ноќе (aGlow).

import * as THREE from 'three';

/** Делови на моделите; бојата ја дава style.landmarks[part]. Додавај само на крај. */
export const PARTS = [
  'wall', //      0 главен ѕид (малтер/камен)
  'wall2', //     1 втор ѕид (акцентна фасада)
  'stone', //     2 камен (подножја, столбови, рабови)
  'roof', //      3 ќерамида
  'dome', //      4 олово (куполи, капи)
  'metal', //     5 метал (врвови, оградни столбчиња)
  'accent', //    6 бело (часовник, корнизи)
  'window', //    7 прозорци (светат ноќе)
  'light', //     8 светилки (светат ноќе)
  'water', //     9 вода
  'blossom', //  10 цвет на магнолија
  'green', //    11 крошна
  'trunk', //    12 стебло
  'mosaic1', //  13 мозаик
  'mosaic2', //  14 мозаик
  'facade1', //  15 фасади на Широк Сокак
  'facade2', //  16
  'facade3', //  17
  'facade4', //  18
  'facade5', //  19
  'paving', //   20 калдрма
];
export const PART_ID = Object.fromEntries(PARTS.map((p, i) => [p, i]));

const GLOW = { window: 0.75, light: 1 };
const m4 = new THREE.Matrix4();
const m4b = new THREE.Matrix4();
const q = new THREE.Quaternion();
const UPV = new THREE.Vector3(0, 1, 0);

export class Kit {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.part = [];
    this.glow = [];
    this.frame = new THREE.Matrix4();
  }

  /** Рамка: центар (cx, y, cz) и оска (ax, az) во светот. */
  setFrame(cx, y, cz, ax = 1, az = 0) {
    const X = new THREE.Vector3(ax, 0, az).normalize();
    const Z = new THREE.Vector3(-X.z, 0, X.x);
    this.frame.makeBasis(X, UPV, Z).setPosition(cx, y, cz);
    return this;
  }

  /** Додај three.js геометрија со локална матрица. */
  add(geo, local, part, glow) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    m4.multiplyMatrices(this.frame, local);
    g.applyMatrix4(m4);
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    const pid = PART_ID[part];
    const gl = glow ?? GLOW[part] ?? 0;
    for (let i = 0; i < p.length; i++) {
      this.pos.push(p[i]);
      this.nor.push(n[i]);
    }
    for (let i = 0; i < p.length / 3; i++) {
      this.part.push(pid);
      this.glow.push(gl);
    }
    if (g !== geo) g.dispose();
    geo.dispose();
    return this;
  }

  /** Локална матрица: позиција (u, y, v), ротација околу y (радијани), скала. */
  static at(u, y, v, rotY = 0, sx = 1, sy = 1, sz = 1) {
    q.setFromAxisAngle(UPV, rotY);
    return m4b.compose(new THREE.Vector3(u, y, v), q, new THREE.Vector3(sx, sy, sz)).clone();
  }

  /** Кутија: центар на основата во (u, y, v); w по u, d по v, h по y. */
  box(u, y, v, w, h, d, part, rotY = 0, glow) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    return this.add(g, Kit.at(u, y, v, rotY), part, glow);
  }

  cylinder(u, y, v, r, h, part, { top = r, seg = 16, rotY = 0, glow } = {}) {
    const g = new THREE.CylinderGeometry(top, r, h, seg);
    g.translate(0, h / 2, 0);
    return this.add(g, Kit.at(u, y, v, rotY), part, glow);
  }

  cone(u, y, v, r, h, part, { seg = 16, rotY = 0 } = {}) {
    const g = new THREE.ConeGeometry(r, h, seg);
    g.translate(0, h / 2, 0);
    return this.add(g, Kit.at(u, y, v, rotY), part);
  }

  /** Купола (полусфера, или пократка со ratio < 1). */
  dome(u, y, v, r, part, { ratio = 1, seg = 20 } = {}) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(4, seg / 2), 0, Math.PI * 2, 0, Math.PI / 2);
    return this.add(g, Kit.at(u, y, v, 0, 1, ratio, 1), part);
  }

  sphere(u, y, v, r, part, { seg = 10, sy = 1 } = {}) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(4, seg / 2));
    return this.add(g, Kit.at(u, y, v, 0, 1, sy, 1), part);
  }

  /** Двоводен покрив над правоаголник w×d (слеме по u), висина h. */
  gable(u, y, v, w, h, d, part, rotY = 0) {
    const hw = w / 2;
    const hd = d / 2;
    const shape = new THREE.Shape([new THREE.Vector2(-hd, 0), new THREE.Vector2(hd, 0), new THREE.Vector2(0, h)]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
    // профилот е во x–y, истиснат по z → сврти го: z → u
    g.translate(0, 0, -hw);
    g.rotateY(Math.PI / 2);
    g.computeVertexNormals();
    return this.add(g, Kit.at(u, y, v, rotY), part);
  }

  /** Четиристрешен покрив (пирамида кога w = d). */
  hip(u, y, v, w, h, d, part, rotY = 0) {
    const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
    g.rotateY(Math.PI / 4);
    g.translate(0, 0.5, 0);
    g.scale(w, h, d);
    g.computeVertexNormals();
    return this.add(g, Kit.at(u, y, v, rotY), part);
  }

  /** Плоча по произволен полигон во СВЕТСКИ координати (рамката не се применува). */
  slab(rings, y0, y1, part, glow) {
    const shape = new THREE.Shape(rings[0].map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const h of rings.slice(1)) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
    const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.translate(0, y0, 0);
    const keep = this.frame.clone();
    this.frame.identity();
    this.add(g, new THREE.Matrix4(), part, glow);
    this.frame.copy(keep);
    return this;
  }

  /** Додај сурови триаголници (светски координати). */
  raw(pos, nor, part, glow) {
    const pid = PART_ID[part];
    const gl = glow ?? GLOW[part] ?? 0;
    for (let i = 0; i < pos.length; i++) {
      this.pos.push(pos[i]);
      this.nor.push(nor[i]);
    }
    for (let i = 0; i < pos.length / 3; i++) {
      this.part.push(pid);
      this.glow.push(gl);
    }
    return this;
  }

  /**
   * Прозорци по ѕидовите на прстен (светски координати): мали плочки 6 cm пред ѕидот.
   * floors: [{ y, h }] — долен раб и висина на прозорците по кат.
   */
  windows(ring, floors, { spacing = 3, width = 1.2, part = 'window', glow, skip = 0 } = {}) {
    const n = ring.length;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % n];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < spacing * 0.9) continue;
      const tx = (b[0] - a[0]) / len;
      const tz = (b[1] - a[1]) / len;
      // нормала нанадвор (прстените се ориентирани како основите на зградите)
      const nx = tz;
      const nz = -tx;
      const count = Math.floor(len / spacing);
      const start = (len - (count - 1) * spacing) / 2;
      for (let c = 0; c < count; c++) {
        const d = start + c * spacing;
        const x = a[0] + tx * d + nx * 0.06;
        const z = a[1] + tz * d + nz * 0.06;
        for (const f of floors) {
          if (skip && k++ % skip === 0) continue;
          const g = new THREE.PlaneGeometry(width, f.h);
          g.translate(0, f.h / 2, 0);
          const rot = Math.atan2(nx, nz);
          const keep = this.frame.clone();
          this.frame.identity();
          this.add(g, Kit.at(x, f.y, z, rot), part, glow);
          this.frame.copy(keep);
        }
      }
    }
    return this;
  }

  toGeometry() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('part', new THREE.Float32BufferAttribute(this.part, 1));
    geo.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glow, 1));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(this.pos.length), 3));
    geo.computeBoundingSphere();
    return geo;
  }
}
