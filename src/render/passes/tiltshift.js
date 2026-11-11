// Пас „минијатура“ (tilt-shift): острина во хоризонтална лента околу фокусот, сè посилно
// замаглување кон горниот и долниот раб. Работи само врз сликата (без уште едно цртање на
// сцената), па е евтин и за телефони. Две поминувања: хоризонтално и вертикално.

import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const shader = (dir) => ({
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    focus: { value: 0.55 }, // y на фокусот (0 = долу, 1 = горе)
    band: { value: 0.16 }, // половина ширина на острата лента
    amount: { value: 1 }, // јачина (0–1)
    maxBlur: { value: 7 }, // пиксели при amount = 1
  },
  defines: { DIR_X: dir === 'x' ? 1 : 0 },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float focus, band, amount, maxBlur;
    varying vec2 vUv;
    void main() {
      float d = max(0.0, abs(vUv.y - focus) - band);
      // горниот дел (далечината) се замаглува побрзо
      float k = smoothstep(0.0, 0.45, d * (vUv.y > focus ? 1.25 : 0.9));
      float r = k * amount * maxBlur;
      #if DIR_X
        vec2 stepv = vec2(r / resolution.x, 0.0);
      #else
        vec2 stepv = vec2(0.0, r / resolution.y);
      #endif
      vec4 sum = texture2D(tDiffuse, vUv) * 0.2270;
      sum += texture2D(tDiffuse, vUv + stepv * 1.3846) * 0.3162;
      sum += texture2D(tDiffuse, vUv - stepv * 1.3846) * 0.3162;
      sum += texture2D(tDiffuse, vUv + stepv * 3.2308) * 0.0702;
      sum += texture2D(tDiffuse, vUv - stepv * 3.2308) * 0.0702;
      gl_FragColor = sum;
    }`,
});

/** Враќа [хоризонтален, вертикален] пас и функција за јачината. */
export function createTiltShift({ focus = 0.55, band = 0.16, maxBlur = 7 } = {}) {
  const passes = ['x', 'y'].map((d) => {
    const p = new ShaderPass(shader(d));
    p.uniforms.focus.value = focus;
    p.uniforms.band.value = band;
    p.uniforms.maxBlur.value = maxBlur;
    const setSize = p.setSize.bind(p);
    p.setSize = (w, h) => {
      setSize(w, h);
      p.uniforms.resolution.value.set(w, h);
      p.uniforms.maxBlur.value = maxBlur * Math.max(1, w / Math.max(1, window.innerWidth));
    };
    return p;
  });
  return {
    passes,
    setAmount(a) {
      for (const p of passes) p.uniforms.amount.value = a;
    },
  };
}
