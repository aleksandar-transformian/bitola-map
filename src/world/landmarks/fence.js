// Ограда по линија во светот (столбчиња + две пречки), што го следи релјефот.

/**
 * @param {import('./kit.js').Kit} kit
 * @param {import('../heightfield.js').Heightfield} hf
 * @param {number[][]} pts  [[x, z], …] во светот
 * @param {{ closed?: boolean, h?: number, step?: number, part?: string, post?: number, solid?: boolean }} [o]
 *   solid = полн ѕид од штици наместо пречки
 */
export function fence(kit, hf, pts, { closed = true, h = 1.9, step = 4, part = 'metal', post = 0.1, solid = false } = {}) {
  const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.2) continue;
    const segs = Math.max(1, Math.round(len / step));
    for (let k = 0; k < segs; k++) {
      const x0 = a[0] + ((b[0] - a[0]) * k) / segs;
      const z0 = a[1] + ((b[1] - a[1]) * k) / segs;
      const x1 = a[0] + ((b[0] - a[0]) * (k + 1)) / segs;
      const z1 = a[1] + ((b[1] - a[1]) * (k + 1)) / segs;
      const y0 = hf.sample(x0, z0);
      const y1 = hf.sample(x1, z1);
      kit.setFrame(x0, y0 - 0.2, z0);
      kit.box(0, 0, 0, post, h + 0.2, post, part);
      const l = Math.hypot(x1 - x0, z1 - z0);
      kit.setFrame((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0);
      if (solid) kit.box(0, -0.2, 0, l, h * 0.8 + 0.2, post * 0.5, part);
      else {
        kit.box(0, h - 0.35, 0, l, 0.08, post * 0.6, part);
        kit.box(0, 0.35, 0, l, 0.06, post * 0.5, part);
      }
    }
  }
  if (!closed) {
    const [x, z] = pts[n - 1];
    kit.setFrame(x, hf.sample(x, z) - 0.2, z);
    kit.box(0, 0, 0, post, h + 0.2, post, part);
  }
}
