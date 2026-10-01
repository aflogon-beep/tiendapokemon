import * as THREE from 'three';

// Ángulos de la vista isométrica clásica: 45° de giro y arctan(1/√2) ≈ 35,26° de inclinación
const YAW = Math.PI / 4;
const PITCH = Math.atan(1 / Math.SQRT2);
const DISTANCE = 80;

/** Modos de la v10: automática, toda la tienda, calle y manual (tras tocar la pantalla) */
export type CamMode = 'auto' | 'fit' | 'city' | 'manual';

export interface View {
  target: THREE.Vector3;
  /** Metros visibles en el lado más corto de la pantalla */
  size: number;
}

export interface IsoCamera {
  camera: THREE.OrthographicCamera;
  view: View;
  aspect: number;
  /** Vectores en el suelo que corresponden a la derecha y arriba de la pantalla */
  right: THREE.Vector3;
  up: THREE.Vector3;
  resize(width: number, height: number): void;
  /** Píxeles tapados por la interfaz arriba y abajo: se encuadra solo la zona visible */
  setInsets(top: number, bottom: number): void;
  apply(): void;
  /** Metros de pantalla visibles en ancho y alto */
  extent(): { w: number; h: number };
  /** Tamaño de vista mínimo para que quepan los puntos (fit) o para llenar la pantalla con ellos (cover) */
  frame(points: THREE.Vector3[], cover?: boolean): View;
}

export function createIsoCamera(): IsoCamera {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 300);
  const right = new THREE.Vector3(Math.cos(YAW), 0, -Math.sin(YAW));
  const up = new THREE.Vector3(-Math.sin(YAW), 0, -Math.cos(YAW));
  const offset = new THREE.Vector3(
    Math.cos(PITCH) * Math.sin(YAW),
    Math.sin(PITCH),
    Math.cos(PITCH) * Math.cos(YAW),
  ).multiplyScalar(DISTANCE);
  // En pantalla, un metro de suelo hacia "arriba" se ve acortado por la inclinación
  const upScale = Math.sin(PITCH);

  let pxH = 1, insetTop = 0, insetBottom = 0;
  // Proporción de la zona visible (sin la interfaz)
  const visAspect = () => iso.aspect * (pxH / Math.max(1, pxH - insetTop - insetBottom));

  const iso: IsoCamera = {
    camera,
    view: { target: new THREE.Vector3(), size: 20 },
    aspect: 1,
    right,
    up,
    resize(width, height) {
      iso.aspect = width / Math.max(1, height);
      pxH = Math.max(1, height);
      iso.apply();
    },
    setInsets(top, bottom) {
      if (top === insetTop && bottom === insetBottom) return;
      insetTop = top;
      insetBottom = bottom;
      iso.apply();
    },
    extent() {
      // size es el lado corto de la zona visible; se amplía a toda la pantalla
      const s = iso.view.size, va = visAspect(), a = iso.aspect;
      const w = va < 1 ? s : s * va;
      return { w, h: w / a };
    },
    apply() {
      const { w, h } = iso.extent();
      // El objetivo queda en el centro de la zona visible, no de la pantalla
      const shift = ((insetBottom - insetTop) / 2) * (h / pxH);
      camera.left = -w / 2;
      camera.right = w / 2;
      camera.top = h / 2 - shift;
      camera.bottom = -h / 2 - shift;
      camera.updateProjectionMatrix();
      camera.position.copy(iso.view.target).add(offset);
      camera.lookAt(iso.view.target);
    },
    frame(points, cover = false) {
      // Proyección en pantalla de cada punto relativa al centro de la caja
      const c = new THREE.Vector3();
      points.forEach((p) => c.add(p));
      c.divideScalar(points.length);
      let hw = 0, hh = 0;
      for (const p of points) {
        const d = p.clone().sub(c);
        hw = Math.max(hw, Math.abs(d.dot(right)));
        hh = Math.max(hh, Math.abs(d.dot(up) * upScale + d.y * Math.cos(PITCH)));
      }
      const a = visAspect();
      // size = lado corto de la zona visible; el largo es size/a (vertical) o size*a (horizontal)
      const needW = a < 1 ? 2 * hw : (2 * hw) / a;
      const needH = a < 1 ? 2 * hh * a : 2 * hh;
      return { target: c, size: cover ? Math.min(needW, needH) : Math.max(needW, needH) };
    },
  };
  iso.apply();
  return iso;
}
