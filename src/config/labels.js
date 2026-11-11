// Натписи: населби (од OSM place=*) и рачно додадени места што ги нема во OSM.
// Знаменитостите добиваат натпис автоматски (config/landmarks.js).

/** Кои OSM места се прикажуваат и со каков ранг (помал = поважен). */
export const PLACE_RANK = {
  'place:quarter': 2,
  'place:neighbourhood': 2,
  'place:suburb': 2,
  'place:locality': 3,
  'place:village': 3,
};

/** Имиња од OSM што не се прикажуваат (дупликати или премногу ситни). */
export const PLACE_SKIP = new Set(['Битола', 'Стара чаршија', 'Кај Авионите']); // „Кај Авионите“ = знаменитост

/**
 * Рачно додадени места. approx: true = приближна позиција (ја нема во OSM);
 * види docs/NOTES.md — да се потврди.
 */
export const EXTRA_PLACES = [
  { name: 'Стара чаршија', x: 60, z: -190, rank: 2, kind: 'quarter' },
  { name: 'Јени Маале', x: 820, z: -260, rank: 2, kind: 'quarter', approx: true },
  { name: 'Буковски Ливади', x: -420, z: 2050, rank: 2, kind: 'quarter', approx: true },
  { name: 'Тумбе Кафе', x: 300, z: 1500, rank: 2, kind: 'quarter', approx: true },
  // натпис на падините на масивот (врвот е надвор од опфатот, ~12 km западно)
  { name: 'Пелистер', x: -5900, z: 2900, rank: 1, kind: 'mountain', lift: 60 },
];
