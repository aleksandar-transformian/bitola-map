// GPU време по кадар и по чекор (пас) преку EXT_disjoint_timer_query_webgl2.
//
// WebGL не дозволува вгнездени мерења, па тајмерот работи како штоперица со „кругови“:
// lap('x') го затвора тековното мерење и отвора ново со ознака 'x'. Истата ознака може
// да се појави повеќе пати во кадарот (на пр. 'scene' пред и по сенките) — времињата се собираат.
// Резултатите доаѓаат со задоцнување од неколку кадри; poll() ги собира кога ќе бидат готови.
// Достапно во Chrome/Edge (десктоп); Safari и Firefox најчесто го немаат → null.

export function createGpuTimer(gl) {
  const ext = gl.getExtension?.('EXT_disjoint_timer_query_webgl2');
  if (!ext || typeof gl.createQuery !== 'function') return null;

  const free = [];
  const pending = []; // [{ tag, laps: [{label, q}] }]
  let frame = null;
  let active = false;

  const stop = () => {
    if (active) gl.endQuery(ext.TIME_ELAPSED_EXT);
    active = false;
  };

  return {
    /** Ознака на кадарот (број), за мерењата да се поврзат со сценаријото. */
    tag: 0,
    begin() {
      if (frame) this.end();
      frame = { tag: this.tag, laps: [] };
    },
    lap(label) {
      if (!frame) return;
      stop();
      const q = free.pop() || gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      active = true;
      frame.laps.push({ label, q });
    },
    end() {
      stop();
      if (frame?.laps.length) pending.push(frame);
      frame = null;
      // ако резултатите не се собираат (на пр. скриен таб), не трупај бесконечно
      while (pending.length > 16) for (const l of pending.shift().laps) free.push(l.q);
    },
    /** cb(tag, { ознака: ms }, вкупно ms) за секој завршен кадар. */
    poll(cb) {
      if (!pending.length) return;
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      while (pending.length) {
        const f = pending[0];
        const last = f.laps[f.laps.length - 1].q;
        if (!disjoint && !gl.getQueryParameter(last, gl.QUERY_RESULT_AVAILABLE)) break;
        pending.shift();
        const laps = {};
        let total = 0;
        for (const { label, q } of f.laps) {
          if (!disjoint) {
            const ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
            laps[label] = (laps[label] || 0) + ms;
            total += ms;
          }
          free.push(q);
        }
        // при „disjoint“ (смена на фреквенција, друг процес) мерењата не се веродостојни
        if (!disjoint) cb(f.tag, laps, total);
      }
    },
  };
}
