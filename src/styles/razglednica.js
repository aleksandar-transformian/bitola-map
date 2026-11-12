// „Разгледница“ — акварелска разгледница од Битола: топли окер и теракота тонови,
// хартија, меки рабови, без тврди контури. Куќите имаат коси покриви од ќерамиди.

import { lambertSet } from './shared/materials.js';
import { createPostcardPass } from '../render/passes/postcard.js';

const PAPER = '#f3e8d2';

export default {
  id: 'razglednica',
  name: 'Разгледница',
  tagline: 'акварел на хартија',
  swatch: 'linear-gradient(135deg, #f3e8d2 0 45%, #c8653f 45% 70%, #9cc27a 70%)',

  geometry: { roofs: 'gabled', trees: 'round' },

  ground: {
    painter: 'watercolor',
    base: '#f1e7d1',
    edge: '#d8c39c',
    washes: [
      ['#e2cc98', 0.16],
      ['#bcc68f', 0.12],
      ['#cdb6a0', 0.08],
    ],
    areas: {
      farmland: '#ebdcb0',
      meadow: '#d3d9a3',
      orchard: '#b3c77c',
      scrub: '#a7b876',
      forest: '#7ea468',
      residential: '#f3e8d3',
      commercial: '#f1e2cf',
      industrial: '#e6ddd0',
      military: '#d9ceb2',
      education: '#f0dcbc',
      cemetery: '#a7b989',
      grass: '#bcd187',
      park: '#98c275',
      sports: '#b0d083',
      parking: '#e6d9c4',
      plaza: '#f5e2c0',
      wetland: '#a6c3ab',
      sand: '#ecd6a6',
      water: '#7cb2c9',
    },
  },

  roads: {
    motorway: '#e6b464',
    trunk: '#ebc078',
    primary: '#f0cd8a',
    secondary: '#f4d9a2',
    tertiary: '#f6e3bb',
    residential: '#f8ecd2',
    service: '#f2e4c7',
    pedestrian: '#f5ddb5',
    footway: '#ead1a9',
    track: '#cdb287',
  },
  rail: ['#8a6f5c', '#ae9b8a'],
  water: '#6aa6c3',

  buildings: {
    // [ѕид, рамен покрив]; косите покриви се од roofAlt (ќерамиди)
    generic: ['#f6ead6', '#d5c4ad'],
    house: ['#f7e6cc', '#d2bfa6'],
    apartments: ['#f2e7d8', '#cfc3b4'],
    commercial: ['#f3e5d2', '#cdbfae'],
    industrial: ['#e9e1d4', '#c4bcb1'],
    civic: ['#f4e0c6', '#c99a78'],
    religious: ['#f7ecda', '#b98262'],
    small: ['#ece1cf', '#bcaa96'],
    historic: ['#f1dcbc', '#c08362'],
    roofAlt: ['#c4704f', '#cf8463', '#b9654a', '#c9906f', '#d69c78', '#ad6a52'],
    variation: 0.05,
    ao: 0.76,
  },

  landmarks: {
    wall: '#f1e2c8',
    wall2: '#e8b9a0',
    stone: '#e0cfb2',
    roof: '#c4704f',
    dome: '#98a5ad',
    metal: '#7d7a74',
    accent: '#fbf6ec',
    window: '#8b9aa2',
    light: '#f4d58a',
    water: '#7cb2c9',
    blossom: '#f1b6c5',
    green: '#8fb36a',
    trunk: '#7a5a42',
    mosaic1: '#b8654a',
    mosaic2: '#e8d4a6',
    facade1: '#f2d2a4',
    facade2: '#ebbfae',
    facade3: '#d2dfc2',
    facade4: '#f4e6c2',
    facade5: '#cad8e2',
    paving: '#e6d2ae',
    bronze: '#6d7560',
    eave: '#7d5c48',
    copper: '#5e483c',
    ochre: '#f6e1a8',
    plinth: '#b39c84',
    tin: '#b8675c',
    amber: '#c98a5e',
    // зградите на Магнолија (world/landmarks/magnolija.js)
    plaster: '#f8f1e4',
    peach: '#f0cfb6',
    wood: '#8e4a33',
    // Хераклеа (world/landmarks/heraclea.js)
    brick: '#b8664c',
    marble: '#f4efe4',
    sand: '#e8d6ae',
    rubble: '#c2ab8c',
    slate: '#6b7178',
  },
  trees: {
    crowns: ['#8fb36a', '#9cbf74', '#7ea862', '#a8c47e', '#b3b86c'],
    forest: ['#6f9a5c', '#7ea468', '#86a96a'],
  },
  night: { lamp: '#ffc27a', windows: { ratio: 0.45 } },

  sky: { top: '#b9d3e2', bottom: '#f6ebd7' },
  fog: { color: '#f2e7d1', near: 5500, far: 21000 },
  light: {
    sun: { color: '#fff0dc', intensity: 2.6, azimuth: 240, elevation: 34 },
    hemi: { sky: '#f6efe2', ground: '#c4b8ab', intensity: 1.45 },
    shadow: 0.42,
    toneMapping: 'neutral',
    exposure: 1.0,
  },
  ui: { paper: PAPER },

  materials(ctx) {
    return lambertSet(ctx, { skirt: '#d9c49f' });
  },

  post(ctx) {
    return {
      before: [],
      after: [
        createPostcardPass({
          paper: PAPER,
          low: ctx.profile.name === 'mobile',
          wobble: 2.0,
          bleed: 0.3,
          edge: 0.14,
          grain: 0.55,
          vignette: 0.6,
          warmth: 0.02,
        }),
      ],
    };
  },
};
