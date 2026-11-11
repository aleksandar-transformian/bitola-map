// Единствениот извор за географскиот опфат на мапата.
// Го користат и Node скриптите за податоци (scripts/data/*) и прелистувачот.

export const REGION = {
  id: 'bitola',
  name: 'Битола',

  // Опфат во степени (WGS84). Ги опфаќа сите градски населби, Лавци,
  // Тумбе Кафе, Хераклеа и почетокот на падините кон Пелистер.
  // Види docs/NOTES.md за тоа како е проверен.
  bbox: {
    south: 40.99,
    west: 21.27,
    north: 41.065,
    east: 21.39,
  },

  // Почетна точка на локалниот координатен систем (метри):
  // Саат кула / центар на градот. x = исток, z = југ, y = нагоре.
  origin: { lat: 41.0306, lon: 21.3349 },

  // Terrain Tiles (Terrarium) — зум ниво за симнување и чекор на мрежата.
  terrain: {
    zoom: 14,
    gridStep: 15, // метри меѓу две точки од мрежата на релјефот
  },
};

const R = 6378137; // WGS84 екваторски радиус, метри
const DEG = Math.PI / 180;

/** Проекција lat/lon → локални метри (еквидистантна околу REGION.origin). */
export function makeProjection(origin = REGION.origin) {
  const k = Math.cos(origin.lat * DEG) * R * DEG; // метри по степен должина
  const m = R * DEG; // метри по степен ширина
  return {
    toXZ(lat, lon) {
      return [(lon - origin.lon) * k, -(lat - origin.lat) * m];
    },
    toLatLon(x, z) {
      return [origin.lat - z / m, origin.lon + x / k];
    },
  };
}

/** Опфатот во локални метри: { minX, maxX, minZ, maxZ }. */
export function bboxMeters(region = REGION) {
  const p = makeProjection(region.origin);
  const [minX, maxZ] = p.toXZ(region.bbox.south, region.bbox.west);
  const [maxX, minZ] = p.toXZ(region.bbox.north, region.bbox.east);
  return { minX, maxX, minZ, maxZ };
}
