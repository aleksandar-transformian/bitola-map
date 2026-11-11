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
    landmarks: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    trees: new THREE.MeshLambertMaterial({ vertexColors: true }),
  };
}

/** Градиент за toon сенчење: n тонови (на пр. [0.45, 0.75, 1]) — n пиксели, без филтрирање. */
export function toonGradient(levels = [0.45, 0.75, 1]) {
  const data = new Uint8Array(levels.map((v) => Math.round(v * 255)));
  const tex = new THREE.DataTexture(data, levels.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** Комплет toon материјали (цртан изглед): сенчење во неколку тонови наместо меко. */
export function toonSet(ctx, { skirt = '#8b7d66', levels } = {}) {
  const gradientMap = toonGradient(levels);
  const toon = (o) => new THREE.MeshToonMaterial({ gradientMap, ...o });
  return {
    terrain: toon({ map: ctx.ground.texture }),
    skirt: toon({ color: skirt, side: THREE.DoubleSide }),
    walls: toon({ vertexColors: true }),
    roofs: toon({ vertexColors: true }),
    roads: toon({ vertexColors: true }),
    rail: toon({ vertexColors: true }),
    water: toon({ vertexColors: true }),
    landmarks: toon({ vertexColors: true, side: THREE.DoubleSide }),
    trees: toon({ vertexColors: true }),
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
      .replace('#include <common>', '#include <common>\n#ifndef HAS_ABASE\n#define HAS_ABASE\nattribute float aBase;\n#endif\nuniform float uGrow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y = aBase + (transformed.y - aBase) * uGrow;');
  };
  const prevKey = material.customProgramCacheKey?.call(material) || '';
  material.customProgramCacheKey = () => prevKey + '|grow';
  return material;
}

// ───────────────────────── Ноќ: светла ─────────────────────────
// env = { night: { value: 0..1 }, lamp: { value: THREE.Color } } — заеднички uniforms што ги
// менува времето од денот (src/app/time.js).

function chain(material, key, fn) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.call(material, shader, r);
    fn(shader);
  };
  const prevKey = material.customProgramCacheKey?.call(material) || '';
  material.customProgramCacheKey = () => prevKey + '|' + key;
  return material;
}

