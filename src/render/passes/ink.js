// Пас „мастило“: темни контури каде што длабочината нагло се менува (силуети на згради,
// дрвја, релјеф). Лапласијан на линеарната длабочина (0 на рамни наклонети површини, па подот
// не добива лажни линии), релативно на растојанието. Едно цртање преку целиот екран, без
// уште едно цртање на сцената — евтино и за телефони.

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const material = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
      cameraNear: { value: 1 },
      cameraFar: { value: 1000 },
      ink: { value: new THREE.Color('#2a2420') },
      strength: { value: 0.9 },
      threshold: { value: 0.012 },
      width: { value: 1 },
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
      uniform float cameraNear, cameraFar, strength, threshold, width;
      uniform vec3 ink;
      varying vec2 vUv;
      float lin(vec2 uv) {
        float z = texture2D(tDepth, uv).x;
        return -perspectiveDepthToViewZ(z, cameraNear, cameraFar);
      }
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        vec2 t = width / resolution;
        float d = lin(vUv);
        float l = lin(vUv - vec2(t.x, 0.0));
        float r = lin(vUv + vec2(t.x, 0.0));
        float u = lin(vUv + vec2(0.0, t.y));
        float b = lin(vUv - vec2(0.0, t.y));
        // Лапласијан релативно на растојанието; само кога соседот е ПОДАЛЕКУ (надворешен раб)
        float lap = (l + r + u + b - 4.0 * d) / max(d, 1.0);
        float e = smoothstep(threshold, threshold * 2.5, lap);
        // небото (многу далеку) нема контури
        e *= 1.0 - smoothstep(cameraFar * 0.6, cameraFar * 0.8, d);
        gl_FragColor = vec4(mix(c.rgb, ink, e * strength), c.a);
      }`,
    depthTest: false,
    depthWrite: false,
  });

export class InkPass extends Pass {
  constructor(camera, { color = '#2a2420', strength = 0.9, threshold = 0.012, width = 1 } = {}) {
    super();
    this.camera = camera;
    this.material = material();
    const u = this.material.uniforms;
    u.ink.value.set(color);
    u.strength.value = strength;
    u.threshold.value = threshold;
    this.baseWidth = width;
    this.quad = new FullScreenQuad(this.material);
  }

  setSize(w, h) {
    this.material.uniforms.resolution.value.set(w, h);
    // иста дебелина на линијата во логички пиксели на секој екран
    this.material.uniforms.width.value = this.baseWidth * Math.max(1, w / Math.max(1, window.innerWidth));
  }

  render(renderer, writeBuffer, readBuffer) {
    const u = this.material.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.tDepth.value = readBuffer.depthTexture;
    u.cameraNear.value = this.camera.near;
    u.cameraFar.value = this.camera.far;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}
