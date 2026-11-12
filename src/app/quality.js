// Квалитет на приказот: скала од нивоа (0 = најдобро) и автоматско прилагодување според
// измереното време на кадар. Послаб уред се спушта по скалата додека не стане мазно; посилен
// останува на врвот (или се качува назад).
//
// Редоследот на скалата е од мерењето на референтниот уред (docs/specs/002-performance/
// analysis.md §7): тесното грло се пикселите, па прво се штеди на MSAA и резолуција, потоа на
// тешките пост-ефекти (AO, боке, сјај) и сенките. Пасовите што го даваат изгледот на стилот
// (хартија, мастило, минијатура) остануваат на секое ниво; натписите се HTML и се секогаш остри.
//
// Режими: 'auto' (стандардно) | 'high' | 'medium' | 'low'  —  #quality=… и localStorage.

export const QUALITIES = [
  { id: 'auto', name: 'Авто' },
  { id: 'high', name: 'Високо' },
  { id: 'medium', name: 'Средно' },
  { id: 'low', name: 'Ниско' },
];
export const validQuality = (id) => QUALITIES.some((q) => q.id === id);

// Пасови што се исклучуваат на пониските нивоа (по perfName).
export const HEAVY_PASSES = new Set(['gtao', 'bokeh', 'bloom']);

const TARGET_MS = 24; // под ~42 fps → ниво подолу
const SLOW_MS = 50; // под 20 fps → две нивоа одеднаш
const CRAWL_MS = 120; // под ~8 fps → три нивоа, и одлука по само два кадри
const GAP_MS = 5000; // подолга пауза меѓу кадри = заспан уред / скриен таб, не бавно цртање
const SMOOTH_MS = 18.5; // „мазно“ (≈ 60 fps) → може да се проба ниво погоре
const GPU_BUDGET_MS = 9; // проценето GPU време на погорното ниво мора да е под ова
const PERIOD_MS = 1000; // должина на едно мерење
const SETTLE_MS = 1500; // по секоја промена: шејдери, нови цели — не се мери
const UP_AFTER = 6; // мазни периоди пред проба нагоре
const RETRY_MS = [30e3, 120e3, 600e3]; // по неуспешна проба нагоре: чекај пред следната

/**
 * Скала за уредот. base = густината на пиксели на највисокото ниво (min(devicePixelRatio, макс. на
 * профилот)). На екран со DPR 1 резолуцијата не се спушта, па таму останува MSAA 2×.
 */
export function buildLadder(base, msaa) {
  const lite = base >= 1.5 ? 0 : Math.min(2, msaa);
  const dpr = (k) => Math.round(Math.max(1, base * k) * 100) / 100;
  const raw = [
    { dpr: base, msaa, shadows: true, heavy: true },
    { dpr: base, msaa: lite, shadows: true, heavy: true },
    { dpr: dpr(0.75), msaa: lite, shadows: true, heavy: true },
    { dpr: dpr(0.75), msaa: lite, shadows: true, heavy: false },
    { dpr: dpr(0.625), msaa: 0, shadows: true, heavy: false },
    { dpr: dpr(0.5), msaa: 0, shadows: true, heavy: false },
    // сенките одат последни — тие ѝ даваат длабочина на минијатурата
    { dpr: dpr(0.5), msaa: 0, shadows: false, heavy: false },
  ];
  const key = (l) => `${l.dpr}/${l.msaa}/${l.shadows}/${l.heavy}`;
  return raw.filter((l, i) => i === 0 || key(l) !== key(raw[i - 1]));
}

/** Груба релативна цена на ниво (за проценка пред качување). */
const cost = (l) => l.dpr * l.dpr * (l.msaa >= 4 ? 1.8 : l.msaa ? 1.4 : 1) * (l.heavy ? 1.5 : 1) * (l.shadows ? 1.2 : 1);

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[s.length >> 1] : 0;
};

/**
 * @param {object} o
 * @param {{dpr:number, msaa:number, shadows:boolean, heavy:boolean}[]} o.ladder
 * @param {(level: object, index: number) => void} o.apply  примени ниво (pipeline + стилови)
 * @param {string} [o.mode]
 * @param {number} [o.megapixels]  пиксели на највисокото ниво — за почетното ниво во 'auto'
 */
