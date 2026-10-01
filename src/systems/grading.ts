import { wpick } from '../core/rng';
import type { Cond } from '../data/rarity';
import type { Item } from '../core/state';

/* Gradeo PGS (v10) */

export const GMULT: Record<number, number> = { 10: 4, 9: 1.7, 8: 1.2, 7: 0.95, 6: 0.8, 5: 0.7, 4: 0.6, 3: 0.55, 2: 0.5, 1: 0.45 };
export const GTXT: Record<number, string> = { 10: 'GEM MINT', 9: 'MINT', 8: 'NM-MT', 7: 'NEAR MINT', 6: 'EX-MT', 5: 'EXCELLENT', 4: 'VG-EX', 3: 'VERY GOOD', 2: 'GOOD', 1: 'POOR' };
export const GSVC = { std: { n: 'Estándar', cost: 12, days: 4 }, exp: { n: 'Exprés', cost: 35, days: 1 } };

export function rollGrade(k: Cond): number {
  const g = +wpick({ 10: 14, 9: 34, 8: 26, 7: 14, 6: 7, 5: 3, 4: 2 }) - (k === 'LP' ? 2 : k === 'MP' ? 3 : 0);
  return Math.max(1, g);
}

/** Clave para agrupar ejemplares iguales */
export const gk = (it: Item): string =>
  it.c + '|' + it.k + '|' + (it.rv ? 1 : 0) + '|' + (it.gr || 0) + '|' + (it.gq ? 1 : 0) + (it.fkK ? '|F' : '');
