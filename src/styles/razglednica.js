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

  geometry: { roofs: 'gabled' },

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
          vignette: 0.55,
          warmth: 0.02,
        }),
      ],
    };
  },
};
