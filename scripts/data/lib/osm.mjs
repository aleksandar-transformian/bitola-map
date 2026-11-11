// Индексирање на OSM елементи и составување на multipolygon прстени.

export function indexOsm(elements) {
  const nodes = new Map();
  const ways = new Map();
  const relations = new Map();
  for (const el of elements) {
    if (el.type === 'node') {
      const prev = nodes.get(el.id);
      // „out skel“ ги враќа јазлите без тагови — задржи ја верзијата со тагови.
      if (!prev || el.tags) nodes.set(el.id, el);
    } else if (el.type === 'way') {
      const prev = ways.get(el.id);
      if (!prev || el.tags) ways.set(el.id, el);
    } else if (el.type === 'relation') {
      relations.set(el.id, el);
    }
  }
  return { nodes, ways, relations };
}

/** Координати [lat, lon] за листа од node id; null ако некој недостасува. */
export function wayLatLons(way, nodes) {
  const out = [];
  for (const id of way.nodes) {
    const n = nodes.get(id);
    if (!n) return null;
    out.push([n.lat, n.lon]);
  }
  return out;
}

export function isClosed(way) {
  return way.nodes.length >= 4 && way.nodes[0] === way.nodes[way.nodes.length - 1];
}

/**
 * Состави затворени прстени од членовите на релација со дадена улога.
 * Враќа низа од низи node id (затворени).
 */
export function assembleRings(rel, ways, role) {
  const segs = [];
  for (const m of rel.members) {
    if (m.type !== 'way') continue;
    const r = m.role || 'outer';
    if (r !== role) continue;
    const w = ways.get(m.ref);
    if (w && w.nodes?.length >= 2) segs.push([...w.nodes]);
  }
  const rings = [];
  while (segs.length) {
    let ring = segs.pop();
    let guard = 0;
    while (ring[0] !== ring[ring.length - 1] && guard++ < 10000) {
      const end = ring[ring.length - 1];
      let found = -1;
      let reverse = false;
      for (let i = 0; i < segs.length; i++) {
        if (segs[i][0] === end) {
          found = i;
          break;
        }
        if (segs[i][segs[i].length - 1] === end) {
          found = i;
          reverse = true;
          break;
        }
      }
      if (found < 0) break;
      const s = segs.splice(found, 1)[0];
      if (reverse) s.reverse();
      ring = ring.concat(s.slice(1));
    }
    if (ring.length >= 4 && ring[0] === ring[ring.length - 1]) rings.push(ring);
  }
  return rings;
}
