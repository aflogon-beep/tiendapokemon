import * as THREE from 'three';
import { PACK_SCALE, spawnInstanced, spawnModel, type ModelInstance, type Placement } from './assets';
import {
  DESK, DOOR, FLOOR_T, FRONT_Y, LAY, SHELF_DEPTH_PX, SHELF_MODULE_PX, SHELF_SLOTS, TILE_PX, W,
  caseRect, counterPieces, prodRect, shelfRect, type Point,
} from '../systems/layout';
import { WALL_PX } from '../systems/shopNav';
import { buildCase, buildDesk, buildProdTable } from './props';
import type { Occluders } from './occluders';

/*
 * Tienda en 3D a partir de LAY (v10). Escala única: 100 px = 1 baldosa de Mini Market = 2,4 m.
 * Origen: centro de la cara interior de la fachada. x → derecha, z → hacia la calle.
 */
export const PX_TO_M = PACK_SCALE.market / TILE_PX;

export function toWorld(px: number, py: number): THREE.Vector3 {
  return new THREE.Vector3((px - W / 2) * PX_TO_M, 0, (py - FRONT_Y) * PX_TO_M);
}

/** Inversa de toWorld: metros → px de la v10 */
export function toPx(v: THREE.Vector3): Point {
  return { x: v.x / PX_TO_M + W / 2, y: v.z / PX_TO_M + FRONT_Y };
}

const place = (px: number, py: number, rotY = 0): Placement => {
  const v = toWorld(px, py);
  return { x: v.x, z: v.z, rotY };
};

export interface Shop {
  door: ModelInstance;
  cashier: ModelInstance;
  /** Grupos del suelo y de las paredes interiores (se tiñen según la categoría) */
  floor: THREE.Group;
  walls: THREE.Group[];
}

/** Materiales de un grupo instanciado */
export const materialsOf = (o: THREE.Object3D): THREE.MeshStandardMaterial[] => {
  const l: THREE.MeshStandardMaterial[] = [];
  o.traverse((m) => {
    const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (mat && !l.includes(mat)) l.push(mat);
  });
  return l;
};

// Suelo: 8 × 5 baldosas exactas (x 0–800, y 48–548)
function floorPlaces(): Placement[] {
  const l: Placement[] = [];
  for (let x = 0; x < W; x += TILE_PX)
    for (let y = FLOOR_T; y < FRONT_Y; y += TILE_PX) l.push(place(x + TILE_PX / 2, y + TILE_PX / 2));
  return l;
}

// Paredes con la cara interior en los bordes de LAY
async function buildWalls(scene: THREE.Scene, occ: Occluders): Promise<{ door: ModelInstance; inner: THREE.Group[] }> {
  const half = WALL_PX / 2;
  const back: Placement[] = [], left: Placement[] = [], right: Placement[] = [], front: Placement[] = [], frontWin: Placement[] = [];
  for (let x = 0; x < W; x += TILE_PX) {
    back.push(place(x + TILE_PX / 2, FLOOR_T - half));
    const cx = x + TILE_PX / 2;
    if (x === DOOR.x0) continue;
    (x === 0 || x === W - TILE_PX ? front : frontWin).push(place(cx, FRONT_Y + half, Math.PI));
  }
  for (let y = FLOOR_T; y < FRONT_Y; y += TILE_PX) {
    left.push(place(-half, y + TILE_PX / 2, Math.PI / 2));
    right.push(place(W + half, y + TILE_PX / 2, -Math.PI / 2));
  }
  // wall-corner tiene los brazos hacia −x y +z; se gira para que sigan a las paredes
  const corners = [place(-half, FLOOR_T - half, 0), place(W + half, FLOOR_T - half, 0)];
  const frontCorners = [place(-half, FRONT_Y + half, Math.PI), place(W + half, FRONT_Y + half, -Math.PI / 2)];
  const own = { ownMaterial: true };
  const [gBack, gLeft, gRight, gFront, gWin, gCorner, gFrontCorner, door] = await Promise.all([
    spawnInstanced('market', 'wall', back, own),
    spawnInstanced('market', 'wall', left, own),
    spawnInstanced('market', 'wall', right),
    spawnInstanced('market', 'wall', front),
    spawnInstanced('market', 'wall-window', frontWin),
    spawnInstanced('market', 'wall-corner', corners),
    spawnInstanced('market', 'wall-corner', frontCorners),
    spawnModel('market', 'wall-door-rotate'),
  ]);
  const d = place((DOOR.x0 + DOOR.x1) / 2, FRONT_Y + half, Math.PI);
  door.root.position.set(d.x, 0, d.z);
  door.root.rotation.y = Math.PI;
  scene.add(gBack, gLeft, gRight, gFront, gWin, gCorner, gFrontCorner, door.root);
  // La fachada y la pared derecha tapan el interior desde la cámara: se recortan
  for (const o of [gRight, gFront, gWin, gFrontCorner, door.root]) occ.addWall(o);
  return { door, inner: [gBack, gLeft] };
}

