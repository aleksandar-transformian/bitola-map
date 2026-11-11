// Рендерирање: WebGLRenderer + EffectComposer.
// Редослед: RenderPass → [пасови на стилот „пред“, во линеарен HDR] → OutputPass
//           (tone mapping + sRGB) → [пасови на стилот „по“, во sRGB].

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createPipeline(container, profile) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  let dpr = Math.min(window.devicePixelRatio, profile.maxPixelRatio);
  let msaa = profile.msaa;
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
    samples: msaa,
    depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
  });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(dpr);
  composer.setSize(container.clientWidth, container.clientHeight);

  let renderPass = null;
  const outputPass = new OutputPass();
  outputPass.perfName = 'output';
  let extra = [];
  let timer = null;

  /** GPU круг за секој пас (името е perfName на пасот). */
  function wrap(pass) {
    if (!timer || pass._perfWrapped) return;
    const render = pass.render;
    const name = pass.perfName || 'pass';
    pass.render = function (...args) {
      timer.lap(name);
      return render.apply(this, args);
    };
    pass._perfWrapped = true;
  }

  return {
    renderer,
    composer,
    /** Сцена и камера се поставуваат еднаш. */
    init(scene, camera) {
      renderPass = new RenderPass(scene, camera);
      renderPass.perfName = 'scene';
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
      for (const p of composer.passes) wrap(p);
    },
    /** Пасовите на тековниот стил (без RenderPass и OutputPass). */
    get stylePasses() {
      return extra;
    },
    /**
     * Мерење на GPU време по пас (perf/gpu-timer.js). Сенките се посебен круг:
     * WebGLShadowMap.render се повикува од RenderPass, па кругот потоа се враќа на 'scene'.
     */
    instrument(gpuTimer) {
      if (!gpuTimer || timer) return;
      timer = gpuTimer;
      for (const p of composer.passes) wrap(p);
      const sm = renderer.shadowMap;
      const render = sm.render;
      sm.render = function (...args) {
        timer.lap('shadow');
        const r = render.apply(this, args);
        timer.lap('scene');
        return r;
      };
    },
    render(dt) {
      renderer.info.reset();
      timer?.begin();
      composer.render(dt);
      timer?.end();
    },
    setSize(w, h) {
      renderer.setSize(w, h);
      composer.setSize(w, h);
    },
    /** Густина на пиксели во живо (мерења; подоцна адаптивна резолуција). */
    setPixelRatio(r) {
      dpr = r;
      renderer.setPixelRatio(r);
      composer.setPixelRatio(r);
      this.setSize(container.clientWidth, container.clientHeight);
    },
    /** Број на MSAA примероци во живо (целите се пресоздаваат при следното цртање). */
    setMsaa(samples) {
      msaa = samples;
      for (const rt of [composer.renderTarget1, composer.renderTarget2]) {
        rt.samples = samples;
        rt.dispose();
      }
    },
    get msaa() {
      return msaa;
    },
    get size() {
      return { width: container.clientWidth, height: container.clientHeight, dpr };
    },
  };
}
