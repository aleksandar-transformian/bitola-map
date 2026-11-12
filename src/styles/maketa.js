// „Макета“ — архитектонска макета на студиска маса: бели згради, јавните и историските
// од светло дрво (балса), подлога од картон со изохипси, бочни страни од наредени листови,
// мека студиска светлина, амбиентна оклузија (десктоп) и длабочина на поле (tilt-shift).

import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { createTiltShift } from '../render/passes/tiltshift.js';
import { lambertSet, withContours, withLayers } from './shared/materials.js';

const WOOD = ['#e6cda3', '#ddc08f'];

export default {
  id: 'maketa',
  name: 'Макета',
  tagline: 'архитектонска макета',
  swatch: 'linear-gradient(135deg, #f7f6f2 0 50%, #e2c89c 50% 75%, #c9d6bd 75%)',

  geometry: { roofs: 'flat', trees: 'lollipop' },

  ground: {
    painter: 'flat',
    base: '#e8e5dd',
    edge: '#cdb48a',
    outline: '#cfcac0',
    areas: {
      farmland: '#e6e2d7',
      meadow: '#dee2d2',
      orchard: '#d5dcc7',
      scrub: '#d2d9c4',
      forest: '#c3cfb4',
      residential: '#ecebe6',
      commercial: '#ebe9e4',
      industrial: '#e3e1db',
      military: '#e1dfd8',
      education: '#ebe8e1',
      cemetery: '#d1d9c5',
      grass: '#d6dfc7',
      park: '#cad8ba',
      sports: '#cfdcc0',
      parking: '#e0ded8',
      plaza: '#f2f0eb',
      wetland: '#cfdbd1',
      sand: '#ebe5d5',
      water: '#b9d1db',
    },
  },

  roads: {
    motorway: '#fbfaf6',
    trunk: '#fbfaf6',
    primary: '#fbfaf6',
    secondary: '#faf9f5',
    tertiary: '#f9f8f4',
    residential: '#f6f5f1',
    service: '#f2f1ec',
    pedestrian: '#f7f3ea',
    footway: '#efede6',
    track: '#e2ddd2',
  },
  rail: ['#a39b90', '#bdb6ac'],
  water: '#a8c6d2',

  buildings: {
    generic: ['#f4f3ef', '#f8f7f4'],
    house: ['#f4f3ef', '#f8f7f4'],
    apartments: ['#f2f1ed', '#f7f6f3'],
    commercial: ['#f3f2ee', '#f7f6f3'],
    industrial: ['#ebeae6', '#f0efeb'],
    civic: WOOD,
    religious: WOOD,
    small: ['#efeeea', '#f3f2ee'],
    historic: WOOD,
    variation: 0.02,
    ao: 0.84,
  },

  // знаменитостите се од светло дрво (балса), остатокот бел
  landmarks: {
    wall: '#e6cc9f',
    wall2: '#dcc092',
    stone: '#ecdab9',
    roof: '#d5b585',
    dome: '#cdac7a',
    metal: '#a88d66',
    accent: '#f6efe2',
    window: '#c9ae82',
    light: '#fff3d6',
    water: '#b9d1db',
    blossom: '#f3e7ea',
    green: '#d3dbc5',
    trunk: '#cdb38a',
    mosaic1: '#d8c29c',
    mosaic2: '#ece0c8',
    facade1: '#f6f5f1',
    facade2: '#f1f0eb',
    facade3: '#f4f2ee',
    facade4: '#eeede8',
    facade5: '#f8f7f3',
    paving: '#eeeae2',
    bronze: '#b8976a',
    eave: '#c2a983',
    copper: '#b39a74',
    ochre: '#efe3c6',
    plinth: '#d8c6a3',
    tin: '#d6bc94',
    amber: '#dcc49c',
    // зградите на Магнолија (world/landmarks/magnolija.js)
    plaster: '#f8f7f3',
    peach: '#f1e8dc',
    wood: '#c9ae82',
    // Хераклеа (world/landmarks/heraclea.js)
    brick: '#d9b48c',
    marble: '#f6f0e4',
    sand: '#efe2c6',
    rubble: '#dcc6a2',
    slate: '#c3ab84',
  },
  traffic: { cars: ['#f6f5f1', '#e6cc9f', '#ecebe6', '#d8be8f'], people: ['#f4f3ef', '#e2c697', '#d6d3cb'] },
  trees: {
    crowns: ['#dfe4d6', '#e7eadf', '#d6dccb'],
    forest: ['#cfd6c2', '#d8decd'],
  },
  night: { lamp: '#ffe2b0', windows: { ratio: 0.38 } },
  // ноќ во „студио“: темна сива позадина, ладна месечина
  times: {
    night: { sky: { top: '#0b0d12', bottom: '#20242c' }, fog: { color: '#1d2028' }, hemi: { sky: '#4a5470', ground: '#1a1c22' } },
  },

  sky: { top: '#d6d9da', bottom: '#f5f4f1' },
  fog: { color: '#efeeea', near: 7000, far: 24000 },
  light: {
    sun: { color: '#ffffff', intensity: 2.1, azimuth: 250, elevation: 42 },
    hemi: { sky: '#ffffff', ground: '#d9d3c8', intensity: 1.75 },
    shadow: 0.55,
    toneMapping: 'neutral',
    exposure: 1.0,
  },
  ui: { paper: '#f5f4f1' },

  materials(ctx) {
    const m = lambertSet(ctx);
    withContours(m.terrain, { step: 10, major: 5, minor: 0.1, strong: 0.2, color: '#7a7368' });
    withLayers(m.skirt, { step: 12, a: '#dcc49b', b: '#d2b88c', seam: '#9a8058' });
    return m;
  },

  post(ctx) {
    // длабочина на поле како кај фотографија на макета (tilt-shift) — само врз сликата
    const tilt = createTiltShift({ focus: 0.5, band: 0.12, maxBlur: ctx.profile.name === 'mobile' ? 4 : 7 });
    if (ctx.profile.name === 'mobile') return { before: [], after: tilt.passes, tilt };
    const { width, height, dpr } = ctx.size;
    const ao = new GTAOPass(ctx.scene, ctx.camera, width * dpr, height * dpr);
    ao.perfName = 'gtao';
    ao.output = GTAOPass.OUTPUT.Default;
    ao.blendIntensity = 0.9;
    ao.updateGtaoMaterial({ radius: 8, distanceExponent: 1.5, thickness: 2, scale: 1.2, samples: 12 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    return { before: [ao], after: tilt.passes, ao, tilt };
  },

  /** По кадар: замаглувањето е посилно на близина (минијатура); радиусот на AO расте со растојанието. */
  update(ctx, post) {
    const d = ctx.camera.position.distanceTo(ctx.controls.target);
    post?.tilt?.setAmount(Math.min(1, Math.max(0.15, 1.6 - Math.log10(d) * 0.42)));
    if (!post?.ao) return;
    const r = Math.min(40, Math.max(2.5, d * 0.012));
    if (Math.abs(r - (post._aoR || 0)) > 0.5) {
      post.ao.updateGtaoMaterial({ radius: r });
      post._aoR = r;
    }
  },
};
