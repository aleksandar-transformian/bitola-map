// Фаза 1: еден едноставен, светол дневен стил.
// Во фаза 2 ова станува модул од системот за стилови (styles/<име>.js).

export const basicStyle = {
  id: 'basic',
  name: 'Основен',

  sky: { top: '#9cc3e4', bottom: '#eef3f2' },
  fog: { color: '#e7ecea', near: 6000, far: 22000 },
  sun: { color: '#fff1dc', intensity: 2.4, azimuth: 215, elevation: 38 },
  hemi: { sky: '#e4edf5', ground: '#b9ab8f', intensity: 1.5 },

  ground: {
    base: '#d9d3b4', // нива / ливада без landuse
    edge: '#8b7d66', // бочните страни на теренот
    areas: {
      farmland: '#e1d9b2',
      meadow: '#cfd5a0',
      orchard: '#bfcf92',
      scrub: '#b3c086',
      forest: '#8fab74',
      residential: '#e8e2d6',
      commercial: '#e6dccf',
      industrial: '#dcd6cf',
      military: '#d6d2c3',
      education: '#e9e0cc',
      cemetery: '#bfcaa8',
      grass: '#c3d699',
      park: '#a9c98a',
      sports: '#b8d39a',
      parking: '#d8d4cc',
      plaza: '#efe6d6',
      wetland: '#b7cbb0',
      sand: '#e3d6b8',
      water: '#86b8cf',
    },
  },

  water: { color: '#7fb2cb' },
  rail: { color: '#7d726a' },

  roads: {
    motorway: '#f2c76b',
    trunk: '#f2cf7f',
    primary: '#f6dc9a',
    secondary: '#fbf0cd',
    tertiary: '#fbf6e9',
    residential: '#f7f4ee',
    service: '#efebe4',
    pedestrian: '#f4e9d6',
    footway: '#e7d9c2',
    track: '#c9b896',
  },

  buildings: {
    // [ѕид, покрив] по класа (BUILDING во config/classes.js)
    generic: ['#efe8dc', '#c9b8a6'],
    house: ['#f1e6d4', '#c98f6c'],
    apartments: ['#ece6de', '#b9b2aa'],
    commercial: ['#e9e4dc', '#bdb8b0'],
    industrial: ['#ddd9d2', '#b0aca5'],
    civic: ['#efe2cf', '#c2a58a'],
    religious: ['#f3ecdf', '#b88d6a'],
    small: ['#e0d8cc', '#a99f94'],
    historic: ['#eadcc3', '#b48466'],
    variation: 0.07, // случајно варирање на осветленоста
    ao: 0.55, // колку се затемнува дното на ѕидот
  },
};
