import { clamp, pick, r05, rand } from '../core/rng';
import type { Game } from '../core/game';
import type { Card } from '../data/cards';
import { RORD, type Rarity } from '../data/rarity';
import { setDef, SETDEF } from '../data/sets';
import { price, rvr, slotCount } from './economy';

/* Sobres: probabilidades según la época del set, valor esperado y precios (v10) */

export interface EraCfg {
  id: 'wotc' | 'mid' | 'sv';
  C: number;
  U: number;
  rv: boolean;
  slot: [Rarity, number][];
  d: string;
}

const ERA: Record<EraCfg['id'], Omit<EraCfg, 'id'>> = {
  wotc: { C: 7, U: 3, rv: false, slot: [['DR', 0.33], ['R', 0.67]], d: 'Época clásica (1999–2002): 11 cartas y 1 holo de cada 3 sobres.' },
  mid: { C: 5, U: 3, rv: true, slot: [['HR', 0.025], ['IR', 0.02], ['UR', 0.1], ['DR', 0.3], ['R', 0.555]], d: '2003–2022: reverse en cada sobre, holo 1 de cada 3 y ultra rara ~1 de cada 10.' },
  sv: { C: 5, U: 3, rv: true, slot: [['HR', 0.007], ['UR', 0.02], ['SIR', 0.018], ['IR', 0.06], ['DR', 0.18], ['R', 0.715]], d: 'Escarlata y Púrpura: ilustraciones especiales, hyper raras y doble raras.' },
};

export function eraCfg(sid: string): EraCfg {
  const sd = setDef(sid), y = sd?.year || 2023;
  const e: EraCfg['id'] = y < 2003 ? 'wotc' : y < 2023 ? 'mid' : 'sv';
  const c: EraCfg = { id: e, ...ERA[e] };
  if (e === 'wotc' && /e-card/i.test(sd?.series || '')) c.rv = true;
  return c;
}

/** Cartas de esa rareza en el set, o de la siguiente más baja que exista */
export function poolR(g: Game, sid: string, r: Rarity): Card[] {
  for (let i = RORD.indexOf(r); i < RORD.length; i++) {
    const l = g.db.bySR[sid + RORD[i]];
    if (l?.length) return l;
  }
  return g.db.byS[sid] || [];
}

const avgL = (g: Game, l: Card[]): number => (l.length ? l.reduce((a, c) => a + price(g, c.id), 0) / l.length : 0);

export function rvPool(g: Game, sid: string): Card[] {
  const l = (['C', 'U', 'R'] as Rarity[]).flatMap((x) => g.db.bySR[sid + x] || []);
  return l.length ? l : g.db.byS[sid] || [];
}

const rvAvg = (g: Game, sid: string): number => {
  const l = rvPool(g, sid);
  return l.length ? l.reduce((a, c) => a + price(g, c.id) * rvr(c), 0) / l.length : 0;
};

/** Valor esperado de un sobre */
export function calcEV(g: Game, sid: string): number {
  const e = eraCfg(sid);
  let v = e.C * avgL(g, poolR(g, sid, 'C')) + e.U * avgL(g, poolR(g, sid, 'U'));
  if (e.rv) v += rvAvg(g, sid);
  e.slot.forEach(([r, p]) => (v += p * avgL(g, poolR(g, sid, r))));
  return v;
}

/** Recalcula el precio mayorista de los sobres siguiendo su valor esperado (solo con precios reales) */
export function refreshPacks(g: Game, first = false): void {
  g.sets.forEach((sd) => {
    const s = sd.id;
    g.evc[s] = calcEV(g, s);
    if (g.mode === 'real') {
      const hi = sd.year >= 2020 ? 7 : sd.year >= 2010 ? 14 : sd.year >= 2003 ? 60 : 400;
      const t = clamp(r05(g.evc[s] * 1.12), 3, hi);
      const P = g.S.pack[s];
      P.w = first ? t : r05(P.w * 0.7 + t * 0.3);
      P.init = 1;
      P.ref = r05(P.w * 1.3);
    }
  });
}

/** Cartas de un sobre */
export function roll(g: Game, sid: string): { c: Card; rv: boolean }[] {
  const e = eraCfg(sid), out: { c: Card; rv: boolean }[] = [];
  for (let i = 0; i < e.C; i++) out.push({ c: pick(poolR(g, sid, 'C')), rv: false });
  for (let i = 0; i < e.U; i++) out.push({ c: pick(poolR(g, sid, 'U')), rv: false });
  if (e.rv) out.push({ c: pick(rvPool(g, sid)), rv: true });
  let r = rand(), sl: Rarity = 'R';
  for (const [k, p] of e.slot) {
    if (r < p) {
      sl = k;
      break;
    }
    r -= p;
  }
  out.push({ c: pick(poolR(g, sid, sl)), rv: false });
  return out;
}

/** Sets activos que tienen cartas cargadas */
export function syncSets(g: Game): void {
  g.sets = g.S.sets.map((id) => SETDEF.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => !!d && !!g.db.byS[d.id]);
}

/** Coloca en las estanterías libres los sets con sobres en stock */
export function assignSlots(g: Game): void {
  const S = g.S, n = slotCount(S);
  S.slots = (S.slots || []).slice(0, n);
  while (S.slots.length < n) S.slots.push(null);
  g.sets.forEach((sd) => {
    if (S.sealed[sd.id] > 0 && !S.slots.includes(sd.id)) {
      const i = S.slots.indexOf(null);
      if (i >= 0) S.slots[i] = sd.id;
    }
  });
}
