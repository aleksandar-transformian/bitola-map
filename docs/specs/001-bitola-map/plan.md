# Технички план

## Податочен тек

```
Overpass API ──(GitHub Actions: data-fetch.yml)──► data/raw/osm.json.gz   (комитуван)
AWS Terrain Tiles (Terrarium, z14) ──────────────► data/cache/terrain/*.png (кеш)
                     │
                     ▼  scripts/data/build.mjs
public/data/  terrain.bin  buildings.bin  roads.bin  lines.bin  areas.bin  trees.bin
              pois.json  meta.json                                        (комитувани)
                     │
                     ▼  прелистувач (src/data/loader.js + src/world/*)
геометрија во меморија: релјеф, подлога (canvas), ленти, згради
```

## Формат `.bin`

`src/lib/pack.js`: `"BTM1"` + должина + JSON заглавје (`meta`, список на низи) + типизирани
низи порамнети на 8 B. Координати Int16 × 0.25 m во локалниот систем (x = исток, z = југ).
Полигоните: `polyRing` (индекс на прв прстен по полигон) → `ringPt` (индекс на прва точка по
прстен) → `coords`. Полилиниите: `linePt` → `coords`. Атрибутите се паралелни низи по објект.

## Слоеви на сцената

| слој | геометрија | зависи од стил преку |
|---|---|---|
| небо | сфера со градиент | uniforms |
| релјеф | мрежа (stride 1/2) + бочни страни | материјал, текстура на подлогата |
| подлога | canvas → CanvasTexture | `paint(style)` |
| улици / пруга / вода | ленти (ribbons) по релјефот | вертекс бои (`recolor`) |
| згради | една споена геометрија, групи ѕид/покрив | вертекс бои (`recolor`), материјали |
| светла / магла | DirectionalLight (сенки) + HemisphereLight | параметри |

## Систем за стилови (спроведен во фаза 2)

Интерфејсот е опишан во `src/styles/index.js`. Секој стил е податочен објект + неколку функции:

```js
// src/styles/<id>.js
export default {
  id, name, tagline, swatch,             // „razglednica“, „Разгледница“, …
  geometry: { roofs: 'flat' | 'gabled' },
  ground: { painter: 'flat' | 'watercolor', base, areas: {...}, washes?, outline? },
  roads: {...}, rail: [..], water, buildings: { класа: [ѕид, покрив], roofAlt?, variation, ao },
  sky, fog, light: { sun, hemi, shadow, toneMapping, exposure }, ui: { paper },
  materials(ctx) → { terrain, skirt, walls, roofs, roads, rail, water },
  post(ctx)?     → { before: Pass[], after: Pass[] },   // before = HDR (AO, DOF), after = sRGB (хартија)
  update(ctx, post)?                                     // по кадар (фокус на DOF, радиус на AO)
};
```

`src/styles/manager.js` при смена: (1) снимка на тековниот кадар во `#fade` за претопување;
(2) ако `geometry.roofs` се разликува — нова геометрија на зградите (кеш на десктоп) и анимација
„растење“; (3) нови материјали (додатоци: `withGrow`, `withContours`, `withLayers`), старите се
ослободуваат; (4) бои по теме и ново цртање на подлогата; (5) светла, магла, небо, tone mapping;
(6) нови пост-пасови; (7) тема на интерфејсот преку `html[data-style]`.

## Ризици

- ~~Покриеност на OSM згради~~ — решено со Overture/Microsoft (20.5 k згради).
- Меморија на iOS: текстурата на подлогата (4096² = 64 MB) → мобилниот профил користи 2048².
- Проценка на висини е груба — знаменитостите и Широк Сокак ќе се моделираат рачно.
