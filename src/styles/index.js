// Регистар на стилови + памтење на изборот.
//
// Интерфејс на стил (секој е модул styles/<id>.js со default export):
//
//   id          латиничен идентификатор, се користи во URL: #style=<id>
//   name        име во интерфејсот (македонски)
//   tagline     краток опис
//   swatch      CSS позадина за копчето во избирачот
//   geometry    { roofs: 'flat' | 'gabled' } — барања за геометрија; ако се разликуваат од
//               тековните, менаџерот ги пресоздава само засегнатите слоеви (со анимација)
//   ground      { painter: 'flat' | 'watercolor', base, edge, washes?, outline?, areas: {класа: боја} }
//   roads       { класа: боја }   (класи: config/classes.js → ROAD)
//   rail        [активна, напуштена]
//   water       боја на водотеците
//   buildings   { класа: [ѕид, покрив], roofAlt?, variation, ao }
//   sky, fog    небо (градиент) и магла (метри)
//   light       { sun: {color, intensity, azimuth, elevation}, hemi: {sky, ground, intensity},
//                 shadow: јачина 0–1, toneMapping: 'neutral' | 'aces' | 'none', exposure }
//   ui          { paper } — бои за интерфејсот (CSS: html[data-style=<id>])
//   materials(ctx)        → { terrain, skirt, walls, roofs, roads, rail, water } — нови материјали
//   post(ctx)?            → { before: Pass[], after: Pass[], ... } — пост-процесирање
//   update(ctx, post)?    по кадар (на пр. фокус за длабочина на поле)
//
// ctx = { scene, camera, controls, renderer, profile, size, ground }

import razglednica from './razglednica.js';
import maketa from './maketa.js';

export const STYLES = [razglednica, maketa];
export const DEFAULT_STYLE = 'razglednica';

const KEY = 'bitola.style';

export function getStyle(id) {
  return STYLES.find((s) => s.id === id) || null;
}

/** Стилот од URL (#style=…), па од localStorage, па стандардниот. */
export function initialStyleId() {
  const fromHash = styleFromHash();
  if (fromHash) return fromHash;
  try {
    const saved = localStorage.getItem(KEY);
    if (getStyle(saved)) return saved;
  } catch {
    // приватен режим / блокирано складирање — продолжи без него
  }
  return DEFAULT_STYLE;
}

export function styleFromHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const id = params.get('style');
  return getStyle(id) ? id : null;
}

/** Запамти го изборот и стави го во URL (без нов запис во историјата). */
export function rememberStyle(id) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // нема складирање — изборот сепак е во URL
  }
  const params = new URLSearchParams(location.hash.slice(1));
  params.set('style', id);
  history.replaceState(null, '', `${location.pathname}${location.search}#${params}`);
}
