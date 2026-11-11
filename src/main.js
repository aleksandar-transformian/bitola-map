import * as THREE from 'three';
import { loadData } from './data/loader.js';
import { createWorld } from './world/world.js';
import { createSky } from './world/sky.js';
import { createPipeline } from './render/pipeline.js';
import { createCamera } from './app/camera.js';
import { createTime, TIMES } from './app/time.js';
import { readPref, hashPref, writePref } from './app/prefs.js';
import { createStyleManager } from './styles/manager.js';
import { STYLES, getStyle, initialStyleId, rememberStyle, styleFromHash } from './styles/index.js';
import { VIEWS, CHECK_VIEWS } from './config/views.js';
import { PLACE_RANK, PLACE_SKIP, EXTRA_PLACES } from './config/labels.js';
import { createOverlay } from './ui/overlay.js';
import { createStylePicker } from './ui/style-picker.js';
import { createMenu } from './ui/menu.js';
import { createLabels, collectLabels } from './ui/labels.js';
import { detectProfile } from './profile.js';
import { createPerf } from './perf/perf.js';
import './ui/fonts.js';
import './ui/ui.css';

const T0 = performance.now();
const QS = new URLSearchParams(location.search);
const BENCH = QS.has('bench');
const profile = detectProfile();
const firstStyle = getStyle(initialStyleId());
const validTime = (id) => TIMES.some((t) => t.id === id);
let validView = (id) => VIEWS.some((v) => v.id === id);
document.documentElement.dataset.style = firstStyle.id;
const overlay = createOverlay();
const stats = { profile: profile.name, ready: false };
window.__bitola = stats;

async function start() {
  const container = document.getElementById('app');
  const ui = document.getElementById('ui');
  const pipeline = createPipeline(container, profile);

  const data = await loadData((f) => overlay.progress(f * 0.8));
  stats.dataMs = Math.round(performance.now() - T0);

  // Заеднички uniforms за ноќта (прозорци, улици, светилки).
  const env = { night: { value: 0 }, lamp: { value: new THREE.Color('#ffc27a') }, streetGain: { value: 1 } };
  const time = createTime(readPref('time', validTime) || 'day');
  document.documentElement.dataset.time = time.mode;

  const t1 = performance.now();
  const world = createWorld(data, profile, env);
  overlay.progress(0.9);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 6000, 22000);
  scene.add(world.group);
  const sky = createSky();
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
  // мерење (само со ?debug или ?bench): CPU по фаза, GPU по пас
  const perf = createPerf(pipeline.renderer, { enabled: BENCH || QS.has('debug') });
  pipeline.instrument(perf.gpu);

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
    time,
    env,
  });
  stats.styleMs = styles.apply(firstStyle, { animate: false });
  stats.buildMs = Math.round(performance.now() - t1);

  // ── Интерфејс ──
  const labels = createLabels(
    ui,
    collectLabels({ pois: data.pois, landmarks: data.landmarks, hf: world.hf, rect: world.rect, placeRank: PLACE_RANK, placeSkip: PLACE_SKIP, extra: EXTRA_PLACES }),
  );
  // Погледи кон знаменитостите: свој `view` или стандарден според големината на моделот.
  const SIZE = { stadium: 420, warCemetery: 380, fortress: 320, monastery: 300, totenburg: 220, heraclea: 380, promenade: 430, square: 200, fildzan: 140, publicBuilding: 220, station: 220 };
  const places = new Map(VIEWS.map((v) => [v.id, v]));
  for (const l of data.landmarks) {
    if (!l.group || places.has(l.id)) continue; // брзиот поглед со истото име има предност
    places.set(l.id, { target: { x: l.center[0], z: l.center[1] }, bearing: 200, polar: 58, distance: SIZE[l.model] || 170, ...(l.view || {}) });
  }
  for (const v of CHECK_VIEWS) if (!places.has(v.id)) places.set(v.id, v); // само преку #view= (проверки, мерења)
  validView = (id) => places.has(id);
  const menu = createMenu(ui, { views: VIEWS, landmarks: data.landmarks, times: TIMES, onGo: (id) => goTo(id), onTime: (id) => setTime(id) });
  syncTime();
  const dock = document.createElement('div');
  dock.className = 'dock';
  ui.appendChild(dock);
  const picker = createStylePicker(dock, STYLES, (id) => setStyle(id));
  picker.setActive(firstStyle.id);
  // упатството се покажува сам само при првата посета
  try {
    if (!BENCH && !localStorage.getItem('bitola.helpSeen')) {
      menu.showHelp(true);
      localStorage.setItem('bitola.helpSeen', '1');
    }
  } catch {
    // без складирање — без автоматско упатство
  }

  function setStyle(id, { animate = true, remember = true } = {}) {
    const s = getStyle(id);
    if (!s || s.id === styles.current?.id) return;
    stats.lastSwitchMs = styles.apply(s, { animate });
    picker.setActive(s.id);
    syncTime();
    if (remember) rememberStyle(s.id);
    // фонтовите на натписите зависат од стилот
    requestAnimationFrame(() => labels.measure());
    return stats.lastSwitchMs;
  }
  function setTime(id, animate = true) {
    if (!validTime(id) || id === time.mode) return;
    time.set(id, animate);
    if (!animate) styles.relight();
    syncTime();
    if (animate) writePref('time', id);
  }
  /** Копчињата за време и data-time; стил со фиксно време ги заклучува копчињата. */
  function syncTime() {
    const fixed = styles.current?.fixedTime || null;
    menu.lockTime(fixed);
    menu.setTime(fixed || time.mode);
    document.documentElement.dataset.time = fixed || time.mode;
  }
  function goTo(id, animate = true) {
    const v = places.get(id);
    if (!v) return;
    if (animate) view.flyTo(v);
    else view.setView(v);
    menu.setPlace(id);
  }
  controls.addEventListener('start', () => menu.setPlace(null));
  window.addEventListener('hashchange', () => {
    const s = styleFromHash();
    if (s) setStyle(s);
    const t = hashPref('time', validTime);
    if (t) setTime(t);
    const v = hashPref('view', validView);
    if (v) goTo(v);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Home') goTo('pregled');
  });

  goTo(hashPref('view', validView) || 'pregled', false);

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
    perf.begin(now);
    view.updateFlight();
    controls.update();
    const d = view.updateClipping(sky);
    updateSun(d);
    styles.update();
    perf.mark('update');
    pipeline.render(dt);
    perf.mark('render');
    labels.update(camera, container.clientWidth, container.clientHeight, d);
    perf.end('labels');
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
      stats.time = time.mode;
      overlay.debug(stats, pipeline.renderer.info, perf.live(), pipeline.size);
    }
  });

  Object.assign(stats, { buildings: data.meta.stats.buildings.count });
  const app = {
    scene,
    camera,
    controls,
    pipeline,
    renderer: pipeline.renderer,
    perf,
    profile,
    stats,
    sun,
    places,
    uiRoot: ui,
    setView: view.setView,
    getView: view.getView,
    flyTo: view.flyTo,
    goTo,
    setStyle,
    setTime,
    get style() {
      return styles.current?.id;
    },
    get time() {
      return time.mode;
    },
    world,
    data,
  };
  window.__bitolaApp = app;

  // ?bench — мерење на изведбата (посебен модул, се вчитува само тогаш)
  if (BENCH) {
    await new Promise((r) => setTimeout(r, 500)); // првите кадри (шејдери, текстури) да поминат
    const { startBench } = await import('./perf/bench.js');
    await startBench(app);
  }
}

start().catch((err) => {
  console.error(err);
  overlay.error(err.message);
});
