// Снегулки што паѓаат: еден слој точки (без текстури) во кутија околу камерата.
// Кутијата и снегулките се скалираат со растојанието до целта, па од секоја висина снегот
// изгледа исто (минијатура). Снегулките што се далеку од фокусот се поголеми и помеки (боке).
// Позициите се во светот (поместувањето на камерата дава паралакса), а кутијата се
// „преклопува“ околу камерата — нема создавање/бришење на честички.

import * as THREE from 'three';

const vertexShader = /* glsl */ `
  attribute float aRand;
  uniform float uTime, uBox, uPix, uFocus, uCoc, uMaxSize, uSize;
  uniform vec3 uCenter;
  varying float vSoft;
  varying float vAlpha;
  varying float vRand;
  void main() {
    vec3 p = position * uBox;
    float speed = uBox * (0.045 + 0.035 * aRand);
    p.y -= uTime * speed;
    // лулање лево-десно
    float ph = uTime * (0.6 + aRand * 0.8) + aRand * 40.0;
    p.x += sin(ph) * uBox * 0.012;
    p.z += cos(ph * 0.8) * uBox * 0.012;
    // најблиската копија од решетката до средиштето на кутијата
    p -= uBox * floor((p - uCenter) / uBox + 0.5);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float z = max(-mv.z, 0.01);
    float px = uSize * uBox * (0.6 + 0.8 * fract(aRand * 7.31)) * uPix / z;
    // круг на расфокус: расте со оддалеченоста од фокусот
    float coc = clamp(abs(z - uFocus) / z, 0.0, 1.5) * uCoc;
    float size = min(px + coc, uMaxSize);
    gl_PointSize = max(size, 1.0);
    vSoft = clamp(coc / max(size, 1.0), 0.0, 1.0);
    // поголемите (размачкани) снегулки се попровидни; многу блиските и далечните избледуваат
    float area = px / max(size, 1.0);
    vAlpha = mix(1.0, 0.18, vSoft) * mix(1.0, area, 0.5) * smoothstep(0.0, uBox * 0.04, z) * (1.0 - smoothstep(uBox * 0.7, uBox * 0.95, z));
    vRand = aRand;
    gl_Position = projectionMatrix * mv;
  }`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vSoft;
  varying float vAlpha;
  varying float vRand;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c) * 2.0;
    // остра снегулка → мек диск со малку посветол раб (како боке)
    float edge = mix(0.35, 0.9, vSoft);
    float a = 1.0 - smoothstep(1.0 - edge, 1.0, r);
    a *= mix(1.0, 0.75 + 0.35 * smoothstep(0.5, 0.95, r), vSoft);
    a *= vAlpha * uOpacity * (0.7 + 0.3 * vRand);
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }`;

/**
 * @param {{count?: number}} opts
 */
export function createSnowfall({ count = 6000 } = {}) {
  const pos = new Float32Array(count * 3);
  const rand = new Float32Array(count);
  let s = 12345;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rnd();
    pos[i * 3 + 1] = rnd();
    pos[i * 3 + 2] = rnd();
    rand[i] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBox: { value: 200 },
      uPix: { value: 500 },
      uFocus: { value: 300 },
      uCoc: { value: 10 },
      uMaxSize: { value: 48 },
      uSize: { value: 0.0035 },
      uCenter: { value: new THREE.Vector3() },
      uColor: { value: new THREE.Color('#ffffff') },
      uOpacity: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'snowfall';
  points.frustumCulled = false;
  points.visible = false;
  points.renderOrder = 10;

  const fwd = new THREE.Vector3();
  const day = new THREE.Color('#ffffff');
  const night = new THREE.Color('#e3e9f2');
  let time = 0;
  let opacity = 0;
  let target = 0;

  points.userData = {
    /** Вклучи/исключи (со мек премин). */
    set(on) {
      target = on ? 1 : 0;
    },
    get on() {
      return target > 0;
    },
    /**
     * По кадар.
     * @param {number} dt секунди
     * @param {THREE.PerspectiveCamera} camera
     * @param {number} d растојание камера–цел (фокус)
     * @param {{height:number, dpr:number}} view висина на екранот (CSS px) и густина на пиксели
     * @param {number} nightW 0–1
     */
    update(dt, camera, d, view, nightW) {
      opacity += (target - opacity) * Math.min(1, dt * 1.8);
      if (Math.abs(target - opacity) < 0.003) opacity = target;
      points.visible = opacity > 0.003;
      if (!points.visible) return;
      time += Math.min(dt, 0.1);
      const u = mat.uniforms;
      const box = Math.min(1800, Math.max(40, d * 0.55));
      u.uBox.value = box;
      camera.getWorldDirection(fwd);
      u.uCenter.value.copy(camera.position).addScaledVector(fwd, box * 0.42);
      u.uPix.value = (view.height * view.dpr * 0.5) / Math.tan((camera.fov * Math.PI) / 360);
      u.uFocus.value = d;
      u.uCoc.value = 4 * view.dpr;
      u.uMaxSize.value = 20 * view.dpr;
      u.uTime.value = time;
      u.uOpacity.value = opacity;
      u.uColor.value.copy(day).lerp(night, nightW);
    },
  };
  return points;
}
