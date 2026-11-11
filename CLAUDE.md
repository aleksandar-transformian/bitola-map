# Битола — 3Д мапа (упатство за работа)

Статичен сајт (без backend) што ја прикажува Битола како интерактивна, илустрирана 3Д мапа.
three.js + Vite, чист JavaScript (ES модули), без framework. Се објавува на GitHub Pages.

## Команди

```bash
npm install                 # зависности
npm run dev                 # dev сервер на http://127.0.0.1:5173/
npm run build               # продукциски build во dist/
npm run preview             # преглед на dist/

npm run data:fetch:osm      # OSM преку Overpass → data/raw/osm.json.gz (бара пристап до Overpass)
npm run data:fetch:terrain  # Terrain Tiles → data/cache/terrain/ (не се комитува)
npm run data:build          # обработка → public/data/*.bin, *.json
npm run data                # сè погоре по ред

npm run shot -- --views home,center,close,west,top   # screenshot-ови + мерења (dev серверот мора да работи)
npm run shot -- --mobile --views home                 # мобилен профил (iPhone 13)
```

URL параметри: `?debug` (FPS, повици, триаголници, време), `?profile=mobile|desktop`.

## Архитектура

```
src/config/region.js     ← ЕДИНСТВЕНОТО место за опфатот (bbox), почетна точка, зум на релјефот
src/config/classes.js    ← enum класи (улици, површини, згради) — дел од форматот на податоците
src/config/zones.js      ← зони за проценка на висини (чаршија, Широк Сокак, центар)
src/lib/pack.js          ← бинарен контејнер .bin (encode во Node, decode во прелистувач)
src/world/heightfield.js ← мрежа со висини + sample(x,z); заедничка за Node и прелистувач
src/world/*.js           ← градење геометрија од податоците (релјеф, подлога, згради, ленти, небо)
src/style/basic.js       ← палета/светла (фаза 1; во фаза 2 → систем за стилови)
src/data/loader.js       ← вчитување на public/data/*
src/ui/                  ← интерфејс (наслов, атрибуција, вчитување)
src/main.js              ← сцена, камера, контроли, јамка
scripts/data/            ← Node скрипти: fetch-osm, fetch-terrain, build (+ lib/)
scripts/dev/screenshot.mjs ← Playwright: screenshot-ови, време на вчитување, FPS
.github/workflows/data-fetch.yml ← Overpass симнување на GitHub Actions (комитува data/raw/)
```

Тек на податоците: OSM (Overpass) + Terrarium PNG → `scripts/data/build.mjs` → `public/data/`
(комитувани, ~1.2 MB) → прелистувачот ја гради геометријата при вчитување (~250 ms).

Координати: локални метри околу Саат кула (`REGION.origin`); x = исток, z = југ, y = нагоре.
Во .bin фајловите координатите се Int16 со чекор 0.25 m (опсег ±8.19 km од почетната точка).

Принцип за стилови (од фаза 2): податоците и геометријата се градат еднаш; стилот е посебен слој
(палета, материјали, шејдери, пост-процесирање, светла, магла, небо). Секој објект во сцената што
зависи од бои има `userData.recolor(style)` / `userData.restyle(style)`.

## Конвенции

- Код: ES модули, без TypeScript, без framework. Коментари и UI текст на македонски.
- UI на македонски со правилен правопис; наслов „Битола“; кирилица.
- Атрибуција секогаш видлива (и на телефон): „© соработниците на OpenStreetMap“ + Terrain Tiles.
- Оригинална работа: не се копира код, шејдери, текстови ни дизајн од други проекти без лиценца.
- Нови податочни класи се додаваат само на крајот од низите во `classes.js`.
- По секоја поголема визуелна промена: `npm run shot` и поглед на сликите.
  Headless Chromium рендерира софтверски (SwiftShader) — FPS таму е само за споредба.
- `localStorage` секогаш во try/catch.

## Git тек

- `develop` — интеграциска гранка (ќе стане default); feature гранките се спојуваат таму.
- `main` — објавува на GitHub Pages. **Push на `main` само по изречна дозвола од сопственикот.**
- Спецификации и план: `docs/specs/`; одлуки, бројки и проблеми: `docs/NOTES.md`.

## Мрежни ограничувања во cloud сесии

Overpass/OSM хостовите може да се блокирани од proxy-то во сесијата. Тогаш: push на промена во
`src/config/region.js` или `scripts/data/fetch-osm.mjs` (или рачно стартување) го пушта
`data-fetch.yml` на GitHub Actions, кој ги комитува свежите `data/raw/*` назад на гранката;
потоа `git pull` и `npm run data:build` локално. Terrain Tiles (S3) обично се достапни.
