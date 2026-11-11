// Слој со интерфејс: наслов, вчитување, атрибуција, debug.

export function createOverlay() {
  const root = document.getElementById('ui');
  root.innerHTML = `
    <header class="title">
      <h1>Битола</h1>
      <p>жива мапа на градот</p>
    </header>
    <div class="loading" role="status" aria-live="polite">
      <div class="loading-name">Битола</div>
      <div class="bar"><span></span></div>
      <div class="loading-text">Се вчитува мапата…</div>
    </div>
    <footer class="attribution">
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© соработниците на OpenStreetMap</a>
      <span class="sep">·</span>
      <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Релјеф: Terrain Tiles</a>
    </footer>
    <pre class="debug" hidden></pre>
  `;
  const bar = root.querySelector('.bar span');
  const loading = root.querySelector('.loading');
  const dbg = root.querySelector('.debug');
  const debugOn = new URLSearchParams(location.search).has('debug');
  dbg.hidden = !debugOn;

  return {
    progress(f) {
      bar.style.width = `${Math.round(f * 100)}%`;
    },
    done() {
      bar.style.width = '100%';
      loading.classList.add('hidden');
      setTimeout(() => loading.remove(), 800);
    },
    error(msg) {
      root.querySelector('.loading-text').textContent = `Грешка: ${msg}`;
      loading.classList.add('error');
    },
    debug(stats, info) {
      if (!debugOn) return;
      dbg.textContent = `${stats.fps} fps · ${info.render.calls} повици · ${(info.render.triangles / 1000).toFixed(0)}k триаголници\n` + `податоци ${stats.dataMs} ms · прв кадар ${stats.firstFrameMs} ms · ${stats.profile}`;
    },
  };
}
