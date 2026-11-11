// Пас „боке“: длабочина на поле од баферот на длабочина + дискови од светлата надвор од фокус.
//
//  1. Расфокус: за секој пиксел, круг на расфокус (CoC) од растојанието до фокусот (целта на
//     камерата). Собирање примероци по спирала со златен агол (Фогелов диск), со случајна
//     ротација по пиксел; примерок од позадината не се размачкува преку поостар преден план.
//     Светлите примероци се ублажуваат (без „искри“) — дисковите ги даваат точките подолу.
//  2. Боке: точките на светлата (прозорци, светилки) се цртаат како меки дискови со големина
//     според CoC — адитивно, по замаглувањето, за да останат чисти. Скриеноста се проверува во
//     vertex шејдерот, од длабочината на сцената во средиштето на дискот.
//
// Работи во линеарен HDR (пред OutputPass), за светлата да се посветли од околината.

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const COC = /* glsl */ `
  uniform float cameraNear, cameraFar, focus, band, maxR;
  float linZ(float d) { return -perspectiveDepthToViewZ(d, cameraNear, cameraFar); }
  // радиус на расфокус во пиксели
  float cocOf(float z) {
    float k = abs(z - focus) / max(z, 1.0);
    return clamp((k - band) / (1.0 - band), 0.0, 1.0) * maxR;
  }
`;

