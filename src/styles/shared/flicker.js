// „Живи“ светла ноќе: благо треперење на јачината, секое светло во свој ритам.
//
// env.time    секунди (се врти на секој час — скокот е невидлив кај ±10 %)
// env.flicker 0–1 — јачина на ефектот; 0 = мирни светла (prefers-reduced-motion, screenshot-ови)
// env.broken  0/1 — понекоја „расипана“ улична светилка што кратко трепне (style.night.flicker.broken)
//
// Пристапност: промените се бавни и мали (≤ ±15 % на близина); побрзото трепкање е само на
// далечина, каде светлата се точки од неколку пиксели. Ништо не трепка на голема површина.

export const FLICKER_GLSL = /* glsl */ `
#ifndef FK_DEFINED
#define FK_DEFINED
uniform float uTime, uFlicker, uBroken;
float fkHash(float n) { return fract(sin(n * 91.3458) * 47453.5453); }
// мек 1Д шум, 0–1
float fkNoise(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(fkHash(i), fkHash(i + 1.0), f);
}
// множител на јачината: бавно „дишење“ одблизу, трепкање низ воздухот на далечина
float fkTwinkle(float seed, float dist) {
  float far = smoothstep(400.0, 3500.0, dist);
  float slow = fkNoise(uTime * 0.35 + seed * 61.0) - 0.5;
  float fast = fkNoise(uTime * (1.4 + seed) + seed * 113.0) - 0.5;
  return 1.0 + uFlicker * (slow * 0.14 + fast * 0.4 * far);
}
// пламен (фенери на знаменитостите): немирно, но благо
float fkFlame(float seed) {
  float a = fkNoise(uTime * 2.1 + seed * 37.0) - 0.5;
  float b = fkNoise(uTime * 5.3 + seed * 11.0) - 0.5;
  return 1.0 + uFlicker * (a * 0.22 + b * 0.1);
}
// „расипана“ светилка (~1 од 150): на 5–12 s кратко (0.7 s) трепне, никогаш не се гаси целосно
float fkBroken(float seed) {
  float pick = step(fract(seed * 97.13), 0.007) * uBroken * uFlicker;
  float period = 5.0 + seed * 7.0;
  float burst = step(mod(uTime + seed * 40.0, period), 0.7);
  float on = step(0.35, fkNoise(uTime * 9.0 + seed * 17.0));
  return mix(1.0, 0.25 + 0.75 * on, burst * pick);
}
#endif
`;

/** Поврзи ги uniform-ите на треперењето со заедничкиот env. */
export function flickerUniforms(shader, env) {
  shader.uniforms.uTime = env.time;
  shader.uniforms.uFlicker = env.flicker;
  shader.uniforms.uBroken = env.broken;
}

/** Детерминистички „случаен“ број 0–1 за цел број (семе на светло). */
export function seedOf(n) {
  let h = Math.imul(n ^ 0x2c1b3c6d, 0x297a2d39);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}
