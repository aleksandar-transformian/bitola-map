import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { loadData } from './data/loader.js';
import { heightfieldFromPack, buildTerrainGeometry } from './world/terrain.js';
import { createGround } from './world/ground.js';
import { buildBuildings } from './world/buildings.js';
import { buildRoads, buildRail, buildWaterways } from './world/ribbons.js';
import { createSky } from './world/sky.js';
import { basicStyle } from './style/basic.js';
import { createOverlay } from './ui/overlay.js';
import { detectProfile } from './profile.js';
import './ui/ui.css';

const T0 = performance.now();
const profile = detectProfile();
const overlay = createOverlay();
const stats = { profile: profile.name, ready: false };
window.__bitola = stats;

const DEG = Math.PI / 180;

async function start() {
  const container = document.getElementById('app');
  const renderer = new THREE.WebGLRenderer({ antialias: profile.antialias, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, profile.maxPixelRatio));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = profile.shadows > 0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const data = await loadData((f) => overlay.progress(f * 0.8));
  stats.dataMs = Math.round(performance.now() - T0);
  const style = basicStyle;
  const rect = data.meta.rect;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(style.fog.color, style.fog.near, style.fog.far);

  // ── Релјеф ──
  const t1 = performance.now();
  const hf = heightfieldFromPack(data.terrain);
  const tg = buildTerrainGeometry(hf, { stride: profile.terrainStride });
  const ground = createGround(data, rect, style, profile.groundTexture);
  ground.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const terrainMat = new THREE.MeshLambertMaterial({ map: ground.texture });
  const terrain = new THREE.Mesh(tg.top, terrainMat);
  terrain.name = 'terrain';
  terrain.receiveShadow = true;
  scene.add(terrain);
  const skirtMat = new THREE.MeshLambertMaterial({ color: style.ground.edge, side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(tg.skirt, skirtMat));
  overlay.progress(0.85);

  // ── Улици, железница, водотеци, згради ──
  scene.add(buildWaterways(data.lines, hf, style));
  scene.add(buildRail(data.lines, hf, style));
  scene.add(buildRoads(data.roads, hf, style));
  overlay.progress(0.92);
  scene.add(buildBuildings(data.buildings, style));
  stats.buildMs = Math.round(performance.now() - t1);

  // ── Небо и светла ──
  const sky = createSky(style);
  scene.add(sky);
  const hemi = new THREE.HemisphereLight(style.hemi.sky, style.hemi.ground, style.hemi.intensity);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(style.sun.color, style.sun.intensity);
  // azimuth: 0 = север (−z), 90 = исток (+x)
  const sunDir = new THREE.Vector3(Math.sin(style.sun.azimuth * DEG) * Math.cos(style.sun.elevation * DEG), Math.sin(style.sun.elevation * DEG), -Math.cos(style.sun.azimuth * DEG) * Math.cos(style.sun.elevation * DEG)).normalize();
  if (profile.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(profile.shadows, profile.shadows);
    // Опсегот на длабочина е ~5 km, па bias од -0.00004 ≈ 0.2 m.
    sun.shadow.bias = -0.00004;
    sun.shadow.normalBias = 0.05;
  }
  scene.add(sun, sun.target);

  // ── Камера и контроли ──
  const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 5, 40000);
  const controls = new MapControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;
  controls.minDistance = 40;
  controls.maxDistance = 14000;
  controls.maxPolarAngle = 80 * DEG;
  controls.zoomToCursor = true;
  controls.listenToKeyEvents(window);
  controls.keyPanSpeed = 25;

  // Поглед: bearing = компасен азимут од целта до камерата (0 = камерата е северно,
  // 90 = источно), polar = агол од вертикала, distance во метри.
  const home = { target: { x: -300, z: 900 }, bearing: 25, polar: 55, distance: 6200 };
  setView(home);

  function setView(v) {
    const ty = hf.sample(v.target.x, v.target.z);
    controls.target.set(v.target.x, ty, v.target.z);
    const off = new THREE.Vector3().setFromSphericalCoords(v.distance, v.polar * DEG, (180 - v.bearing) * DEG);
    camera.position.copy(controls.target).add(off);
    controls.update();
  }

  // Целта секогаш на теренот и во опфатот.
  controls.addEventListener('change', () => {
    const t = controls.target;
    const cx = Math.max(rect.minX, Math.min(rect.maxX, t.x));
    const cz = Math.max(rect.minZ, Math.min(rect.maxZ, t.z));
    const dy = hf.sample(cx, cz) - t.y;
    const dx = cx - t.x;
    const dz = cz - t.z;
    if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > 0.01) {
      t.set(cx, t.y + dy, cz);
      camera.position.x += dx;
      camera.position.y += dy;
      camera.position.z += dz;
    }
    // Камерата да не влезе во теренот.
    const minY = hf.sample(camera.position.x, camera.position.z) + 15;
    if (camera.position.y < minY) camera.position.y = minY;
  });

  function updateSun() {
    const d = camera.position.distanceTo(controls.target);
    const size = Math.max(250, Math.min(3500, d * 0.75));
    sun.position.copy(controls.target).addScaledVector(sunDir, 6000);
    sun.target.position.copy(controls.target);
    if (profile.shadows) {
      const c = sun.shadow.camera;
      c.left = -size;
      c.right = size;
      c.top = size;
      c.bottom = -size;
      c.near = 3500;
      c.far = 8500;
      c.updateProjectionMatrix();
    }
    sky.position.copy(camera.position);
  }

  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  // ── Јамка + FPS ──
  let frames = 0;
  let lastFpsT = performance.now();
  let first = true;
  renderer.setAnimationLoop(() => {
    controls.update();
    updateSun();
    renderer.render(scene, camera);
    frames++;
    const now = performance.now();
    if (first) {
      first = false;
      stats.firstFrameMs = Math.round(now - T0);
      stats.ready = true;
      stats.triangles = renderer.info.render.triangles;
      stats.calls = renderer.info.render.calls;
      overlay.done();
      console.info('[bitola]', JSON.stringify(stats));
    }
    if (now - lastFpsT > 1000) {
      stats.fps = Math.round((frames * 1000) / (now - lastFpsT));
      frames = 0;
      lastFpsT = now;
      overlay.debug(stats, renderer.info);
    }
  });

  Object.assign(stats, { buildings: data.meta.stats.buildings.count });
  window.__bitolaApp = { scene, camera, controls, renderer, setView, hf, data };
}

start().catch((err) => {
  console.error(err);
  overlay.error(err.message);
});
