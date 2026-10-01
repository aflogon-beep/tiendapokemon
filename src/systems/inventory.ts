import { clamp } from '../core/rng';
import type { Game } from '../core/game';
import type { Item } from '../core/state';
import type { Card } from '../data/cards';
import { caseCap, caseItems, itemVal, price, rvr } from './economy';
import { GSVC, gk } from './grading';
import { track } from './missions';
import { assignSlots, roll } from './packs';
import { pInfo, pPrice, pStock } from './products';

/* Acciones de inventario de la v10 (A.buyp, A.open, A.buyprod, A.sell1, A.caseadd…) sin interfaz */

export type Result = { ok: true } | { ok: false; msg: string };
const NO_MONEY: Result = { ok: false, msg: 'No tienes dinero suficiente' };
const OK: Result = { ok: true };

/** Precio de comprar n sobres al mayorista (la caja de 36 tiene un 7 % de descuento) */
export const packCost = (g: Game, s: string, n: number): number => g.S.pack[s].w * n * (n >= 36 ? 0.93 : 1);

export function buyPacks(g: Game, s: string, n: number): Result {
  const c = packCost(g, s, n);
  if (g.S.money < c) return NO_MONEY;
  g.S.money -= c;
  g.S.sealed[s] += n;
  assignSlots(g);
  return OK;
}

/** Cambia el precio de los sobres en la estantería (mínimo 0,25 €) */
export function setShelfPrice(g: Game, s: string, delta: number): void {
  g.S.shelf[s] = Math.max(0.25, Math.round((g.S.shelf[s] + delta) * 100) / 100);
}

export interface Pulled {
  c: Card;
  rv: boolean;
  /** Primera vez que sale en la colección */
  nw: boolean;
}

export const pulledVal = (g: Game, x: { c: Card; rv: boolean }): number => price(g, x.c.id) * (x.rv ? rvr(x.c) : 1);

/** Abre n sobres: las cartas pasan al inventario */
export function openPacks(g: Game, s: string, n: number): { pulled: Pulled[]; val: number } | null {
  const S = g.S;
  n = Math.min(n, S.sealed[s]);
  if (n < 1) return null;
  S.dex ||= {};
  const had = new Set(S.items.map((i) => i.c)), pulled: Pulled[] = [], cpp = S.pack[s].w / 10;
  for (let i = 0; i < n; i++)
    roll(g, s).forEach((x) => {
      const nw = !had.has(x.c.id) && !S.dex[x.c.id];
      had.add(x.c.id);
      S.dex[x.c.id] = 1;
      S.items.push({ i: S.nid++, c: x.c.id, k: 'NM', rv: x.rv, cost: cpp, case: null, res: false });
      pulled.push({ ...x, nw });
    });
  S.sealed[s] -= n;
  track(g, 'open', n);
  if (pulled.some((x) => x.c.r === 'SIR' || x.c.r === 'HR')) track(g, 'bighit');
  return { pulled, val: pulled.reduce((a, x) => a + pulledVal(g, x), 0) };
}

/* --- productos sellados y accesorios --- */

export function buyProd(g: Game, pid: string, n: number): Result {
  const i = pInfo(g.S, pid);
  if (!i) return { ok: false, msg: 'Producto no disponible' };
  const c = i.w * n;
  if (g.S.money < c) return NO_MONEY;
  g.S.money -= c;
  g.S.prod[pid] = pStock(g.S, pid) + n;
  g.S.prodSeen = true;
  return OK;
}

export function setProdPrice(g: Game, pid: string, delta: number): void {
  g.S.pp[pid] = Math.max(0.25, Math.round((pPrice(g.S, pid) + delta) * 100) / 100);
}

/** Abre una caja/ETB/lata: sus sobres pasan al stock */
export function openProd(g: Game, pid: string): number {
  const i = pInfo(g.S, pid);
  if (!i?.packs || !i.s || pStock(g.S, pid) < 1) return 0;
  g.S.prod[pid]--;
  g.S.sealed[i.s] += i.packs;
  assignSlots(g);
  return i.packs;
}

/* --- colección --- */

export interface Group {
  key: string;
  c: Card;
  k: Item['k'];
  rv: boolean;
  its: Item[];
}

/** Ejemplares iguales agrupados, de más a menos valor total */
export function groups(g: Game): Group[] {
  const out: Record<string, Group> = {};
  g.S.items.forEach((it) => {
    const k = gk(it);
    (out[k] ??= { key: k, c: g.db.byId[it.c], k: it.k, rv: it.rv, its: [] }).its.push(it);
  });
  return Object.values(out).sort((a, b) => itemVal(g, b.its[0]) * b.its.length - itemVal(g, a.its[0]) * a.its.length);
}

export const groupItems = (g: Game, key: string): Item[] => g.S.items.filter((i) => gk(i) === key);

/** Vende al mayorista (85 % del mercado). Las falsas no se pagan. Devuelve lo cobrado y cuántas eran falsas. */
export function sellToDealer(g: Game, key: string, all: boolean): { got: number; fakes: number } {
  const S = g.S;
  const l = groupItems(g, key).filter((i) => !i.res && !i.gq);
  const sel = all ? l : l.slice(0, 1);
  let got = 0, fakes = 0;
  const ids = new Set(sel.map((i) => i.i));
  sel.forEach((i) => {
    if (i.fk && !(all ? false : i.fkK)) fakes++;
    else got += itemVal(g, i) * 0.85;
  });
  S.items = S.items.filter((i) => !ids.has(i.i));
  S.money += got;
  return { got, fakes };
}

export function caseAdd(g: Game, key: string): boolean {
  if (caseItems(g.S).length >= caseCap(g.S)) return false;
  const l = groupItems(g, key), it = l.find((i) => i.case == null && !i.gq && !i.fkK);
  if (!it) return false;
  const inc = l.find((i) => i.case != null);
  it.case = inc ? inc.case : 1.1;
  return true;
}

export function caseRemove(g: Game, key: string): void {
  const it = groupItems(g, key).find((i) => i.case != null && !i.res && !i.lux);
  if (it) it.case = null;
}

/** Margen de la vitrina: entre el 60 % y el 160 % del mercado */
export function caseMarkup(g: Game, key: string, delta: number): void {
  groupItems(g, key).forEach((i) => {
    if (i.case != null) i.case = clamp(Math.round((i.case + delta) * 100) / 100, 0.6, 1.6);
  });
}

/* --- peanas de lujo --- */
export const luxItems = (g: Game): Item[] => g.S.items.filter((i) => i.lux && i.case != null);

export function luxAdd(g: Game, key: string): boolean {
  if (luxItems(g).length >= 3) return false;
  const it = groupItems(g, key).find((i) => !i.lux && !i.gq && !i.fkK && !i.res);
  if (!it) return false;
  it.lux = true;
  if (it.case == null) it.case = 1.2;
  return true;
}

export function luxRemove(g: Game, key: string): void {
  const it = groupItems(g, key).find((i) => i.lux && !i.res);
  if (it) {
    it.lux = false;
    it.case = null;
  }
}

/* --- gradeo --- */
export function sendToGrade(g: Game, key: string, svc: keyof typeof GSVC): Result {
  const sv = GSVC[svc];
  if (g.S.money < sv.cost) return NO_MONEY;
  const l = groupItems(g, key).filter((i) => !i.res && !i.gq && !i.gr), it = l.find((i) => i.case == null) || l[0];
  if (!it) return { ok: false, msg: 'No hay ninguna para gradear' };
  it.case = null;
  it.gq = { due: g.S.day + sv.days, svc };
  g.S.money -= sv.cost;
  return OK;
}
