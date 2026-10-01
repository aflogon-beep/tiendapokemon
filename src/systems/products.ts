import { r05, wpick } from '../core/rng';
import type { State } from '../core/state';
import { setCol, setName } from '../data/sets';

/* Productos sellados (cajas, ETB, latas, colecciones) y accesorios (v10) */

export const PTYPES: Record<string, { n: string; ic: string; packs: number; f: number }> = {
  box: { n: 'Caja de 36 sobres', ic: '🗃️', packs: 36, f: 0.85 },
  etb: { n: 'Elite Trainer Box', ic: '🎁', packs: 9, f: 1.35 },
  tin: { n: 'Lata', ic: '🥫', packs: 4, f: 1.2 },
  col: { n: 'Colección premium', ic: '💎', packs: 6, f: 1.45 },
};

export const ACC = [
  { id: 'sleeves', n: 'Fundas (65 u.)', ic: '🛡️', w: 2.2, r: 4.95, col: '#3f7fc4' },
  { id: 'toploader', n: 'Toploaders (25 u.)', ic: '🧊', w: 1.6, r: 3.95, col: '#9ad7e8' },
  { id: 'deckbox', n: 'Caja de mazo', ic: '📦', w: 1.8, r: 4.5, col: '#d9402a' },
  { id: 'dice', n: 'Dados y marcadores', ic: '🎲', w: 1.2, r: 3.5, col: '#f2b705' },
  { id: 'playmat', n: 'Tapete de juego', ic: '🟩', w: 7, r: 16.95, col: '#2fa557' },
  { id: 'binder', n: 'Carpeta de 9 bolsillos', ic: '📒', w: 8, r: 17.95, col: '#2f2f38' },
];

export interface ProdInfo {
  t: string;
  s?: string;
  n: string;
  ic: string;
  /** Precio mayorista */
  w: number;
  /** Precio que aceptan los clientes */
  ref: number;
  col: string;
  packs?: number;
}

/** pid = "acc:sleeves" o "<tipo>:<set>", p. ej. "etb:mew" */
export function pInfo(S: State, pid: string): ProdInfo | null {
  const [t, x] = pid.split(':');
  if (t === 'acc') {
    const a = ACC.find((y) => y.id === x);
    return a ? { t, n: a.n, ic: a.ic, w: a.w, ref: a.r, col: a.col } : null;
  }
  const P = PTYPES[t];
  if (!P || !S.pack[x]) return null;
  const w = r05(S.pack[x].w * P.packs * P.f);
  return { t, s: x, n: P.n + ' · ' + setName(x), ic: P.ic, w, ref: r05(w * (t === 'box' ? 1.22 : 1.3)), col: setCol(x), packs: P.packs };
}

export const pStock = (S: State, pid: string): number => S.prod[pid] || 0;

export function pPrice(S: State, pid: string): number {
  if (S.pp[pid] == null) {
    const i = pInfo(S, pid);
    S.pp[pid] = i ? r05(i.ref) : 1;
  }
  return S.pp[pid];
}

export const prodValue = (S: State): number =>
  Object.keys(S.prod).reduce((a, pid) => {
    const i = pInfo(S, pid);
    return a + (i ? i.w * pStock(S, pid) : 0);
  }, 0);

const PPREF: Record<string, Record<string, number>> = {
  kid: { tin: 3, acc: 4 },
  collector: { etb: 3, acc: 2, col: 1, tin: 1 },
  investor: { box: 5, col: 1 },
  whale: { col: 3, etb: 3, box: 2 },
  player: { acc: 5, etb: 1 },
};

/** Producto que buscaría un cliente de ese tipo, según lo que hay en stock */
export function pickProd(S: State, type: string): string | null {
  const pf = PPREF[type] || { acc: 1 }, w: Record<string, number> = {};
  Object.keys(S.prod).forEach((pid) => {
    if (pStock(S, pid) < 1) return;
    const i = pInfo(S, pid);
    if (!i) return;
    const v = pf[i.t] || 0;
    if (v) w[pid] = v;
  });
  return Object.keys(w).length ? wpick(w) : null;
}
