// „Цртан филм“ — весела, едноставна Битола: чисти заситени бои, сенчење во три тона,
// темни контури (пас „мастило“ врз длабочината) и дебели рабови на парковите и реките.
// Лесен за рендерирање: без сенки, без амбиентна оклузија, без нови податоци или текстури.

import { toonSet } from './shared/materials.js';
import { InkPass } from '../render/passes/ink.js';

const INK = '#2b2521';

export default {
  id: 'crtan',
  name: 'Цртан филм',
  tagline: 'весело и едноставно',
  swatch: 'linear-gradient(135deg, #ffd23f 0 40%, #ef5b3a 40% 70%, #5bc0eb 70%)',

  geometry: { roofs: 'gabled', trees: 'round' },

  ground: {
    painter: 'flat',
    base: '#b9e08f',
    edge: '#8a6a4a',
    outline: '#5a6b3a',
    outlineWidth: 1.6,
    outlineWater: true,
    outlineSkip: ['residential', 'farmland', 'meadow', 'commercial', 'industrial'],
    areas: {
      farmland: '#cfe89a',
      meadow: '#b4dd84',
      orchard: '#9ed36f',
      scrub: '#8fcb66',
      forest: '#5fb24f',
      residential: '#f6eccf',
      commercial: '#f9e3c8',
      industrial: '#e8e1d4',
      military: '#d8d3b8',
      education: '#fde6b0',
      cemetery: '#a6d17e',
      grass: '#98d46c',
      park: '#7cc95a',
      sports: '#8fd668',
      parking: '#e2dfd8',
      plaza: '#fff3d1',
      wetland: '#9fd0b4',
      sand: '#f7df9a',
      water: '#4fb3e8',
    },
  },

  roads: {
    motorway: '#ffd23f',
    trunk: '#ffd84f',
    primary: '#ffe066',
    secondary: '#fff2a8',
    tertiary: '#ffffff',
    residential: '#ffffff',
    service: '#f7f4ee',
    pedestrian: '#ffe9c2',
    footway: '#f2dfbd',
    track: '#d9b98a',
  },
  rail: ['#6b5a4e', '#9a8a7c'],
  water: '#3aa7e2',

  buildings: {
    // [ѕид, рамен покрив]; косите покриви се од roofAlt
    generic: ['#fff1cc', '#d9cbb3'],
    house: ['#ffe6a8', '#d8c8ac'],
    apartments: ['#ffd9b8', '#cfc6bd'],
    commercial: ['#cfe7ff', '#c9d2dc'],
    industrial: ['#e7e2da', '#c4bfb8'],
    civic: ['#ffd1c1', '#e07a55'],
    religious: ['#fff4dc', '#e0623d'],
    small: ['#f3e6cf', '#c9b79e'],
    historic: ['#ffe2a6', '#e0623d'],
    roofAlt: ['#ef5b3a', '#f2703f', '#e4572e', '#f58a4b', '#d9502f'],
    variation: 0.07,
    ao: 0.82,
  },

  landmarks: {
    wall: '#fff3d6',
    wall2: '#ffc9b5',
    stone: '#efe0c2',
    roof: '#ef5b3a',
    dome: '#5b8fe0',
    metal: '#4a4a52',
    accent: '#ffffff',
    window: '#4d7fbf',
    light: '#ffe27a',
    water: '#4fb3e8',
    blossom: '#ff9ec7',
    green: '#6cc24a',
    trunk: '#8a5a36',
    mosaic1: '#e4572e',
    mosaic2: '#ffd23f',
    facade1: '#ffd166',
    facade2: '#ff9f80',
    facade3: '#9be38f',
    facade4: '#ffe8a3',
    facade5: '#8ecdf2',
    paving: '#ffe7b8',
    bronze: '#4f6b58',
    eave: '#9a5f3f',
    copper: '#7a4a36',
    ochre: '#ffd77a',
    plinth: '#c9a27e',
    tin: '#e0574a',
    amber: '#f2a65a',
    // зградите на Магнолија (world/landmarks/magnolija.js)
    plaster: '#fffaf0',
    peach: '#ffc9a8',
    wood: '#a5472b',
    // грбот на Битола (Филџанот)
    crestRed: '#e4362b',
    crestGold: '#ffc93c',
    crestBlue: '#2b59c3',
    granite: '#d0857a', // постаменти (споменик на Стив)
  },
  traffic: { cars: ['#ef3b2d', '#ffd23f', '#2f8fe0', '#2bb673', '#ff8a1f', '#ffffff', '#8e44ad'], people: ['#ef3b2d', '#2f8fe0', '#ffd23f', '#2bb673', '#ff6fb1', '#ff8a1f'] },
  trees: {
    crowns: ['#5cbf4a', '#6fcd52', '#4caf45', '#86d45e'],
    forest: ['#3f9e45', '#4caf45', '#5bb34c'],
  },
  night: { lamp: '#ffd36b', windows: { ratio: 0.5 }, flicker: { broken: true } },

  sky: { top: '#5fb8f0', bottom: '#d9f1ff' },
  fog: { color: '#d4eefc', near: 6000, far: 22000 },
  light: {
    sun: { color: '#ffffff', intensity: 2.4, azimuth: 225, elevation: 48 },
    hemi: { sky: '#ffffff', ground: '#c9b99a', intensity: 1.35 },
    shadow: 0,
    shadows: false,
    toneMapping: 'neutral',
    exposure: 1.0,
  },
  ui: { paper: '#fffaf0' },

  materials(ctx) {
    return toonSet(ctx, { skirt: '#b08a5c', levels: [0.5, 0.78, 1] });
  },

  post(ctx) {
    const ink = new InkPass(ctx.camera, { color: INK, strength: 0.85, threshold: 0.012, width: ctx.profile.name === 'mobile' ? 1 : 1.25 });
    return { before: [ink], after: [] };
  },
};
