// Битолскиот филџан на кружниот тек „11. Бригада“ — според фотографија (есен 2025):
// бела порцеланска шолја со речиси прави ѕидови и заоблено дно, на ниска нога во плитка
// чинија; голема рачка во облик на уво; грбот на Битола (меандар на сина лента, црвено
// поле со златни триаголници) на три страни; во шолјата земја и цвеќе (цветна леа).
// Мерките се во единици R = радиусот на шолјата (во природа ~1.45 m; на мапата зголемено
// за да се гледа од далеку).

import * as THREE from 'three';
import { Kit } from './kit.js';

const TAU = Math.PI * 2;

// Профил на шолјата (r, y), од центарот на дното, нагоре по надворешниот ѕид, преку
// заоблениот раб и надолу по внатрешниот ѕид до земјата.
const CUP = [
  [0.01, 0.28], [0.55, 0.28], [0.72, 0.3], [0.84, 0.345], [0.92, 0.41], [0.97, 0.5], [0.995, 0.62],
  [1.0, 0.78], [1.006, 1.2], [1.014, 1.6], [1.02, 1.7], [1.034, 1.716], [1.042, 1.74], [1.034, 1.764],
  [1.0, 1.776], [0.97, 1.766], [0.956, 1.74], [0.952, 1.6],
];
const SOIL_Y = 1.62;
/** Радиус на надворешниот ѕид на висина y (правиот дел, за грбовите). */
const wallR = (y) => 1.0 + 0.014 * Math.min(1, Math.max(0, (y - 0.78) / 0.82));

/**
 * „Налепница“ на ѕидот на шолјата: 2Д многуаголник (s = должина по лакот надесно, y = висина)
 * се триангулира, дели на ситни триаголници и се витка по цилиндарот на растојание d од ѕидот.
 */
