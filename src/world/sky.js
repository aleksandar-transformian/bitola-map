// Небо: голема сфера со вертикален градиент; ноќе — ѕвезди (процедурални, без текстури).

import * as THREE from 'three';

export function createSky() {
  const geo = new THREE.SphereGeometry(30000, 48, 24);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color('#9cc3e4') },
      bottom: { value: new THREE.Color('#eef3f2') },
      night: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 bottom;
      uniform float night;
      varying vec3 vDir;
      float sHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        float t = smoothstep(-0.02, 0.45, vDir.y);
        vec3 c = mix(bottom, top, t);
        if (night > 0.01) {
          vec3 cell = floor(vDir * 380.0);
          float h = sHash(cell);
          float star = step(0.9965, h) * smoothstep(0.04, 0.3, vDir.y);
          c += vec3(0.9, 0.93, 1.0) * star * night * (0.4 + 0.6 * fract(h * 91.0));
        }
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sky';
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  /** Бои (THREE.Color, линеарни) и ноќ 0–1. */
  mesh.userData.set = (topC, bottomC, n) => {
    mat.uniforms.top.value.copy(topC);
    mat.uniforms.bottom.value.copy(bottomC);
    mat.uniforms.night.value = n;
  };
  return mesh;
}
