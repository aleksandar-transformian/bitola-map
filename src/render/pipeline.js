// Рендерирање: WebGLRenderer + EffectComposer.
// Редослед: RenderPass → [пасови на стилот „пред“, во линеарен HDR] → OutputPass
//           (tone mapping + sRGB) → [пасови на стилот „по“, во sRGB].

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createPipeline(container, profile) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  const dpr = Math.min(window.devicePixelRatio, profile.maxPixelRatio);
  renderer.setPixelRatio(dpr);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = profile.shadows > 0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false; // композиторот црта во повеќе чекори — бројиме цел кадар
  container.appendChild(renderer.domElement);

  // текстура за длабочина: ја користат пасовите што бараат рабови (на пр. „мастило“ кај цртаниот стил)
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: profile.msaa,
    depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
  });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(dpr);
  composer.setSize(container.clientWidth, container.clientHeight);

  let renderPass = null;
  const outputPass = new OutputPass();
  let extra = [];

  return {
    renderer,
    composer,
    /** Сцена и камера се поставуваат еднаш. */
    init(scene, camera) {
      renderPass = new RenderPass(scene, camera);
      this.setPasses([], []);
    },
    /** Замени ги пасовите на стилот (старите се ослободуваат). */
    setPasses(before, after) {
      for (const p of extra) p.dispose?.();
      extra = [...before, ...after];
      composer.passes.length = 0;
      composer.addPass(renderPass);
      for (const p of before) composer.addPass(p);
      composer.addPass(outputPass);
      for (const p of after) composer.addPass(p);
    },
    render(dt) {
      renderer.info.reset();
      composer.render(dt);
    },
    setSize(w, h) {
      renderer.setSize(w, h);
      composer.setSize(w, h);
    },
    get size() {
      return { width: container.clientWidth, height: container.clientHeight, dpr };
    },
  };
}
