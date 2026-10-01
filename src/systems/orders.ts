import { pick, r05, rand, rnd } from '../core/rng';
import type { Game } from '../core/game';
import type { Item, Order } from '../core/state';
import { price } from './economy';
import { loy, RG, regS } from './regulars';
import { track } from './missions';

/* Encargos de clientes habituales (v10) */

export function genOrder(g: Game): void {
  const S = g.S;
  const pool = g.db.cards.filter((c) => S.sets.includes(c.s) && S.prices[c.id] && price(g, c.id) >= 1.5 && price(g, c.id) <= 250);
  if (!pool.length) return;
  const c = pick(pool), rid = pick(['lucia', 'iker', 'marcos', 'aitana', 'hugo']), rl = regS(S, rid).loy;
  S.orders.push({ id: S.nid++, c: c.id, pay: r05(price(g, c.id) * (1.25 + rand() * 0.4) * (1 + rl / 500)), due: S.day + 3 + rnd(4), who: RG(rid).n, reg: rid });
}

/** Ejemplar propio que serviría para el encargo (mejor si no está en la vitrina) */
export function ownFor(g: Game, o: Order): Item | undefined {
  const l = g.S.items.filter((i) => i.c === o.c && !i.gq && !i.res && !i.fkK);
  return l.find((i) => i.case == null) || l[0];
}

export type Delivery = { k: 'none' } | { k: 'fake'; who: string } | { k: 'ok'; who: string; pay: number };

/** Entregar un encargo con una carta propia (si era falsa, el cliente lo descubre) */
export function deliverOrder(g: Game, id: number): Delivery {
  const S = g.S, o = S.orders.find((x) => x.id === id);
  if (!o) return { k: 'none' };
  const it = ownFor(g, o);
  if (!it) return { k: 'none' };
  S.items.splice(S.items.indexOf(it), 1);
  if (it.fk) {
    S.repB = Math.max(0, S.repB - 2);
    loy(g, o.reg, -20, 'Le entregaste una carta falsa');
    return { k: 'fake', who: o.who };
  }
  S.money += o.pay;
  S.repB += 1;
  loy(g, o.reg, 15, 'Le conseguiste ' + g.db.byId[o.c].name);
  S.orders = S.orders.filter((x) => x !== o);
  track(g, 'order');
  return { k: 'ok', who: o.who, pay: o.pay };
}
