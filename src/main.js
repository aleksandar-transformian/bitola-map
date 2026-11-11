import * as THREE from 'three';
import { loadData } from './data/loader.js';
import { createWorld } from './world/world.js';
import { createSky } from './world/sky.js';
import { createPipeline } from './render/pipeline.js';
import { createCamera } from './app/camera.js';
import { createTime, TIMES } from './app/time.js';
import { createWeather, WEATHERS } from './app/weather.js';
import { readPref, hashPref, writePref } from './app/prefs.js';
import { createStyleManager } from './styles/manager.js';
import { STYLES, getStyle, initialStyleId, rememberStyle, styleFromHash } from './styles/index.js';
import { VIEWS } from './config/views.js';
import { PLACE_RANK, PLACE_SKIP, EXTRA_PLACES } from './config/labels.js';
import { createOverlay } from './ui/overlay.js';
import { createStylePicker } from './ui/style-picker.js';
import { createMenu } from './ui/menu.js';
import { createLabels, collectLabels } from './ui/labels.js';
import { detectProfile } from './profile.js';
import './ui/fonts.js';
import './ui/ui.css';

const T0 = performance.now();
const profile = detectProfile();
const firstStyle = getStyle(initialStyleId());
const validTime = (id) => TIMES.some((t) => t.id === id);
const validWeather = (id) => WEATHERS.some((w) => w.id === id);
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

  // Заеднички uniforms за ноќта (прозорци, улици, светилки) и снегот.
  const env = { night: { value: 0 }, lamp: { value: new THREE.Color('#ffc27a') }, snow: { value: 0 }, snowColor: { value: new THREE.Color('#f3f6fa') } };
  const time = createTime(readPref('time', validTime) || 'day');
  document.documentElement.dataset.time = time.mode;
  const weather = createWeather(readPref('weather', validWeather) || 'clear');
  env.snow.value = weather.snow;
  document.documentElement.dataset.weather = weather.mode;

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
  validView = (id) => places.has(id);
  const menu = createMenu(ui, {
    views: VIEWS,
    landmarks: data.landmarks,
    times: TIMES,
    weathers: WEATHERS,
    onGo: (id) => goTo(id),
    onTime: (id) => setTime(id),
    onWeather: (id) => setWeather(id),
  });
  menu.setTime(time.mode);
  menu.setWeather(weather.mode);
  world.snowfall.userData.set(weather.falling);
  const dock = document.createElement('div');
  dock.className = 'dock';
  ui.appendChild(dock);
  const picker = createStylePicker(dock, STYLES, (id) => setStyle(id));
  picker.setActive(firstStyle.id);
  // упатството се покажува сам само при првата посета
  try {
    if (!localStorage.getItem('bitola.helpSeen')) {
      menu.showHelp(true);
      localStorage.setItem('bitola.helpSeen', '1');
    }
  } catch {
    // без складирање — без автоматско упатство
  }

  function setStyle(id) {
    const s = getStyle(id);
    if (!s || s.id === styles.current?.id) return;
    stats.lastSwitchMs = styles.apply(s);
    picker.setActive(s.id);
    rememberStyle(s.id);
    // фонтовите на натписите зависат од стилот
    requestAnimationFrame(() => labels.measure());
  }
  function setTime(id) {
    if (!validTime(id) || id === time.mode) return;
    time.set(id);
    menu.setTime(id);
    document.documentElement.dataset.time = id;
    writePref('time', id);
  }
  function setWeather(id) {
    if (!validWeather(id) || id === weather.mode) return;
    weather.set(id);
    world.snowfall.userData.set(weather.falling);
    menu.setWeather(id);
    document.documentElement.dataset.weather = id;
    writePref('weather', id);
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
    const w = hashPref('weather', validWeather);
    if (w) setWeather(w);
    const v = hashPref('view', validView);
    if (v) goTo(v);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Home') goTo('pregled');
    // S = снег: без снег → снег → снежи → без снег
    if (['s', 'S', 'с', 'С'].includes(e.key) && !e.target.closest?.('select, input, textarea') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const i = WEATHERS.findIndex((w) => w.id === weather.mode);
      setWeather(WEATHERS[(i + 1) % WEATHERS.length].id);
    }
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
    view.updateFlight();
    controls.update();
    const d = view.updateClipping(sky);
    updateSun(d);
    if (weather.update()) env.snow.value = weather.snow;
    world.snowfall.userData.update(dt, camera, d, { height: container.clientHeight, dpr: pipeline.size.dpr }, env.night.value);
    styles.update();
    pipeline.render(dt);
    labels.update(camera, container.clientWidth, container.clientHeight, d);
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
      stats.weather = weather.mode;
      overlay.debug(stats, pipeline.renderer.info);
    }
  });

  Object.assign(stats, { buildings: data.meta.stats.buildings.count });
  window.__bitolaApp = { scene, camera, controls, pipeline, setView: view.setView, getView: view.getView, goTo, setStyle, setTime, setWeather, world, data };
}

start().catch((err) => {
  console.error(err);
  overlay.error(err.message);
});
