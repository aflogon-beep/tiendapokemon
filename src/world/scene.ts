import * as THREE from 'three';

export interface World {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
}

// Renderer y escena base (fondo, niebla suave, sombras)
export function createWorld(canvas: HTMLCanvasElement): World {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#5d636c');
  return { renderer, scene };
}

// Suelo de la escena vacía (F0)
export function createGround(size = 40): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#7d8a6a', roughness: 1 }));
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}
