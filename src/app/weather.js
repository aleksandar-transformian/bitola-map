// Временски услови: ведро / снег (покриено) / снежи (покриено + снегулки што паѓаат).
// Независни од стилот и од времето од денот. Снегот се „натрупува“ и „топи“ со мек премин
// (uniform env.snow 0–1, го користи shared/materials.js → withSnow).

export const WEATHERS = [
  { id: 'clear', name: 'Без снег' },
  { id: 'snow', name: 'Снег' },
  { id: 'snowfall', name: 'Снежи' },
];

const DURATION = 2200; // ms — колку трае натрупувањето/топењето

export function createWeather(initial = 'clear') {
  let mode = initial;
  let from = initial === 'clear' ? 0 : 1;
  let to = from;
  let t0 = -1;
  let value = from;
  return {
    get mode() {
      return mode;
    },
    /** Колку снег има (0–1). */
    get snow() {
      return value;
    },
    /** Дали паѓаат снегулки. */
    get falling() {
      return mode === 'snowfall';
    },
    set(id, animate = true) {
      if (!WEATHERS.some((w) => w.id === id) || id === mode) return;
      mode = id;
      from = value;
      to = id === 'clear' ? 0 : 1;
      t0 = animate ? performance.now() : -1;
      if (!animate) value = to;
    },
    /** Враќа true ако количината на снег се променила. */
    update() {
      if (t0 < 0) return false;
      const k = Math.min(1, (performance.now() - t0) / DURATION);
      const e = k * k * (3 - 2 * k);
      value = from + (to - from) * e;
      if (k >= 1) t0 = -1;
      return true;
    },
  };
}
