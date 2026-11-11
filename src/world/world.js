// Светот: сите слоеви изградени од податоците, еднаш. Материјалите и боите ги дава стилот.

import * as THREE from 'three';
import { heightfieldFromPack, buildTerrainGeometry } from './terrain.js';
import { createGround } from './ground.js';
import { buildBuildingGeometry } from './buildings.js';
import { buildRoadGeometry, buildRailGeometry, buildWaterGeometry } from './ribbons.js';

const PLACEHOLDER = new THREE.MeshBasicMaterial({ color: 0xff00ff });

export function createWorld(data, profile) {
  const rect = data.meta.rect;
  const hf = heightfieldFromPack(data.terrain);
  const tg = buildTerrainGeometry(hf, { stride: profile.terrainStride });
  const ground = createGround(data, rect, profile.groundTexture);

  const group = new THREE.Group();
  group.name = 'world';

  const terrain = new THREE.Mesh(tg.top, PLACEHOLDER);
  terrain.name = 'terrain';
  terrain.receiveShadow = true;

  const skirt = new THREE.Mesh(tg.skirt, PLACEHOLDER);
  skirt.name = 'skirt';

  const water = new THREE.Mesh(buildWaterGeometry(data.lines, hf), PLACEHOLDER);
  water.name = 'water';
  const rail = new THREE.Mesh(buildRailGeometry(data.lines, hf), PLACEHOLDER);
  rail.name = 'rail';
  rail.receiveShadow = true;
  const roads = new THREE.Mesh(buildRoadGeometry(data.roads, hf), PLACEHOLDER);
  roads.name = 'roads';
  roads.receiveShadow = true;

  const buildings = new THREE.Mesh(new THREE.BufferGeometry(), [PLACEHOLDER, PLACEHOLDER]);
  buildings.name = 'buildings';
  buildings.castShadow = true;
  buildings.receiveShadow = true;

  group.add(terrain, skirt, water, rail, roads, buildings);

  // Варијантите на геометријата на зградите се кешираат на десктоп
  // (брзо враќање при смена на стил); на телефон се ослободуваат.
  const cache = new Map();
  function setBuildingRoofs(roofs) {
    const old = buildings.geometry;
    if (old.userData.info?.roofs === roofs) return false;
    let geo = cache.get(roofs);
    if (!geo) {
      geo = buildBuildingGeometry(data.buildings, { roofs });
      if (profile.cacheGeometry) cache.set(roofs, geo);
    }
    buildings.geometry = geo;
    if (!profile.cacheGeometry || !cache.has(old.userData.info?.roofs)) old.dispose();
    return true;
  }

  return { rect, hf, ground, group, terrain, skirt, water, rail, roads, buildings, setBuildingRoofs };
}
