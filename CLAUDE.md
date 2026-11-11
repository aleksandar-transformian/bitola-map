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
npm run data:fetch:overture # згради од Overture Maps (S3, GeoParquet) → data/raw/overture-buildings.json.gz
npm run data:fetch:terrain  # Terrain Tiles → data/cache/terrain/ (не се комитува)
npm run data:build          # обработка → public/data/*.bin, *.json (OSM + Overture згради)
npm run data                # сè погоре по ред

npm run shot -- --views home,center,close,west,top   # screenshot-ови + мерења (dev серверот мора да работи)
npm run shot -- --mobile --views home                 # мобилен профил (iPhone 13)
npm run shot -- --style maketa --time night --views shirok-sokak,saat --clean # стил, време, погледи
npm run shot -- --style bajka --time night --weather snowfall --views saat     # снег: clear|snow|snowfall
npm run shot -- --time night --motion --views saat     # со треперење на светлата (стандардно: мирни)
node scripts/dev/check-styles.mjs                     # проверка на интерфејсот (стил, време, погледи, тастатура, натписи)

npm run bench -- --suite quick                        # бенчмарк headless (SwiftShader): структура на кадарот + споредба со основата
npm run bench -- --suite standard --check             # цело мерење; излез 1 при регресија > 10 % (повици, триаголници)
npm run bench -- --gpu [--uncapped]                   # вистински GPU (видлив прозорец) — за мерење на сопствена машина
npm run bench -- --compare стар.json нов.json         # споредба на два извештаја
```

Мерење на изведбата: `?debug` = во живо (кадар p50/p95, CPU по фаза, GPU по пас — scene, shadow,
gtao, output, postcard, tiltshift); `?bench[=quick|standard|ablation]` = бенчмарк во прелистувачот
со табела и JSON (копирај/сними) — така се мери на референтниот уред (MacBook Pro 2018, Radeon Pro
555X, Retina, Chrome). Буџети: `src/config/perf.js`; основа и резултати: `docs/perf/`;
спецификација, план и анализа: `docs/specs/002-performance/`.

Погледи за `shot`: брзите погледи од `src/config/views.js` (pregled, shirok-sokak, vlez-shirok-sokak,
charshija, gradski-park, herakleja) + `CHECK_VIEWS` (home, center, close, west, top, saat, dimitrija,
filip, dom, dom-front, gimnazija, gimnazija-agol, mag-red, mag-plostad) + `lm-<id>` за секоја знаменитост.

URL: `?debug` (FPS, повици, триаголници, време), `?profile=mobile|desktop`,
`#style=razglednica|maketa|crtan|lowpoly|bajka&time=day|sunset|night&weather=clear|snow|snowfall&view=<id>`
(`#style=nokna` → Разгледница ноќе — „Ноќна Битола“ е споена во ноќта на сите стилови).
Тастатура: стрелки = поместување, Q/E = ротација, +/− = зум, PageUp/PageDown = наклон,
Home = преглед, 1–5 = стил, S = снег (без → снег → снежи), ? = упатство.

Важно: слојот со натписите е преку цел екран и мора да има `pointer-events: none`, инаку ги
„голта“ глувчето/допирот и мапата не може да се движи (`check-styles.mjs` го проверува ова).

## Архитектура

