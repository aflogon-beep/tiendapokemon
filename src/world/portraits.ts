import * as THREE from 'three';
import { spawnLoaded, type Pack } from './assets';

/*
 * Retratos de personajes (portrait de la v10): una foto del mismo modelo 3D que camina por
 * la tienda, hecha con un renderizador pequeño fuera de pantalla y guardada en caché.
 */

const W = 160, H = 200;
let renderer: THREE.WebGLRenderer | null = null;
const cache = new Map<string, string>();

function setup(): THREE.WebGLRenderer {
  if (renderer) return renderer;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

/** Imagen (data URL) del personaje de frente, de cintura para arriba */
export function portrait(pack: Pack, model: string): string {
  const key = pack + '/' + model;
  const hit = cache.get(key);
  if (hit) return hit;
  let url = '';
  try {
    const r = setup();
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a6a', 2.2));
    const sun = new THREE.DirectionalLight('#fff3dd', 1.6);
    sun.position.set(1, 2, 3);
    scene.add(sun);
    const inst = spawnLoaded(pack, model);
    scene.add(inst.root);
    // Pose de reposo
    const idle = inst.animations.find((a) => a.name === 'idle');
    if (idle) {
      const mixer = new THREE.AnimationMixer(inst.root);
      mixer.clipAction(idle).play();
      mixer.update(0.4);
    }
    // Los personajes de Mini Characters miden ~0,75 unidades (≈1,8 m con la escala del pack)
    const h = 0.75 * inst.root.scale.y;
    const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
    cam.position.set(0, h * 0.62, h * 1.25);
    cam.lookAt(0, h * 0.58, 0);
    r.render(scene, cam);
    url = r.domElement.toDataURL('image/png');
  } catch {
    /* sin WebGL: el retrato queda vacío */
  }
  cache.set(key, url);
  return url;
}
