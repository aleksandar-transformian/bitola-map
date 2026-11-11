// Небо: голема сфера со вертикален градиент (без текстури).

import * as THREE from 'three';

export function createSky(style) {
  const geo = new THREE.SphereGeometry(30000, 32, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(style.sky.top) },
      bottom: { value: new THREE.Color(style.sky.bottom) },
    },
    vertexShader: /* glsl */ `
      varying float vH;
      void main() {
        vH = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 bottom;
      varying float vH;
      void main() {
        float t = smoothstep(-0.02, 0.45, vH);
        gl_FragColor = vec4(mix(bottom, top, t), 1.0);
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
  mesh.userData.restyle = (s) => {
    mat.uniforms.top.value.set(s.sky.top);
    mat.uniforms.bottom.value.set(s.sky.bottom);
  };
  return mesh;
}
