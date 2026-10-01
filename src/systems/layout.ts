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

/*
 * Decoración (v10: decorObjs, drawLux). Posiciones de la v10 ajustadas para que en 3D no
 * pisen los puntos donde se paran los clientes ni la cola.
 */
export const DECOR_POS = {
  /**
   * Mesa de juego (v10: 140–336 × 276–330). Se baja y estrecha para no tapar la segunda fila de
   * estanterías ni el pasillo central; las sillas van al sur y al oeste.
   */
  table: { x: 130, y: 304, w: 156, h: 48 } as Rect,
  tableSeats: [{ x: 170, y: 370 }, { x: 246, y: 370 }, { x: 112, y: 316 }, { x: 112, y: 342 }] as Point[],
  coffee: { x: 560, y: 282, w: 38, h: 24 } as Rect,
  sofa: { x: 500, y: 488, w: 100, h: 30 } as Rect,
  rug: { x: 262, y: 505 } as Point,
  /** Plantas que da la decoración «Más plantas» y las que hay siempre */
  plants: [{ x: 612, y: 228 }, { x: 22, y: 300 }, { x: 588, y: 470 }] as Point[],
  basePlants: [{ x: 22, y: 490 }, { x: 778, y: 500 }, { x: 622, y: 136 }] as Point[],
  /** Peanas de lujo */
  lux: [{ x: 452, y: 452 }, { x: 512, y: 452 }, { x: 572, y: 452 }] as Point[],
  neon: { x: 612, y: FLOOR_T } as Point,
};

const around = (p: Point, r: number): Rect => ({ x: p.x - r, y: p.y - r, w: r * 2, h: r * 2 });

/** Obstáculos que añade la decoración comprada */
export function decorObstacles(decor: Record<string, unknown>): Rect[] {
  const l: Rect[] = DECOR_POS.basePlants.map((p) => around(p, 12));
  if (decor.table) l.push(DECOR_POS.table, ...DECOR_POS.tableSeats.map((p) => around(p, 8)));
  if (decor.coffee) l.push(DECOR_POS.coffee);
  if (decor.sofa) l.push(DECOR_POS.sofa);
  if (decor.plants) l.push(...DECOR_POS.plants.map((p) => around(p, 12)));
  if (decor.lux) l.push(...DECOR_POS.lux.map((p) => around(p, 17)));
  return l;
}
