// „Бајка“ — рачно изработена минијатура: куќички од дрво и глина со коси покриви од
// шкрилци, ели, подлога од филц. Најубава е ноќе (и под снег): топли прозорци, сино-тиркизно
// небо, плитка длабочина на поле со боке-дискови од светлата, сјај (bloom) на десктоп.
// Инспирација: фотографии на зимски макети/диорами — без копирање на конкретно дело.

import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import * as THREE from 'three';
import { lambertSet, withCraft } from './shared/materials.js';
import { BokehPass } from '../render/passes/bokeh.js';
import { createGradePass } from '../render/passes/grade.js';

const LAMP = '#ffad55';

export default {
  id: 'bajka',
  name: 'Бајка',
  tagline: 'рачно изработена минијатура',
  swatch: 'radial-gradient(circle at 35% 35%, #ffc77a 0 22%, #3d5a6a 23% 60%, #e9ecef 61%)',

  geometry: { roofs: 'gabled', trees: 'cone' },

  ground: {
    painter: 'flat',
    base: '#b8a68a',
    edge: '#7b6650',
    outline: '#a8957a',
    areas: {
      farmland: '#bba886',
      meadow: '#a8a682',
      orchard: '#93976f',
      scrub: '#8a8e68',
      forest: '#55654f',
      residential: '#bfae93',
      commercial: '#c1b097',
      industrial: '#ada291',
      military: '#a99d84',
      education: '#c2b096',
      cemetery: '#7f8a6a',
      grass: '#9ca27a',
      park: '#7f8d66',
      sports: '#94a177',
      parking: '#ad9f88',
      plaza: '#cbbba0',
      wetland: '#7f9184',
      sand: '#c9b791',
      water: '#4f6f7c',
    },
  },

  // калдрма и земјени патеки
  roads: {
    motorway: '#8f8579',
    trunk: '#958a7d',
    primary: '#9c9083',
    secondary: '#a39686',
    tertiary: '#a99c8b',
    residential: '#ae9f8c',
    service: '#a99a87',
    pedestrian: '#c2ad8e',
    footway: '#b29e82',
    track: '#9a8669',
  },
  rail: ['#5e5248', '#7c7066'],
  water: '#3f6170',

  buildings: {
    // [ѕид, рамен покрив]
    generic: ['#cdb595', '#77716d'],
    house: ['#d2b994', '#77716d'],
    apartments: ['#c9b8a2', '#6f6c6c'],
    commercial: ['#d0b08a', '#736d68'],
    industrial: ['#b5ab9e', '#6b6864'],
    civic: ['#d8c4a4', '#6a6e74'],
    religious: ['#e2d3b9', '#6a6e74'],
    small: ['#a89077', '#6f6862'],
    historic: ['#c98d5e', '#6a6e74'],
    // ѕидови на куќичките: дрво, глина, окер, портокалова, сино-сива (како обоени макети)
    wallAlt: ['#c9a77c', '#b48d68', '#d7c09a', '#c47a4a', '#8d98a3', '#a27b5c', '#dccaa8', '#b9a07e', '#9a7a62'],
    // шкрилци и стари ќерамиди
    roofAlt: ['#5d6670', '#676a70', '#73665d', '#59606a', '#7d6a5c', '#4f5862', '#6c7279'],
    variation: 0.08,
    ao: 0.7,
  },

  landmarks: {
    wall: '#d9c6a6',
    wall2: '#c99b74',
    stone: '#c8b89c',
    roof: '#5f6873',
    dome: '#7e8a92',
    metal: '#5e5a55',
    accent: '#ece2cf',
    window: '#5a4c40',
    light: '#ffc277',
    water: '#4f6f7c',
    blossom: '#d9b9bd',
    green: '#62745a',
    trunk: '#5e4a3a',
    mosaic1: '#a8714f',
    mosaic2: '#d8c39c',
    facade1: '#d6b386',
    facade2: '#c98e66',
    facade3: '#a9b09a',
    facade4: '#dcc79f',
    facade5: '#97a6b0',
    paving: '#bfae93',
    bronze: '#5f6a5a',
    // Дом на културата, Горна гимназија (world/landmarks/civic.js)
    eave: '#6f4c3a',
    copper: '#4f3a2e',
    ochre: '#d8b26c',
    plinth: '#9a8670',
    tin: '#9a5a4c',
    amber: '#d08a52',
    // зградите на Магнолија (world/landmarks/magnolija.js)
    plaster: '#ebe2d2',
    peach: '#ddb89d',
    wood: '#7b3f2a',
    // штитот-фонтана и постаментот на Филип II (Магнолија)
    gold: '#ad8336',
    granite: '#3f3d40',
    glass: '#557f8c', // Стаклена
  },
  // играчки-возила: пригушени бои (минијатура)
  traffic: { cars: ['#9a3b2e', '#3d5a6e', '#c9a25a', '#e4ddd0', '#56604a', '#7a4a3a'], people: ['#7a3b2e', '#3d4f62', '#b88a4a', '#5a5048', '#8a6a7a'] },
  trees: {
    crowns: ['#3f5a4c', '#46604f', '#3a5246', '#506a55'],
    forest: ['#34493f', '#3b5245', '#2f443a'],
  },
  // улиците светат само малку (одблесок од светилките врз снегот/калдрмата)
  night: {
    bloom: false, // стилот има свој сјај (post) — без општиот ноќен сјај од менаџерот
    lamp: LAMP,
    windows: { ratio: 0.55, cross: 1, halo: 0.32, fill: 0.45 },
    landmarkFill: 0.07,
    streets: [0.1, 0.1, 0.1, 0.09, 0.08, 0.06, 0.03, 0.2, 0.02, 0.0],
  },
  snow: { color: '#f4f1ec' },
  times: {
    // ноќ: длабоко сино-тиркизно небо и магла, топли светла
    night: {
      sun: { color: '#9fb4d6', intensity: 0.3, azimuth: 150, elevation: 40 },
      // топол одблесок од земјата (светилки, прозорци) → ѕидовите не се црни
      hemi: { sky: '#7593b3', ground: '#6a4a33', intensity: 0.85 },
      sky: { top: '#07121e', bottom: '#2c4a58' },
      fog: { color: '#22404c' },
      shadow: 0.4,
      exposure: 1.15,
    },
    sunset: {
      sky: { top: '#3f5a7a', bottom: '#f0a875' },
      fog: { color: '#c99c86' },
    },
  },

  sky: { top: '#a9bccb', bottom: '#ece6dc' },
  fog: { color: '#ddd8cf', near: 3800, far: 16000 },
  light: {
    sun: { color: '#fff1de', intensity: 2.2, azimuth: 230, elevation: 30 },
    hemi: { sky: '#e8edf2', ground: '#9d8f7e', intensity: 1.35 },
    shadow: 0.5,
    toneMapping: 'neutral',
    exposure: 1.0,
  },
  ui: { paper: '#efe6d6' },

  materials(ctx) {
    const m = lambertSet(ctx, { skirt: '#6d5a48' });
    withCraft(m.walls, { mottle: 0.1, lines: 1, lineStep: 0.42, lineDark: 0.16, vertical: true });
    withCraft(m.roofs, { mottle: 0.12, lines: 1, lineStep: 0.3, lineDark: 0.22 });
    withCraft(m.terrain, { mottle: 0.1 });
    withCraft(m.landmarks, { mottle: 0.08, vertical: true });
    withCraft(m.trees, { mottle: 0.1 });
    return m;
  },

  post(ctx) {
    const mobile = ctx.profile.name === 'mobile';
    const bokeh = new BokehPass(ctx.camera, {
      samples: mobile ? 14 : 36,
      maxRadius: mobile ? 7 : 11,
      band: 0.06,
      lights: ctx.world.lightPoints(),
      gain: 0.75,
      lamp: LAMP,
    });
    const before = [bokeh];
    let bloom = null;
    if (!mobile) {
      const { width, height } = ctx.size;
      bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.55, 0.6, 0.85);
      bloom.perfName = 'bloom';
      before.push(bloom);
    }
    const grade = createGradePass({ shadows: '#1b3a4c', highlights: '#ffb46a', split: 0.1, vignette: 0.4, grain: 0.035 });
    return { before, after: [grade], bokeh, bloom, grade };
  },

  /** По кадар: фокус на целта на камерата; ноќе посилен сјај и поширок расфокус. */
  update(ctx, post) {
    const d = ctx.camera.position.distanceTo(ctx.controls.target);
    const night = ctx.env.night.value;
    post.bokeh.update(d, night, ctx.scene.fog.far);
    // одблизу (минијатура) — посилен расфокус; од високо — помек
    const k = Math.min(1, Math.max(0.35, 1.75 - Math.log10(d) * 0.42));
    if (Math.abs(k - (post._k || 0)) > 0.02) {
      post.bokeh.setStrength(k);
      post._k = k;
    }
    if (post.bloom) {
      post.bloom.strength = 0.12 + 0.3 * night;
      post.bloom.threshold = 1.0 - 0.15 * night;
    }
    post.grade.uniforms.split.value = 0.05 + 0.08 * night;
  },
};