function decal(kit, pts, theta0, d, part, S) {
  const contour = pts.map(([s, y]) => new THREE.Vector2(s, y));
  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  const tris = [];
  const split = (a, b, c, depth) => {
    const ab = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const bc = Math.hypot(b[0] - c[0], b[1] - c[1]);
    const ca = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const m = Math.max(ab, bc, ca);
    if (m < 0.05 || depth > 6) return tris.push(a, b, c);
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    // дели го најдолгиот раб
    if (m === ab) {
      const x = mid(a, b);
      split(a, x, c, depth + 1);
      split(x, b, c, depth + 1);
    } else if (m === bc) {
      const x = mid(b, c);
      split(a, b, x, depth + 1);
      split(a, x, c, depth + 1);
    } else {
      const x = mid(c, a);
      split(a, b, x, depth + 1);
      split(x, b, c, depth + 1);
    }
  };
  for (const [i, j, k] of faces) split(pts[i], pts[j], pts[k], 0);
  const pos = new Float32Array(tris.length * 3);
  const nor = new Float32Array(tris.length * 3);
  tris.forEach(([s, y], i) => {
    const r = wallR(y) + d;
    const th = theta0 - s / r; // гледано однадвор, s расте надесно
    const cx = Math.cos(th);
    const sz = Math.sin(th);
    pos.set([r * cx * S, y * S, r * sz * S], i * 3);
    nor.set([cx, 0, sz], i * 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  kit.add(g, Kit.at(0, 0, 0), part);
}

/** Штит во облик на „U“: рамен горен раб на y0, прави страни до `straight`·h, па елипсесто дно. */
function shield(w, h, y0, { straight = 0.57, n = 16 } = {}) {
  const hw = w / 2;
  const yc = y0 - h * straight; // каде почнува дното
  const rb = h - h * straight; // висина на дното
  const pts = [[-hw, y0], [hw, y0]];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * (Math.PI / 2);
    pts.push([hw * Math.cos(a), yc - rb * Math.sin(a)]);
  }
  pts.push([0, yc - rb]);
  for (let i = n - 1; i >= 0; i--) {
    const a = (i / n) * (Math.PI / 2);
    pts.push([-hw * Math.cos(a), yc - rb * Math.sin(a)]);
  }
  return pts;
}
const rect = (s0, y0, s1, y1) => [[s0, y0], [s1, y0], [s1, y1], [s0, y1]];

/** Пресек на многуаголник со конвексен многуаголник (Sutherland–Hodgman). */
function clipConvex(subject, clip) {
  let area = 0;
  for (let i = 0; i < clip.length; i++) {
    const [x1, y1] = clip[i];
    const [x2, y2] = clip[(i + 1) % clip.length];
    area += x1 * y2 - x2 * y1;
  }
  const sg = Math.sign(area);
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const side = (p) => sg * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    const inp = out;
    out = [];
    for (let j = 0; j < inp.length; j++) {
      const p = inp[j];
      const q = inp[(j + 1) % inp.length];
      const sp = side(p);
      const sq = side(q);
      if (sp >= 0) out.push(p);
      if (sp >= 0 !== sq >= 0) {
        const t = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return out;
}

/**
 * Грбот на Битола (според официјалниот знак) на ѕидот на шолјата, центриран на агол theta,
 * горниот раб на висина top: златен раб, бела подлога, сина лента со златен меандар,
 * црвено поле во облик на „U“ со златен раб и 3 × 3 златни триаголници.
 */
function crest(kit, theta, top, S) {
  const W = 0.5;
  const H = 0.66;
  const D = 0.006; // чекор меѓу слоевите (над ѕидот)
  const e = 0.02; // дебелина на златниот раб
  decal(kit, shield(W, H, top), theta, D, 'crestGold', S);
  decal(kit, shield(W - 2 * e, H - 2 * e, top - e, { straight: 0.56 }), theta, 2 * D, 'accent', S);
  // сина лента со меандар (4 „клуча“ и долна линија)
  const bw = W / 2 - e;
  const bTop = top - e;
  const bBot = top - 0.125;
  decal(kit, rect(-bw, bBot, bw, bTop), theta, 3 * D, 'crestBlue', S);
  const t = 0.016;
  const y0 = bBot + 0.014;
  const ch = bTop - bBot - 0.028;
  const n = 4;
  const cw = (2 * bw - 0.02) / n;
  decal(kit, rect(-bw + 0.01, y0, bw - 0.01, y0 + t), theta, 4 * D, 'crestGold', S);
  for (let i = 0; i < n; i++) {
    const x0 = -bw + 0.01 + i * cw;
    for (const r of [
      rect(x0, y0, x0 + t, y0 + ch), // лево нагоре
      rect(x0, y0 + ch - t, x0 + 0.78 * cw, y0 + ch), // горе надесно
      rect(x0 + 0.78 * cw - t, y0 + 0.36 * ch, x0 + 0.78 * cw, y0 + ch), // надолу
      rect(x0 + 0.4 * cw, y0 + 0.36 * ch, x0 + 0.78 * cw, y0 + 0.36 * ch + t), // налево
      rect(x0 + 0.4 * cw, y0 + 0.36 * ch, x0 + 0.4 * cw + t, y0 + 0.62 * ch), // кратко нагоре
    ])
      decal(kit, r, theta, 4 * D, 'crestGold', S);
  }
  // црвено поле со златен раб и златни триаголници во три реда (основите се допираат)
  const fTop = bBot;
  const fw = 0.33;
  const fh = 0.45;
  decal(kit, shield(fw + 2 * 0.012, fh + 0.012, fTop, { straight: 0.6 }), theta, 3 * D, 'crestGold', S);
  const field = shield(fw, fh, fTop - 0.012, { straight: 0.6 });
  decal(kit, field, theta, 4 * D, 'crestRed', S);
  const tw = fw / 3;
  const rh = (fh - 0.02) / 3;
  for (let row = 0; row < 3; row++) {
    const yb = fTop - 0.02 - (row + 1) * rh;
    for (let col = -1; col <= 1; col++) {
      const cx = col * tw;
      const tri = clipConvex([[cx - tw / 2, yb], [cx + tw / 2, yb], [cx, yb + rh]], field);
      if (tri.length >= 3) decal(kit, tri, theta, 5 * D, 'crestGold', S);
    }
  }
}

/** Рачка во облик на уво: цевка по затворена крива во рамнината (u, y), кон +u. */
function handle(kit, S) {
  const pts = [];
  const n = 40;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    // појаширока горе, потесна долу (уво)
    pts.push(new THREE.Vector3((1.24 + 0.19 * Math.cos(a) * (1 + 0.22 * Math.sin(a))) * S, (1.2 + 0.42 * Math.sin(a)) * S, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  kit.add(new THREE.TubeGeometry(curve, 64, 0.095 * S, 12, true), Kit.at(0, 0, 0), 'accent');
}

export function fildzan(kit, item, ctx) {
  const [cx, cz] = item.center;
  const R = Math.max(3, (item.radius || 8) - 3.5); // тревниот остров
  const S = Math.min(4.5, R * 0.3); // радиус на шолјата на мапата
  const g = ctx.hf.sample(cx, cz);
  // рачката гледа кон југо-исток (како на фотографијата: Пелистер зад шолјата, десно)
  kit.setFrame(cx, g, cz, 0.38, 0.92);

  // остров: камен раб и трева
  kit.cylinder(0, -0.4, 0, R + 0.4, 0.75, 'stone', { seg: 48 });
  kit.cylinder(0, 0.3, 0, R, 0.12, 'green', { seg: 48 });
  const base = 0.42;

  // чинија: рамен бел прстен со заоблен раб; во средината плитко корито (вода)
  const saucer = [
    [1.1, 0.03], [1.16, 0.085], [1.5, 0.1], [1.57, 0.088], [1.6, 0.055], [1.585, 0.015], [1.52, -0.01], [1.1, -0.01],
  ].map(([r, y]) => new THREE.Vector2(r * S, y * S));
  kit.add(new THREE.LatheGeometry(saucer, 64), Kit.at(0, base, 0), 'accent');
  kit.cylinder(0, base, 0, 1.11 * S, 0.035 * S, 'water', { seg: 48 });

  // нога и шолја
  kit.cylinder(0, base + 0.03 * S, 0, 0.64 * S, 0.27 * S, 'accent', { seg: 48 });
  const prof = CUP.map(([r, y]) => new THREE.Vector2(r * S, y * S));
  kit.add(new THREE.LatheGeometry(prof, 64), Kit.at(0, base, 0), 'accent');
  kit.setFrame(cx, g + base, cz, 0.38, 0.92);
  handle(kit, S);

  // грбот на три страни (рачката е на агол 0)
  for (const a of [60, 180, 300]) crest(kit, (a / 180) * Math.PI, 1.5, S);

  // земја и цвеќе во шолјата
  kit.cylinder(0, SOIL_Y * S, 0, 0.955 * S, 0.02, 'trunk', { seg: 40 });
  let k = 0;
  for (const [rr, cnt] of [[0.25, 5], [0.55, 9], [0.8, 13]]) {
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * TAU + rr * 2.3;
      const u = Math.cos(a) * rr * S;
      const v = Math.sin(a) * rr * S;
      kit.sphere(u, SOIL_Y * S + 0.1, v, 0.32, 'green', { seg: 8, sy: 0.6 });
      kit.sphere(u + 0.12, SOIL_Y * S + 0.26, v, 0.17, k++ % 3 === 0 ? 'mosaic1' : 'crestGold', { seg: 6 });
    }
  }

  // на тревата: топчести грмушки, леи со кадифе и рефлектори кон шолјата
  kit.setFrame(cx, g, cz, 0.38, 0.92);
  const top = 0.36;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.4;
    const r = R - 1.6;
    kit.sphere(Math.cos(a) * r, top + 0.55, Math.sin(a) * r, 0.75, 'green', { seg: 10, sy: 0.85 });
  }
  // леи со кадифе: лаци во средината на тревата, по два реда
  const rb = (1.6 * S + R - 1.6) / 2;
  for (let b = 0; b < 5; b++) {
    const a0 = (b / 5) * TAU + 0.3;
    for (let j = 0; j < 9; j++) {
      for (const dr of [-0.35, 0.35]) {
        const a = a0 + (j - 4) * (0.7 / rb) + (dr > 0 ? 0.35 / rb : 0);
        const u = Math.cos(a) * (rb + dr);
        const v = Math.sin(a) * (rb + dr);
        kit.sphere(u, top + 0.1, v, 0.42, 'green', { seg: 6, sy: 0.4 });
        kit.sphere(u, top + 0.26, v, 0.3, (j + b) % 4 === 0 ? 'mosaic1' : 'crestGold', { seg: 6, sy: 0.6 });
      }
    }
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    kit.box(Math.cos(a) * (R - 0.6), 0.35, Math.sin(a) * (R - 0.6), 0.3, 0.2, 0.3, 'light', -a);
  }
}
