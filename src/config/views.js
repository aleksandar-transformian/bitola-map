// Брзи погледи. target = точка во локални метри (x = исток, z = југ),
// bearing = компасен азимут од целта до камерата, polar = агол од вертикала, distance во m.

export const VIEWS = [
  { id: 'pregled', name: 'Преглед', target: { x: -300, z: 900 }, bearing: 25, polar: 55, distance: 6200 },
  // по должината на пешачката улица, од Магнолија кон Офицерскиот дом
  { id: 'shirok-sokak', name: 'Широк Сокак', target: { x: 95, z: 330 }, bearing: 344, polar: 64, distance: 430 },
  // од споменикот на Филип II кон влезот на Широк Сокак (зградите на Магнолија)
  { id: 'vlez-shirok-sokak', name: 'Влез на Широк Сокак', target: { x: 4, z: 70 }, bearing: 345, polar: 72, distance: 55 },
  { id: 'charshija', name: 'Чаршија', target: { x: 40, z: -150 }, bearing: 205, polar: 56, distance: 480 },
  { id: 'gradski-park', name: 'Градски парк', target: { x: 440, z: 1180 }, bearing: 330, polar: 54, distance: 1200 },
  { id: 'herakleja', name: 'Хераклеа', target: { x: 625, z: 2150 }, bearing: 25, polar: 55, distance: 300 },
];

// Дополнителни погледи за проверки и мерења (scripts/dev/screenshot.mjs, perf/bench.js) —
// не се во менито.
export const CHECK_VIEWS = [
  { id: 'center', target: { x: 0, z: 0 }, bearing: 200, polar: 55, distance: 900 },
  { id: 'close', target: { x: 30, z: -60 }, bearing: 160, polar: 62, distance: 350 },
  { id: 'west', target: { x: -2500, z: 800 }, bearing: 70, polar: 65, distance: 4500 },
  { id: 'top', target: { x: -500, z: 400 }, bearing: 0, polar: 1, distance: 11000 },
  // крупни планови на знаменитостите
  { id: 'saat', target: { x: -40, z: -20 }, bearing: 215, polar: 62, distance: 170 },
  { id: 'dimitrija', target: { x: -82, z: 68 }, bearing: 140, polar: 58, distance: 160 },
  { id: 'filip', target: { x: -18, z: 38 }, bearing: 135, polar: 64, distance: 85 },
  { id: 'dom', target: { x: -8, z: 292 }, bearing: 115, polar: 58, distance: 160 }, // како воздушната фотографија од паркот
  { id: 'dom-front', target: { x: 10, z: 285 }, bearing: 68, polar: 76, distance: 120 }, // фронтално од паркот
  { id: 'gimnazija', target: { x: -542, z: -162 }, bearing: 182, polar: 72, distance: 80 }, // од кејот на Драгор
  { id: 'gimnazija-agol', target: { x: -540, z: -163 }, bearing: 140, polar: 72, distance: 65 },
  // сообраќај и пешаци: Широк Сокак и булеварот до Магнолија одблиску
  { id: 'traffic', target: { x: 60, z: 200 }, bearing: 150, polar: 62, distance: 240 },
  // зградите на Магнолија од споменикот (како на фотографиите на сопственикот)
  // камерата е на плоштадот источно од споменикот (не во ресторанот „Грне“)
  { id: 'mag-red', target: { x: -25, z: 73 }, bearing: 43, polar: 77, distance: 41 },
  { id: 'mag-plostad', target: { x: 10, z: 58 }, bearing: 300, polar: 68, distance: 90 },
  // штитот-фонтана и споменикот одозгора, кон Широк Сокак (како фотографијата од дрон)
  // ресторан „Грне“ од југозапад (главната фасада со балконот и летната тераса)
  { id: 'grne', target: { x: 12, z: 37 }, bearing: 205, polar: 74, distance: 30 },
  // западно од Магнолија (кон Саат Кула): плоштадот од север, улицата 11 Октомври, Алта Банка
  { id: 'mag-zapad', target: { x: -40, z: 52 }, bearing: 33, polar: 76, distance: 46 },
  { id: 'oktomvri', target: { x: -50, z: 46 }, bearing: 11, polar: 76, distance: 30 },
  { id: 'banka', target: { x: -78, z: 32 }, bearing: 343, polar: 74, distance: 38 },
  // Јорго Османо од банката кон Саат Кула (книжарница, дуќани, бр. 8, coffee house на аголот)
  { id: 'osmano', target: { x: -100, z: 6 }, bearing: 62, polar: 70, distance: 34 },
  // раскрсницата со „Петар Петровиќ-Његош“: кебапчилницата „Охрид“ од југоисток, улицата кон запад
  { id: 'kebab', target: { x: -125, z: -40 }, bearing: 120, polar: 78, distance: 30 },
  { id: 'njegos', target: { x: -138, z: -45 }, bearing: 95, polar: 74, distance: 40 },
  // паркот: фонтаната и стаклото над ископините пред Јени џамија, живите огради
  { id: 'jeni-park', target: { x: -12, z: -30 }, bearing: 255, polar: 66, distance: 34 },
  { id: 'park-ogradi', target: { x: -115, z: -62 }, bearing: 30, polar: 62, distance: 45 },
  { id: 'osmano-agol', target: { x: -116, z: -22 }, bearing: 20, polar: 72, distance: 32 },
  // Трговски центар Стаклена: од Магнолија (запад) и од улицата Добривое Радосављевиќ (север)
  { id: 'staklena', target: { x: 48, z: 30 }, bearing: 250, polar: 60, distance: 72 },
  { id: 'staklena-sever', target: { x: 52, z: 28 }, bearing: 15, polar: 68, distance: 62 },
  // Магаза и нејзиниот двор од плоштадот (југ)
  { id: 'magaza', target: { x: 31, z: 77 }, bearing: 345, polar: 72, distance: 24 },
  { id: 'mag-fontana', target: { x: -15, z: 42 }, bearing: 315, polar: 52, distance: 48 },
];
