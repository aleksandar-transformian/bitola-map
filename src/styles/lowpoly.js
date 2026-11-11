// „Low-poly“ — фасетирана, модерна Битола: рамно сенчење (секој триаголник една боја),
// четиристрешни покриви, дрвја-конуси, пригушена пастелна палета со теракота.
// Најлесниот стил: без пост-процесирање; сенки само на десктоп.

import { lambertSet } from './shared/materials.js';

export default {
  id: 'lowpoly',
  name: 'Low-poly',
  tagline: 'фасетирано и модерно',
  swatch: 'conic-gradient(from 45deg, #e8d9c4 0 25%, #c9785a 0 50%, #8fae8b 0 75%, #7aa3b8 0)',

  geometry: { roofs: 'hip', trees: 'cone' },

  ground: {
    painter: 'flat',
    base: '#d8d3bd',
    edge: '#9b8a73',
    areas: {
      farmland: '#dcd5b8',
      meadow: '#c6cfa6',
      orchard: '#b3c495',
      scrub: '#a9b98d',
      forest: '#8fa983',
      residential: '#e6e1d6',
      commercial: '#e4dfd6',
      industrial: '#d9d6d0',
      military: '#d4d0c2',
      education: '#e6dfcd',
      cemetery: '#b2c0a2',
      grass: '#b9c99c',
      park: '#a3bd8f',
      sports: '#adc597',
      parking: '#d7d4ce',
      plaza: '#ece6da',
      wetland: '#b1c6b6',
      sand: '#e2d7bb',
      water: '#86aec2',
    },
  },

  roads: {
    motorway: '#e9c98f',
    trunk: '#ecd09c',
    primary: '#efd8ab',
    secondary: '#f2e6cb',
    tertiary: '#f4efe5',
    residential: '#f1ede6',
    service: '#ebe7df',
    pedestrian: '#efe4d2',
    footway: '#e3d8c5',
    track: '#c7b493',
  },
  rail: ['#7f756c', '#a59d94'],
  water: '#7aa3b8',

  buildings: {
    // [ѕид, рамен покрив]; косите (четиристрешни) покриви се од roofAlt
    generic: ['#efe8dc', '#cfc6b8'],
    house: ['#f1e6d3', '#cfc4b3'],
    apartments: ['#e9e4dc', '#c8c3bb'],
    commercial: ['#e3e6e6', '#c4c8c9'],
    industrial: ['#dedbd5', '#bcb8b1'],
    civic: ['#efdccb', '#b87458'],
    religious: ['#f3ebde', '#b06a4f'],
    small: ['#e3dbcf', '#bdb2a4'],
    historic: ['#ecd9bf', '#b06a4f'],
    roofAlt: ['#c9785a', '#bf6e52', '#d08566', '#b8735b', '#c48a6e'],
    variation: 0.06,
    ao: 0.8,
  },

  landmarks: {
    wall: '#f1e8d8',
    wall2: '#e8c9b3',
    stone: '#ddd2bf',
    roof: '#c9785a',
    dome: '#8fa7b6',
    metal: '#6b6a68',
    accent: '#faf6ee',
    window: '#7d93a3',
    light: '#f5d48c',
    water: '#86aec2',
    blossom: '#e9b1c0',
    green: '#9ab78a',
    trunk: '#7a6150',
    mosaic1: '#c06d50',
    mosaic2: '#e6d3a8',
    facade1: '#ecd3a8',
    facade2: '#e7beab',
    facade3: '#cdd9bf',
    facade4: '#efe3c3',
    facade5: '#c5d5df',
    paving: '#e6dac4',
    bronze: '#5f6d63',
  },
  traffic: { flat: true, cars: ['#c9785a', '#e8e1d4', '#7aa3b8', '#8fae8b', '#5f6670', '#d9b56b'], people: ['#c9785a', '#7aa3b8', '#8fae8b', '#e3d3b4', '#6d665e'] },
  trees: {
    crowns: ['#8fae8b', '#9cb78f', '#83a585', '#a8bd92'],
    forest: ['#7a9a7b', '#86a585', '#6f8f72'],
  },
  night: { lamp: '#ffcf86', windows: { ratio: 0.4 } },

  sky: { top: '#a8c4d6', bottom: '#eceee9' },
  fog: { color: '#e5e8e4', near: 6000, far: 22000 },
  light: {
    sun: { color: '#fff6e8', intensity: 2.5, azimuth: 230, elevation: 40 },
    hemi: { sky: '#eef2f4', ground: '#b9ad99', intensity: 1.35 },
    shadow: 0.5,
    toneMapping: 'neutral',
    exposure: 1.0,
  },
  ui: { paper: '#f4f2ed' },

  materials(ctx) {
    const m = lambertSet(ctx, { skirt: '#a8967c' });
    for (const mat of Object.values(m)) mat.flatShading = true;
    return m;
  },
};
