import { clamp, gauss, rand } from '../core/rng';
import type { Game } from '../core/game';
import type { Item, PriceState, State } from '../core/state';
import type { Card } from '../data/cards';
import { COND, type Rarity } from '../data/rarity';
import { evMul } from './events';
import { GMULT } from './grading';
import { prodValue } from './products';
import { REGS } from './regulars';

/* Precios, valor de la empresa, niveles, decoración y empleados (v10) */

export const DAYLEN = 100;
export const RENT = 15;

/** Multiplicador de una carta reverse respecto a la normal */
export const rvr = (c: Card | undefined): number => (c?.rv && c.b ? clamp(c.rv / c.b, 1.2, 8) : 2.5);

export const price = (g: Game, id: string): number => g.S.prices[id].p;

export function itemVal(g: Game, it: Item): number {
  if (it.fkK) return 0;
  const c = g.db.byId[it.c];
  return price(g, it.c) * (it.rv ? rvr(c) : 1) * (it.gr ? GMULT[it.gr] : COND[it.k]);
}

export const invValue = (g: Game): number => g.S.items.reduce((a, it) => a + itemVal(g, it), 0);
export const sealedCount = (g: Game): number => g.sets.reduce((a, sd) => a + g.S.sealed[sd.id], 0);

export const netWorth = (g: Game): number =>
  g.S.money + invValue(g) + g.sets.reduce((a, sd) => a + g.S.sealed[sd.id] * g.S.pack[sd.id].w, 0) + prodValue(g.S);

export const LV = [0, 2000, 5000, 10000, 25000, 50000, 100000, 250000, 1000000];

export function level(g: Game): number {
  const n = netWorth(g);
  let l = 1;
  LV.forEach((v, i) => {
    if (n >= v) l = i + 1;
  });
  return l;
}

export const tierOf = (l: number): number => (l >= 7 ? 3 : l >= 5 ? 2 : l >= 3 ? 1 : 0);
export const caseCap = (S: State): number => 8 + 8 * S.up.case;
export const caseItems = (S: State): Item[] => S.items.filter((i) => i.case != null && !i.lux);
export const slotCount = (S: State): number => 3 + 3 * S.up.shelf;
export const repv = (S: State): number => Math.floor(S.sales / 6) + (S.repB || 0);

/* --- evolución de precios --- */
export const VOL: Record<Rarity, number> = { C: 0.3, U: 0.3, R: 0.5, DR: 0.8, IR: 1, UR: 1, SIR: 1.2, HR: 1.3 };

export function step(p: PriceState, vol: number): void {
  p.t = p.t * 0.85 + (rand() - 0.5) * 0.012 * vol;
  p.p = Math.max(0.02, p.p * Math.exp(p.t + gauss() * 0.03 * vol) + (p.b - p.p) * 0.03);
  p.h.push(p.p);
  if (p.h.length > 60) p.h.shift();
}

/** Historial inicial: reconstruido con las medias de Cardmarket o simulado */
export function initPrice(c: Card): PriceState {
  const h: number[] = [];
  if (c.seed) {
    const s = c.seed;
    for (let i = 0; i < 30; i++) {
      const f = i / 29;
      const v = f < 0.77 ? s[0] + (s[1] - s[0]) * (f / 0.77) : s[1] + (c.b - s[1]) * ((f - 0.77) / 0.23);
      h.push(v * (1 + (rand() - 0.5) * 0.01));
    }
    h[29] = c.b;
  } else {
    const p = { p: c.b * (0.92 + rand() * 0.16), t: 0, b: c.b, h: [] as number[] };
    for (let i = 0; i < 30; i++) step(p, VOL[c.r]);
    return p;
  }
  return { p: c.b, t: 0, b: c.b, h };
}

/* --- decoración y empleados --- */
export interface Decor {
  k: string;
  ic: string;
  n: string;
  d: string;
  cost: number;
  sp?: number;
  tol?: number;
  pat?: number;
}

export const DECOR: Decor[] = [
  { k: 'plants', ic: '🪴', n: 'Más plantas', d: 'Tienda más acogedora: +5 % clientes.', cost: 120, sp: 0.05 },
  { k: 'poster', ic: '🖼️', n: 'Pósters de coleccionista', d: 'Los clientes aceptan precios un 4 % más altos.', cost: 250, tol: 0.04 },
  { k: 'rug', ic: '⭕', n: 'Alfombra Pokéball', d: '+10 % clientes.', cost: 300, sp: 0.1 },
  { k: 'coffee', ic: '☕', n: 'Máquina de café', d: '+25 % de paciencia en la cola.', cost: 350, pat: 0.25 },
  { k: 'sofa', ic: '🛋️', n: 'Sofá de espera', d: '+20 % de paciencia en la cola.', cost: 450, pat: 0.2 },
  { k: 'lights', ic: '💡', n: 'Focos para la vitrina', d: 'Las cartas de la vitrina se aceptan un 6 % más caras.', cost: 500, tol: 0.06 },
  { k: 'neon', ic: '✨', n: 'Letrero de neón', d: '+15 % clientes.', cost: 600, sp: 0.15 },
  { k: 'table', ic: '🎲', n: 'Mesa de juego', d: 'Permite organizar torneos en la tienda.', cost: 800 },
  { k: 'lux', ic: '💎', n: 'Peanas de lujo', d: '3 peanas con foco para tus mejores cartas: se aceptan un 12 % más caras.', cost: 1500 },
];

export const STAFF = [
  { k: 'cashier' as const, ic: '🧑‍💼', n: 'Cajero/a', d: 'Cobra por ti a los clientes que compran (sin minijuego de caja).', sal: 20 },
  { k: 'appraiser' as const, ic: '🧐', n: 'Tasador/a', d: 'Revisa gratis 10 cartas de cada lote y afina a la mitad la estimación.', sal: 25 },
  { k: 'cm' as const, ic: '📣', n: 'Community manager', d: '+1 de reputación al día y +10 % clientes.', sal: 30 },
];

const dsum = (S: State, k: 'sp' | 'tol' | 'pat'): number =>
  DECOR.reduce((a, d) => a + (S.decor[d.k] && d[k] ? d[k]! : 0), 0);

/** Multiplicador de llegada de clientes */
export const spMul = (S: State): number =>
  (1 + dsum(S, 'sp') + (S.staff.cm ? 0.1 : 0) + REGS.filter((r) => S.regs?.[r.id] && S.regs[r.id].loy >= 80).length * 0.03) * evMul(S);
/** Multiplicador de paciencia en la cola */
export const patMul = (S: State): number => 1 + dsum(S, 'pat');
/** Multiplicador de tolerancia al precio */
export const tolMul = (S: State): number => 1 + dsum(S, 'tol');
