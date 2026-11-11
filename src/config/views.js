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
