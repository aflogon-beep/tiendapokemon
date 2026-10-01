import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FLOOR_T, FRONT_Y, LAY, SHELF_SLOTS, TILE_PX, W, obstacles, shelfRect, type Rect } from '../src/systems/layout';
import { PX_TO_M, toPx, toWorld } from '../src/world/shop';

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('escala de LAY a metros', () => {
  it('100 px son una baldosa de Mini Market (2,4 m)', () => {
    expect(TILE_PX * PX_TO_M).toBeCloseTo(2.4);
  });

  it('la tienda mide 8 × 5 baldosas', () => {
    expect((W * PX_TO_M) / 2.4).toBeCloseTo(8);
    expect(((FRONT_Y - FLOOR_T) * PX_TO_M) / 2.4).toBeCloseTo(5);
  });

  it('toPx deshace toWorld', () => {
    const p = toPx(toWorld(LAY.qx, LAY.qy));
    expect(p.x).toBeCloseTo(LAY.qx);
    expect(p.y).toBeCloseTo(LAY.qy);
    expect(toWorld(W / 2, FRONT_Y)).toEqual(new THREE.Vector3(0, 0, 0));
  });
});

describe('distribución', () => {
  it('cada estantería ocupa su hueco de LAY', () => {
    for (let i = 0; i < SHELF_SLOTS; i++) {
      const r = shelfRect(i), s = LAY.shelf(i);
      expect(Math.abs(r.x + r.w / 2 - (s.x + s.w / 2))).toBeLessThan(1);
      expect(r.w).toBeLessThanOrEqual(s.w + 12);
    }
  });

  it('los muebles no se solapan y están dentro de la tienda', () => {
    const l = obstacles();
    for (let i = 0; i < l.length; i++) {
      const r = l[i];
      expect(r.x >= 0 && r.x + r.w <= W && r.y >= FLOOR_T && r.y + r.h <= FRONT_Y, `mueble ${i}`).toBe(true);
      for (let j = i + 1; j < l.length; j++) expect(overlap(r, l[j]), `muebles ${i} y ${j}`).toBe(false);
    }
  });
});
