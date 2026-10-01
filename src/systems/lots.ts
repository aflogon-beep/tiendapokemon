import { clamp, pick, r05, rand, rnd, wpick } from '../core/rng';
import { fmt } from '../core/format';
import type { Game } from '../core/game';
import type { Card } from '../data/cards';
import { COND, type Cond, type Rarity } from '../data/rarity';
import { price, rvr } from './economy';
import { say, type Customer } from './customers';
import { track } from './missions';

/* Lotes misteriosos (v10): un coleccionista vende cientos de cartas; hay que estimar su valor */

export interface LotCard {
  c: Card;
  k: Cond;
  rv: boolean;
  v: number;
}

export interface Lot {
  c: Customer | null;
  n: number;
  cards: LotCard[];
  /** Valor real (oculto) */
  v: number;
  ask: number;
  floor: number;
  /** Índices de las cartas revisadas */
  rev: number[];
  expert: boolean;
  lo: number;
  hi: number;
  tries: number;
  msg: string;
  offer: number;
  done: boolean;
  counter: number;
  /** Revisión gratis de 10 cartas (con tasador/a) */
  free: boolean;
  paid?: number;
}

export function makeLot(g: Game, c: Customer | null): Lot {
  const S = g.S, n = 40 + rnd(220), cards: LotCard[] = [];
  const W8: Record<Rarity, number> = { C: 52, U: 26, R: 11, DR: 6, IR: 2.2, UR: 1.2, SIR: 0.9, HR: 0.7 };
  const pools = {} as Record<Rarity, Card[]>;
  (Object.keys(W8) as Rarity[]).forEach((r) => (pools[r] = (g.db.byR[r] || []).filter((x) => S.sets.includes(x.s))));
  for (let i = 0; i < n; i++) {
    let r = wpick(W8);
    if (!pools[r].length) r = 'C';
    const l = pools[r].length ? pools[r] : g.db.cards, cd = pick(l), k = wpick<Cond>({ NM: 45, LP: 38, MP: 17 });
    const rv = (r === 'C' || r === 'U' || r === 'R') && rand() < 0.15;
    cards.push({ c: cd, k, rv, v: price(g, cd.id) * (rv ? rvr(cd) : 1) * COND[k] });
  }
  const v = cards.reduce((a, x) => a + x.v, 0), ask = Math.max(5, r05(v * (0.5 + rand() * 0.8)));
  return {
    c, n, cards, v, ask, floor: r05(ask * (0.72 + rand() * 0.18)), rev: [], expert: false,
    lo: v * (0.35 + rand() * 0.3), hi: v * (1.35 + rand() * 0.8), tries: 0, msg: '', offer: ask, done: false, counter: 0,
    free: !!S.staff.appraiser,
  };
}

/** Horquilla de valor estimado: a ojo, por muestra revisada o exacta (experto) */
export function lotEst(g: Game, L: Lot): [number, number] {
  if (L.expert) return [L.v, L.v];
  if (!L.rev.length) return [L.lo, L.hi];
  const k = L.rev.length, m = L.rev.reduce((a, i) => a + L.cards[i].v, 0) / k, e = m * L.n;
  const b = clamp((1.3 / Math.sqrt(k)) * (g.S.staff.appraiser ? 0.5 : 1), 0.08, 0.9);
  return [e * (1 - b), e * (1 + b)];
}

export function lotReview(L: Lot, k: number): void {
  const rest = L.cards.map((_, i) => i).filter((i) => !L.rev.includes(i));
  for (let j = 0; j < k && rest.length; j++) L.rev.push(rest.splice(rnd(rest.length), 1)[0]);
}

export const expCost = (L: Lot): number => Math.max(20, r05(L.ask * 0.08));

/** Pagar por revisar 10 (gratis la primera vez con tasador/a) o 50 cartas */
export function payReview(g: Game, L: Lot, n: 10 | 50): boolean {
  let c = n === 10 ? 10 : 35;
  if (n === 10 && L.free) {
    c = 0;
    L.free = false;
  }
  if (g.S.money < c) return false;
  g.S.money -= c;
  lotReview(L, n);
  return true;
}

export function payExpert(g: Game, L: Lot): boolean {
  const c = expCost(L);
  if (g.S.money < c) return false;
  g.S.money -= c;
  L.expert = true;
  return true;
}

export function lotBuy(g: Game, L: Lot, p: number): boolean {
  const S = g.S;
  if (S.money < p) return false;
  S.money -= p;
  const each = p / L.n;
  L.cards.forEach((x) => {
    S.items.push({ i: S.nid++, c: x.c.id, k: x.k, rv: x.rv, cost: each, case: null, res: false });
    S.dex[x.c.id] = 1;
  });
  L.done = true;
  L.paid = p;
  track(g, 'lot');
  return true;
}

/** Nuestra oferta: si llega al mínimo, se compra; si no, una contraoferta y a la segunda se va */
export function lotOffer(L: Lot): 'buy' | 'counter' | 'gone' {
  if (L.offer >= L.floor) return 'buy';
  if (!L.tries) {
    L.tries = 1;
    L.counter = r05(L.floor * 1.03);
    L.msg = `Por menos de ${fmt(L.counter)} no lo vendo.`;
    return 'counter';
  }
  L.msg = '';
  return 'gone';
}

/** El vendedor se va (con o sin trato) */
export function endLot(g: Game, L: Lot): void {
  const c = L.c;
  if (!c) return;
  const qi = g.queue.indexOf(c);
  if (qi >= 0) g.queue.splice(qi, 1);
  c.hold = null;
  say(c, L.done ? '❤️' : '👋');
  c.st = 'leave';
  if (L.done) g.S.sales++;
}
