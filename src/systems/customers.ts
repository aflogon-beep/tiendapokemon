import { pick, r05, rand, rnd, wpick } from '../core/rng';
import type { Game } from '../core/game';
import type { Item } from '../core/state';
import type { Card } from '../data/cards';
import { COND, type Cond, type Rarity } from '../data/rarity';
import { caseCap, caseItems, itemVal, patMul, price, rvr, tolMul } from './economy';
import { LAY, type Point } from './layout';
import { track } from './missions';
import { findPath } from './nav';
import { pickProd, pInfo, pPrice, pStock } from './products';
import { loy, pickReg, RG, regS } from './regulars';
import { SIDEWALK } from './shopNav';

/*
 * Clientes (v10): llegan por la acera, entran, miran, deciden, hacen cola en la caja y se van.
 * Coordenadas en px de la v10. Los waypoints fijos de la v10 se sustituyen por caminos del
 * buscador (nav.ts) para que en 3D no atraviesen los muebles.
 */

export type CustType = 'kid' | 'collector' | 'investor' | 'whale' | 'seller' | 'lot';
export type CustState = 'in' | 'browse' | 'toq' | 'wait' | 'leave';

export const CT: Record<CustType, { w: number; col: string; hair: string; sc: number; mult: number }> = {
  kid: { w: 0.3, col: '#4a90d9', hair: '#4b2e1a', sc: 0.85, mult: 0.95 },
  collector: { w: 0.28, col: '#4fa36a', hair: '#222', sc: 1, mult: 1.02 },
  investor: { w: 0.12, col: '#3d4257', hair: '#111', sc: 1, mult: 0.96 },
  whale: { w: 0.05, col: '#d0a52a', hair: '#8a6a1a', sc: 1.05, mult: 1.12 },
  seller: { w: 0.25, col: '#a25fb5', hair: '#5a3a2a', sc: 1, mult: 1 },
  lot: { w: 0, col: '#8a5a2b', hair: '#cfcfcf', sc: 1, mult: 1 },
};

export interface Want {
  k: 'pack' | 'prod' | 'single' | 'sell' | 'lot';
  s?: string;
  pid?: string;
}

export interface Hold {
  k: 'pack' | 'prod' | 'single';
  s?: string;
  pid?: string;
  it?: Item;
  qty: number;
  total: number;
}

/** Carta que un cliente quiere vender a la tienda */
export interface Deal {
  reg: string | null;
  fake: boolean;
  chk: boolean;
  c: Card;
  k: Cond;
  rv: boolean;
  val: number;
  ask: number;
  floor: number;
  tries: number;
  offer: number;
  msg: string;
  counter: number;
  cust?: Customer;
}

export interface Customer {
  id: number;
  type: CustType;
  reg: string | null;
  x: number;
  y: number;
  st: CustState;
  /** Destino de la compra */
  tx: number;
  ty: number;
  /** Velocidad (px/s) */
  sp: number;
  bub: string | null;
  bt: number;
  hold: Hold | null;
  /** Tiempo esperando en la cola y paciencia */
  wt: number;
  pat: number;
  t: number;
  /** ¿Se está moviendo? */
  mv: boolean;
  paid: number;
  want: Want;
  deal?: Deal;
  /** Camino pendiente y destino para el que se calculó */
  path: Point[];
  goal: Point | null;
  ex?: number;
  ey?: number;
  bw: number;
  hg?: boolean;
  bought?: boolean;
  /** Variante visual estable (modelo 3D) */
  look: number;
}

/* --- coordenadas de la calle: la acera de la v10 (y 570–612) se estira a la nuestra --- */
const streetY = (v10y: number): number => SIDEWALK.y0 + ((v10y - 570) / 42) * (SIDEWALK.y1 - SIDEWALK.y0);

export const say = (c: Customer, t: string): void => {
  c.bub = t;
  c.bt = 2.2;
};

// Puntos de compra como en la v10 (con un poco de azar)
export function shelfSpot(i: number): Point {
  const s = LAY.shelf(i);
  return { x: s.x + s.w / 2 + rnd(40) - 20, y: s.y + s.h + 44 + rnd(14) };
}

export function caseSpot(cap: number): Point {
  const c = LAY.cs(cap);
  return { x: c.x + c.w / 2 + rnd(80) - 40, y: c.y + c.h + 40 + rnd(14) };
}