/** Делови што светат ноќе (атрибут aGlow: прозорци, светилки на знаменитостите). */
export function withGlow(material, env, { fill = 0 } = {}) {
  return chain(material, `glow${fill}`, (shader) => {
    shader.uniforms.uNight = env.night;
    shader.uniforms.uLamp = env.lamp;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nuniform vec3 uLamp;\nvarying float vGlow;')
      .replace(
        '#include <emissivemap_fragment>',
        // fill = топол одблесок од светилките врз фасадите (ноќе не се сосема црни)
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += uLamp * vGlow * uNight * 1.6;
        ${fill ? `totalEmissiveRadiance += diffuseColor.rgb * uLamp * uNight * (1.0 - vGlow) * ${fill.toFixed(3)};` : ''}`,
      );
  });
}

/**
 * Осветлени прозорци на ѕидовите ноќе: процедурална мрежа (3.2 × 3.1 m) во рамнината на
 * секој ѕид, случајно светнати ќелии. Потребен е атрибутот aBase (подлога на зградата).
 */
export function withWindows(material, env, { ratio = 0.42, cross = 0, halo = 0, fill = 0 } = {}) {
  return chain(material, `windows${cross}-${halo}-${fill}`, (shader) => {
    shader.uniforms.uNight = env.night;
    shader.uniforms.uLamp = env.lamp;
    shader.uniforms.uRatio = { value: ratio };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n#ifndef HAS_ABASE\n#define HAS_ABASE\nattribute float aBase;\n#endif\nvarying vec3 vWPos;\nvarying vec3 vWNor;\nvarying float vWBase;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNor = normalize(mat3(modelMatrix) * objectNormal);\nvWBase = aBase;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uNight, uRatio;
        uniform vec3 uLamp;
        varying vec3 vWPos;
        varying vec3 vWNor;
        varying float vWBase;
        float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (uNight > 0.001 && abs(vWNor.y) < 0.4) {
          vec2 t = normalize(vec2(-vWNor.z, vWNor.x));
          float u = dot(vWPos.xz, t);
          float v = vWPos.y - vWBase - 0.9;
          vec2 cell = floor(vec2(u / 3.2, v / 3.1));
          vec2 f = fract(vec2(u / 3.2, v / 3.1));
          float inWin = step(0.28, f.x) * step(f.x, 0.72) * step(0.22, f.y) * step(f.y, 0.78) * step(0.0, v);
          float h = wHash(cell + floor(vWNor.xz * 3.0) * 17.0);
          float lit = step(1.0 - uRatio, h);
          vec3 warm = mix(uLamp, vec3(1.0, 0.95, 0.85), step(0.85, h));
          float on = lit * smoothstep(0.3, 0.95, uNight) * (0.9 + 0.6 * fract(h * 13.0));
          ${
            cross
              ? `// крстеста рамка (пречки) во прозорецот
          vec2 wl = (f - vec2(0.28, 0.22)) / vec2(0.44, 0.56);
          float bar = max(1.0 - smoothstep(0.035, 0.06, abs(wl.x - 0.5)), 1.0 - smoothstep(0.03, 0.055, abs(wl.y - 0.58)));
          bar *= 1.0 - smoothstep(0.025, 0.07, fwidth(u / 3.2));
          inWin *= 1.0 - bar * ${cross.toFixed(2)};`
              : ''
          }
          totalEmissiveRadiance += warm * inWin * on;
          ${
            fill
              ? `// топол одблесок од уличните светилки на долниот дел од ѕидовите
          totalEmissiveRadiance += diffuseColor.rgb * uLamp * (1.0 - smoothstep(0.0, 14.0, v + 1.5)) * smoothstep(0.2, 0.9, uNight) * ${fill.toFixed(3)};`
              : ''
          }
          ${
            halo
              ? `// топол одблесок на ѕидот околу светнатиот прозорец
          vec2 dd = max(abs(f - vec2(0.5)) - vec2(0.22, 0.28), 0.0) * vec2(3.2, 3.1);
          totalEmissiveRadiance += warm * on * exp(-length(dd) * 3.2) * (1.0 - inWin) * step(0.0, v) * ${halo.toFixed(3)};`
              : ''
          }
        }`,
      );
  });
}

/** Улиците светат ноќе според класата (атрибут „cls“ на лентите). */
export function withStreetGlow(material, env, strength = [0.4, 0.38, 0.36, 0.32, 0.28, 0.2, 0.08, 0.55, 0.06, 0.0]) {
  return chain(material, 'street', (shader) => {
    shader.uniforms.uNight = env.night;
    shader.uniforms.uLamp = env.lamp;
    shader.uniforms.uStrength = { value: strength };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float cls;\nuniform float uStrength[10];\nvarying float vStreet;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStreet = uStrength[int(cls + 0.5)];');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nuniform vec3 uLamp;\nvarying float vStreet;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uLamp * vStreet * uNight;');
  });
}

// ───────────────────────── Снег ─────────────────────────
// env.snow = { value: 0..1 } — заеднички uniform (временски услови, app/weather.js).
// Снегот ги бели површините свртени нагоре (покриви, земја, круни), со шум за наноси.

