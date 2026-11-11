// Пас „тон“ (во sRGB, по OutputPass): ладни сенки и топли светла (split toning), блага
// винета и зрно. Едно цртање преку екранот — евтино и за телефони.

import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export function createGradePass({ shadows = '#1d3a4a', highlights = '#ffb46a', split = 0.12, vignette = 0.35, grain = 0.04, lift = 0.0 } = {}) {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
      shadowsC: { value: new THREE.Color(shadows) },
      highlightsC: { value: new THREE.Color(highlights) },
      split: { value: split },
      vignette: { value: vignette },
      grain: { value: grain },
      lift: { value: lift },
      seed: { value: 0 },
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
      uniform vec3 shadowsC, highlightsC;
      uniform float split, vignette, grain, lift, seed;
      varying vec2 vUv;
      float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        // тонирање: сенките кон ладната, светлите кон топлата боја (меко, со зачувана осветленост)
        vec3 tone = mix(shadowsC, highlightsC, smoothstep(0.08, 0.75, l));
        vec3 toned = c.rgb + (tone - vec3(dot(tone, vec3(0.299, 0.587, 0.114)))) * split;
        toned += lift * shadowsC * (1.0 - l);
        // винета (елиптична, според страните на екранот)
        vec2 q = (vUv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
        float v = 1.0 - vignette * smoothstep(0.35, 1.05, length(q) * 1.15);
        toned *= v;
        // зрно (статично по пиксел — без треперење)
        toned += (h(gl_FragCoord.xy + seed) - 0.5) * grain;
        gl_FragColor = vec4(clamp(toned, 0.0, 1.0), c.a);
      }`,
  });
  const setSize = pass.setSize.bind(pass);
  pass.setSize = (w, h) => {
    setSize(w, h);
    pass.uniforms.resolution.value.set(w, h);
  };
  return pass;
}
