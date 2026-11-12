// Мени горе десно: „Оди до…“ (брзи погледи + знаменитости по групи), време од денот,
// временски услови (снег) и упатство за движење низ мапата.

const ICONS = {
  day: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><g stroke-width="1.8" stroke-linecap="round"><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/></g></svg>',
  sunset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 16a5.5 5.5 0 0 1 11 0z"/><g stroke-width="1.8" stroke-linecap="round" fill="none"><path d="M2.5 19.5h19M12 5v2.4M4.6 9.2l1.6 1.4M19.4 9.2l-1.6 1.4"/></g></svg>',
  night: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z"/></svg>',
  // без снег: прецртана снегулка
  clear:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke-width="1.7" stroke-linecap="round"><path d="M12 4v16M5.1 8l13.8 8M5.1 16l13.8-8" opacity=".45"/><path d="M4 20 20 4"/></g></svg>',
  // снег: покрив под снег
  snow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13.5 12 6l9 7.5v1.8l-9-7.4-9 7.4z"/><path d="M6.5 14.2V20h11v-5.8L12 9.6z" opacity=".55"/><path d="M2.6 13.2C5 8.6 9 5 12 4.4c3 .6 7 4.2 9.4 8.8-2.4-1.4-5-2.6-9.4-6-4.4 3.4-7 4.6-9.4 6z"/></svg>',
  // снежи: снегулка
  snowfall:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke-width="1.7" stroke-linecap="round"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.6 4.6 12 6.6l2.4-2M9.6 19.4l2.4-2 2.4 2M4.6 10.6l3-1-.7-3M19.4 13.4l-3 1 .7 3M4.6 13.4l3 1-.7 3M19.4 10.6l-3-1 .7-3"/></g></svg>',
};

const LIFE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11.5 6.6 7.3A2 2 0 0 1 8.5 6h7a2 2 0 0 1 1.9 1.3L19 11.5V17h-2.2v-1.6H7.2V17H5zM7.4 10.6h9.2l-1-2.7H8.4z"/><circle cx="8" cy="13.3" r="1.1" fill="#fff"/><circle cx="16" cy="13.3" r="1.1" fill="#fff"/></svg>';

const PHOTO_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 5.5 9.9 4h4.2l1.3 1.5H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2zM12 16.3a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-1.8a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4z"/></svg>';

// квалитет: три столбчиња (ниско / средно / високо); во „авто“ со буквата А
const QUALITY_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="q1" x="4" y="14" width="4" height="6" rx="1"/><rect class="q2" x="10" y="10" width="4" height="10" rx="1"/><rect class="q3" x="16" y="5" width="4" height="15" rx="1"/><text class="qa" x="7.5" y="9.5" text-anchor="middle" font-size="8.5" font-weight="700" font-family="system-ui, sans-serif">А</text></svg>';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * @param {HTMLElement} root
 * @param {{ views: object[], landmarks: object[], times: object[], weathers: object[], onGo: (id:string)=>void, onTime: (id:string)=>void, onWeather: (id:string)=>void, onLife?: (on:boolean)=>void }} o
 */
