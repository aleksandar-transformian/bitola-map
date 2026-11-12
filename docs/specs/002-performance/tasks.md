# Задачи: мерлива изведба

Легенда: [x] готово · [ ] отворено · (?) чека сопственикот

## Фаза А — мерење

- [x] `src/perf/gpu-timer.js` — GPU време по пас (штоперица со кругови, сенките посебно)
- [x] `src/perf/perf.js` — интервал, CPU по фаза (update / render / labels), опис на уредот
- [x] `?debug` панел: кадар p50/p95, CPU по фаза, GPU по пас, резолуција во пиксели
- [x] `src/render/pipeline.js` — `instrument()`, `setPixelRatio()`, `setMsaa()`, имиња на пасовите
- [x] `src/perf/bench.js` — `?bench=quick|standard|ablation`, аблација, панел (копирај / сними JSON)
- [x] `src/config/perf.js` — буџети за референтниот уред; `src/perf/report.js` — ✓/✗, табела, споредба
- [x] `scripts/dev/bench.mjs` (`npm run bench`) — SwiftShader / `--gpu` / `--uncapped`, `--compare`, `--check`
- [x] Основа во SwiftShader: `docs/perf/baseline-swiftshader.json` (десктоп, standard) и `baseline-swiftshader-mobile.json` (телефон, quick)
- [x] Анализа: `analysis.md` — каде оди времето (хипотези + бројки од структурата)
- [x] **Прво мерење на MacBook-от** (2026-11-12, Radeon Pro 555X, 5.54 MP) → `docs/perf/results/`
- [x] По мерењето: редоследот во фаза Б е сменет (пиксели пред геометрија) — `analysis.md` §7
- [ ] Мерењето по пас на ANGLE/Metal не е веродостојно (сè на `scene`) — поправи или означи

## Фаза Б — оптимизации (секоја со `?bench` пред/по на уредот; редослед од мерењето)

- [ ] Б1 MSAA: пост-пасови без MSAA; сцена 2×/без + евтин AA каде што треба
- [ ] Б2 `gtao`, `bloom`, `bokeh` во помала резолуција
- [ ] Б3 Шумот на хартијата („Разгледница“) испечен во текстура
- [x] Б4 Нивоа на квалитет + „авто“ (`src/app/quality.js`): скала MSAA → DPR → тешки ефекти → сенки,
      копче во менито, `#quality=`, нивото се памти по стил, сликата секогаш во највисок квалитет
- (?) Мерење на „авто“ на MacBook-от: `?bench=quick#quality=auto` (колоната „кв.“ = постигнато ниво)
- [ ] Б5 Сенки: ажурирање само при движење; PCF; без сенки од далечни дрвја
- [ ] Б6 Цртање по потреба (мирување = 0 % GPU)
- [ ] Б7 Смена на стил / прв кадар: `compileAsync`, помалку варијанти на шејдери
- [ ] Б8 `ink` поевтин
- [ ] Б9 `backdrop-filter` на слаб уред
- [ ] Б10 Геометрија (плочки, culling, LOD) — низок приоритет на овој уред
- [ ] Б11 Натписи без принудни layout-и — низок приоритет (CPU ≈ 1 ms)
- [ ] CI: `npm run bench -- --suite quick --check` во GitHub Actions (структура, SwiftShader)
