// Копчиња: брзи погледи и време од денот.

const ICONS = {
  day: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><g stroke-width="1.8" stroke-linecap="round"><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/></g></svg>',
  sunset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 16a5.5 5.5 0 0 1 11 0z"/><g stroke-width="1.8" stroke-linecap="round" fill="none"><path d="M2.5 19.5h19M12 5v2.4M4.6 9.2l1.6 1.4M19.4 9.2l-1.6 1.4"/></g></svg>',
  night: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z"/></svg>',
};

export function createViewBar(root, views, onPick) {
  const el = document.createElement('nav');
  el.className = 'view-bar';
  el.setAttribute('aria-label', 'Брзи погледи');
  el.innerHTML = views.map((v) => `<button type="button" data-id="${v.id}">${v.name}</button>`).join('');
  root.appendChild(el);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) onPick(b.dataset.id);
  });
  return {
    setActive(id) {
      for (const b of el.querySelectorAll('button')) b.classList.toggle('active', b.dataset.id === id);
    },
  };
}

export function createTimeToggle(root, times, onPick) {
  const el = document.createElement('nav');
  el.className = 'time-toggle';
  el.setAttribute('aria-label', 'Време од денот');
  el.setAttribute('role', 'radiogroup');
  el.innerHTML = times
    .map((t) => `<button type="button" role="radio" aria-checked="false" data-id="${t.id}" title="${t.name}" aria-label="${t.name}">${ICONS[t.id]}</button>`)
    .join('');
  root.appendChild(el);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) onPick(b.dataset.id);
  });
  return {
    setActive(id) {
      for (const b of el.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.id === id));
    },
  };
}