const dofMaterial = (samples) =>
  new THREE.ShaderMaterial({
    defines: { SAMPLES: samples },
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
      cameraNear: { value: 1 },
      cameraFar: { value: 1000 },
      focus: { value: 500 },
      band: { value: 0.1 },
      maxR: { value: 12 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      #include <packing>
      uniform sampler2D tDiffuse;
      uniform sampler2D tDepth;
      uniform vec2 resolution;
      ${COC}
      varying vec2 vUv;
      vec3 tame(vec3 c) {
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        return c / (1.0 + max(l - 0.8, 0.0));
      }
      void main() {
        vec4 c0 = texture2D(tDiffuse, vUv);
        float z0 = linZ(texture2D(tDepth, vUv).x);
        float k0 = cocOf(z0);
        // во фокус: без собирање (најчест случај кога се гледа одблизу)
        if (k0 < 0.5) { gl_FragColor = c0; return; }
        float w0 = 1.0 / max(k0 * k0, 1.0);
        vec3 acc = tame(c0.rgb) * w0;
        float wsum = w0;
        // шум со испреплетен градиент → ротација на спиралата по пиксел
        float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        float R = max(k0, maxR * 0.5);
        for (int i = 0; i < SAMPLES; i++) {
          float fi = float(i) + 0.5;
          float r = sqrt(fi / float(SAMPLES)) * R;
          float a = fi * 2.39996323 + ign * 6.2831853;
          vec2 uv = vUv + vec2(cos(a), sin(a)) * r / resolution;
          float z = linZ(texture2D(tDepth, uv).x);
          float k = cocOf(z);
          // позадината не се размачкува преку поостриот преден план
          if (z > z0) k = min(k, k0);
          float w = smoothstep(r - 1.5, r + 0.5, k) / max(k * k, 1.0);
          acc += tame(texture2D(tDiffuse, uv).rgb) * w;
          wsum += w;
        }
        vec3 col = acc / wsum;
        // врати ја јачината на светлите делови (ублажувањето е само за собирањето)
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col *= 1.0 + max(l - 0.8, 0.0) * 0.6;
        gl_FragColor = vec4(col, c0.a);
      }`,
    depthTest: false,
    depthWrite: false,
  });

const lightMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      tDepth: { value: null },
      cameraNear: { value: 1 },
      cameraFar: { value: 1000 },
      focus: { value: 500 },
      band: { value: 0.1 },
      maxR: { value: 12 },
      minR: { value: 2.5 },
      maxSize: { value: 64 },
      thin: { value: 16 },
      gain: { value: 1 },
      night: { value: 0 },
      fogFar: { value: 20000 },
      lamp: { value: new THREE.Color('#ffb15e') },
      cool: { value: new THREE.Color('#fff1d6') },
    },
    vertexShader: /* glsl */ `
      #include <packing>
      attribute float aPower;
      uniform sampler2D tDepth;
      uniform float minR, maxSize, gain, night, fogFar, thin;
      ${COC}
      varying float vAlpha;
      varying float vSoft;
      varying float vTint;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec4 clip = projectionMatrix * mv;
        float z = -mv.z;
        gl_PointSize = 0.0;
        vAlpha = 0.0;
        vTint = fract(aPower * 17.0);
        vSoft = 0.0;
        gl_Position = clip;
        if (z <= cameraNear || night < 0.01) return;
        vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
        if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return;
        // скриено зад зграда/рид → без диск
        float zs = linZ(textureLod(tDepth, uv, 0.0).x);
        if (zs < z - max(4.0, z * 0.015)) return;
        float coc = cocOf(z);
        float show = smoothstep(minR, minR * 2.2, coc);
        if (show < 0.01) return;
        float size = min(2.0 * coc + 2.0, maxSize);
        // проредување: поголемите дискови се преклопуваат повеќе, па се задржува само дел од
        // нив (постојана покриеност на екранот) — секој останат диск е јасен, без „сјај-магла“
        float keep = clamp(pow(thin / size, 2.0), 0.03, 1.0);
        float pick = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453);
        if (pick > keep) return;
        gl_PointSize = size;
        float spread = 1.0 / (1.0 + size * size / 2500.0);
        vAlpha = gain * aPower * show * night * spread * (1.0 - 0.85 * smoothstep(fogFar * 0.35, fogFar, z));
        vSoft = 1.0 - smoothstep(10.0, 50.0, size);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 lamp, cool;
      varying float vAlpha;
      varying float vSoft;
      varying float vTint;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0 || vAlpha <= 0.0) discard;
        // диск со мек раб и малку посветол обод (како кај вистински објектив)
        float edge = mix(0.12, 0.35, vSoft);
        float a = 1.0 - smoothstep(1.0 - edge, 1.0, r);
        a *= 0.8 + 0.3 * smoothstep(0.55, 0.92, r);
        vec3 c = mix(lamp, cool, step(0.82, vTint) * 0.8);
        gl_FragColor = vec4(c * a * vAlpha, 1.0);
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

export class BokehPass extends Pass {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {{samples?: number, maxRadius?: number, band?: number, lights?: {position: Float32Array, power: Float32Array}, gain?: number}} o
   *        maxRadius = најголем радиус на расфокус во CSS пиксели
   */
  constructor(camera, { samples = 32, maxRadius = 12, band = 0.1, lights = null, gain = 1, lamp = '#ffb15e' } = {}) {
    super();
    this.camera = camera;
    this.maxRadius = maxRadius;
    this.dof = dofMaterial(samples);
    this.dof.uniforms.band.value = band;
    this.quad = new FullScreenQuad(this.dof);
    this.lights = null;
    if (lights?.position.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(lights.position, 3));
      geo.setAttribute('aPower', new THREE.BufferAttribute(lights.power, 1));
      this.lightMat = lightMaterial();
      this.lightMat.uniforms.band.value = band;
      this.lightMat.uniforms.gain.value = gain;
      this.lightMat.uniforms.lamp.value.set(lamp);
      const pts = new THREE.Points(geo, this.lightMat);
      pts.frustumCulled = false;
      this.lights = new THREE.Scene();
      this.lights.add(pts);
      this.lightGeo = geo;
    }
  }

  /** Фокус (растојание до целта), ноќ 0–1 и далечина на маглата — по кадар. */
  update(focus, night, fogFar) {
    this.dof.uniforms.focus.value = focus;
    if (this.lightMat) {
      const u = this.lightMat.uniforms;
      u.focus.value = focus;
      u.night.value = night;
      u.fogFar.value = fogFar;
    }
  }

  setStrength(k) {
    this.strength = k;
    this._applyRadius();
  }

  setSize(w, h) {
    this.dof.uniforms.resolution.value.set(w, h);
    this.dpr = Math.max(1, w / Math.max(1, window.innerWidth));
    this._applyRadius();
  }

  _applyRadius() {
    const r = this.maxRadius * (this.dpr || 1) * (this.strength ?? 1);
    this.dof.uniforms.maxR.value = r;
    if (this.lightMat) {
      this.lightMat.uniforms.maxR.value = r * 2.2;
      this.lightMat.uniforms.minR.value = 2.5 * (this.dpr || 1);
      this.lightMat.uniforms.maxSize.value = 90 * (this.dpr || 1);
      this.lightMat.uniforms.thin.value = 11 * (this.dpr || 1);
    }
  }

  render(renderer, writeBuffer, readBuffer) {
    const near = this.camera.near;
    const far = this.camera.far;
    const u = this.dof.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.tDepth.value = readBuffer.depthTexture;
    u.cameraNear.value = near;
    u.cameraFar.value = far;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
    if (this.lights && this.lightMat.uniforms.night.value > 0.01) {
      const lu = this.lightMat.uniforms;
      lu.tDepth.value = readBuffer.depthTexture;
      lu.cameraNear.value = near;
      lu.cameraFar.value = far;
      const auto = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(this.lights, this.camera);
      renderer.autoClear = auto;
    }
  }

  dispose() {
    this.dof.dispose();
    this.quad.dispose();
    this.lightMat?.dispose();
    this.lightGeo?.dispose();
  }
}
