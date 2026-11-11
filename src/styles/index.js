// Регистар на стилови + памтење на изборот.
//
// Интерфејс на стил (секој е модул styles/<id>.js со default export):
//
//   id          латиничен идентификатор, се користи во URL: #style=<id>
//   name        име во интерфејсот (македонски)
//   tagline     краток опис
//   swatch      CSS позадина за копчето во избирачот
//   geometry    { roofs: 'flat' | 'gabled', trees } — барања за геометрија; ако се разликуваат од
//               тековните, менаџерот ги пресоздава само засегнатите слоеви (со анимација)
//   ground      { painter: 'flat' | 'watercolor', base, edge, washes?, outline?, areas: {класа: боја} }
//   roads       { класа: боја }   (класи: config/classes.js → ROAD)
//   rail        [активна, напуштена]
//   water       боја на водотеците
//   buildings   { класа: [ѕид, покрив], roofAlt?, variation, ao }
//   sky, fog    небо (градиент) и магла (метри)
//   light       { sun: {color, intensity, azimuth, elevation}, hemi: {sky, ground, intensity},
//                 shadow: јачина 0–1, toneMapping: 'neutral' | 'aces' | 'none', exposure }
//   landmarks   { дел: боја } — делови на моделите на знаменитостите (world/landmarks/kit.js → PARTS)
//   trees       { crowns: [бои], forest?: [бои] }; облик во geometry.trees: 'round'|'lollipop'|'cone'
//   night       { lamp, windows?: { ratio }, streets?: [јачина по класа на улица] } — ноќни светла
//   times?      { sunset?, night? } — делумно пребришување на стандардното зајдисонце/ноќ (app/time.js)
//   ui          { paper } — бои за интерфејсот (CSS: html[data-style=<id>])
//   materials(ctx)        → { terrain, skirt, walls, roofs, roads, rail, water } — нови материјали
//   post(ctx)?            → { before: Pass[], after: Pass[], ... } — пост-процесирање
//   update(ctx, post)?    по кадар (на пр. фокус за длабочина на поле)
//
// ctx = { scene, camera, controls, renderer, profile, size, ground }

import razglednica from './razglednica.js';
import maketa from './maketa.js';
import { readPref, hashPref, writePref } from '../app/prefs.js';

export const STYLES = [razglednica, maketa];
export const DEFAULT_STYLE = 'razglednica';

export function getStyle(id) {
  return STYLES.find((s) => s.id === id) || null;
}

const valid = (id) => !!getStyle(id);

/** Стилот од URL (#style=…), па од localStorage, па стандардниот. */
export function initialStyleId() {
  return readPref('style', valid) || DEFAULT_STYLE;
}

export function styleFromHash() {
  return hashPref('style', valid);
}

/** Запамти го изборот и стави го во URL (без нов запис во историјата). */
export function rememberStyle(id) {
  writePref('style', id);
}
