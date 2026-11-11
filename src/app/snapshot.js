// „Зачувај слика“: еден кадар во повисока резолуција (десктоп 2×, телефон 1× од екранот),
// со натписите, насловот и атрибуцијата вцртани во сликата (ODbL бара видлива атрибуција).
// Копчињата и менијата не влегуваат во сликата.

const MAX_SIDE = 4096; // граница за големината на сликата (меморија, особено на iOS)

/**
 * @param {object} o
 * @param {ReturnType<import('../render/pipeline.js').createPipeline>} o.pipeline
 * @param {() => void} o.renderFrame  еден целосен кадар (ажурирање + цртање)
 * @param {HTMLElement} o.container
 * @param {object} o.profile
 * @param {string[]} o.attribution
 * @param {() => {style: string, styleName: string, time: string}} o.state
 */
export function createSnapshot({ pipeline, renderFrame, container, profile, attribution, state }) {
  async function capture() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    const baseDpr = pipeline.size.dpr;
    let scale = profile.name === 'mobile' ? Math.max(1, baseDpr) : 2;
    scale = Math.min(scale, MAX_SIDE / Math.max(w, h));

    // кадар во повисока резолуција; сликата се копира веднаш по цртањето (во истиот чекор),
    // па не е потребен preserveDrawingBuffer
    pipeline.setPixelRatio(scale);
    let out;
    try {
      renderFrame();
      const src = pipeline.renderer.domElement;
      out = document.createElement('canvas');
      out.width = src.width;
      out.height = src.height;
      out.getContext('2d').drawImage(src, 0, 0);
    } finally {
      pipeline.setPixelRatio(baseDpr);
      renderFrame();
    }

    const ctx = out.getContext('2d');
    const k = out.width / w; // пиксели во сликата по CSS пиксел
    drawLabels(ctx, container, k);
    drawFrame(ctx, out.width, out.height, k, attribution);

    const s = state();
    const name = `bitola-${s.style}-${s.time}.png`;
    const blob = await new Promise((res) => out.toBlob(res, 'image/png'));
    if (!blob) throw new Error('Сликата не може да се направи');
    return { blob, name, width: out.width, height: out.height };
  }

  /** Зачувај: на телефон преку менито за споделување (ако го има), инаку преземање. */
  async function save() {
    const shot = await capture();
    const file = new File([shot.blob], shot.name, { type: 'image/png' });
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    if (coarse && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Битола' });
        return shot;
      } catch (err) {
        if (err?.name === 'AbortError') return shot; // корисникот се откажа
      }
    }
    const url = URL.createObjectURL(shot.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = shot.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return shot;
  }

  return { capture, save };
}

/** Видливите HTML натписи → текст во сликата (иста позиција, фонт и боја). */
function drawLabels(ctx, container, k) {
  const box = container.getBoundingClientRect();
  for (const el of document.querySelectorAll('.label.on span')) {
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    const cs = getComputedStyle(el);
    const x = (r.left + r.width / 2 - box.left) * k;
    const y = (r.bottom - box.top - parseFloat(cs.paddingBottom || 0)) * k;
    const text = el.textContent;
    const size = parseFloat(cs.fontSize) * k;
    ctx.save();
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if (cs.letterSpacing && cs.letterSpacing !== 'normal' && 'letterSpacing' in ctx) ctx.letterSpacing = `${parseFloat(cs.letterSpacing) * k}px`;
    const bg = cs.backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      // балончиња („Цртан филм“)
      const tw = ctx.measureText(text).width;
      const pw = 9 * k;
      const ph = 3 * k;
      const bh = size + ph * 2;
      roundRect(ctx, x - tw / 2 - pw, y - size - ph + size * 0.12, tw + pw * 2, bh, bh / 2);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.lineWidth = parseFloat(cs.borderTopWidth || 0) * k;
      if (ctx.lineWidth) {
        ctx.strokeStyle = cs.borderTopColor;
        ctx.stroke();
      }
    } else {
      // ореол за читливост (како text-shadow)
      const halo = cs.textShadow.match(/rgba?\([^)]+\)/)?.[0];
      if (halo) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4 * k;
        ctx.strokeStyle = halo;
        ctx.strokeText(text, x, y);
      }
    }
    ctx.fillStyle = cs.color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
}

/** Наслов горе лево и лента со атрибуција долу. */
function drawFrame(ctx, W, H, k, attribution) {
  const css = getComputedStyle(document.documentElement);
  const paper = css.getPropertyValue('--paper').trim() || 'rgba(250,247,240,0.9)';
  const ink = css.getPropertyValue('--ink').trim() || '#2f2a24';
  const soft = css.getPropertyValue('--ink-soft').trim() || '#6b6157';
  const titleFont = css.getPropertyValue('--title-font').trim() || 'Georgia, serif';
  const font = css.getPropertyValue('--font').trim() || 'system-ui, sans-serif';
  const titleWeight = css.getPropertyValue('--title-weight').trim() || '600';

  // наслов
  const pad = 16 * k;
  ctx.save();
  ctx.font = `${titleWeight} ${30 * k}px ${titleFont}`;
  const tw = ctx.measureText('Битола').width;
  ctx.font = `400 ${13 * k}px ${font}`;
  const sw = ctx.measureText('жива мапа на градот').width;
  const bw = Math.max(tw, sw) + 36 * k;
  roundRect(ctx, pad, pad, bw, 74 * k, 14 * k);
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.font = `${titleWeight} ${30 * k}px ${titleFont}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Битола', pad + 18 * k, pad + 40 * k);
  ctx.fillStyle = soft;
  ctx.font = `400 ${13 * k}px ${font}`;
  ctx.fillText('жива мапа на градот', pad + 18 * k, pad + 60 * k);

  // атрибуција (задолжителна)
  const text = attribution.join('  ·  ');
  const size = 12 * k;
  ctx.font = `400 ${size}px ${font}`;
  const aw = Math.min(W - 2 * pad, ctx.measureText(text).width + 16 * k);
  const ah = size + 10 * k;
  roundRect(ctx, W - aw - 8 * k, H - ah - 6 * k, aw, ah, 8 * k);
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.fillStyle = soft;
  ctx.textAlign = 'right';
  ctx.fillText(text, W - 16 * k, H - 6 * k - 5 * k - size * 0.15, aw - 16 * k);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
