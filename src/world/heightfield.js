// Мрежа со висини (релјеф) во локални метри + билинеарно читање.
// Ја користат и обработката (Node) и прелистувачот.

export class Heightfield {
  /**
   * @param {{cols:number, rows:number, minX:number, minZ:number, step:number}} grid
   * @param {Float32Array} heights  rows*cols, ред по ред (z), од minZ кон maxZ
   */
  constructor(grid, heights) {
    this.cols = grid.cols;
    this.rows = grid.rows;
    this.minX = grid.minX;
    this.minZ = grid.minZ;
    this.step = grid.step;
    this.maxX = this.minX + (this.cols - 1) * this.step;
    this.maxZ = this.minZ + (this.rows - 1) * this.step;
    this.heights = heights;
    let lo = Infinity;
    let hi = -Infinity;
    for (const h of heights) {
      if (h < lo) lo = h;
      if (h > hi) hi = h;
    }
    this.minH = lo;
    this.maxH = hi;
  }

  /** Висина (m) во точка (x, z); надвор од мрежата се зема работ. */
  sample(x, z) {
    const { cols, rows, step, heights } = this;
    let fx = (x - this.minX) / step;
    let fz = (z - this.minZ) / step;
    fx = Math.max(0, Math.min(cols - 1.0001, fx));
    fz = Math.max(0, Math.min(rows - 1.0001, fz));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const k = j * cols + i;
    // Исто како триаголниците во мрежата (дијагонала од (i,j+1) до (i+1,j)),
    // за објектите да седат точно на површината.
    const h00 = heights[k];
    const h10 = heights[k + 1];
    const h01 = heights[k + cols];
    const h11 = heights[k + cols + 1];
    if (tx + tz <= 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
    return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
  }
}
