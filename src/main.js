import * as THREE from 'three';
import { loadData } from './data/loader.js';
import { createWorld } from './world/world.js';
import { createSky } from './world/sky.js';
import { createPipeline } from './render/pipeline.js';
import { createCamera } from './app/camera.js';
import { createStyleManager } from './styles/manager.js';
import { STYLES, getStyle, initialStyleId, rememberStyle, styleFromHash } from './styles/index.js';
import { createOverlay } from './ui/overlay.js';
import { createStylePicker } from './ui/style-picker.js';
import { detectProfile } from './profile.js';
import './ui/fonts.js';
import './ui/ui.css';

const T0 = performance.now();
const profile = detectProfile();
const firstStyle = getStyle(initialStyleId());
document.documentElement.dataset.style = firstStyle.id;
const overlay = createOverlay();
const stats = { profile: profile.name, ready: false };
window.__bitola = stats;

async function start() {
  const container = document.getElementById('app');
  const pipeline = createPipeline(container, profile);

  const data = await loadData((f) => overlay.progress(f * 0.8));
  stats.dataMs = Math.round(performance.now() - T0);

  const t1 = performance.now();
  const world = createWorld(data, profile);
  overlay.progress(0.9);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 6000, 22000);
  scene.add(world.group);
  const sky = createSky(firstStyle);
  scene.add(sky);

  const hemi = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  if (profile.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(profile.shadows, profile.shadows);
    // Опсегот на длабочина е ~5 km, па bias од -0.00004 ≈ 0.2 m.
    sun.shadow.bias = -0.00004;
    sun.shadow.normalBias = 0.05;
  }
  scene.add(hemi, sun, sun.target);

  const view = createCamera(pipeline.renderer.domElement, world);
  const { camera, controls } = view;
  pipeline.init(scene, camera);

  const styles = createStyleManager({
    world,
    scene,
    camera,
    controls,
    pipeline,
    profile,
    lights: { sun, hemi },
    sky,
    fadeCanvas: document.getElementById('fade'),
  });
  stats.styleMs = styles.apply(firstStyle, { animate: false });
  stats.buildMs = Math.round(performance.now() - t1);

  const picker = createStylePicker(document.getElementById('ui'), STYLES, (id) => setStyle(id));
  picker.setActive(firstStyle.id);
  function setStyle(id) {
    const s = getStyle(id);
    if (!s || s.id === styles.current?.id) return;
    stats.lastSwitchMs = styles.apply(s);
    picker.setActive(s.id);
    rememberStyle(s.id);
  }
  window.addEventListener('hashchange', () => {
    const id = styleFromHash();
    if (id) setStyle(id);
  });

  view.setView({ target: { x: -300, z: 900 }, bearing: 25, polar: 55, distance: 6200 });

  function updateSun(d) {
    const size = Math.max(250, Math.min(3500, d * 0.75));
    sun.position.copy(controls.target).addScaledVector(styles.sunDir, 6000);
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
  }

  window.addEventListener('resize', () => {
    view.resize(container.clientWidth, container.clientHeight);
    pipeline.setSize(container.clientWidth, container.clientHeight);
  });

  // ── Јамка + FPS ──
  let frames = 0;
  let lastFpsT = performance.now();
  let last = performance.now();
  let first = true;
  pipeline.renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    controls.update();
    const d = view.updateClipping(sky);
    updateSun(d);
    styles.update();
    pipeline.render(dt);
    frames++;
    if (first) {
      first = false;
      stats.firstFrameMs = Math.round(performance.now() - T0);
      stats.ready = true;
      stats.triangles = pipeline.renderer.info.render.triangles;
      stats.calls = pipeline.renderer.info.render.calls;
      overlay.done();
      console.info('[bitola]', JSON.stringify(stats));
    }
    if (now - lastFpsT > 1000) {
      stats.fps = Math.round((frames * 1000) / (now - lastFpsT));
      frames = 0;
      lastFpsT = now;
      stats.style = styles.current?.id;
      overlay.debug(stats, pipeline.renderer.info);
    }
  });

  Object.assign(stats, { buildings: data.meta.stats.buildings.count });
  window.__bitolaApp = { scene, camera, controls, pipeline, setView: view.setView, setStyle, world, data };
}

start().catch((err) => {
  console.error(err);
  overlay.error(err.message);
});
