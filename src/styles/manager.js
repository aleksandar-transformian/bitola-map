// Менаџер на стилови: применува стил врз веќе изградениот свет без превчитување.
//
//  1. ако стилот бара друга геометрија (покриви, дрвја) — се пресоздаваат само тие слоеви;
//     зградите потоа „растат“ од подлогата;
//  2. нови материјали за сите слоеви (старите се ослободуваат) + ноќни додатоци
//     (прозорци, светлечки улици, светилки на знаменитостите) + снег (временски услови);
//  3. бои по теме (згради, знаменитости, дрвја, улици, пруга, вода) и ново цртање на подлогата;
//  4. осветлување за тековното време од денот, tone mapping, пост-процесирање, тема на UI.
//  Целата смена е покриена со кратко претопување (снимка од претходниот кадар).

import * as THREE from 'three';
import { ROAD } from '../config/classes.js';
import { colorBuildings } from '../world/buildings.js';
import { colorRibbons } from '../world/ribbons.js';
import { colorLandmarks } from '../world/landmarks/index.js';
import { colorTrees, setTreeShape } from '../world/trees.js';
import { withGrow, withWindows, withGlow, withStreetGlow, withSnow } from './shared/materials.js';
import { resolveLighting } from '../app/time.js';

const DEG = Math.PI / 180;
const TONE = { neutral: THREE.NeutralToneMapping, aces: THREE.ACESFilmicToneMapping, none: THREE.NoToneMapping };
const GROW_MS = 900;
const FADE_MS = 550;

