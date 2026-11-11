// Знаменитости што се моделираат рачно (процедурално, од основата во OSM).
// osm: 'w<id>' = линија, 'r<id>' = релација. Обичната истисната зграда со истиот OSM id
// се отстранува од слојот на зградите и наместо неа се црта моделот.
//
// Позициите и основите се од OSM; моделите се стилизирани (препознатливи, не архитектонски точни).

export const LANDMARKS = [
  { id: 'saat-kula', name: 'Саат Кула', osm: 'w1335734377', model: 'clockTower' },
  {
    id: 'jeni-dzamija',
    name: 'Јени џамија',
    osm: 'w38575706',
    model: 'mosque',
    // Во OSM е означена само како музеј/галерија; позицијата (северно од Магнолија,
    // источно од Саат Кула) одговара на Јени џамија — да се потврди.
    opts: { dome: 7.2, hall: 16, minaret: 34, porticoDomes: 3 },
  },
  { id: 'ajdar-kadi', name: 'Ајдар-кади џамија', osm: 'w192121734', model: 'mosque', opts: { dome: 6.2, hall: 14, minaret: 28, porticoDomes: 3 } },
  { id: 'bezisten', name: 'Безистен', osm: 'w1143767501', model: 'bezisten' },
  { id: 'oficerski-dom', name: 'Офицерски дом', osm: 'w1102567439', model: 'officersHome' },
  { id: 'sv-dimitrija', name: 'Св. Димитрија', osm: 'w38582552', model: 'church' },
  { id: 'magnolija', name: 'Плоштад Магнолија', osm: 'r20052087', model: 'square' },
  { id: 'shirok-sokak', name: 'Широк Сокак', street: 'Широк Сокак', model: 'promenade', buffer: 26 },
  { id: 'herakleja', name: 'Хераклеа Линкестис', osm: 'w37956139', model: 'heraclea', parts: { theater: 'w226160304' } },
];
