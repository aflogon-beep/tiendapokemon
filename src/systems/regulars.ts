import { clamp, pick, wpick } from '../core/rng';
import type { Game } from '../core/game';
import type { RegState, State } from '../core/state';

/* Clientes habituales (v10) */

export interface Regular {
  id: string;
  n: string;
  e: string;
  t: string;
  col: string;
  skin: string;
  hair: string;
  d: string;
  acc?: boolean;
}

export const REGS: Regular[] = [
  { id: 'lucia', n: 'Lucía', e: '👩', t: 'collector', col: '#2fa557', skin: '#f2c9a0', hair: '#6b3a1e', d: 'Coleccionista de ilustraciones raras.' },
  { id: 'iker', n: 'Iker', e: '🧒', t: 'kid', col: '#4a90d9', skin: '#e0a878', hair: '#222', d: 'Se gasta la paga en sobres.' },
  { id: 'marcos', n: 'Marcos', e: '🧑‍💼', t: 'investor', col: '#3d4257', skin: '#f2c9a0', hair: '#111', d: 'Invierte en cajas y cartas top.' },
  { id: 'aitana', n: 'Aitana', e: '🤑', t: 'whale', col: '#d0a52a', skin: '#a9714b', hair: '#2a1a0a', d: 'Gasta a lo grande.' },
  { id: 'hugo', n: 'Hugo', e: '🎮', t: 'collector', col: '#8e4cb5', skin: '#f2c9a0', hair: '#c47a45', d: 'Jugador competitivo: fundas, tapetes y cartas.', acc: true },
  { id: 'paco', n: 'Don Paco', e: '👴', t: 'lot', col: '#8a5a2b', skin: '#f2c9a0', hair: '#ddd', d: 'Vende colecciones de toda la vida.' },
  { id: 'rafa', n: 'Rafa', e: '🕶️', t: 'seller', col: '#3a3a3a', skin: '#e0a878', hair: '#111', d: 'Siempre trae «chollos»… ojo con él.' },
];

export const RG = (id: string): Regular => REGS.find((r) => r.id === id)!;

export function regS(S: State, id: string): RegState {
  return S.regs[id] || (S.regs[id] = { loy: 30, visits: 0, note: '', met: false, fav: pick(S.sets) });
}

/** Cambia la lealtad de un habitual; si sube y está en la tienda, corazones */
export function loy(g: Game, id: string | null | undefined, d: number, note?: string): void {
  if (!id) return;
  const r = regS(g.S, id);
  r.loy = clamp(r.loy + d, 0, 100);
  if (note) r.note = note;
  if (d > 0) {
    const c = g.custs.find((x) => x.reg === id);
    if (c) g.fx.hearts(c, Math.min(4, Math.ceil(d / 3)));
  }
}

export const hearts = (l: number): string => {
  const n = Math.round(l / 20);
  return '❤️'.repeat(n) + '🤍'.repeat(5 - n);
};

export function pickReg(g: Game): string | null {
  const S = g.S, here = new Set(g.custs.map((c) => c.reg).filter(Boolean)), w: Record<string, number> = {};
  REGS.forEach((r) => {
    if (here.has(r.id)) return;
    const s = regS(S, r.id);
    if (s.loy < 5) return;
    if (r.t === 'lot' && (S.day < 2 || g.custs.some((c) => c.type === 'lot'))) return;
    w[r.id] = 0.5 + s.loy / 50;
  });
  return Object.keys(w).length ? wpick(w) : null;
}
