// Буџети за изведба (цели). Ги проверува извештајот од бенчмаркот (perf/report.js).
//
// Референтен уред: MacBook Pro 15" (2018/19) — Intel Core i7 6 јадра 2.2 GHz, Radeon Pro 555X 4 GB
// (+ Intel UHD 630), 16 GB, Retina екран (DPR 2), Chrome, прозорец преку цел екран.
// Времињата важат само со вистински GPU; во SwiftShader (headless) се проверува само структурата
// на кадарот (повици, триаголници, програми), која не зависи од уредот.

export const REFERENCE_DEVICE = 'MacBook Pro 15" 2018/19 · Radeon Pro 555X · Retina · Chrome';

export const BUDGETS = {
  // ms; интервал = време меѓу два кадри (што го гледа корисникот), со vsync од 60 Hz
  time: {
    intervalP50: 17.5, // 60 fps во медијана (16.7 ms + мала толеранција)
    intervalP95: 25, // најмногу ретко пропуштен кадар
    jankPct: 5, // % кадри подолги од 25 ms („сецкање“)
    gpuP95: 13, // GPU работа по кадар — простор за композиторот на прелистувачот
    cpuP95: 8, // JS по кадар (контроли, натписи, повици за цртање)
  },
  // структура на кадарот по профил (по сценарио)
  frame: {
    desktop: { calls: 40, triangles: 3.0e6, programs: 30 },
    mobile: { calls: 30, triangles: 1.0e6, programs: 30 },
  },
  load: { firstFrameMs: 3000, switchHitchMs: 250 },
};

// Праг за „сецкање“ (ms) — кадар подолг од ова е видливо пропуштен при 60 Hz.
export const JANK_MS = 25;