```
src/config/region.js     ← ЕДИНСТВЕНОТО место за опфатот (bbox), почетна точка, зум на релјефот
src/config/classes.js    ← enum класи (улици, површини, згради) — дел од форматот на податоците
src/config/zones.js      ← зони за проценка на висини (чаршија, Широк Сокак, центар)
src/config/landmarks.js  ← знаменитости (31): OSM основа/точка/кружен тек или `at` {lat,lon} + модел,
                           group (мени „Оди до…“), view, rank, label, parts (и OSM точки),
                           flatten (израмнување на релјефот во обработката)
src/config/views.js      ← брзи погледи
src/config/labels.js     ← кои населби добиваат натпис + рачни места (Јени Маале, …)
src/lib/pack.js          ← бинарен контејнер .bin (encode во Node, decode во прелистувач)
src/world/heightfield.js ← мрежа со висини + sample(x,z); заедничка за Node и прелистувач
src/world/*.js           ← градење геометрија од податоците (релјеф, подлога, згради, ленти, небо)
src/world/world.js       ← сите слоеви на светот (еднаш); setBuildingRoofs() = варијанта на геометрија
src/world/buildings.js   ← згради: рамни, двоводни ('gabled') или четиристрешни ('hip') покриви
                           (најниската од N коси рамнини), атрибут aBase за „растење“
src/world/ground.js      ← подлога во canvas; сликари 'flat' и 'watercolor'
src/world/landmarks/     ← kit.js (примитиви → една геометрија, „делови“ за боја), models.js и
                           extra.js (моделите: џамија, црква, јавна зграда, коњаник, стадион, авиони, …),
                           civic.js (Дом на културата, Горна гимназија — рачно, според фотографии)
                           magnolija.js (детални згради на Магнолија/влезот на Широк Сокак по OSM id,
                           од фотографии)
src/world/trees.js       ← инстанцирани дрвја (облик по стил), lamps.js ← улични светилки (ноќ)
src/world/traffic.js     ← „Живот на мапата“: автомобили и пешаци (инстанцирани, CPU), фарови ноќе
src/world/snowfall.js    ← снегулки што паѓаат (точки околу камерата); lightpoints.js ← точки на
                           светлата (прозорци, светилки) за боке-дисковите
src/world/geom2d.js      ← 2Д геометрија (OBB, конвексна обвивка, точка во полигон)
src/styles/index.js      ← регистар на стилови + ОПИС НА ИНТЕРФЕЈСОТ + памтење (localStorage, #style=)
src/styles/<id>.js       ← еден стил = еден модул (razglednica.js, maketa.js, crtan.js, lowpoly.js, bajka.js)
src/styles/manager.js    ← применува стил врз светот: геометрија, материјали, бои, светла, пост-процесирање
src/styles/shared/       ← заеднички материјали (lambertSet, toonSet) и шејдер-додатоци (изохипси, слоеви, растење, ноќ,
                           снег `withSnow`, „рачна изработка“ `withCraft`);
                           flicker.js — „живи“ светла ноќе (треперење, прозорци што се палат, телевизори)
src/render/pipeline.js   ← WebGLRenderer + EffectComposer (пасови пред/по OutputPass); instrument() за
                           GPU време по пас (perfName), setPixelRatio()/setMsaa() во живо
src/perf/                ← мерење: gpu-timer.js, perf.js (во живо), bench.js (?bench), report.js
src/config/perf.js       ← буџети за изведба (референтен уред)
src/render/passes/       ← сопствени пост-пасови (postcard.js — акварел/хартија, tiltshift.js — минијатура,
                           ink.js — контури од длабочината; bokeh.js — длабочина на поле + боке-дискови;
                           grade.js — тонирање/винета/зрно; композиторот има depthTexture)
src/app/camera.js        ← камера, MapControls, погледи, лет до поглед, тастатура, динамички near/far
src/app/time.js          ← ден/зајдисонце/ноќ: тежини, премин, resolveLighting(style, тежини)
src/app/weather.js       ← временски услови: без снег / снег / снежи (env.snow 0–1, премин)
src/app/prefs.js         ← поставки во URL hash + localStorage
src/app/snapshot.js      ← „Зачувај слика“: кадар 2×, натписи + наслов + атрибуција во PNG
src/data/loader.js       ← вчитување на public/data/*
src/ui/                  ← интерфејс: наслов, атрибуција, мени горе десно (menu.js: „Оди до…“, време,
                           упатство „?“), избирач на стил долу, натписи (labels.js), фонтови
src/main.js              ← поврзување на сè погоре, јамка
scripts/data/            ← Node скрипти: fetch-osm, fetch-overture, fetch-terrain, build (+ lib/)
scripts/dev/             ← screenshot.mjs (слики, време, FPS), check-styles.mjs (тест на стиловите),
                           bench.mjs (бенчмарк, споредба, --check)
.github/workflows/data-fetch.yml ← Overpass + Overture на GitHub Actions (комитува data/raw/)
```

Тек на податоците: OSM (Overpass) + Overture згради (без OSM извор, т.е. Microsoft ML Buildings)
+ Terrarium PNG → `scripts/data/build.mjs` → `public/data/` (комитувани, ~2 MB) → прелистувачот ја
гради геометријата при вчитување (~0.6 s на десктоп). OSM зградите имаат предност; Overture
згради што се преклопуваат со OSM се отфрлаат.

Координати: локални метри околу Саат кула (`REGION.origin`); x = исток, z = југ, y = нагоре.
Во .bin фајловите координатите се Int16 со чекор 0.25 m (опсег ±8.19 km од почетната точка).

