// Камера и контроли (глувче, допир, тастатура), погледи, лет до поглед и ограничувања.

import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';

const DEG = Math.PI / 180;

export function createCamera(dom, world) {
  const { hf, rect } = world;
  const camera = new THREE.PerspectiveCamera(40, dom.clientWidth / dom.clientHeight, 5, 40000);
  const controls = new MapControls(camera, dom);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;
  controls.minDistance = 40;
  controls.maxDistance = 14000;
  controls.maxPolarAngle = 80 * DEG;
  controls.zoomToCursor = true;
  controls.listenToKeyEvents(window);
  controls.keyPanSpeed = 25;

  /**
   * Поглед: bearing = компасен азимут од целта до камерата (0 = камерата е северно,
   * 90 = источно), polar = агол од вертикала, distance во метри.
   */
  function setView(v) {
    const ty = hf.sample(v.target.x, v.target.z);
    controls.target.set(v.target.x, ty, v.target.z);
    const off = new THREE.Vector3().setFromSphericalCoords(v.distance, v.polar * DEG, (180 - v.bearing) * DEG);
    camera.position.copy(controls.target).add(off);
    controls.update();
  }

  // Целта секогаш на теренот и во опфатот; камерата никогаш под теренот.
  controls.addEventListener('change', () => {
    const t = controls.target;
    const cx = Math.max(rect.minX, Math.min(rect.maxX, t.x));
    const cz = Math.max(rect.minZ, Math.min(rect.maxZ, t.z));
    const dy = hf.sample(cx, cz) - t.y;
    const dx = cx - t.x;
    const dz = cz - t.z;
    if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > 0.01) {
      t.set(cx, t.y + dy, cz);
      camera.position.x += dx;
      camera.position.y += dy;
      camera.position.z += dz;
    }
    const minY = hf.sample(camera.position.x, camera.position.z) + 15;
    if (camera.position.y < minY) camera.position.y = minY;
  });

  /** near/far според растојанието — подобра прецизност на длабочината (сенки, AO, DOF). */
  function updateClipping(sky) {
    const d = camera.position.distanceTo(controls.target);
    const near = Math.min(150, Math.max(2, d * 0.02));
    const far = Math.min(45000, d + 26000);
    if (Math.abs(near - camera.near) > 0.5 || Math.abs(far - camera.far) > 50) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
    sky.position.copy(camera.position);
    sky.scale.setScalar((far * 0.9) / sky.geometry.parameters.radius);
    return d;
  }

  /** Тековниот поглед во истите параметри како setView. */
  function getView() {
    const off = camera.position.clone().sub(controls.target);
    const d = off.length();
    return {
      target: { x: controls.target.x, z: controls.target.z },
      bearing: (Math.atan2(off.x, -off.z) / DEG + 360) % 360,
      polar: Math.acos(Math.min(1, Math.max(-1, off.y / d))) / DEG,
      distance: d,
    };
  }

  // Лет до поглед: мазно движење на целта, азимутот, наклонот и растојанието;
  // при подалечни скокови камерата малку се крева. Секое корисничко движење го прекинува.
  let flight = null;
  function flyTo(v, ms = 1800) {
    const a = getView();
    let db = ((v.bearing - a.bearing + 540) % 360) - 180;
    const travel = Math.hypot(v.target.x - a.target.x, v.target.z - a.target.z);
    flight = { a, b: v, db, t0: performance.now(), ms, hump: Math.min(0.9, travel / Math.max(a.distance, v.distance)) * 0.6 };
  }
  controls.addEventListener('start', () => (flight = null));

  function updateFlight() {
    if (!flight) return false;
    const { a, b, db, t0, ms, hump } = flight;
    const k = Math.min(1, (performance.now() - t0) / ms);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const lerp = (x, y) => x + (y - x) * e;
    const dist = Math.exp(lerp(Math.log(a.distance), Math.log(b.distance))) * (1 + hump * Math.sin(Math.PI * k));
    setView({
      target: { x: lerp(a.target.x, b.target.x), z: lerp(a.target.z, b.target.z) },
      bearing: a.bearing + db * e,
      polar: lerp(a.polar, b.polar),
      distance: dist,
    });
    if (k >= 1) flight = null;
    return true;
  }

  // Тастатура: Q/E ротација, +/− зум, PageUp/PageDown наклон (стрелките ги има MapControls).
  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea') || e.altKey || e.ctrlKey || e.metaKey) return;
    const v = getView();
    let changed = true;
    switch (e.key) {
      case 'q':
      case 'Q':
      case 'љ':
      case 'Љ':
        v.bearing -= 12;
        break;
      case 'e':
      case 'E':
      case 'е':
      case 'Е':
        v.bearing += 12;
        break;
      case '+':
      case '=':
        v.distance = Math.max(controls.minDistance, v.distance / 1.25);
        break;
      case '-':
      case '_':
        v.distance = Math.min(controls.maxDistance, v.distance * 1.25);
        break;
      case 'PageUp':
        v.polar = Math.max(5, v.polar - 6);
        break;
      case 'PageDown':
        v.polar = Math.min(controls.maxPolarAngle / DEG, v.polar + 6);
        break;
      default:
        changed = false;
    }
    if (changed) {
      e.preventDefault();
      flyTo(v, 260);
    }
  });

  function resize(w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return { camera, controls, setView, getView, flyTo, updateFlight, updateClipping, resize };
}
