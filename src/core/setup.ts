import { r05 } from './rng';
import { blankState, type State } from './state';
import { noFx, type Game, type GameFx, type Mode } from './game';
import { FAILED, fetchSetCards, indexCards, loadMany, type CardDB } from '../data/cards';
import { DEFAULT_SETS, setDef } from '../data/sets';
import { caseCap, initPrice } from '../systems/economy';
import { genMissions } from '../systems/missions';
import { genOrder } from '../systems/orders';
import { assignSlots, refreshPacks, syncSets } from '../systems/packs';
import { createShopNav } from '../systems/shopNav';

/** Contexto de partida a partir de un estado (cargado o nuevo) */
export function createGame(S: State, db: CardDB, mode: Mode, fx: GameFx = noFx): Game {
  const g: Game = {
    S, db, mode, fx,
    sets: [], evc: {}, custs: [], queue: [], cid: 0, spawnT: 3,
    nav: createShopNav(8), paused: false, speed: 1,
  };
  ensure(g);
  return g;
}

export function newGame(db: CardDB, mode: Mode, fx?: GameFx): Game {
  return createGame(blankState(DEFAULT_SETS), db, mode, fx);
}

/** Completa y repara el estado (ensure() de la v10): campos nuevos, precios, sobres, misiones… */
export function ensure(g: Game): void {
  const S = g.S;
  if (!S.dex) {
    S.dex = {};
    S.items.forEach((i) => (S.dex[i.c] = 1));
  }
  if (!S.sets) S.sets = DEFAULT_SETS.slice();
  if (!S.up.shelf) S.up.shelf = 0;
  syncSets(g);
  g.db.cards.forEach((c) => {
    if (!S.prices[c.id]) S.prices[c.id] = initPrice(c);
  });
  // Cartas de sets que no han cargado: se apartan (orph) y vuelven cuando cargan
  if (S.orph?.length) {
    S.items = S.items.concat(S.orph.filter((i) => g.db.byId[i.c]));
    S.orph = S.orph.filter((i) => !g.db.byId[i.c]);
  }
  {
    const o = S.items.filter((i) => !g.db.byId[i.c]);
    if (o.length) {
      S.orph = (S.orph || []).concat(o);
      S.items = S.items.filter((i) => g.db.byId[i.c]);
    }
  }
  if (!S.staff) S.staff = { cashier: !!S.up?.cashier, appraiser: false, cm: false };
  S.decor ||= {};
  S.prod ||= {};
  S.pp ||= {};
  S.regs ||= {};
  S.fkRet ||= [];
  S.repB ||= 0;
  S.lt ||= {};
  S.ach ||= {};
  S.albR ||= {};
  S.orders ||= [];
  S.grNew ||= [];
  S.stats ||= { inc: 0, cust: 0, lost: 0, bought: 0 };
  if (!S.tut) S.tut = { on: S.day <= 1 && !S.items.length && !Object.values(S.sealed || {}).some((v) => v > 0), i: 0 };
  if (S.ev === undefined) S.ev = null;
  if (!S.tour) S.tour = false;
  g.sets.forEach((sd) => {
    const s = sd.id;
    if (S.sealed[s] == null) S.sealed[s] = 0;
    if (!S.pack[s]) S.pack[s] = { w: sd.dp, ref: sd.dp * 1.3 };
    if (S.shelf[s] == null) S.shelf[s] = r05(S.pack[s].ref);
  });
  refreshPacks(g, true);
  assignSlots(g);
  S.orders = S.orders.filter((o) => g.db.byId[o.c]);
  if (!S.orders.length && S.day <= 1) genOrder(g);
  if (!S.dm || S.dm.day !== S.day) genMissions(g);
  // La vitrina crece con las mejoras: el camino de los clientes la rodea
  g.nav = createShopNav(caseCap(S), S.decor);
}

/** Carga las colecciones de una partida importada que aún no tenemos (loadSetsFor de la v10) */
export async function loadSetsFor(g: Game, ids: string[]): Promise<void> {
  const miss = (ids || []).filter((id) => !g.db.byS[id]).map((id) => setDef(id)).filter((d): d is NonNullable<typeof d> => !!d);
  if (!miss.length || g.mode !== 'real') return;
  const arr = await Promise.all(miss.map((sd) => fetchSetCards(sd).then((cs) => (cs.forEach((c) => (c.s = sd.id)), cs))));
  g.db = indexCards(g.db.cards.concat(...arr));
}

/** Sustituye la partida en curso (importar o empezar de cero) */
export function replaceState(g: Game, S: State): void {
  g.S = S;
  S.phase = 'closed';
  S.clock = 0;
  g.custs = [];
  g.queue = [];
  g.paused = false;
  ensure(g);
}

/** Vuelve a pedir las colecciones que fallaron al cargar (retrySets de la v10) */
export async function retrySets(g: Game): Promise<{ tried: number; left: number }> {
  const ids = [...FAILED];
  if (!ids.length) return { tried: 0, left: 0 };
  const cs = await loadMany(ids);
  g.db = indexCards(g.db.cards.filter((c) => !ids.includes(c.s)).concat(cs));
  ensure(g);
  return { tried: ids.length, left: FAILED.size };
}

/** Añade colecciones al catálogo cargando sus cartas de 3 en 3 (addSets de la v10) */
export async function addSets(g: Game, ids: string[], onProgress?: (done: number, total: number) => void): Promise<{ ok: number; total: number }> {
  ids = ids.filter((id) => !g.S.sets.includes(id) && setDef(id));
  if (!ids.length || g.mode !== 'real') return { ok: 0, total: ids.length };
  let done = 0, ok = 0;
  const q = ids.slice();
  let cards = g.db.cards;
  const work = async (): Promise<void> => {
    const id = q.shift();
    if (!id) return;
    const sd = setDef(id)!, cs = await fetchSetCards(sd);
    done++;
    if (cs.length) {
      cs.forEach((c) => (c.s = sd.id));
      cards = cards.filter((c) => c.s !== sd.id).concat(cs);
      g.S.sets.push(sd.id);
      ok++;
    }
    onProgress?.(done, ids.length);
    return work();
  };
  await Promise.all([work(), work(), work()]);
  g.db = indexCards(cards);
  ensure(g);
  return { ok, total: ids.length };
}

/** Quita un set del catálogo (solo si no tienes sobres ni cartas suyas) */
export function removeSet(g: Game, id: string): void {
  g.S.sets = g.S.sets.filter((x) => x !== id);
  g.S.slots = g.S.slots.map((x) => (x === id ? null : x));
  ensure(g);
}
