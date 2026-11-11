// Светот: сите слоеви изградени од податоците, еднаш. Материјалите и боите ги дава стилот.

import * as THREE from 'three';
import { heightfieldFromPack, buildTerrainGeometry } from './terrain.js';
import { createGround } from './ground.js';
import { buildBuildingGeometry } from './buildings.js';
import { buildRoadGeometry, buildRailGeometry, buildWaterGeometry } from './ribbons.js';
import { buildLandmarks } from './landmarks/index.js';
import { createTrees } from './trees.js';
import { createLamps } from './lamps.js';
import { createTraffic } from './traffic.js';

const PLACEHOLDER = new THREE.MeshBasicMaterial({ color: 0xff00ff });

/**
 * @param {object} env заеднички uniforms за времето од денот ({ night, lamp })
 */
export function createWorld(data, profile, env) {
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

  // Знаменитостите се градат пред зградите: тие одлучуваат кои згради се заменуваат.
  const lm = buildLandmarks(data.landmarks, data.buildings, hf, data.lines);
  const landmarks = new THREE.Mesh(lm.geometry, PLACEHOLDER);
  landmarks.name = 'landmarks';
  landmarks.castShadow = true;
  landmarks.receiveShadow = true;

  const trees = createTrees(data.trees, hf, { every: profile.treeEvery, detail: profile.name !== 'mobile' });
  const lamps = createLamps(data.roads, hf, env, { density: profile.name === 'mobile' ? 0.6 : 1 });

  const traffic = createTraffic(data.roads, hf, env, profile.traffic);

  group.add(terrain, skirt, water, rail, roads, buildings, landmarks, trees, lamps, traffic.group);

  // Варијантите на геометријата на зградите се кешираат на десктоп
  // (брзо враќање при смена на стил); на телефон се ослободуваат.
  const cache = new Map();
  function setBuildingRoofs(roofs) {
    const old = buildings.geometry;
    if (old.userData.info?.roofs === roofs) return false;
    let geo = cache.get(roofs);
    if (!geo) {
      geo = buildBuildingGeometry(data.buildings, { roofs, skip: lm.skip });
      if (profile.cacheGeometry) cache.set(roofs, geo);
    }
    buildings.geometry = geo;
    if (!profile.cacheGeometry || !cache.has(old.userData.info?.roofs)) old.dispose();
    return true;
  }

  return { rect, hf, ground, group, terrain, skirt, water, rail, roads, buildings, landmarks, landmarkItems: lm.items, trees, lamps, traffic, setBuildingRoofs };
}
