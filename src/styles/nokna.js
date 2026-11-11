// „Ноќна Битола“ — градот секогаш ноќе: речиси црна подлога, улиците светат по класа
// (Широк Сокак најмногу), многу осветлени прозорци, знаменитости под рефлектори, ѕвезди.
// Десктоп: сјај (bloom) околу светлата; телефон: без bloom — адитивните светилки го даваат ефектот.

import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { lambertSet } from './shared/materials.js';

export default {
  id: 'nokna',
  name: 'Ноќна Битола',
  tagline: 'градот под светла',
  swatch: 'radial-gradient(circle at 35% 35%, #ffc46b 0 18%, #1b2340 22% 60%, #080b16 64%)',

  // стилот е секогаш ноќ — копчињата за време се заклучени
  fixedTime: 'night',
  geometry: { roofs: 'flat', trees: 'round' },

  ground: {
    painter: 'flat',
    base: '#141a26',
    edge: '#0c1018',
    areas: {
      farmland: '#151b26',
      meadow: '#141c24',
      orchard: '#131c22',
      scrub: '#121b21',
      forest: '#0e1a1c',
      residential: '#1a1f2c',
      commercial: '#1d2130',
      industrial: '#1a1d27',
      military: '#171b24',
      education: '#1c2030',
      cemetery: '#111a1d',
      grass: '#132020',
      park: '#112321',
      sports: '#13241f',
      parking: '#1d212c',
      plaza: '#3a3225',
      wetland: '#0f1a22',
      sand: '#1d1f24',
      water: '#0a1a33',
    },
  },

  roads: {
    motorway: '#3a3530',
    trunk: '#38332e',
    primary: '#36322d',
    secondary: '#33302c',
    tertiary: '#302d2a',
    residential: '#2a2a2c',
    service: '#242528',
    pedestrian: '#4a3e2c',
    footway: '#262628',
    track: '#202124',
  },
  rail: ['#2c2c30', '#232327'],
  water: '#0d2442',

  buildings: {
    generic: ['#232838', '#1b1f2c'],
    house: ['#262a38', '#2b1f22'],
    apartments: ['#222737', '#1c202b'],
    commercial: ['#242a3a', '#1d212d'],
    industrial: ['#20242f', '#1a1d26'],
    civic: ['#2c2c3a', '#2e2224'],
    religious: ['#2e2d38', '#2e2224'],
    small: ['#1f2330', '#191c25'],
    historic: ['#302d36', '#2e2224'],
    variation: 0.08,
    ao: 0.7,
  },

  // знаменитостите се осветлени со рефлектори: топол камен + мало сопствено сјаење
  landmarks: {
    wall: '#d9c3a0',
    wall2: '#d8b498',
    stone: '#c9b28d',
    roof: '#8a5a44',
    dome: '#7d8da0',
    metal: '#3a3a40',
    accent: '#f3e6cf',
    window: '#ffd28a',
    light: '#ffe2a8',
    water: '#1f4f7a',
    blossom: '#c98aa4',
    green: '#2f4a33',
    trunk: '#3a2c22',
    mosaic1: '#8a4a36',
    mosaic2: '#b8a070',
    facade1: '#d9b88a',
    facade2: '#d4a690',
    facade3: '#b9c4a6',
    facade4: '#ddcda8',
    facade5: '#a9b9c6',
    paving: '#6a5a44',
    bronze: '#3f4a42',
    eave: '#6e4c3a',
    copper: '#22180f',
    ochre: '#d9c08a',
    plinth: '#7d6a58',
    tin: '#a8564a',
    amber: '#ffc27a',
    // зградите на Магнолија (world/landmarks/magnolija.js)
    plaster: '#e3dccd',
    peach: '#d9b393',
    wood: '#6f3a26',
  },
  traffic: { cars: ['#3a3f4a', '#2b2f38', '#4a4038', '#30363f'], people: ['#3d3a44', '#47404a', '#35383f'] },
  trees: {
    crowns: ['#14261c', '#18301f', '#112219'],
    forest: ['#0d1c15', '#10201a'],
  },
  night: {
    lamp: '#ffb257',
    windows: { ratio: 0.6 },
    // јачина на сјаењето по класа: motorway, trunk, primary, secondary, tertiary,
    // residential, service, pedestrian, footway, track
    streets: [0.42, 0.4, 0.38, 0.33, 0.28, 0.18, 0.06, 0.55, 0.05, 0.0],
  },

  // „денот“ не се користи (fixedTime), но се дефинира за интерфејсот на стилот
  sky: { top: '#03050c', bottom: '#141c33' },
  fog: { color: '#0e1426', near: 4500, far: 19000 },
  light: {
    sun: { color: '#a8bbff', intensity: 0.35, azimuth: 150, elevation: 42 },
    hemi: { sky: '#3b4c7c', ground: '#121621', intensity: 0.5 },
    shadow: 0.4,
    toneMapping: 'neutral',
    exposure: 1.15,
  },
  times: {
    night: {
      sun: { color: '#9fb2ff', intensity: 0.4, azimuth: 150, elevation: 45 },
      hemi: { sky: '#33446e', ground: '#0d1018', intensity: 0.55 },
      sky: { top: '#02040a', bottom: '#131b31' },
      fog: { color: '#0d1324' },
      shadow: 0.35,
      exposure: 1.15,
    },
  },
  ui: { paper: '#101422' },

  materials(ctx) {
    const m = lambertSet(ctx, { skirt: '#151a24' });
    // рефлектори врз знаменитостите
    m.landmarks.emissive = new THREE.Color('#3a2a16');
    return m;
  },

  /** По кадар: улиците светат целосно од далеку (тенки линии), поприглушено одблиску. */
  update(ctx) {
    const d = ctx.camera.position.distanceTo(ctx.controls.target);
    ctx.env.streetGain.value = Math.min(1, Math.max(0.3, (d - 150) / 2500));
  },

  post(ctx) {
    if (ctx.profile.name === 'mobile') return { before: [], after: [] };
    const { width, height, dpr } = ctx.size;
    // пред OutputPass (линеарен HDR): сјаат само навистина светлите делови
    const bloom = new UnrealBloomPass(new THREE.Vector2(width * dpr, height * dpr), 0.45, 0.4, 0.88);
    bloom.perfName = 'bloom';
    return { before: [bloom], after: [], bloom };
  },
};
