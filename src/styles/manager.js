// Менаџер на стилови: применува стил врз веќе изградениот свет без превчитување.
//
//  1. ако стилот бара друга геометрија (покриви) — се пресоздаваат само зградите,
//     кои потоа „растат“ од подлогата;
//  2. нови материјали за сите слоеви (старите се ослободуваат);
//  3. бои по теме (згради, улици, пруга, вода) и ново цртање на подлогата;
//  4. небо, магла, светла, tone mapping, пост-процесирање, тема на интерфејсот.
//  Целата смена е покриена со кратко претопување (снимка од претходниот кадар).

import * as THREE from 'three';
import { ROAD } from '../config/classes.js';
import { colorBuildings } from '../world/buildings.js';
import { colorRibbons } from '../world/ribbons.js';
import { withGrow } from './shared/materials.js';

const DEG = Math.PI / 180;
const TONE = { neutral: THREE.NeutralToneMapping, aces: THREE.ACESFilmicToneMapping, none: THREE.NoToneMapping };
const GROW_MS = 900;
const FADE_MS = 550;

export function createStyleManager({ world, scene, camera, controls, pipeline, profile, lights, sky, fadeCanvas }) {
  const grow = { value: 1 };
  const sunDir = new THREE.Vector3(0, 1, 0);
  const depthMaterial = withGrow(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), grow);
  world.buildings.customDepthMaterial = depthMaterial;

  let current = null;
  let post = null;
  let growStart = -1;
  const ctx = {
    scene,
    camera,
    controls,
    renderer: pipeline.renderer,
    profile,
    ground: world.ground,
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

    // 2) материјали
    const m = style.materials(ctx);
    withGrow(m.walls, grow);
    withGrow(m.roofs, grow);
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

    // 3) бои
    colorBuildings(world.buildings.geometry, style.buildings);
    colorRibbons(world.roads.geometry, ROAD.map((k) => style.roads[k]));
    colorRibbons(world.rail.geometry, style.rail);
    colorRibbons(world.water.geometry, [style.water]);
    world.ground.paint(style);

    // 4) околина
    scene.fog.color.set(style.fog.color);
    scene.fog.near = style.fog.near;
    scene.fog.far = style.fog.far;
    sky.userData.restyle(style);
    const L = style.light;
    lights.sun.color.set(L.sun.color);
    lights.sun.intensity = L.sun.intensity;
    lights.sun.shadow.intensity = L.shadow ?? 1;
    const az = L.sun.azimuth * DEG;
    const el = L.sun.elevation * DEG;
    // азимут: 0 = север (−z), 90 = исток (+x)
    sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    lights.hemi.color.set(L.hemi.sky);
    lights.hemi.groundColor.set(L.hemi.ground);
    lights.hemi.intensity = L.hemi.intensity;
    pipeline.renderer.toneMapping = TONE[L.toneMapping] ?? THREE.NeutralToneMapping;
    pipeline.renderer.toneMappingExposure = L.exposure ?? 1;

    post = style.post?.(ctx) || { before: [], after: [] };
    pipeline.setPasses(post.before, post.after);

    document.documentElement.dataset.style = style.id;
    current = style;
    if (animate) fadeOut();
    return Math.round(performance.now() - t0);
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
    /** По кадар: анимација на растење и ажурирања на стилот. */
    update() {
      if (growStart >= 0) {
        const t = Math.min(1, (performance.now() - growStart) / GROW_MS);
        grow.value = 1 - Math.pow(1 - t, 3);
        if (t >= 1) growStart = -1;
      }
      current?.update?.(ctx, post);
    },
  };
}
