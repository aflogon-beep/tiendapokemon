import * as THREE from 'three';

/*
 * Lo que tapa el interior desde la cámara isométrica. Cuando la cámara mira la tienda:
 * - las paredes (fachada y pared derecha) se recortan a un zócalo, como en Los Sims;
 * - los edificios vecinos que tapan se vuelven casi transparentes.
 */

const CUT_HEIGHT = 0.14; // fracción de la altura de la pared que queda
const FADED = 0.08;

export interface Occluders {
  /** Pared que se recorta en altura */
  addWall(obj: THREE.Object3D): void;
  /** Objeto que se difumina */
  addFade(obj: THREE.Object3D): void;
  setHidden(hidden: boolean): void;
  update(dt: number): void;
}

export function createOccluders(): Occluders {
  const walls: { obj: THREE.Object3D; base: number }[] = [];
  const fadeMeshes: THREE.Mesh[] = [];
  const fadeRoots: THREE.Object3D[] = [];
  const mats = new Set<THREE.Material>();
  const clones = new Map<THREE.Material, THREE.Material>();
  let target = 0; // 0 = visible del todo, 1 = recortado/difuminado
  let k = 0;

  const apply = () => {
    for (const w of walls) w.obj.scale.y = w.base * (1 - k * (1 - CUT_HEIGHT));
    const o = 1 - k * (1 - FADED);
    // Un edificio difuminado no debe seguir dejando sombra sobre la tienda
    for (const m of fadeMeshes) m.castShadow = k < 0.5;
    // Del todo difuminado se oculta: así no quedan líneas fantasma sobre la caja
    for (const r of fadeRoots) r.visible = k < 0.97;
    for (const m of mats) {
      m.opacity = o;
      m.transparent = o < 0.999;
      m.depthWrite = o >= 0.999;
    }
  };

  return {
    addWall(obj) {
      walls.push({ obj, base: obj.scale.y });
      apply();
    },
    addFade(obj) {
      fadeRoots.push(obj);
      // Material propio para no difuminar las mismas piezas en el resto de la escena
      obj.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        fadeMeshes.push(mesh);
        const swap = (m: THREE.Material) => {
          let c = clones.get(m);
          if (!c) {
            c = m.clone();
            clones.set(m, c);
            mats.add(c);
          }
          return c;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
      });
      apply();
    },
    setHidden(hidden) {
      target = hidden ? 1 : 0;
    },
    update(dt) {
      if (k === target) return;
      k += (target - k) * Math.min(1, dt * 6);
      if (Math.abs(k - target) < 0.005) k = target;
      apply();
    },
  };
}
