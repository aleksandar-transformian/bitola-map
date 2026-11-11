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

## Систем за стилови (фаза 2 — нацрт)

```js
// styles/<id>.js
export default {
  id, name,                     // „Разгледница“…
  palette: {...},               // бои на површини, згради, улици
  geometry: { roofs: 'flat' | 'pitched' | 'lowpoly', trees: 'round' | 'lowpoly' },
  createMaterials(ctx),         // материјали/шејдери
  lights(ctx), fog, sky,
  post(ctx),                    // пост-процесирање (EffectComposer passes)
  dispose(),
};
```

Менаџерот на стилови: споредува `geometry` со тековниот стил → пресоздава само слоевите што се
разликуваат (со анимација на премин), а за останатите повикува `recolor/restyle`.

## Ризици

- **Покриеност на OSM згради** (4.5 k) — предлог: дополнување од Overture/Microsoft (види NOTES).
- Меморија на iOS: текстурата на подлогата (4096² = 64 MB) → мобилниот профил користи 2048².
- Проценка на висини е груба — знаменитостите и Широк Сокак ќе се моделираат рачно.
