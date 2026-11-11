// Профил на изведба: десктоп или полесен мобилен (меморија на iOS!).
// Може да се присили со ?profile=mobile или ?profile=desktop.

export function detectProfile() {
  const qs = new URLSearchParams(location.search);
  const forced = qs.get('profile');
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const mobile = forced ? forced === 'mobile' : coarse && small;
  return mobile
    ? { name: 'mobile', msaa: 2, maxPixelRatio: 1.5, terrainStride: 2, groundTexture: 2048, shadows: 0, cacheGeometry: false, treeEvery: 3 }
    : { name: 'desktop', msaa: 4, maxPixelRatio: 2, terrainStride: 1, groundTexture: 4096, shadows: 2048, cacheGeometry: true, treeEvery: 1 };
}