Стилови: податоците и геометријата се градат еднаш; стилот е посебен слој (палета, материјали,
шејдери, пост-процесирање, светла, магла, небо). Интерфејсот е опишан во `src/styles/index.js`.
Нов стил = нов модул во `src/styles/` + ред во `STYLES`. Ако стилот бара друга геометрија
(`geometry.roofs`), менаџерот ја пресоздава само таа (и ја кешира на десктоп), а зградите „растат“
(uniform `uGrow`, атрибут `aBase`). Секоја смена е покриена со претопување (снимка во `#fade`).

Време од денот: денот го дава стилот (`light`, `sky`, `fog`); зајдисонцето и ноќта се стандардни
поставки во `app/time.js` што стилот може делумно да ги пребрише (`style.times`). Заедничкиот
uniform `env.night` (0–1) ги пали прозорците (`withWindows`), улиците (`withStreetGlow`),
светилките на знаменитостите (`withGlow`, атрибут `aGlow`) и уличните светилки.
Ноќе на десктоп менаџерот додава сјај (`UnrealBloomPass`) на секој стил; улиците светат
посилно од далеку (`env.streetGain`). „Ноќна Битола“ не е посебен стил (`#style=nokna` → ноќ). Светлата благо
треперат (`env.time`, `env.flicker`; атрибут `aSeed` = семе по светло); при
`prefers-reduced-motion` се мирни. Големи површини (улиците) не треперат.

Снег: временските услови се независни од стилот и од времето. `env.snow` (0–1) го користи
`withSnow` (површини свртени нагоре; параметрите по слој се во менаџерот), а снегулките се
посебен слој во светот што се пали само при „Снежи“ (може да се исклучат за изведба).

Знаменитости: `build.mjs` ги извлекува основите во `landmarks.json`; моделите (`world/landmarks/
models.js`) се градат од примитиви во рамка од OBB на основата. Обичните згради што ги заменуваат
(по OSM id, по растојание од Широк Сокак, во оградата на Хераклеа) се прескокнуваат.

## Конвенции

- Код: ES модули, без TypeScript, без framework. Коментари и UI текст на македонски.
- UI на македонски со правилен правопис; наслов „Битола“; кирилица.
- Атрибуција секогаш видлива (и на телефон): „© соработниците на OpenStreetMap“ +
  „Overture Maps, Microsoft“ (згради) + Terrain Tiles.
- Пост-пасови што работат во sRGB (хартија, винета) одат во `after`; HDR/длабочина (AO, DOF) во `before`.
- Тешките ефекти (GTAO, длабочина на поле) се само за десктоп профилот.
- Оригинална работа: не се копира код, шејдери, текстови ни дизајн од други проекти без лиценца.
- Нови податочни класи се додаваат само на крајот од низите во `classes.js`.
- По секоја поголема визуелна промена: `npm run shot` и поглед на сликите.
  Headless Chromium рендерира софтверски (SwiftShader) — FPS таму е само за споредба.
- По секоја промена што додава геометрија, ефект или стил: `npm run bench -- --suite quick` (повици,
  триаголници наспроти основата). Оптимизациите се докажуваат со `?bench` пред/по на референтниот
  уред; новиот пас добива `perfName` за да се гледа во мерењето.
- `localStorage` секогаш во try/catch.

## Git тек

- `develop` — интеграциска гранка (ќе стане default); feature гранките се спојуваат таму.
- `main` — објавува на GitHub Pages (`.github/workflows/deploy.yml`, извор „GitHub Actions“):
  https://aleksandar-transformian.github.io/bitola-map/ — **push на `main` само по изречна
  дозвола од сопственикот** (дадена за објавата во фаза 4; секоја следна објава — прашај).
  Околината `github-pages` мора да ја дозволува гранката `main` (Settings → Environments);
  инаку `deploy` се одбива за 2 s без лог.
- Лиценца: MIT за кодот (`LICENSE`); податоците ODbL, фонтовите OFL.
- Спецификации и план: `docs/specs/`; одлуки, бројки и проблеми: `docs/NOTES.md`.

## Мрежни ограничувања во cloud сесии

Overpass/OSM хостовите може да се блокирани од proxy-то во сесијата. Тогаш: push на промена во
`src/config/region.js` или `scripts/data/fetch-osm.mjs` (или рачно стартување) го пушта
`data-fetch.yml` на GitHub Actions, кој ги комитува свежите `data/raw/*` назад на гранката;
потоа `git pull` и `npm run data:build` локално. Terrain Tiles (S3) обично се достапни.
