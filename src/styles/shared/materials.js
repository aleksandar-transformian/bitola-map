// Заеднички материјали и додатоци на шејдерите што ги користат стиловите.
// Сите додатоци се преку onBeforeCompile врз вградените материјали на three.js,
// за да останат осветлувањето, сенките и маглата.

import * as THREE from 'three';

/**
 * Основен комплет материјали за сите слоеви на сцената.
 * @param {{ground:{texture:THREE.Texture}}} ctx
 * @param {{skirt?: string}} opts
 */
export function lambertSet(ctx, { skirt = '#8b7d66' } = {}) {
  return {
    terrain: new THREE.MeshLambertMaterial({ map: ctx.ground.texture }),
    skirt: new THREE.MeshLambertMaterial({ color: skirt, side: THREE.DoubleSide }),
    walls: new THREE.MeshLambertMaterial({ vertexColors: true }),
    roofs: new THREE.MeshLambertMaterial({ vertexColors: true }),
    roads: new THREE.MeshLambertMaterial({ vertexColors: true }),
    rail: new THREE.MeshLambertMaterial({ vertexColors: true }),
    water: new THREE.MeshLambertMaterial({ vertexColors: true }),
  };
}

/** Додај светска висина како varying (vWorldY) во vertex шејдерот. */
function injectWorldY(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vWorldY;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWorldY;');
}

/**
 * Изохипси (контурни линии) на теренот — тенки на секои `step` метри,
 * појаки на секои `step * major`.
 */
export function withContours(material, { step = 10, major = 5, minor = 0.12, strong = 0.22, color = '#6f6658' } = {}) {
  const uniforms = {
    uStep: { value: step },
    uMajor: { value: major },
    uMinor: { value: minor },
    uStrong: { value: strong },
    uLineColor: { value: new THREE.Color(color) },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    injectWorldY(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uStep, uMajor, uMinor, uStrong;\nuniform vec3 uLineColor;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float h = vWorldY / uStep;
          float lw = fwidth(h);
          float l1 = 1.0 - smoothstep(0.0, lw * 1.1, abs(fract(h + 0.5) - 0.5));
          float h2 = vWorldY / (uStep * uMajor);
          float lw2 = fwidth(h2);
          float l2 = 1.0 - smoothstep(0.0, lw2 * 1.6, abs(fract(h2 + 0.5) - 0.5));
          // на многу стрмно или далеку линиите се згуснуваат — избледи ги
          float fade = 1.0 - smoothstep(0.25, 0.6, lw);
          float k = max(l1 * uMinor, l2 * uStrong) * fade;
          diffuseColor.rgb = mix(diffuseColor.rgb, uLineColor, k);
        }`,
      );
  };
  material.customProgramCacheKey = () => 'contours';
  return material;
}

/** Бочните страни како наредени листови (картон/шперплоча) на секои `step` метри. */
export function withLayers(material, { step = 12, a = '#d9c39d', b = '#cfb68c', seam = '#8d7552' } = {}) {
  const uniforms = {
    uStep: { value: step },
    uA: { value: new THREE.Color(a) },
    uB: { value: new THREE.Color(b) },
    uSeam: { value: new THREE.Color(seam) },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    injectWorldY(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uStep;\nuniform vec3 uA, uB, uSeam;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float h = vWorldY / uStep;
          float band = mod(floor(h), 2.0);
          vec3 c = mix(uA, uB, band);
          float lw = fwidth(h);
          float seam = 1.0 - smoothstep(0.0, lw * 1.5, abs(fract(h + 0.5) - 0.5));
          diffuseColor.rgb = mix(c, uSeam, seam * 0.6);
        }`,
      );
  };
  material.customProgramCacheKey = () => 'layers';
  return material;
}

/**
 * Анимација „растење“ на зградите: y = aBase + (y - aBase) * uGrow.
 * `grow` е заеднички објект { value } што го менува менаџерот на стилови.
 */
export function withGrow(material, grow) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.call(material, shader, r);
    shader.uniforms.uGrow = grow;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBase;\nuniform float uGrow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y = aBase + (transformed.y - aBase) * uGrow;');
  };
  const prevKey = material.customProgramCacheKey?.call(material) || '';
  material.customProgramCacheKey = () => prevKey + '|grow';
  return material;
}
