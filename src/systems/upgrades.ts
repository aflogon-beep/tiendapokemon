import type { Game } from '../core/game';
import { DECOR, STAFF } from './economy';
import { assignSlots } from './packs';
import { createShopNav } from './shopNav';
import { caseCap } from './economy';

/* Mejoras, decoración, personal y torneo (v10: mUp, A.upg, A.decor, A.staff, A.tourtog) */

export const UPS = [
  { k: 'ads' as const, n: 'Publicidad local', d: 'Entran más clientes cada día.', cost: [250, 600, 1400], max: 3 },
  { k: 'case' as const, n: 'Vitrina grande', d: 'Sube la capacidad de la vitrina de 8 a 16 cartas.', cost: [500], max: 1 },
  { k: 'shelf' as const, n: 'Segunda fila de estanterías', d: 'Pasas de 3 a 6 sets de sobres en las estanterías a la vez.', cost: [350], max: 1 },
];

export function buyUpgrade(g: Game, k: (typeof UPS)[number]['k']): boolean {
  const u = UPS.find((x) => x.k === k)!, lv = g.S.up[k];
  if (lv >= u.max) return false;
  const c = u.cost[lv];
  if (g.S.money < c) return false;
  g.S.money -= c;
  g.S.up[k]++;
  assignSlots(g);
  // La vitrina grande ocupa más sitio: los clientes la rodean
  if (k === 'case') g.nav = createShopNav(caseCap(g.S), g.S.decor);
  return true;
}

export function buyDecor(g: Game, k: string): boolean {
  const x = DECOR.find((y) => y.k === k);
  if (!x || g.S.decor[x.k] || g.S.money < x.cost) return false;
  g.S.money -= x.cost;
  g.S.decor[x.k] = 1;
  // Los muebles nuevos ocupan sitio: los clientes los rodean
  g.nav = createShopNav(caseCap(g.S), g.S.decor);
  return true;
}

/** Contratar o despedir; devuelve si queda contratado */
export function toggleStaff(g: Game, k: (typeof STAFF)[number]['k']): boolean {
  g.S.staff[k] = !g.S.staff[k];
  return g.S.staff[k];
}

/** Organizar torneo para el día siguiente (necesita la mesa de juego) */
export function toggleTour(g: Game): void {
  if (g.S.decor.table) g.S.tour = !g.S.tour;
}