export function makeDeal(g: Game, reg: string | null): Deal | undefined {
  for (let t = 0; t < 40; t++) {
    const rr = wpick<Rarity>({ C: 30, U: 18, R: 20, DR: 12, IR: 8, UR: 4, SIR: 6, HR: 2 }), pool = g.db.byR[rr];
    if (!pool) continue;
    const c = pick(pool), k = wpick<Cond>({ NM: 50, LP: 35, MP: 15 }), rv = (rr === 'C' || rr === 'U' || rr === 'R') && rand() < 0.3;
    const val = price(g, c.id) * (rv ? rvr(c) : 1) * COND[k];
    if (val < 0.6 && t < 39) continue;
    return {
      reg: reg || null,
      fake: rand() < (reg === 'rafa' ? 0.5 : val > 30 ? 0.22 : 0.1),
      chk: false, c, k, rv, val,
      ask: r05(val * (reg === 'rafa' ? 0.72 : 0.9 + rand() * 0.3)),
      floor: r05(val * (0.5 + rand() * 0.3)),
      tries: 0, offer: r05(val * 0.7), msg: '', counter: 0,
    };
  }
  return undefined;
}

export function spawn(g: Game): Customer {
  const S = g.S;
  const wts = {} as Record<CustType, number>;
  for (const k in CT) wts[k as CustType] = CT[k as CustType].w;
  wts.lot = S.day >= 2 && !g.custs.some((x) => x.type === 'lot') ? 0.05 : 0;
  if (S.tour) wts.collector *= 2;
  let type = wpick(wts), reg: string | null = null;
  if (S.ev?.t === 'vip' && !S.vipDone && S.clock > 12) {
    type = 'whale';
    S.vipDone = true;
  } else if (S.tut?.on && !(S.lt.served > 0) && caseItems(S).length) type = 'collector';
  else if (rand() < 0.28) {
    reg = pickReg(g);
    if (reg) type = RG(reg).t as CustType;
  }
  g.fx.sound('bell');
  const R = reg ? RG(reg) : null, rs = reg ? regS(S, reg) : null;
  const c: Customer = {
    id: ++g.cid, type, reg,
    x: 358 + (rand() < 0.5 ? -1 : 1) * (170 + rnd(260)), y: streetY(590 + rnd(16)),
    st: 'in', tx: 0, ty: 0, sp: 55 + rnd(20), bub: null, bt: 0, hold: null, wt: 0,
    pat: (28 + rnd(10)) * patMul(S) * (S.tut?.on ? 3 : 1) * (rs ? 1 + (rs.loy / 100) * 0.6 : 1),
    t: 0, mv: false, paid: 0, want: { k: 'single' }, path: [], goal: null, bw: 0,
    look: reg ? lookOf(reg) : rnd(1000),
  };
  if (R && rs) {
    say(c, rs.met ? pick(['¡Buenas! 👋', '¡Hola otra vez!', '¿Qué hay de nuevo?']) : `¡Hola! Soy ${R.n} 😄`);
    rs.met = true;
    rs.visits++;
    if (!S.sets.includes(rs.fav)) rs.fav = pick(S.sets);
  }
  g.custs.push(c);
  S.stats.cust++;
  if (type === 'seller' || type === 'lot') {
    c.want = { k: type === 'lot' ? 'lot' : 'sell' };
    if (type === 'seller') c.deal = makeDeal(g, reg);
    c.st = 'toq';
    return c;
  }
  const ptry = S.tut?.on ? 0 : R?.acc ? 0.6 : ({ kid: 0.25, collector: 0.3, investor: 0.4, whale: 0.45 } as Record<string, number>)[type] || 0;
  const pid = rand() < ptry ? pickProd(S, R?.acc ? 'player' : type) : null;
  if (pid) {
    c.want = { k: 'prod', pid };
    const b = LAY.prod;
    c.tx = b.x + 20 + rnd(b.w - 40);
    c.ty = b.y + b.h + 34 + rnd(10);
  } else if ((type === 'kid' || type === 'whale') && S.slots.some(Boolean)) {
    const w: Record<string, number> = {};
    S.slots.forEach((id) => {
      if (id) w[id] = (S.sealed[id] > 0 ? 3 : 1) * (S.ev?.t === 'launch' && S.ev.s === id ? 6 : 1) * (rs?.fav === id ? 4 : 1);
    });
    const s = wpick(w), i = S.slots.indexOf(s);
    c.want = { k: 'pack', s };
    const p = shelfSpot(i);
    c.tx = p.x;
    c.ty = p.y;
  } else {
    c.want = { k: 'single' };
    const p = caseSpot(caseCap(S));
    c.tx = p.x;
    c.ty = p.y;
  }
  return c;
}

