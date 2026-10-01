import * as THREE from 'three';

const SUN_DIR = new THREE.Vector3(8, 14, 6).normalize();

// Luz ambiente + sol direccional (única fuente de sombras, resolución moderada)
export interface Lights {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
}

export function createLighting(scene: THREE.Scene): Lights {
  const hemi = new THREE.HemisphereLight('#dfefff', '#6b5a48', 1.4);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#fff3dd', 2.2);
  sun.position.set(8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  return { sun, hemi };
}

/** La zona de sombras sigue a la cámara para no gastar resolución fuera de la vista */
export function followSun(sun: THREE.DirectionalLight, center: THREE.Vector3, viewSize: number): void {
  const half = THREE.MathUtils.clamp(viewSize * 0.85, 8, 45);
  const c = sun.shadow.camera;
  if (c.right !== half) {
    c.left = -half;
    c.right = half;
    c.top = half;
    c.bottom = -half;
    c.updateProjectionMatrix();
  }
  sun.target.position.copy(center);
  sun.position.copy(center).addScaledVector(SUN_DIR, 50);
}