/** Светска позиција и нормала (со инстанци) како varyings — заедничко за снегот и текстурите. */
function injectWorld(shader) {
  if (shader.vertexShader.includes('vWorldP_')) return;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP_;\nvarying vec3 vWorldN_;')
    .replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      {
        vec4 wp_ = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp_ = instanceMatrix * wp_;
        #endif
        vWorldP_ = (modelMatrix * wp_).xyz;
        // нормалата во поглед → светски координати (viewMatrix е ротација + поместување)
        vWorldN_ = normalize((vec4(transformedNormal, 0.0) * viewMatrix).xyz);
      }`,
    );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    `#include <common>
    varying vec3 vWorldP_;
    varying vec3 vWorldN_;
    float n2Hash_(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vNoise_(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(n2Hash_(i), n2Hash_(i + vec2(1.0, 0.0)), f.x), mix(n2Hash_(i + vec2(0.0, 1.0)), n2Hash_(i + 1.0), f.x), f.y);
    }`,
  );
}

/**
 * Снег врз материјалот. lo/hi = праг на нормалата (y) — над hi сè е бело;
 * amount = најмногу снег (на пр. улиците се погазени); patch = колку шумот прави дамки.
 */
export function withSnow(material, env, { lo = 0.45, hi = 0.75, amount = 1, patch = 0.35, scale = 0.05, color = null } = {}) {
  return chain(material, `snow${lo}-${hi}-${amount}-${patch}`, (shader) => {
    injectWorld(shader);
    shader.uniforms.uSnow = env.snow;
    shader.uniforms.uSnowNight = env.night;
    shader.uniforms.uSnowColor = color ? { value: new THREE.Color(color) } : env.snowColor;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSnow, uSnowNight;\nuniform vec3 uSnowColor;\nfloat snowCover_ = 0.0;')
      // ноќе снегот благо „свети“ (месечина, одблесок од градот) — инаку е сосема темен
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uSnowColor * vec3(0.62, 0.72, 0.88) * snowCover_ * uSnowNight * 0.11;',
      )
      // по бојата и „рачните“ текстури (alphamap доаѓа веднаш по color_fragment)
      .replace(
        '#include <alphamap_fragment>',
        `if (uSnow > 0.001) {
          vec2 sp_ = vWorldP_.xz * ${scale.toFixed(4)};
          float sn_ = vNoise_(sp_) * 0.65 + vNoise_(sp_ * 4.3) * 0.35;
          float up_ = vWorldN_.y + (sn_ - 0.5) * ${patch.toFixed(3)};
          // снегот се натрупува постепено: прво на најрамните места и во наносите
          float th_ = 1.0 - uSnow * 1.35;
          float cover_ = smoothstep(${lo.toFixed(3)}, ${hi.toFixed(3)}, up_) * smoothstep(th_, th_ + 0.3, (sn_ + max(vWorldN_.y, 0.0)) * 0.5);
          vec3 snowC_ = uSnowColor * (0.92 + 0.08 * vNoise_(vWorldP_.xz * 1.7));
          snowCover_ = cover_ * ${amount.toFixed(3)};
          diffuseColor.rgb = mix(diffuseColor.rgb, snowC_, snowCover_);
        }
        #include <alphamap_fragment>`,
      );
  });
}

/**
 * „Рачна изработка“: шум како глина/филц и линии (штици на ѕидовите, редови ќерамиди на
 * покривите) што исчезнуваат кога се погусти од пиксел.
 */
export function withCraft(material, { mottle = 0.12, lines = 0, lineStep = 0.45, lineDark = 0.18, vertical = false } = {}) {
  return chain(material, `craft${mottle}-${lines}-${lineStep}-${vertical}`, (shader) => {
    injectWorld(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      {
        vec3 P_ = vWorldP_;
        vec2 q_ = ${vertical ? 'vec2(dot(P_.xz, normalize(vec2(-vWorldN_.z, vWorldN_.x) + 1e-4)), P_.y)' : 'P_.xz'};
        float m_ = vNoise_(q_ * 0.9) * 0.5 + vNoise_(q_ * 3.1) * 0.3 + vNoise_(P_.xz * 0.11 + P_.y * 0.07) * 0.2;
        diffuseColor.rgb *= 1.0 + (m_ - 0.5) * ${(mottle * 2).toFixed(3)};
        ${
          lines
            ? `float l_ = P_.y / ${lineStep.toFixed(3)};
        float lw_ = fwidth(l_);
        float ln_ = 1.0 - smoothstep(0.0, max(lw_ * 1.2, 0.08), fract(l_));
        ln_ *= 1.0 - smoothstep(0.25, 0.6, lw_);
        diffuseColor.rgb *= 1.0 - ln_ * ${lineDark.toFixed(3)} * ${lines.toFixed(3)};`
            : ''
        }
      }`,
    );
  });
}