// Los habituales siempre tienen el mismo aspecto
export const lookOf = (reg: string): number => [...reg].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) % 1000;

export function leave(g: Game, c: Customer, angry: boolean): void {
  const S = g.S;
  if (c.hold) {
    if (c.hold.k === 'pack') S.sealed[c.hold.s!] += c.hold.qty;
    else if (c.hold.k === 'prod') S.prod[c.hold.pid!] = pStock(S, c.hold.pid!) + c.hold.qty;
    else c.hold.it!.res = false;
    c.hold = null;
  }
  const qi = g.queue.indexOf(c);
  if (qi >= 0) g.queue.splice(qi, 1);
  if (angry) {
    S.sales = Math.max(0, S.sales - 1);
    S.stats.lost++;
    if (c.reg) loy(g, c.reg, -8, 'Se fue enfadado de la tienda');
  }
  c.st = 'leave';
}

/** El cliente decide si compra lo que vino a buscar */
export function decide(g: Game, c: Customer): void {
  const S = g.S;
  const m = CT[c.type].mult * (c.reg ? 1 + regS(S, c.reg).loy / 1000 : 1);
  if (c.want.k === 'prod') {
    const pid = c.want.pid!, i = pInfo(S, pid);
    if (!i || pStock(S, pid) < 1) {
      say(c, '😕 Sin stock');
      return leave(g, c, true);
    }
    const pr = pPrice(S, pid), ref = i.ref * m * tolMul(S) * (0.9 + rand() * 0.25);
    if (pr > ref) {
      say(c, '💸 Muy caro');
      return leave(g, c, true);
    }
    S.prod[pid]--;
    c.hold = { k: 'prod', pid, qty: 1, total: pr };
  } else if (c.want.k === 'pack') {
    const s = c.want.s!, st = S.sealed[s];
    const ref = S.pack[s].ref * m * tolMul(S) * (S.ev?.t === 'launch' && S.ev.s === s ? 1.2 : 1) * (0.9 + rand() * 0.25);
    const sh = S.shelf[s];
    if (st < 1) {
      say(c, '😕 Sin stock');
      return leave(g, c, true);
    }
    if (sh > ref) {
      say(c, '💸 Muy caro');
      return leave(g, c, true);
    }
    let qty = c.type === 'whale' ? 3 + rnd(4) : 1;
    qty = Math.min(qty, st);
    if (c.type === 'kid' && sh > 14) {
      say(c, '😢 No me llega');
      return leave(g, c, false);
    }
    S.sealed[s] -= qty;
    c.hold = { k: 'pack', s, qty, total: sh * qty };
  } else {
    let its = S.items.filter((i) => i.case != null && !i.res && !i.fkK);
    if (!its.length) {
      say(c, '😕 Vitrina vacía');
      return leave(g, c, true);
    }
    if (c.type === 'investor') its = its.sort((a, b) => itemVal(g, b) - itemVal(g, a)).slice(0, 3);
    const it = pick(its), f = (0.95 + rand() * 0.3) * m * tolMul(S) * (it.lux ? 1.12 : 1);
    if (it.case! > f && !S.tut?.on) {
      say(c, '💸 Muy caro');
      return leave(g, c, true);
    }
    it.res = true;
    c.hold = { k: 'single', it, qty: 1, total: itemVal(g, it) * it.case! };
  }
  c.st = 'toq';
}

export const qpos = (g: Game, c: Customer): Point => {
  const i = g.queue.indexOf(c);
  return { x: LAY.qx, y: LAY.qy + Math.max(0, i) * LAY.qs };
};

/** Cliente que está esperando primero en la caja */
export function front(g: Game): Customer | null {
  const c = g.queue[0];
  if (!c) return null;
  const p = qpos(g, c);
  return Math.hypot(c.x - p.x, c.y - p.y) < 5 && c.st === 'wait' ? c : null;
}