export function createMenu(root, { views, landmarks, times, weathers, qualities = [], onGo, onTime, onWeather, onLife, onSnapshot, onQuality }) {
  const GROUP_ORDER = ['Центар', 'Цркви и џамии', 'Јавни згради', 'Историја и спомен-места'];
  const viewIds = new Set(views.map((v) => v.id));
  const groups = new Map(GROUP_ORDER.map((g) => [g, []]));
  for (const l of landmarks) {
    if (!l.group || viewIds.has(l.id)) continue;
    if (!groups.has(l.group)) groups.set(l.group, []);
    groups.get(l.group).push(l);
  }
  const options = [
    `<optgroup label="Погледи">${views.map((v) => `<option value="${v.id}">${esc(v.name)}</option>`).join('')}</optgroup>`,
    ...[...groups].filter(([, list]) => list.length).map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}</optgroup>`),
  ].join('');

  const el = document.createElement('section');
  el.className = 'panel';
  el.setAttribute('aria-label', 'Мени');
  el.innerHTML = `
    <label class="go">
      <span class="sr">Оди до</span>
      <select aria-label="Оди до знаменитост или поглед">
        <option value="" disabled selected>Оди до…</option>
        ${options}
      </select>
    </label>
    <nav class="time-toggle" role="radiogroup" aria-label="Време од денот">
      ${times.map((t) => `<button type="button" role="radio" aria-checked="false" data-id="${t.id}" title="${t.name}" aria-label="${t.name}">${ICONS[t.id] || ''}</button>`).join('')}
    </nav>
    <nav class="time-toggle weather-toggle" role="radiogroup" aria-label="Снег">
      ${weathers.map((t) => `<button type="button" role="radio" aria-checked="false" data-id="${t.id}" title="${t.name}" aria-label="${t.name}">${ICONS[t.id] || ''}</button>`).join('')}
    </nav>
    <button type="button" class="help-btn life-btn" aria-pressed="true" title="Живот на мапата: сообраќај и пешаци" aria-label="Живот на мапата: сообраќај и пешаци">${LIFE_ICON}</button>
    <button type="button" class="help-btn photo-btn" title="Зачувај слика (PNG)" aria-label="Зачувај слика">${PHOTO_ICON}</button>
    <button type="button" class="help-btn quality-btn" data-q="auto" title="Квалитет на приказот" aria-label="Квалитет на приказот">${QUALITY_ICON}</button>
    <button type="button" class="help-btn" aria-expanded="false" aria-controls="help" title="Како се движи низ мапата">?</button>
  `;
  root.appendChild(el);

  const help = document.createElement('aside');
  help.className = 'help';
  help.id = 'help';
  help.hidden = true;
  help.innerHTML = `
    <h2>Движење низ мапата</h2>
    <dl>
      <dt>Глувче</dt>
      <dd><b>Лево копче + влечење</b> — поместување</dd>
      <dd><b>Десно копче + влечење</b> — ротација и наклон</dd>
      <dd><b>Тркалце</b> — зум кон курсорот</dd>
      <dt>Допир</dt>
      <dd><b>Еден прст</b> — поместување</dd>
      <dd><b>Два прста</b> — зум (штипкање) и ротација</dd>
      <dt>Тастатура</dt>
      <dd><kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd> поместување · <kbd>Q</kbd> <kbd>E</kbd> ротација</dd>
      <dd><kbd>+</kbd> <kbd>−</kbd> зум · <kbd>PgUp</kbd> <kbd>PgDn</kbd> наклон · <kbd>Home</kbd> преглед</dd>
      <dd><kbd>1</kbd>–<kbd>5</kbd> стил · <kbd>S</kbd> снег (без → снег → снежи)</dd>
      <dt>Слика</dt>
      <dd>Копчето со фотоапарат го зачувува погледот како PNG (со натписите и атрибуцијата).</dd>
      <dt>Живот на мапата</dt>
      <dd>Копчето со автомобил ги вклучува/исклучува сообраќајот и пешаците.</dd>
      <dt>Квалитет</dt>
      <dd>Копчето со столбчиња: <b>авто</b> (се прилагодува на уредот за мазно движење) → високо → средно → ниско.</dd>
    </dl>
    <p>Со „Оди до…“ камерата лета до знаменитоста. Изборот на стил, време и снег се памти и може да се сподели со линкот.</p>
    <button type="button" class="help-close">Во ред</button>
  `;
  root.appendChild(help);

  const select = el.querySelector('select');
  select.addEventListener('change', () => {
    if (select.value) onGo(select.value);
    select.blur(); // стрелките пак да ја движат мапата
  });
  const timeNav = el.querySelector('.time-toggle:not(.weather-toggle)');
  const weatherNav = el.querySelector('.weather-toggle');
  timeNav.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) onTime(b.dataset.id);
  });
  weatherNav.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    // клик на избраното копче = следната состојба (на телефон се гледа само тоа копче)
    if (b.getAttribute('aria-checked') === 'true') {
      const all = [...weatherNav.querySelectorAll('button[data-id]')];
      onWeather(all[(all.indexOf(b) + 1) % all.length].dataset.id);
    } else onWeather(b.dataset.id);
  });
  const lifeBtn = el.querySelector('.life-btn');
  lifeBtn.addEventListener('click', () => onLife?.(lifeBtn.getAttribute('aria-pressed') !== 'true'));
  const photoBtn = el.querySelector('.photo-btn');
  photoBtn.addEventListener('click', async () => {
    if (photoBtn.disabled) return;
    photoBtn.disabled = true;
    photoBtn.classList.add('busy');
    try {
      await onSnapshot?.();
    } finally {
      photoBtn.disabled = false;
      photoBtn.classList.remove('busy');
    }
  });
  const qualityBtn = el.querySelector('.quality-btn');
  qualityBtn.addEventListener('click', () => {
    const i = qualities.findIndex((q) => q.id === qualityBtn.dataset.q);
    if (qualities.length) onQuality?.(qualities[(i + 1) % qualities.length].id);
  });
  const btn = el.querySelector('.help-btn[aria-controls="help"]');
  const toggleHelp = (show = help.hidden) => {
    help.hidden = !show;
    btn.setAttribute('aria-expanded', String(show));
  };
  btn.addEventListener('click', () => toggleHelp());
  help.querySelector('.help-close').addEventListener('click', () => toggleHelp(false));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggleHelp(false);
    if (e.key === '?' && !e.target.closest?.('select, input, textarea')) toggleHelp();
  });

  return {
    setPlace(id) {
      select.value = id && [...select.options].some((o) => o.value === id) ? id : '';
    },
    setLife(on) {
      lifeBtn.setAttribute('aria-pressed', String(on));
    },
    setTime(id) {
      for (const b of timeNav.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.id === id));
    },
    setWeather(id) {
      for (const b of weatherNav.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.id === id));
    },
    /** @param {string} id режим  @param {string} [detail] на пр. тековното ниво во „авто“ */
    setQuality(id, detail = '') {
      const q = qualities.find((x) => x.id === id);
      qualityBtn.dataset.q = id;
      const label = `Квалитет: ${(q?.name || id).toLowerCase()}${detail ? ` (${detail})` : ''}`;
      qualityBtn.title = `${label} — клик за следното`;
      qualityBtn.setAttribute('aria-label', label);
    },
    showHelp: toggleHelp,
  };
}
