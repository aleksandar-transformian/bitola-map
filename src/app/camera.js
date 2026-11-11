// Камера и контроли (глувче, допир, тастатура), погледи и ограничувања.

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

  function resize(w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return { camera, controls, setView, updateClipping, resize };
}
