import * as THREE from 'three';
import { spawnModel } from './assets';
import { toWorld, PX_TO_M } from './shop';
import { SIDEWALK, WALL_PX } from '../systems/shopNav';
import { W } from '../systems/layout';
import type { Occluders } from './occluders';

/*
 * Calle: acera, calzada con paso de cebra, acera de enfrente y edificios de City Kit.
 * Los vecinos siguen a la v10: café y panadería a la izquierda, librería y floristería a la derecha.
 */

const ROAD_PX = 292; // 7 m
const FAR_WALK_PX = 125; // 3 m
export const ROAD = { y0: SIDEWALK.y1, y1: SIDEWALK.y1 + ROAD_PX };
export const FAR_SIDEWALK = { y0: ROAD.y1, y1: ROAD.y1 + FAR_WALK_PX };
export const CITY_BOUNDS = { x0: -1500, x1: W + 1500, y0: -500, y1: FAR_SIDEWALK.y1 + 400 };

const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.95 });

const ROAD_TOP = -0.15; // la calzada queda un bordillo por debajo de las aceras

// Losa en px de la v10 con su cara superior a la altura `top`
function strip(x0: number, x1: number, y0: number, y1: number, m: THREE.Material, top = 0): THREE.Mesh {
  const w = (x1 - x0) * PX_TO_M, d = (y1 - y0) * PX_TO_M, thick = 0.3;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, thick, d), m);
  const c = toWorld((x0 + x1) / 2, (y0 + y1) / 2);
  mesh.position.set(c.x, top - thick / 2, c.z);
  mesh.receiveShadow = true;
  return mesh;
}

function buildGround(scene: THREE.Scene): void {
  const B = CITY_BOUNDS;
  // Explanada grande para que no asome el cielo por los bordes
  scene.add(strip(B.x0 - 6000, B.x1 + 6000, B.y0 - 6000, B.y1 + 6000, mat('#5d636c'), -0.02));
  const walk = mat('#9aa0a8'), road = mat('#3a3e46'), curb = mat('#6d737c'), paint = mat('#e8e8e8'), back = mat('#6f7680');
  scene.add(strip(B.x0, B.x1, B.y0, SIDEWALK.y0, back, -0.005));
  scene.add(strip(B.x0, B.x1, SIDEWALK.y0, SIDEWALK.y1 - 6, walk));
  scene.add(strip(B.x0, B.x1, SIDEWALK.y1 - 6, SIDEWALK.y1, curb));
  scene.add(strip(B.x0, B.x1, ROAD.y0, ROAD.y1, road, ROAD_TOP));
  scene.add(strip(B.x0, B.x1, FAR_SIDEWALK.y0, FAR_SIDEWALK.y0 + 6, curb));
  scene.add(strip(B.x0, B.x1, FAR_SIDEWALK.y0 + 6, FAR_SIDEWALK.y1, walk));
  scene.add(strip(B.x0, B.x1, FAR_SIDEWALK.y1, B.y1, back, -0.005));
  // Línea discontinua y paso de cebra (en la v10, a la derecha de la puerta)
  const mid = (ROAD.y0 + ROAD.y1) / 2;
  for (let x = B.x0 + 10; x < B.x1; x += 120) scene.add(strip(x, x + 60, mid - 3, mid + 3, paint, ROAD_TOP + 0.01));
  for (let y = ROAD.y0 + 12; y < ROAD.y1 - 12; y += 28) scene.add(strip(560, 680, y, y + 14, paint, ROAD_TOP + 0.01));
}

interface Lot {
  model: string;
  x: number; // centro en px
  occludes?: boolean;
}

// Fila de nuestra acera (fachada alineada con la de la tienda) y fila de enfrente
const NEAR: Lot[] = [
  { model: 'building-h', x: -777 },
  { model: 'building-c', x: -491 }, // café
  { model: 'building-a', x: -205 }, // panadería
  { model: 'building-b', x: W + WALL_PX + 150, occludes: true }, // librería
  { model: 'building-d', x: 1305 }, // floristería
  { model: 'building-g', x: 1598 },
];
const FAR: Lot[] = [
  { model: 'building-c', x: -1050 },
  { model: 'building-e', x: -500 },
  { model: 'building-c', x: 120 },
  { model: 'building-h', x: 540 },
  { model: 'building-e', x: 1080 },
  { model: 'building-d', x: 1550 },
];

async function placeLot(scene: THREE.Scene, occ: Occluders, lot: Lot, frontY: number, facing: 1 | -1) {
  const b = await spawnModel('city', lot.model);
  const box = new THREE.Box3().setFromObject(b.root);
  const halfDepth = (box.max.z - box.min.z) / 2;
  const p = toWorld(lot.x, frontY);
  b.root.position.set(p.x, 0, p.z - facing * halfDepth);
  if (facing < 0) b.root.rotation.y = Math.PI;
  scene.add(b.root);
  if (lot.occludes) occ.addFade(b.root);
}

export async function buildCity(scene: THREE.Scene, occ: Occluders): Promise<void> {
  buildGround(scene);
  await Promise.all([
    ...NEAR.map((l) => placeLot(scene, occ, l, SIDEWALK.y0, 1)),
    ...FAR.map((l) => placeLot(scene, occ, l, FAR_SIDEWALK.y1, -1)),
  ]);
}
