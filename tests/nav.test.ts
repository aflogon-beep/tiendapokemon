import { describe, expect, it } from 'vitest';
import { ENTRANCE, FRONT_Y, SHELF_SLOTS, caseSpot, obstacles, queueSpot, shelfSpot, type Point, type Rect } from '../src/systems/layout';
import { createShopNav, CHAR_RADIUS, SIDEWALK } from '../src/systems/shopNav';
import { findPath, isFree } from '../src/systems/nav';

const grid = createShopNav();
const street: Point = { x: -500, y: (SIDEWALK.y0 + SIDEWALK.y1) / 2 };

// Distancia de un punto a un rectángulo
const distToRect = (p: Point, r: Rect) =>
  Math.hypot(Math.max(r.x - p.x, 0, p.x - r.x - r.w), Math.max(r.y - p.y, 0, p.y - r.y - r.h));

// Muestrea el camino cada 2 px y comprueba que ningún punto pisa un mueble
function clearOfFurniture(path: Point[]): boolean {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2);
    for (let s = 0; s <= n; s++) {
      const p = { x: a.x + ((b.x - a.x) * s) / n, y: a.y + ((b.y - a.y) * s) / n };
      if (obstacles().some((o) => distToRect(p, o) < CHAR_RADIUS - 6)) return false;
    }
  }
  return true;
}

describe('navegación en la tienda', () => {
  const targets: [string, Point][] = [
    ...Array.from({ length: SHELF_SLOTS }, (_, i) => [`estantería ${i}`, shelfSpot(i)] as [string, Point]),
    ['vitrina', caseSpot()],
    ['cola 0', queueSpot(0)],
    ['cola 5', queueSpot(5)],
  ];

  it('los puntos de destino están libres', () => {
    for (const [name, p] of targets) expect(isFree(grid, p), name).toBe(true);
  });

  it('se llega a cada destino desde la calle sin atravesar muebles', () => {
    for (const [name, p] of targets) {
      const path = findPath(grid, street, p);
      expect(path, name).not.toBeNull();
      expect(clearOfFurniture(path!), name).toBe(true);
    }
  });

  it('se entra por la puerta', () => {
    const path = findPath(grid, street, shelfSpot(0))!;
    const idx = path.findIndex((p, i) => i > 0 && path[i - 1].y > FRONT_Y !== p.y > FRONT_Y);
    const a = path[idx - 1], b = path[idx];
    const x = a.x + ((b.x - a.x) * (FRONT_Y - a.y)) / (b.y - a.y);
    expect(Math.abs(x - ENTRANCE.x)).toBeLessThan(40);
  });
});
