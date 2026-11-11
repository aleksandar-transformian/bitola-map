// Натписи на кирилица: HTML елементи проектирани од 3Д позиции секој кадар.
// Видливоста зависи од зумот (растојанието на камерата) и од рангот; натписите што би се
// преклопиле се кријат (поважните имаат предност).

import * as THREE from 'three';

// [мин, макс] растојание на камерата до целта во кое видот на натпис е видлив
const RANGE = {
  mountain: [2500, Infinity],
  village: [1800, Infinity],
  quarter: [500, 9000],
  landmark: [0, 2800],
  landmark2: [0, 1500], // помалку важните знаменитости — само на поблизок зум
};

export function createLabels(root, items) {
  const box = document.createElement('div');
  box.className = 'labels';
  box.setAttribute('aria-hidden', 'true');
  root.prepend(box);
  const L = items.map((it) => {
    const el = document.createElement('div');
    el.className = `label label-${it.kind}`;
    el.innerHTML = `<span>${it.name}</span>`;
    box.appendChild(el);
    return { ...it, el, w: 0, h: 0, shown: false, pos: new THREE.Vector3(it.x, it.y, it.z) };
  });
  const order = [...L].sort((a, b) => a.rank - b.rank);

  function measure() {
    for (const l of L) {
      l.w = l.el.offsetWidth;
      l.h = l.el.offsetHeight;
    }
  }
  measure();
  document.fonts?.ready.then(measure);

  let obstacleEls = null;
  const obstacles = () => (obstacleEls ||= [...document.querySelectorAll('.title, .panel, .help, .dock, .attribution')]);
  const v = new THREE.Vector3();
  const placed = [];
  return {
    measure,
    /** @param {THREE.Camera} camera  @param {number} dist растојание до целта */
    update(camera, width, height, dist) {
      placed.length = 0;
      // панелите на интерфејсот се пречки за натписите
      for (const el of obstacles()) {
        if (el.hidden) continue;
        const r = el.getBoundingClientRect();
        if (r.width) placed.push([r.left, r.top, r.right, r.bottom]);
      }
      for (const l of order) {
        const [lo, hi] = RANGE[l.kind] || RANGE.quarter;
        let show = dist >= lo && dist <= hi;
        let sx = 0;
        let sy = 0;
        if (show) {
          v.copy(l.pos).project(camera);
          show = v.z < 1 && v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1;
          sx = (v.x * 0.5 + 0.5) * width;
          sy = (-v.y * 0.5 + 0.5) * height;
        }
        if (show) {
          // правоаголник на натписот (центриран хоризонтално, над точката)
          const r = [sx - l.w / 2 - 4, sy - l.h - 4, sx + l.w / 2 + 4, sy + 2];
          const offscreen = r[0] < 0 || r[2] > width || r[1] < 0 || r[3] > height;
          if (offscreen || placed.some((p) => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])) show = false;
          else placed.push(r);
        }
        if (show) l.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        if (show !== l.shown) {
          l.el.classList.toggle('on', show);
          l.shown = show;
        }
      }
    },
  };
}

/** Собери ги натписите од податоците: населби (OSM), рачни места, знаменитости. */
export function collectLabels({ pois, landmarks, hf, rect, placeRank, placeSkip, extra }) {
  const out = [];
  const inside = (x, z) => x > rect.minX + 150 && x < rect.maxX - 150 && z > rect.minZ + 150 && z < rect.maxZ - 150;
  for (const p of pois) {
    const rank = placeRank[p.type];
    if (!rank || placeSkip.has(p.name) || !inside(p.x, p.z)) continue;
    out.push({ name: p.name, x: p.x, z: p.z, y: hf.sample(p.x, p.z) + 25, rank, kind: p.type === 'place:village' ? 'village' : 'quarter' });
  }
  for (const e of extra) {
    if (!inside(e.x, e.z)) continue;
    out.push({ ...e, y: hf.sample(e.x, e.z) + (e.lift ?? 25) });
  }
  // висина на натписот над подлогата, по модел
  const H = {
    clockTower: 36, mosque: 30, church: 30, officersHome: 22, publicBuilding: 22, bezisten: 14, square: 10, promenade: 16,
    heraclea: 10, equestrian: 17, stoneTower: 18, station: 16, stadium: 36, fortress: 14, totenburg: 14, warCemetery: 18,
    monastery: 22, fildzan: 9, jets: 10,
  };
  for (const lm of landmarks) {
    if (lm.label === false) continue;
    const [x, z] = lm.center;
    const rank = lm.rank ?? 0;
    out.push({ name: lm.name, x, z, y: (lm.ground?.mean ?? hf.sample(x, z)) + (H[lm.model] ?? 15), rank, kind: rank ? 'landmark2' : 'landmark' });
  }
  return out;
}
