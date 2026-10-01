import * as THREE from 'three';

// Luz ambiente + sol direccional (única fuente de sombras, resolución moderada)
export function createLighting(scene: THREE.Scene): THREE.DirectionalLight {
  scene.add(new THREE.HemisphereLight('#dfefff', '#6b5a48', 1.4));

  const sun = new THREE.DirectionalLight('#fff3dd', 2.2);
  sun.position.set(8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const s = sun.shadow.camera;
  s.left = -14;
  s.right = 14;
  s.top = 14;
  s.bottom = -14;
  s.near = 1;
  s.far = 50;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  return sun;
}
