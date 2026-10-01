import { shuffle } from '../core/rng';
import type { Game } from '../core/game';
import { ALBR, albPct, checkAch } from './achievements';
import { ownFor } from './orders';

/* Misiones del día y contadores de por vida (v10) */

export const MT = [
  { k: 'open', n: 'Abre {g} sobres', g: [2, 4, 6], r: [20, 35, 60] },
  { k: 'sellpack', n: 'Vende {g} sobres en la tienda', g: [4, 7, 12], r: [20, 40, 70] },
  { k: 'serve', n: 'Atiende a {g} clientes', g: [5, 9, 14], r: [25, 45, 70] },
  { k: 'earn', n: 'Ingresa {g} € en caja', g: [40, 90, 180], r: [20, 45, 80] },
  { k: 'buycard', n: 'Compra {g} carta(s) a clientes', g: [1, 2, 3], r: [15, 30, 50] },
  { k: 'exact', n: 'Da el cambio exacto {g} veces', g: [2, 3, 5], r: [20, 30, 50] },
  { k: 'cardpay', n: 'Cobra {g} veces con tarjeta', g: [2, 3, 4], r: [15, 25, 40] },
  { k: 'bigsale', n: 'Vende en vitrina una carta de {g} € o más', g: [5, 15, 30], r: [25, 50, 90] },
  { k: 'sellprod', n: 'Vende {g} productos sellados o accesorios', g: [2, 4, 7], r: [25, 45, 80] },
];

export function genMissions(g: Game): void {
  const S = g.S, tier = Math.min(2, Math.floor((S.day - 1) / 6));
  S.dm = {
    day: S.day,
    list: shuffle(MT).slice(0, 3).map((m) => ({ k: m.k, t: m.n.replace('{g}', String(m.g[tier])), g: m.g[tier], p: 0, r: m.r[tier], done: 0, cl: 0 })),
  };
}

// Contadores de por vida (S.lt) que alimentan los logros
const LTK: Record<string, string> = { open: 'packs', serve: 'served', exact: 'exact', order: 'orders', lot: 'lots', tour: 'tours', gem: 'gem', bighit: 'bighit' };

export function track(g: Game, k: string, v = 1): void {
  const S = g.S;
  if (LTK[k]) S.lt[LTK[k]] = (S.lt[LTK[k]] || 0) + v;
  S.dm?.list.forEach((m) => {
    if (m.k !== k || m.done) return;
    if (k === 'bigsale') {
      if (v >= m.g) m.p = m.g;
    } else m.p += v;
    if (m.p >= m.g) {
      m.p = m.g;
      m.done = 1;
      g.fx.toast('✅ Misión completada: ' + m.t);
      g.fx.sound('ach');
    }
  });
  checkAch(g);
}

/** Cosas pendientes de cobrar o entregar (punto rojo en «Tareas») */
export function claimables(g: Game): number {
  const S = g.S;
  let n = S.dm ? S.dm.list.filter((m) => m.done && !m.cl).length : 0;
  n += S.orders.filter((o) => ownFor(g, o)).length;
  S.sets.forEach((s) => {
    const p = albPct(g, s), c = S.albR[s] || [];
    ALBR.forEach(([t], i) => {
      if (p >= t && !c.includes(i)) n++;
    });
  });
  return n;
}
