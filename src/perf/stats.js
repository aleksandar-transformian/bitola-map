// Статистика за мерењата: прстен со последните вредности и збир (перцентили).

/** Прстен со фиксна големина (последните n вредности). */
export class Ring {
  constructor(n) {
    this.a = new Float64Array(n);
    this.n = 0;
    this.i = 0;
  }
  push(v) {
    this.a[this.i] = v;
    this.i = (this.i + 1) % this.a.length;
    if (this.n < this.a.length) this.n++;
  }
  values() {
    return Array.from(this.a.subarray(0, this.n));
  }
}

/** Перцентил од веќе подредена низа (линеарна интерполација). */
function pct(sorted, p) {
  if (!sorted.length) return NaN;
  const k = (sorted.length - 1) * p;
  const lo = Math.floor(k);
  const hi = Math.min(sorted.length - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (k - lo);
}

const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

/** { n, mean, p50, p95, p99, max } во ms, заокружено на 0.01. */
export function summarize(values) {
  const s = Float64Array.from(values).sort();
  if (!s.length) return { n: 0, mean: null, p50: null, p95: null, p99: null, max: null };
  let sum = 0;
  for (const v of s) sum += v;
  return { n: s.length, mean: r2(sum / s.length), p50: r2(pct(s, 0.5)), p95: r2(pct(s, 0.95)), p99: r2(pct(s, 0.99)), max: r2(s[s.length - 1]) };
}

/** Удел (%) на вредностите над прагот. */
export function over(values, limit) {
  if (!values.length) return null;
  let k = 0;
  for (const v of values) if (v > limit) k++;
  return Math.round((k / values.length) * 1000) / 10;
}
