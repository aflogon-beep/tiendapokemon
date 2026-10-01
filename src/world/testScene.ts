import * as THREE from 'three';
import { PACK_SCALE, spawnModel, type ModelInstance, type Pack } from './assets';

/*
 * Escena de prueba de la F1: tramo de suelo y pared, estanterías y caja (Mini Market),
 * un edificio de City Kit y personajes de Mini Characters para validar la escala.
 */

const T = PACK_SCALE.market; // lado de una baldosa de Mini Market, en metros
const SHOP = { minX: -1.5 * T, maxX: 1.5 * T, minZ: -2 * T, maxZ: 0 };
const WALK_SPEED = 1.2; // m/s, ajustado al paso de la animación walk (0,67 s)

// Recorrido en bucle: acera → tienda → estanterías → acera
const WALK_PATH = [
  new THREE.Vector3(-9, 0, 1.3),
  new THREE.Vector3(0, 0, 1.3),
  new THREE.Vector3(0, 0, -2.6),
  new THREE.Vector3(-2, 0, -2.6),
  new THREE.Vector3(-2, 0, -0.8),
  new THREE.Vector3(-5, 0, 1.3),
];

export interface TestScene {
  update(dt: number): void;
}

function flat(w: number, d: number, color: string, x: number, z: number, y: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

// Césped, acera y calzada (provisional hasta la F2)
function buildStreet(scene: THREE.Scene): void {
  scene.add(flat(40, 40, '#6f7d5c', -4, -4, -0.02));
  scene.add(flat(30, 2.6, '#b9b9b4', -4, 1.3, -0.01));
  scene.add(flat(30, 6, '#4a4d55', -4, 5.6, -0.015));
}

async function place(scene: THREE.Scene, pack: Pack, name: string, x: number, z: number, rotY = 0) {
  const inst = await spawnModel(pack, name);
  inst.root.position.set(x, 0, z);
  inst.root.rotation.y = rotY;
  scene.add(inst.root);
  return inst;
}

// Suelo de baldosas y dos paredes (fondo e izquierda) con puerta y ventana
async function buildShopShell(scene: THREE.Scene): Promise<ModelInstance> {
  const jobs: Promise<unknown>[] = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++)
      jobs.push(place(scene, 'market', 'floor', SHOP.minX + (i + 0.5) * T, SHOP.minZ + (j + 0.5) * T));
  jobs.push(place(scene, 'market', 'wall', SHOP.minX + 0.5 * T, SHOP.minZ));
  jobs.push(place(scene, 'market', 'wall-window', SHOP.minX + 2.5 * T, SHOP.minZ));
  jobs.push(place(scene, 'market', 'wall', SHOP.minX, SHOP.minZ + 0.5 * T, Math.PI / 2));
  jobs.push(place(scene, 'market', 'wall-window', SHOP.minX, SHOP.minZ + 1.5 * T, Math.PI / 2));
  jobs.push(place(scene, 'market', 'wall-corner', SHOP.minX, SHOP.minZ));
  const door = place(scene, 'market', 'wall-door-rotate', SHOP.minX + 1.5 * T, SHOP.minZ);
  await Promise.all(jobs);
  return door;
}

function playClip(mixer: THREE.AnimationMixer, inst: ModelInstance, name: string): void {
  const clip = THREE.AnimationClip.findByName(inst.animations, name);
  if (clip) mixer.clipAction(clip).play();
}

export async function buildTestScene(scene: THREE.Scene): Promise<TestScene> {
  buildStreet(scene);
  const shelfW = 0.8 * T;
  const [door, , , , , walker, clerk, browser] = await Promise.all([
    buildShopShell(scene),
    place(scene, 'market', 'shelf-boxes', SHOP.minX + shelfW * 0.5 + 0.2, SHOP.minZ + 0.55 * T, Math.PI / 2),
    place(scene, 'market', 'shelf-bags', SHOP.minX + shelfW * 0.5 + 0.2, SHOP.minZ + 0.55 * T + shelfW, Math.PI / 2),
    place(scene, 'market', 'cash-register', SHOP.maxX - 1.6, -2.2, -Math.PI / 2),
    place(scene, 'city', 'building-a', SHOP.minX - 4, -3),
    place(scene, 'characters', 'character-male-c', WALK_PATH[0].x, WALK_PATH[0].z),
    place(scene, 'market', 'character-employee', SHOP.maxX - 0.6, -2.2, -Math.PI / 2),
    place(scene, 'characters', 'character-female-d', SHOP.minX + 2.2, SHOP.minZ + 1.6, -Math.PI / 2),
  ]);

  const mixers: THREE.AnimationMixer[] = [];
  const animate = (inst: ModelInstance, clip: string) => {
    const mixer = new THREE.AnimationMixer(inst.root);
    playClip(mixer, inst, clip);
    mixers.push(mixer);
  };
  animate(walker, 'walk');
  animate(clerk, 'idle');
  animate(browser, 'interact-right');
  animate(door, 'open-and-close');

  let seg = 0;
  const dir = new THREE.Vector3();
  const moveWalker = (dt: number) => {
    const target = WALK_PATH[(seg + 1) % WALK_PATH.length];
    const pos = walker.root.position;
    dir.subVectors(target, pos);
    const dist = dir.length();
    const step = WALK_SPEED * dt;
    if (dist <= step) {
      pos.copy(target);
      seg = (seg + 1) % WALK_PATH.length;
      return;
    }
    dir.multiplyScalar(1 / dist);
    pos.addScaledVector(dir, step);
    walker.root.rotation.y = Math.atan2(dir.x, dir.z);
  };

  return {
    update(dt) {
      moveWalker(dt);
      for (const m of mixers) m.update(dt);
    },
  };
}