export function createStyleManager({ world, scene, camera, controls, pipeline, profile, lights, sky, fadeCanvas, time, env }) {
  const grow = { value: 1 };
  const sunDir = new THREE.Vector3(0, 1, 0);
  const depthMaterial = withGrow(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), grow);
  world.buildings.customDepthMaterial = depthMaterial;

  let current = null;
  let post = null;
  let growStart = -1;
  let lit = null;
  const ctx = {
    scene,
    camera,
    controls,
    renderer: pipeline.renderer,
    profile,
    ground: world.ground,
    world,
    env,
    get size() {
      return pipeline.size;
    },
  };

  function apply(style, { animate = true } = {}) {
    if (current?.id === style.id) return;
    const t0 = performance.now();
    if (animate && current) snapshot();

    // 1) геометрија
    const roofs = style.geometry?.roofs || 'flat';
    if (world.setBuildingRoofs(roofs) && current) {
      grow.value = 0;
      growStart = performance.now();
    }
    setTreeShape(world.trees, style.geometry?.trees || 'round');

    // 2) материјали
    const m = style.materials(ctx);
    m.landmarks ||= new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    m.trees ||= new THREE.MeshLambertMaterial({ vertexColors: true });
    withGrow(m.walls, grow);
    withWindows(m.walls, env, style.night?.windows);
    withGrow(m.roofs, grow);
    withGlow(m.landmarks, env);
    withStreetGlow(m.roads, env, style.night?.streets);
    // снег (временски услови): ги бели површините свртени нагоре; улиците се погазени
    withSnow(m.terrain, env, { lo: 0.62, hi: 0.86 });
    withSnow(m.roofs, env, { lo: 0.3, hi: 0.55, patch: 0.25 });
    withSnow(m.landmarks, env, { lo: 0.45, hi: 0.75, patch: 0.3 });
    withSnow(m.trees, env, { lo: -0.15, hi: 0.45, amount: 0.85, patch: 0.6, scale: 0.6 });
    withSnow(m.roads, env, { lo: 0.6, hi: 0.9, amount: 0.62, patch: 0.7, scale: 0.12 });
    withSnow(m.rail, env, { lo: 0.6, hi: 0.9, amount: 0.75, patch: 0.5 });
    for (const mat of [m.roads, m.rail, m.water]) {
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -2;
      mat.polygonOffsetUnits = -4;
    }
    m.water.polygonOffsetFactor = -1;
    m.water.polygonOffsetUnits = -2;
    swap(world.terrain, m.terrain);
    swap(world.skirt, m.skirt);
    swap(world.roads, m.roads);
    swap(world.rail, m.rail);
    swap(world.water, m.water);
    swap(world.buildings, [m.walls, m.roofs]);
    swap(world.landmarks, m.landmarks);
    swap(world.trees, m.trees);

    // 3) бои
    colorBuildings(world.buildings.geometry, style.buildings);
    colorLandmarks(world.landmarks.geometry, style.landmarks);
    colorTrees(world.trees, style.trees);
    colorRibbons(world.roads.geometry, ROAD.map((k) => style.roads[k]));
    colorRibbons(world.rail.geometry, style.rail);
    colorRibbons(world.water.geometry, [style.water]);
    world.ground.paint(style);

    // 4) околина
    current = style;
    applyLighting();
    pipeline.renderer.toneMapping = TONE[style.light.toneMapping] ?? THREE.NeutralToneMapping;
    // некои стилови (цртан филм) се без сенки — поевтино и поедноставно
    lights.sun.castShadow = profile.shadows > 0 && style.light.shadows !== false;

    post = style.post?.(ctx) || { before: [], after: [] };
    pipeline.setPasses(post.before, post.after);

    document.documentElement.dataset.style = style.id;
    if (animate) fadeOut();
    return Math.round(performance.now() - t0);
  }

  /** Осветлување, небо и магла за стилот и тековното време од денот. */
  function applyLighting() {
    lit = resolveLighting(current, time.weights, lit || undefined);
    const L = lit;
    scene.fog.color.copy(L.fog.color);
    scene.fog.near = current.fog.near;
    scene.fog.far = current.fog.far;
    sky.userData.set(L.sky.top, L.sky.bottom, L.night);
    lights.sun.color.copy(L.sun.color);
    lights.sun.intensity = L.sun.intensity;
    lights.sun.shadow.intensity = L.shadow;
    const az = L.sun.azimuth * DEG;
    const el = Math.max(6, L.sun.elevation) * DEG;
    // азимут: 0 = север (−z), 90 = исток (+x)
    sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    lights.hemi.color.copy(L.hemi.sky);
    lights.hemi.groundColor.copy(L.hemi.ground);
    lights.hemi.intensity = L.hemi.intensity;
    pipeline.renderer.toneMappingExposure = L.exposure;
    env.night.value = L.night;
    if (current.night?.lamp) env.lamp.value.set(current.night.lamp);
    env.snowColor.value.set(current.snow?.color || '#f3f6fa');
    world.lamps.userData.update(L.night);
  }

  function swap(mesh, next) {
    const old = mesh.material;
    mesh.material = next;
    for (const mat of [].concat(old)) if (mat && mat.type !== 'MeshBasicMaterial') mat.dispose();
  }

  // Претопување: копија од последниот кадар над canvas-от, што потоа избледува.
  function snapshot() {
    pipeline.render(0);
    const src = pipeline.renderer.domElement;
    fadeCanvas.width = src.width;
    fadeCanvas.height = src.height;
    fadeCanvas.getContext('2d').drawImage(src, 0, 0);
    fadeCanvas.style.transition = 'none';
    fadeCanvas.style.opacity = '1';
  }
  function fadeOut() {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        fadeCanvas.style.transition = `opacity ${FADE_MS}ms ease`;
        fadeCanvas.style.opacity = '0';
      }),
    );
  }

  return {
    apply,
    get current() {
      return current;
    },
    sunDir,
    /** По кадар: растење, премин на времето од денот, ажурирања на стилот. */
    update() {
      if (growStart >= 0) {
        const t = Math.min(1, (performance.now() - growStart) / GROW_MS);
        grow.value = 1 - Math.pow(1 - t, 3);
        if (t >= 1) growStart = -1;
      }
      if (time.update() && current) applyLighting();
      current?.update?.(ctx, post);
    },
  };
}
