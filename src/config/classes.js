// Класи (enum) што ги делат обработката и прелистувачот.
// Редоследот е дел од форматот на податоците — додавај само на крај.

export const ROAD = [
  'motorway', //    0
  'trunk', //       1
  'primary', //     2
  'secondary', //   3
  'tertiary', //    4
  'residential', // 5 (вклучува unclassified, living_street)
  'service', //     6
  'pedestrian', //  7 (пешачка зона)
  'footway', //     8 (footway, path, steps, cycleway)
  'track', //       9
];
export const ROAD_ID = Object.fromEntries(ROAD.map((n, i) => [n, i]));

export const ROAD_FLAG = { bridge: 1, tunnel: 2, oneway: 4 };

export const RAIL = ['rail', 'disused', 'tram'];
export const RAIL_ID = Object.fromEntries(RAIL.map((n, i) => [n, i]));

export const WATERWAY = ['river', 'stream', 'canal', 'ditch'];
export const WATERWAY_ID = Object.fromEntries(WATERWAY.map((n, i) => [n, i]));

// Класи на површини; низата е и редослед на цртање (од долу нагоре).
export const AREA = [
  'farmland', //     0
  'meadow', //       1 (grassland, greenfield, meadow)
  'orchard', //      2 (orchard, vineyard)
  'scrub', //        3 (scrub, heath)
  'forest', //       4 (forest, wood)
  'residential', //  5
  'commercial', //   6 (commercial, retail)
  'industrial', //   7 (industrial, railway, construction, brownfield)
  'military', //     8
  'education', //    9 (школи, факултети, болници — двор)
  'cemetery', //    10
  'grass', //       11 (landuse=grass, village_green)
  'park', //        12 (park, garden, recreation_ground, playground)
  'sports', //      13 (pitch, stadium, sports_centre, track)
  'parking', //     14
  'plaza', //       15 (пешачки плоштади)
  'wetland', //     16
  'sand', //        17 (sand, bare_rock, scree, quarry)
  'water', //       18
];
export const AREA_ID = Object.fromEntries(AREA.map((n, i) => [n, i]));

export const BUILDING = [
  'generic', //     0
  'house', //       1
  'apartments', //  2
  'commercial', //  3
  'industrial', //  4
  'civic', //       5 (училишта, болници, јавни)
  'religious', //   6
  'small', //       7 (гаражи, бараки)
  'historic', //    8
];
export const BUILDING_ID = Object.fromEntries(BUILDING.map((n, i) => [n, i]));

export const ROOF = ['flat', 'gabled', 'hipped', 'pyramidal', 'dome', 'other'];
export const ROOF_ID = Object.fromEntries(ROOF.map((n, i) => [n, i]));
