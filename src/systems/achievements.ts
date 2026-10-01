import type { Game } from '../core/game';
import { fmt } from '../core/format';
import { netWorth } from './economy';

/* Logros y álbum (v10) */

export const ACH = [
  { id: 'pack1', n: 'Primer sobre', d: 'Abre tu primer sobre.', st: 'packs', g: 1, r: 20 },
  { id: 'pack100', n: 'Adicto a los sobres', d: 'Abre 100 sobres.', st: 'packs', g: 100, r: 300 },
  { id: 'serve50', n: 'Atención al cliente', d: 'Atiende a 50 clientes.', st: 'served', g: 50, r: 150 },
  { id: 'serve500', n: 'Tienda de barrio', d: 'Atiende a 500 clientes.', st: 'served', g: 500, r: 1000 },
  { id: 'exact20', n: 'Cajero de oro', d: 'Da el cambio exacto 20 veces.', st: 'exact', g: 20, r: 80 },
  { id: 'hit', n: '¡Brilla!', d: 'Consigue una Ilustración especial o una Hyper rara en un sobre.', st: 'bighit', g: 1, r: 50 },
  { id: 'gem', n: 'Gem Mint', d: 'Consigue un 10 en el gradeo.', st: 'gem', g: 1, r: 100 },
  { id: 'lot', n: 'Cazador de lotes', d: 'Compra un lote misterioso.', st: 'lots', g: 1, r: 40 },
  { id: 'order5', n: 'Por encargo', d: 'Completa 5 encargos.', st: 'orders', g: 5, r: 120 },
  { id: 'tour', n: 'Organizador', d: 'Organiza un torneo.', st: 'tours', g: 1, r: 60 },
  { id: 'alb50', n: 'Media colección', d: 'Llega al 50 % de un set en el álbum.', st: 'alb50', g: 1, r: 150 },
  { id: 'alb100', n: 'Maestro del set', d: 'Completa un set entero en el álbum.', st: 'alb100', g: 1, r: 1000 },
  { id: 'nw10k', n: 'Empresario', d: 'Valor de la empresa: 10.000 €.', st: 'nw', g: 10000, r: 200 },
  { id: 'nw100k', n: 'Magnate', d: 'Valor de la empresa: 100.000 €.', st: 'nw', g: 100000, r: 2000 },
];

/** Fracción del set conseguida en el álbum */
export function albPct(g: Game, sid: string): number {
  const l = g.db.byS[sid] || [];
  return l.length ? l.filter((c) => g.S.dex[c.id]).length / l.length : 0;
}

export const ALBR: [number, number, number][] = [[0.25, 40, 1], [0.5, 120, 2], [0.75, 300, 3], [1, 1000, 5]];

export function achVal(g: Game, a: (typeof ACH)[number]): number {
  if (a.st === 'nw') return netWorth(g);
  if (a.st === 'alb50') return g.S.sets.some((s) => albPct(g, s) >= 0.5) ? 1 : 0;
  if (a.st === 'alb100') return g.S.sets.some((s) => albPct(g, s) >= 1) ? 1 : 0;
  return g.S.lt[a.st] || 0;
}

export function checkAch(g: Game): void {
  ACH.forEach((a) => {
    if (!g.S.ach[a.id] && achVal(g, a) >= a.g) {
      g.S.ach[a.id] = 1;
      g.S.money += a.r;
      g.fx.toast(`🏆 Logro: ${a.n} · +${fmt(a.r)}`);
      g.fx.sound('ach');
    }
  });
}

/** Cobrar un premio del álbum (25, 50, 75 o 100 % del set): dinero y reputación */
export function claimAlbum(g: Game, sid: string, i: number): [number, number] | null {
  const S = g.S, c = (S.albR[sid] ||= []), [t, m, r] = ALBR[i];
  if (c.includes(i) || albPct(g, sid) < t) return null;
  c.push(i);
  S.money += m;
  S.repB += r;
  checkAch(g);
  return [m, r];
}
