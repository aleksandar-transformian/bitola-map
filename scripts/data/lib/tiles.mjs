// Web Mercator (XYZ) помошни функции.

const DEG = Math.PI / 180;

export function lonToTileX(lon, z) {
  return ((lon + 180) / 360) * 2 ** z;
}

export function latToTileY(lat, z) {
  const r = lat * DEG;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}

/** Опсег на плочки (вклучително) што го покриваат bbox. */
export function tileRange(bbox, z) {
  return {
    x0: Math.floor(lonToTileX(bbox.west, z)),
    x1: Math.floor(lonToTileX(bbox.east, z)),
    y0: Math.floor(latToTileY(bbox.north, z)),
    y1: Math.floor(latToTileY(bbox.south, z)),
  };
}
