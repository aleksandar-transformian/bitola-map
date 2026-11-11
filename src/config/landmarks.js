// Знаменитости што се моделираат рачно (процедурално, од основата во OSM).
// osm: 'w<id>' = линија, 'r<id>' = релација. Обичната истисната зграда со истиот OSM id
// се отстранува од слојот на зградите и наместо неа се црта моделот.
// rank: 0 = главни (натписот има предност), 1 = останати; label: false = без натпис.
// at: { lat, lon } = рачна точна позиција (WGS84), има предност пред OSM; со inside: true —
//   зградата во дворот на која покажува точката (наместо најголемата).
// group = група во менито „Оди до…“; view = поглед ({bearing, polar, distance}) наместо стандардниот.
// parts: дополнителни OSM делови ('w…'/'r…' = основа, 'n…' = точка); flatten: { lat, lon, r, blend }
//   = израмнување на релјефот во обработката (рамно место што Terrain Tiles не го гледа).
// Модели и опции: src/world/landmarks/models.js.
//
// Позициите и основите се од OSM; моделите се стилизирани (препознатливи, не архитектонски точни).

export const LANDMARKS = [
  // ── главни ──
  { id: 'saat-kula', group: 'Центар', name: 'Саат Кула', osm: 'w1335734377', model: 'clockTower', rank: 0 },
  {
    id: 'jeni-dzamija', group: 'Цркви и џамии',
    name: 'Јени џамија',
    osm: 'w38575706',
    model: 'mosque',
    rank: 0,
    // Во OSM е означена само како музеј/галерија; позицијата (северно од Магнолија,
    // источно од Саат Кула) одговара на Јени џамија — да се потврди.
    opts: { dome: 7.2, hall: 16, minaret: 34, porticoDomes: 3 },
  },
  { id: 'ajdar-kadi', group: 'Цркви и џамии', name: 'Ајдар-кади џамија', osm: 'w192121734', model: 'mosque', rank: 0, opts: { dome: 6.2, hall: 14, minaret: 28, porticoDomes: 3 } },
  { id: 'bezisten', group: 'Центар', name: 'Безистен', osm: 'w1143767501', model: 'bezisten', rank: 0 },
  { id: 'oficerski-dom', group: 'Центар', name: 'Офицерски дом', osm: 'w1102567439', model: 'officersHome', rank: 0 },
  { id: 'sv-dimitrija', group: 'Цркви и џамии', name: 'Св. Димитрија', osm: 'w38582552', model: 'church', rank: 0 },
  { id: 'magnolija', group: 'Центар', name: 'Плоштад Магнолија', osm: 'r20052087', model: 'square', rank: 0 },
  // коњаничка статуа на висок постамент (n4411126494 „Статуа Филип II“); точна позиција од
  // сопственикот (Google Maps). Коњаникот е свртен кон Магнолија и влезот на Широк Сокак —
  // со грбот кон Саат Кула (backTo).
  {
    id: 'filip-vtori', group: 'Центар',
    name: 'Споменик на Филип II Македонски',
    node: 'n4411126494',
    at: { lat: 41.0301915, lon: 21.3347793 },
    model: 'equestrian',
    rank: 0,
    opts: { pedestal: 9, backTo: 'saat-kula' },
    view: { bearing: 135, polar: 64, distance: 85 },
  },
  // фонтаната на Магнолија (кружна, w1464455372) — посебно од споменикот; точна позиција од сопственикот
  { id: 'magnolija-fontana', name: 'Фонтана', osm: 'w1464455372', at: { lat: 41.0302792, lon: 21.3346646 }, model: 'fountain', rank: 2, label: false },
  { id: 'shirok-sokak', group: 'Центар', name: 'Широк Сокак', street: 'Широк Сокак', model: 'promenade', buffer: 26, rank: 0 },
  { id: 'herakleja', group: 'Историја и спомен-места', name: 'Хераклеа Линкестис', osm: 'w37956139', model: 'heraclea', parts: { theater: 'w226160304' }, rank: 0 },

  // ── џамии ──
  { id: 'isak-dzamija', group: 'Цркви и џамии', name: 'Исак џамија', osm: 'w38581757', model: 'mosque', rank: 1, opts: { dome: 8.5, hall: 20, minaret: 32, porticoDomes: 5 } },
  { id: 'hadzi-mahmud', group: 'Цркви и џамии', name: 'Хаџи Махмуд бег', osm: 'w717943748', model: 'mosque', rank: 1, opts: { dome: 6, hall: 15, minaret: 26, porticoDomes: 3 } },

  // ── цркви и манастири ──
  { id: 'presveto-srce', group: 'Цркви и џамии', name: 'Пресвето Срце Исусово', osm: 'w1070850326', model: 'church', rank: 1, opts: { tower: 'front', spire: true, dome: false, wallH: 11 } },
  { id: 'presveta-bogorodica', group: 'Цркви и џамии', name: 'Пресвета Богородица', osm: 'w210252893', model: 'church', rank: 1, opts: { towerH: 24 } },
  { id: 'sv-nedela', group: 'Цркви и џамии', name: 'Св. Недела', osm: 'w210253741', model: 'church', rank: 1, opts: { towerH: 20, wallH: 8 } },
  { id: 'star-manastir', group: 'Цркви и џамии', name: 'Стар Битолски Манастир', osm: 'w1134050922', model: 'monastery', rank: 1 },
  { id: 'nov-manastir', group: 'Цркви и џамии', name: 'Нов Битолски Манастир', osm: 'w1331445406', model: 'monastery', rank: 1 },

  // ── јавни згради ──
  // Дом на културата (Смилевски и Мушич, 1976–1980): бакарни покриви, скалести волумени;
  // главната фасада гледа кон паркот на исток (front = насока во светот, x = исток, z = југ)
  { id: 'dom-na-kultura', group: 'Јавни згради', name: 'Дом на култура', osm: 'w38065297', model: 'culturalCenter', rank: 1, opts: { front: [1, 0] } },
  { id: 'opshtina', group: 'Јавни згради', name: 'Општина Битола', osm: 'w789965987', model: 'publicBuilding', rank: 1, opts: { height: 17, roof: 'flat', part: 'wall', floors: 5, flag: true } },
  // „Горна гимназија“ — СОУ „Јосип Броз Тито“: главната зграда во дворот на училиштето
  // главната зграда е до главната улица (точка од сопственикот); најголемата во дворот е спортската сала
  { id: 'gorna-gimnazija', group: 'Јавни згради', name: 'Горна гимназија', osm: 'w991753317', inside: true, at: { lat: 41.0321394, lon: 21.3284611 }, model: 'gymnasium', rank: 1, opts: { front: [0, 1] } }, // фасадата кон Драгор (на југ од зградата)
  { id: 'muzej', group: 'Јавни згради', name: 'Музеј на Битола', osm: 'r17362023', model: 'publicBuilding', rank: 1, opts: { height: 10, roof: 'tiles', part: 'wall2', floors: 2 } },
  { id: 'zandan-kule', group: 'Историја и спомен-места', name: 'Зандан Куле', osm: 'w992188624', model: 'stoneTower', rank: 1 },
  { id: 'stanica', group: 'Јавни згради', name: 'Железничка станица', osm: 'w333585687', model: 'station', rank: 1 },
  { id: 'stadion', group: 'Јавни згради', name: 'Стадион „Тумбе Кафе“', osm: 'w38006058', model: 'stadium', rank: 1 },
  { id: 'tvrdina', group: 'Историја и спомен-места', name: 'Битолска тврдина', osm: 'w1127758201', model: 'fortress', rank: 1 },

  // ── спомен-гробишта ──
  { id: 'totenborg', group: 'Историја и спомен-места', name: 'Германски воени гробишта (Тотенборг)', osm: 'w210250978', model: 'totenburg', rank: 1 },
  { id: 'francuski-grobishta', group: 'Историја и спомен-места', name: 'Француски воени гробишта', osm: 'w1050777115', model: 'warCemetery', parts: { memorial: 'w1217195019' }, rank: 1 },
  { id: 'srpski-grobishta', group: 'Историја и спомен-места', name: 'Српски воени гробишта', osm: 'w1050747139', model: 'warCemetery', opts: { chapel: true }, rank: 1 },

  // ── Битолскиот филџан: скулптура на кружниот тек „11. Бригада“ (западен влез) ──
  // точна позиција од сопственикот (Google Maps: 41.0329632, 21.3160347)
  { id: 'fildzan', group: 'Историја и спомен-места', name: 'Битолскиот филџан', roundabout: 'w196560544', at: { lat: 41.0329632, lon: 21.3160347 }, model: 'fildzan', rank: 1 },

  // ── „Кај авионите“: рамна ливада (дел од поранешната касарна) со два изложени авиони ──
  // F-86 „Сејбр“ на ВВС на СФРЈ, служеле за вежби. Местото: точка од сопственикот (Google Maps);
  // авионите: OSM (historic=aircraft) — Ф-86Е (северно) и Ф-86Д (јужно, со радарски нос).
  // Насоката (heading, степени од север, во насока на стрелките) и кружните патеки (pad, m)
  // се од сателитската снимка: двата се свртени со носот кон север.
  {
    id: 'kaj-avionite', group: 'Историја и спомен-места',
    name: 'Кај авионите',
    at: { lat: 41.0188323, lon: 21.3293992 },
    parts: { f86e: 'n9653138816', f86d: 'n9653178117' },
    // ливадата е рамна (израмнета за вежбите), а релјефот од Terrain Tiles таму паѓа ~1 m на 10 m
    flatten: { lat: 41.018765, lon: 21.32933, r: 32, blend: 35 },
    model: 'jets',
    rank: 1,
    opts: {
      planes: [
        { part: 'f86e', heading: 0, pad: 7.5 },
        { part: 'f86d', heading: 8, pad: 10, radome: true },
      ],
    },
    view: { bearing: 200, polar: 56, distance: 95 },
  },
];