async function buildShelves(scene: THREE.Scene): Promise<void> {
  const mods: Placement[] = [];
  for (let i = 0; i < SHELF_SLOTS; i++) {
    const r = shelfRect(i);
    const cy = r.y + SHELF_DEPTH_PX / 2;
    // Dos módulos por hueco; los sobres de cada set se colocan en sus baldas (merch.ts)
    mods.push(place(r.x + SHELF_MODULE_PX / 2, cy), place(r.x + SHELF_MODULE_PX * 1.5, cy));
  }
  // Sin los productos de fábrica del modelo (cartones y cajas)
  scene.add(await spawnInstanced('market', 'shelf-boxes', mods, { skip: (n) => n.startsWith('carton') || n.startsWith('box') }));
}

// Mostrador: caja registradora (con la cinta del lado de la cola) + dos vitrinas bajas (freezer)
async function buildCounter(scene: THREE.Scene): Promise<void> {
  const reg: Placement[] = [], glass: Placement[] = [];
  for (const p of counterPieces())
    (p.kind === 'register' ? reg : glass).push(place(p.rect.x + p.rect.w / 2, p.rect.y + p.rect.h / 2, Math.PI / 2));
  const [a, b] = await Promise.all([
    spawnInstanced('market', 'cash-register', reg),
    spawnInstanced('market', 'freezer', glass),
  ]);
  scene.add(a, b);
}

function addProp(scene: THREE.Scene, obj: THREE.Object3D, r: { x: number; y: number; w: number; h: number }): void {
  const c = toWorld(r.x + r.w / 2, r.y + r.h / 2);
  obj.position.copy(c);
  scene.add(obj);
}

export async function buildShop(scene: THREE.Scene, occ: Occluders): Promise<Shop> {
  const c = caseRect(), pr = prodRect();
  addProp(scene, buildCase(c.w * PX_TO_M, c.h * PX_TO_M), c);
  addProp(scene, buildProdTable(pr.w * PX_TO_M, pr.h * PX_TO_M), pr);
  addProp(scene, buildDesk(DESK.w * PX_TO_M, DESK.h * PX_TO_M), DESK);

  const [floor, walls, , , cashier] = await Promise.all([
    spawnInstanced('market', 'floor', floorPlaces(), { ownMaterial: true }),
    buildWalls(scene, occ),
    buildShelves(scene),
    buildCounter(scene),
    spawnModel('market', 'character-employee'),
  ]);
  scene.add(floor);
  const cp = toWorld(LAY.cashier.x, LAY.cashier.y);
  cashier.root.position.copy(cp);
  cashier.root.rotation.y = -Math.PI / 2;
  scene.add(cashier.root);
  return { door: walls.door, cashier, floor, walls: walls.inner };
}

export const worldOf = (p: Point) => toWorld(p.x, p.y);
