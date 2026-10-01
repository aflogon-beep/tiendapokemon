/*
 * Distribución de la tienda en coordenadas de la v10 (px): x a la derecha, y hacia la calle.
 * LAY se copia tal cual de reference/pokemon-card-shop-v10.html. Las huellas de los muebles
 * en 3D salen de LAY ajustadas al tamaño de los modelos (100 px = 1 baldosa de Mini Market).
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export const W = 800;
export const FLOOR_T = 48; // cara interior de la pared del fondo
export const FRONT_Y = 548; // cara interior de la fachada (en la v10 la pared ocupa 548–570)
export const TILE_PX = 100; // una baldosa de Mini Market

// Igual que en la v10
export const LAY = {
  shelf: (i: number): Rect => ({ x: 40 + (i % 3) * 205, y: i < 3 ? 46 : 170, w: 150, h: 54 }),
  cs: (cap = 8): Rect => ({ x: 60, y: 390, w: 270, h: cap > 8 ? 92 : 58 }),
  counter: { x: 650, y: 190, w: 56, h: 250 },
  prod: { x: 372, y: 258, w: 170, h: 62 },
  qx: 622,
  qy: 262,
  qs: 32,
  door: { x: 355, y: 650 },
  cashier: { x: 748, y: 330 },
};

export const SHELF_SLOTS = 6;
export const SHELF_MODULE_PX = 80; // shelf-boxes / shelf-bags: 0,8 × 0,7 unidades
export const SHELF_DEPTH_PX = 70;
export const COUNTER_PIECE_PX = 85; // cash-register: 0,85 unidades
export const DOOR = { x0: 300, x1: 400 }; // hueco de la puerta (v10: 316–396), alineado a baldosa

/** Huella en el suelo de cada estantería: dos módulos, la fila de atrás pegada a la pared */
export function shelfRect(i: number): Rect {
  const s = LAY.shelf(i);
  const cx = s.x + s.w / 2;
  const y = i < 3 ? FLOOR_T : s.y;
  return { x: cx - SHELF_MODULE_PX, y, w: SHELF_MODULE_PX * 2, h: SHELF_DEPTH_PX };
}

/**
 * Mostrador: una caja registradora y dos vitrinas bajas en línea, de arriba abajo.
 * La registradora queda donde la dibuja la v10 (c.y + 76), frente al primero de la cola.
 */
export function counterPieces(): { kind: 'register' | 'glass'; rect: Rect }[] {
  const c = LAY.counter;
  const cx = c.x + c.w / 2 + 7; // un poco a la derecha para dejar sitio a la cola (qx = 622)
  const y0 = c.y + 76 - COUNTER_PIECE_PX / 2;
  const kinds = ['register', 'glass', 'glass'] as const;
  return kinds.map((kind, k) => ({
    kind,
    rect: { x: cx - COUNTER_PIECE_PX / 2, y: y0 + k * COUNTER_PIECE_PX, w: COUNTER_PIECE_PX, h: COUNTER_PIECE_PX },
  }));
}

/** Vitrina de cartas (geometría propia), con la huella de box3d de la v10 */
export function caseRect(cap = 8): Rect {
  const c = LAY.cs(cap);
  return { x: c.x - 6, y: c.y, w: c.w + 12, h: c.h };
}

/** Mesa de sellado y accesorios (v10: box3d con 26 px de fondo) */
export function prodRect(): Rect {
  const b = LAY.prod;
  return { x: b.x - 4, y: b.y + b.h - 26, w: b.w + 8, h: 26 };
}

/** Mesa del fondo con el monitor de precios (drawDesk en la v10) */
export const DESK: Rect = { x: 642, y: 98, w: 130, h: 30 };

export function obstacles(cap = 8): Rect[] {
  const l: Rect[] = [];
  for (let i = 0; i < SHELF_SLOTS; i++) l.push(shelfRect(i));
  for (const p of counterPieces()) l.push(p.rect);
  l.push(caseRect(cap), prodRect(), DESK);
  return l;
}

// Puntos a los que van los clientes (sin el azar de la v10)
export function shelfSpot(i: number): Point {
  const r = shelfRect(i);
  return { x: r.x + r.w / 2, y: r.y + r.h + 24 };
}

export function caseSpot(cap = 8): Point {
  const c = caseRect(cap);
  return { x: c.x + c.w / 2, y: c.y + c.h + 36 };
}

export function queueSpot(i: number): Point {
  return { x: LAY.qx, y: LAY.qy + Math.max(0, i) * LAY.qs };
}

export const ENTRANCE: Point = { x: (DOOR.x0 + DOOR.x1) / 2, y: FRONT_Y + 40 };
