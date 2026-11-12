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
  // Хераклеа одблиску: од локалитетот кон театарот (аркадата на сцената) и од горе кон базиликата
  { id: 'her-teatar', target: { x: 625, z: 2150 }, bearing: 170, polar: 70, distance: 120 },
  { id: 'her-bazilika', target: { x: 635, z: 2195 }, bearing: 320, polar: 58, distance: 130 },
  { id: 'her-gore', target: { x: 630, z: 2175 }, bearing: 0, polar: 1, distance: 260 },
  // Зоолошката градина и југот (натписот на Буковски Ливади)
  { id: 'zoo', target: { x: 560, z: 1740 }, bearing: 140, polar: 55, distance: 330 },
  { id: 'zoo-blisku', target: { x: 600, z: 1720 }, bearing: 150, polar: 62, distance: 130 },
  { id: 'jug', target: { x: 800, z: 2400 }, bearing: 20, polar: 50, distance: 1600 },
];
