import { r05 } from '../core/rng';
import { fmt } from '../core/format';
import type { Game } from '../core/game';
import { leave, say, type Customer, type Deal } from './customers';
import { track } from './missions';
import { loy } from './regulars';

/* Comprar cartas a clientes (v10: finishDeal, closeDeal, dealoffer) */

export type Result = { ok: true } | { ok: false; msg: string };

/** El cliente se va (enfadado o no) sin trato */
export function closeDeal(g: Game, c: Customer | undefined, angry: boolean): void {
  if (c) leave(g, c, angry);
}

/** Paga p y la carta pasa a la colección (si era falsa, sin saberlo) */
export function finishDeal(g: Game, d: Deal, p: number): Result {
  const S = g.S;
  if (S.money < p) return { ok: false, msg: 'No tienes dinero suficiente' };
  S.money -= p;
  S.stats.bought++;
  S.items.push({ i: S.nid++, c: d.c.id, k: d.k, rv: d.rv, cost: p, case: null, res: false, fk: d.fake || undefined });
  S.dex[d.c.id] = 1;
  loy(g, d.reg, 3);
  track(g, 'buycard');
  const c = d.cust!;
  c.hold = null;
  say(c, '❤️');
  const qi = g.queue.indexOf(c);
  if (qi >= 0) g.queue.splice(qi, 1);
  c.st = 'leave';
  S.sales++;
  return { ok: true };
}

/**
 * Nuestra oferta: si llega a lo que pide o a su mínimo, trato; si se queda cerca, contraoferta;
 * si es muy baja, se queja y al segundo intento se va enfadado.
 */
export function offerDeal(d: Deal, o: number): { k: 'buy'; price: number } | { k: 'counter' } | { k: 'insulted' } | { k: 'angry' } {
  d.offer = o;
  if (o >= d.ask) return { k: 'buy', price: d.ask };
  if (o >= d.floor) return { k: 'buy', price: o };
  if (o >= d.floor * 0.85) {
    d.counter = r05(d.floor);
    d.msg = `Mmm… por ${fmt(d.counter)} y cerramos.`;
    return { k: 'counter' };
  }
  d.tries++;
  d.counter = 0;
  if (d.tries >= 2) return { k: 'angry' };
  d.msg = '¡Eso es casi un insulto! Ofréceme algo razonable.';
  return { k: 'insulted' };
}

/** Acusar al vendedor de falsa: premio si aciertas, enfado si no */
export function accuseDeal(g: Game, d: Deal): boolean {
  if (d.fake) {
    g.S.repB += 1;
    loy(g, d.reg, -5, 'Le pillaste intentando colarte una falsa');
    closeDeal(g, d.cust, false);
    return true;
  }
  loy(g, d.reg, -10, 'Le acusaste de vender una falsa (era buena)');
  closeDeal(g, d.cust, true);
  return false;
}
