import { DOOR, FLOOR_T, FRONT_Y, W, decorObstacles, obstacles, type Rect } from './layout';
import { blockBand, createNavGrid, type NavGrid } from './nav';

// Zona por la que se puede andar: interior de la tienda + acera (en px de la v10)
export const WALL_PX = 60; // grosor de las paredes de Mini Market (0,6 unidades)
export const SIDEWALK = { y0: FRONT_Y + WALL_PX, y1: FRONT_Y + WALL_PX + 125 }; // 3 m de acera
export const WALK_BOUNDS: Rect = { x: -700, y: FLOOR_T, w: W + 1400, h: SIDEWALK.y1 - FLOOR_T };
export const CHAR_RADIUS = 16; // medio cuerpo de un personaje (0,15 unidades × 2,4) + margen
export const DOOR_OPENING: [number, number] = [DOOR.x0 + 10, DOOR.x1 - 10];

/** Edificios y paredes que cierran la tienda por los lados */
function shellObstacles(): Rect[] {
  return [
    { x: WALK_BOUNDS.x, y: FLOOR_T - WALL_PX, w: -WALK_BOUNDS.x, h: SIDEWALK.y0 - FLOOR_T + WALL_PX }, // izquierda
    { x: W, y: FLOOR_T - WALL_PX, w: WALK_BOUNDS.w, h: SIDEWALK.y0 - FLOOR_T + WALL_PX }, // derecha
  ];
}

export function createShopNav(cap = 8, decor: Record<string, unknown> = {}): NavGrid {
  const g = createNavGrid(WALK_BOUNDS, [...obstacles(cap), ...decorObstacles(decor), ...shellObstacles()], CHAR_RADIUS);
  blockBand(g, FRONT_Y, SIDEWALK.y0, [DOOR_OPENING], CHAR_RADIUS);
  return g;
}
