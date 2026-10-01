import * as THREE from 'three';

// Ángulos de la vista isométrica clásica: 45° de giro y arctan(1/√2) ≈ 35,26° de inclinación
const YAW = Math.PI / 4;
const PITCH = Math.atan(1 / Math.SQRT2);
const DISTANCE = 50;

export interface IsoCamera {
  camera: THREE.OrthographicCamera;
  target: THREE.Vector3;
  /** Metros visibles en el lado más corto de la pantalla */
  viewSize: number;
  resize(width: number, height: number): void;
  update(): void;
}

export function createIsoCamera(viewSize = 12): IsoCamera {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const iso: IsoCamera = {
    camera,
    target: new THREE.Vector3(),
    viewSize,
    resize(width, height) {
      // En vertical (móvil) manda el ancho; en horizontal, el alto
      const aspect = width / Math.max(1, height);
      const half = iso.viewSize / 2;
      const hw = aspect < 1 ? half : half * aspect;
      const hh = aspect < 1 ? half / aspect : half;
      camera.left = -hw;
      camera.right = hw;
      camera.top = hh;
      camera.bottom = -hh;
      camera.updateProjectionMatrix();
    },
    update() {
      const t = iso.target;
      camera.position.set(
        t.x + DISTANCE * Math.cos(PITCH) * Math.sin(YAW),
        t.y + DISTANCE * Math.sin(PITCH),
        t.z + DISTANCE * Math.cos(PITCH) * Math.cos(YAW),
      );
      camera.lookAt(t);
    },
  };
  iso.update();
  return iso;
}
