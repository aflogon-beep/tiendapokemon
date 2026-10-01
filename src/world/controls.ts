import * as THREE from 'three';
import type { CamMode, IsoCamera, View } from './camera';

/*
 * Control de la cámara como en la v10: botones ＋ / － / ⤢ (automática → tienda → calle),
 * arrastrar para mover, pellizcar o rueda para hacer zoom, y vuelta suave a la vista automática.
 */

export interface CamPresets {
  /** Vista automática: tienda llenando la pantalla, o la caja si hay cliente delante */
  auto(): View;
  /** Toda la tienda */
  fit(): View;
  /** Calle */
  city(): View;
  /** Límites del centro de la cámara (x0, z0, x1, z1) y del zoom */
  bounds: { x0: number; z0: number; x1: number; z1: number };
}

export interface CamController {
  mode: CamMode;
  cycle(): CamMode;
  zoom(factor: number): void;
  update(dt: number): void;
  onTap?: (ground: THREE.Vector3) => void;
}

const USER_PAUSE_MS = 4000; // como camFollow en la v10

export function createCamController(canvas: HTMLCanvasElement, iso: IsoCamera, presets: CamPresets): CamController {
  const view = iso.view;
  let lastUser = -Infinity;
  let easing: View | null = null;
  const sizeLimits = () => {
    const fit = presets.fit().size, city = presets.city().size;
    return { min: fit / 3.2, max: city * 1.4 };
  };

  const clamp = () => {
    const b = presets.bounds, t = view.target;
    t.x = THREE.MathUtils.clamp(t.x, b.x0, b.x1);
    t.z = THREE.MathUtils.clamp(t.z, b.z0, b.z1);
    const { min, max } = sizeLimits();
    view.size = THREE.MathUtils.clamp(view.size, min, max);
  };

  // Punto del suelo bajo un píxel de la pantalla
  const ray = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const groundAt = (sx: number, sy: number): THREE.Vector3 | null => {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1), iso.camera);
    return ray.ray.intersectPlane(ground, new THREE.Vector3());
  };

  const userMoved = () => {
    lastUser = performance.now();
    ctl.mode = 'manual';
    easing = null;
  };

  function zoomAt(factor: number, sx: number, sy: number) {
    const before = groundAt(sx, sy);
    view.size /= factor;
    clamp();
    iso.apply();
    const after = groundAt(sx, sy);
    if (before && after) view.target.add(before.sub(after));
    clamp();
    iso.apply();
    userMoved();
  }

  // Gestos con Pointer Events (ratón y dedos)
  const pts = new Map<number, { x: number; y: number }>();
  let drag: { x: number; y: number; target: THREE.Vector3 } | null = null;
  let pinch: { d: number; size: number } | null = null;
  let moved = false;

  canvas.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* algunos navegadores no lo permiten */
    }
    if (pts.size === 1) {
      drag = { x: e.clientX, y: e.clientY, target: view.target.clone() };
      moved = false;
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, size: view.size };
      moved = true;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const want = pinch.size * (pinch.d / (Math.hypot(a.x - b.x, a.y - b.y) || 1));
      zoomAt(view.size / want, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 7) moved = true;
    if (!moved) return;
    // Píxeles → metros de suelo (en vertical, el suelo se ve acortado por la inclinación)
    const mpp = iso.extent().w / canvas.clientWidth;
    view.target
      .copy(drag.target)
      .addScaledVector(iso.right, -dx * mpp)
      .addScaledVector(iso.up, (dy * mpp) / Math.sin(Math.atan(1 / Math.SQRT2)));
    clamp();
    iso.apply();
    userMoved();
  });

  const up = (e: PointerEvent) => {
    const p = pts.get(e.pointerId);
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 1) {
      const q = [...pts.values()][0];
      drag = { x: q.x, y: q.y, target: view.target.clone() };
    }
    if (pts.size === 0) {
      if (!moved && p && e.type === 'pointerup') {
        const g = groundAt(p.x, p.y);
        if (g) ctl.onTap?.(g);
      }
      drag = null;
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
    },
    { passive: false },
  );

  const presetFor = (m: CamMode): View | null =>
    m === 'auto' ? presets.auto() : m === 'fit' ? presets.fit() : m === 'city' ? presets.city() : null;

  const ctl: CamController = {
    mode: 'auto',
    cycle() {
      ctl.mode = ctl.mode === 'auto' || ctl.mode === 'manual' ? 'fit' : ctl.mode === 'fit' ? 'city' : 'auto';
      lastUser = -Infinity;
      easing = presetFor(ctl.mode);
      return ctl.mode;
    },
    zoom(factor) {
      const r = canvas.getBoundingClientRect();
      zoomAt(factor, r.left + r.width / 2, r.top + r.height / 2);
    },
    update(dt) {
      // La automática sigue a la caja salvo durante 4 s después de tocar
      if (ctl.mode === 'auto' && performance.now() - lastUser > USER_PAUSE_MS) easing = presets.auto();
      if (!easing) return;
      const k = Math.min(1, dt * (ctl.mode === 'auto' ? 1.6 : 5));
      view.target.lerp(easing.target, k);
      view.size += (easing.size - view.size) * k;
      if (ctl.mode !== 'auto' && view.target.distanceTo(easing.target) < 0.01 && Math.abs(view.size - easing.size) < 0.01)
        easing = null;
      iso.apply();
    },
  };

  // Vista inicial sin transición
  const first = presets.auto();
  view.target.copy(first.target);
  view.size = first.size;
  iso.apply();
  return ctl;
}