export function createQuality({ ladder, apply, mode = 'auto', megapixels = 0 }) {
  const last = ladder.length - 1;
  const fixed = { high: 0, medium: Math.min(2, last), low: last };
  // запамтено ниво по стил (секој стил има друга цена)
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem('bitola.qlevels') || '{}') || {};
  } catch {
    // без складирање — секоја посета почнува од проценката
  }
  // без запамтено: екран со многу пиксели (Retina) почнува од средина, за да не сецка на почеток
  const guess = megapixels > 3 ? Math.min(2, last) : 0;

  let style = null;
  let level = -1;
  let held = 0; // > 0: привремено највисоко ниво (на пр. „Зачувај слика“)
  // состојба на автоматиката
  let samples = [];
  let gpu = [];
  let periodStart = 0;
  let settleUntil = 0;
  let smooth = 0;
  let failedUp = 0; // колку пати по ред пробата нагоре не успеа
  let noUpBefore = 0;
  let probing = false;
  let lastChange = 0;

  function setLevel(i, now = performance.now()) {
    i = Math.max(0, Math.min(last, i));
    if (i === level) return false;
    level = i;
    apply(ladder[i], i);
    samples = [];
    gpu = [];
    periodStart = 0;
    smooth = 0;
    settleUntil = now + SETTLE_MS;
    lastChange = now;
    return true;
  }
  function remember() {
    if (mode !== 'auto' || !style) return;
    saved[style] = level;
    try {
      localStorage.setItem('bitola.qlevels', JSON.stringify(saved));
    } catch {
      // без складирање
    }
  }
  const startLevel = () => (mode === 'auto' ? Math.min(last, saved[style] ?? (level >= 0 ? level : guess)) : fixed[mode]);

  return {
    ladder,
    get mode() {
      return mode;
    },
    get level() {
      return level;
    },
    get settings() {
      return ladder[Math.max(0, level)];
    },
    /** Нивото не се сменило подолго време (за мерењата со 'auto'). */
    get stable() {
      return mode !== 'auto' || performance.now() - lastChange > 4000;
    },
    setMode(id) {
      if (!validQuality(id)) return;
      mode = id;
      probing = false;
      failedUp = 0;
      noUpBefore = 0;
      setLevel(startLevel());
    },
    /** При смена на стил: запамтеното ниво за тој стил (или тековното). */
    setStyle(id) {
      style = id;
      probing = false;
      failedUp = 0;
      noUpBefore = 0;
      if (!setLevel(startLevel())) {
        // исто ниво — сепак примени го (новиот стил има нови пасови и материјали)
        apply(ladder[level], level);
        settleUntil = performance.now() + SETTLE_MS;
        samples = [];
        periodStart = 0;
      }
    },
    /** Привремено највисоко ниво додека трае fn (автоматиката мирува). */
    async withBest(fn) {
      const back = level;
      held++;
      setLevel(0);
      try {
        return await fn();
      } finally {
        held--;
        setLevel(back);
      }
    },
    /** GPU време на кадарот (ms), ако прелистувачот има тајмер. */
    gpuSample(ms) {
      if (mode === 'auto' && !held && performance.now() >= settleUntil) gpu.push(ms);
    },
    /**
     * По кадар. @param {number} dt интервал од претходниот кадар (ms) @param {number} now
     * @returns {boolean} дали нивото се смени
     */
    frame(dt, now) {
      if (mode !== 'auto' || held || level < 0) return false;
      if (document.hidden || dt > GAP_MS) {
        // скриен таб / заспан уред — тоа не е бавно цртање
        samples = [];
        periodStart = 0;
        return false;
      }
      if (now < settleUntil) return false;
      if (!periodStart) periodStart = now;
      samples.push(dt);
      // обично: мерење од 1 s (барем 4 кадри); кога едвај се движи — доволни се два кадри
      const crawling = samples.length >= 2 && Math.min(...samples) > CRAWL_MS;
      if (!crawling && (now - periodStart < PERIOD_MS || samples.length < 4)) return false;
      const ms = median(samples);
      const g = gpu.length >= 4 ? median(gpu) : null;
      samples = [];
      gpu = [];
      periodStart = 0;

      if (ms > TARGET_MS && level < last) {
        if (probing) {
          // пробата нагоре не успеа → назад и подолга пауза пред следната
          noUpBefore = now + RETRY_MS[Math.min(failedUp, RETRY_MS.length - 1)];
          failedUp++;
        }
        probing = false;
        setLevel(level + (ms > CRAWL_MS ? 3 : ms > SLOW_MS ? 2 : 1), now);
        remember();
        return true;
      }
      if (probing) {
        // пробата успеа: новото ниво е мазно
        probing = false;
        failedUp = 0;
        remember();
      }
      if (ms <= SMOOTH_MS && level > 0 && now >= noUpBefore) {
        smooth++;
        // со GPU тајмер: качи се само ако проценката вели дека има резерва
        const predicted = g == null ? null : (g * cost(ladder[level - 1])) / cost(ladder[level]);
        if (smooth >= UP_AFTER && (predicted == null || predicted <= GPU_BUDGET_MS)) {
          probing = true;
          setLevel(level - 1, now);
          return true;
        }
      } else smooth = 0;
      return false;
    },
  };
}
