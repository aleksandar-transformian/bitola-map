// Избирач на стил: копчиња со мостра на бојата и име. Тастатура: 1–9.

export function createStylePicker(root, styles, onPick) {
  const el = document.createElement('nav');
  el.className = 'style-picker';
  el.setAttribute('aria-label', 'Стил на мапата');
  el.setAttribute('role', 'radiogroup');
  el.innerHTML = styles
    .map(
      (s, i) => `
      <button type="button" role="radio" data-id="${s.id}" aria-checked="false" title="${s.name} — ${s.tagline} (${i + 1})">
        <span class="swatch" style="background:${s.swatch}"></span>
        <span class="label">${s.name}</span>
      </button>`,
    )
    .join('');
  root.appendChild(el);

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) onPick(b.dataset.id);
  });
  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea')) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const i = Number(e.key) - 1;
    if (i >= 0 && i < styles.length) onPick(styles[i].id);
  });

  return {
    setActive(id) {
      for (const b of el.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.id === id));
    },
  };
}
