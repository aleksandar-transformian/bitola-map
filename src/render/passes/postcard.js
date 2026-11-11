// Пас „разгледница“: акварелски изглед преку целата слика.
// Работи по OutputPass (вредности во sRGB), за ефектите да се перцептивно рамномерни.
//
//  - нерамни рабови: мало поместување на UV со шум (рака што слика)
//  - разлевање: мешање со замаглена верзија
//  - пигмент на рабовите: потемнување каде што бојата нагло се менува (меко, без контури)
//  - хартија: зрнеста текстура (шум во пиксели — хартијата не се движи со камерата)
//  - винета кон бојата на хартијата

import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const shader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    paper: { value: new THREE.Vector3(0.95, 0.91, 0.82) },
    wobble: { value: 2.0 },
    bleed: { value: 0.35 },
    edge: { value: 0.35 },
    grain: { value: 0.5 },
    vignette: { value: 0.5 },
    warmth: { value: 0.04 },
    pixelScale: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform vec3 paper;
    uniform float wobble, bleed, edge, grain, vignette, warmth, pixelScale;
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
                 mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < OCTAVES; i++) {
        v += a * vnoise(p);
        p = p * 2.07 + 13.1;
        a *= 0.5;
      }
      return v;
    }
    vec3 tap(vec2 uv) { return texture2D(tDiffuse, uv).rgb; }

    void main() {
      vec2 px = vUv * resolution / pixelScale; // логички пиксели (иста големина на секој екран)
      vec2 texel = 1.0 / resolution;

      // 1) нерамни рабови
      vec2 w = vec2(fbm(px * 0.035), fbm(px * 0.035 + 41.7)) - 0.5;
      vec2 uv = vUv + w * wobble * pixelScale * texel * 2.0;
      vec3 c = tap(uv);

      // 2) разлевање (6 земања во круг)
      float r = 2.2 * pixelScale;
      vec3 soft = vec3(0.0);
      for (int i = 0; i < 6; i++) {
        float a = float(i) * 1.0472 + 0.4;
        soft += tap(uv + vec2(cos(a), sin(a)) * r * texel);
      }
      soft /= 6.0;
      vec3 wide = vec3(0.0);
      for (int i = 0; i < 6; i++) {
        float a = float(i) * 1.0472;
        wide += tap(uv + vec2(cos(a), sin(a)) * r * 2.6 * texel);
      }
      wide /= 6.0;
      c = mix(c, soft, bleed);

      // 3) пигментот се собира на промени на бојата (меко, без линии)
      float diff = length(c - wide);
      c *= 1.0 - edge * smoothstep(0.05, 0.4, diff);

      // 4) хартија: крупни облаци + ситно зрно
      float clouds = fbm(px * 0.006);
      float fine = vnoise(px * 0.9) * 0.6 + vnoise(px * 0.33) * 0.4;
      float g = mix(clouds, fine, 0.55);
      c *= mix(1.0, 0.86 + 0.26 * g, grain);
      // пигментот поблед таму каде што хартијата е „испакната“
      c = mix(c, paper, grain * 0.18 * smoothstep(0.55, 0.85, fine));

      // 5) топлина и винета кон хартијата
      c *= vec3(1.0 + warmth, 1.0, 1.0 - warmth);
      vec2 q = vUv - 0.5;
      q.x *= resolution.x / resolution.y;
      float v = smoothstep(0.45, 1.05, length(q) * 1.35 + (clouds - 0.5) * 0.25);
      c = mix(c, paper, v * vignette);

      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

/** sRGB хекс → вектор (без конверзија во линеарен простор). */
function srgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * @param {object} o
 * @param {string} o.paper  боја на хартијата (#rrggbb)
 * @param {boolean} [o.low] полесна верзија за телефони
 */
export function createPostcardPass(o) {
  const pass = new ShaderPass({ ...shader, defines: { OCTAVES: o.low ? 3 : 5 } });
  pass.perfName = 'postcard';
  const u = pass.uniforms;
  u.paper.value.copy(srgb(o.paper));
  for (const k of ['wobble', 'bleed', 'edge', 'grain', 'vignette', 'warmth']) if (o[k] !== undefined) u[k].value = o[k];
  const setSize = pass.setSize.bind(pass);
  pass.setSize = (w, h) => {
    setSize(w, h);
    u.resolution.value.set(w, h);
    u.pixelScale.value = Math.max(1, w / Math.max(1, window.innerWidth));
  };
  return pass;
}
