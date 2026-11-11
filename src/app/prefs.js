// Поставки што се памтат и делат: URL (#style=…&time=…) има предност пред localStorage.

export function readPref(key, isValid) {
  const v = new URLSearchParams(location.hash.slice(1)).get(key);
  if (v && isValid(v)) return v;
  try {
    const saved = localStorage.getItem(`bitola.${key}`);
    if (saved && isValid(saved)) return saved;
  } catch {
    // приватен режим / блокирано складирање
  }
  return null;
}

export function hashPref(key, isValid) {
  const v = new URLSearchParams(location.hash.slice(1)).get(key);
  return v && isValid(v) ? v : null;
}

export function writePref(key, value) {
  try {
    localStorage.setItem(`bitola.${key}`, value);
  } catch {
    // нема складирање — вредноста сепак е во URL
  }
  const params = new URLSearchParams(location.hash.slice(1));
  params.set(key, value);
  history.replaceState(null, '', `${location.pathname}${location.search}#${params}`);
}