/** Cobra al cliente (got = lo que paga de verdad; por defecto, el total) */
export function pay(g: Game, c: Customer, got?: number): void {
  const S = g.S, h = c.hold!;
  if (got == null) got = h.total;
  S.money += got;
  S.stats.inc += got;
  S.sales++;
  if (h.k === 'single') {
    const i = S.items.indexOf(h.it!);
    if (i >= 0) S.items.splice(i, 1);
    track(g, 'bigsale', got);
    if (h.it!.fk) S.fkRet.push({ got, reg: c.reg || null });
  } else if (h.k === 'prod') track(g, 'sellprod', h.qty);
  else track(g, 'sellpack', h.qty);
  if (c.reg) loy(g, c.reg, 3 + (c.wt < c.pat * 0.4 ? 2 : 0));
  track(g, 'earn', got);
  track(g, 'serve');
  if (got >= 50) g.fx.shake(3);
  g.fx.coins(c, got);
  c.bought = true;
  c.hold = null;
  say(c, '❤️');
  const qi = g.queue.indexOf(c);
  if (qi >= 0) g.queue.splice(qi, 1);
  c.st = 'leave';
}

/** ¿Pedirá rebaja? Solo cartas de la vitrina de 5 € o más, una vez por cliente */
export function canHaggle(c: Customer): boolean {
  return (
    c.hold?.k === 'single' && c.hold.total >= 5 && !c.hg &&
    rand() < (({ investor: 0.6, collector: 0.4, whale: 0.2, kid: 0.3 } as Record<string, number>)[c.type] || 0.3)
  );
}

/* --- movimiento --- */

function moveTo(g: Game, c: Customer, tx: number, ty: number, dt: number): number {
  // Recalcula el camino si cambia el destino
  if (!c.goal || Math.hypot(c.goal.x - tx, c.goal.y - ty) > 4) {
    const p = findPath(g.nav, { x: c.x, y: c.y }, { x: tx, y: ty });
    c.path = p ? p.slice(1) : [{ x: tx, y: ty }];
    c.goal = { x: tx, y: ty };
  }
  let step = c.sp * dt;
  c.mv = false;
  while (step > 0 && c.path.length) {
    const wp = c.path[0], dx = wp.x - c.x, dy = wp.y - c.y, d = Math.hypot(dx, dy);
    if (d <= step) {
      c.x = wp.x;
      c.y = wp.y;
      c.path.shift();
      step -= d;
    } else {
      c.x += (dx / d) * step;
      c.y += (dy / d) * step;
      step = 0;
    }
    c.mv = true;
  }
  const end = c.path.length ? c.path[c.path.length - 1] : { x: c.x, y: c.y };
  return c.path.length ? Math.hypot(end.x - c.x, end.y - c.y) + 1 : 0;
}

export function updateCusts(g: Game, dt: number): void {
  const S = g.S;
  for (const c of g.custs) {
    c.t += dt;
    if (c.bt > 0) {
      c.bt -= dt;
      if (c.bt <= 0) c.bub = null;
    }
    if (c.st === 'browse') {
      c.mv = false;
      c.bw -= dt;
      if (c.bw <= 0) decide(g, c);
      continue;
    }
    let tx = c.tx, ty = c.ty;
    if (c.st === 'toq' || c.st === 'wait') {
      if (c.st === 'toq' && g.queue.indexOf(c) < 0) g.queue.push(c);
      const p = qpos(g, c);
      tx = p.x;
      ty = p.y;
    }
    if (c.st === 'leave') {
      if (c.ex == null) {
        c.ex = 358 + (rand() < 0.5 ? -1 : 1) * (380 + rnd(220));
        c.ey = streetY(588 + rnd(18));
      }
      tx = c.ex;
      ty = c.ey!;
    }
    const d = moveTo(g, c, tx, ty, dt);
    if (c.st === 'in' && d <= 3) {
      c.st = 'browse';
      c.bw = 1.4 + rand() * 1.6;
    }
    if (c.st === 'toq' && d <= 4) c.st = 'wait';
    if (c.st === 'wait') {
      // Ya está en su sitio de la cola: se coloca exactamente
      const p = qpos(g, c);
      if (!c.mv) {
        c.x = p.x;
        c.y = p.y;
      }
      c.wt += dt;
      if (c.wt > c.pat) {
        say(c, '😠');
        leave(g, c, true);
      } else if (front(g) === c && c.hold && S.staff.cashier) {
        c.paid += dt;
        if (c.paid > 1.6) {
          pay(g, c);
          g.fx.sound('coin');
        }
      }
    }
  }
  g.custs = g.custs.filter((c) => !(c.st === 'leave' && c.ex != null && !c.path.length && Math.hypot(c.x - c.ex, c.y - c.ey!) < 4));
}

/** ¿Queda alguien dentro de la tienda o yéndose? (para cerrar el día) */
export const anyoneInside = (g: Game): boolean => g.custs.some((c) => c.st !== 'leave' || c.y < SIDEWALK.y0);
