import { pick, r05, rand, wpick } from '../core/rng';
import type { Game } from '../core/game';
import type { Customer } from './customers';
import { pay } from './customers';
import { track } from './missions';
import { loy, regS } from './regulars';

/* Caja (v10): el cliente paga en efectivo (hay que dar el cambio) o con tarjeta (se teclea en el TPV) */

/** Billete o importe con el que paga (en céntimos): a veces justo, si no el billete redondo siguiente */
export function payWith(tc: number): number {
  if (rand() < 0.15) return tc;
  const cands = [500, 1000, 2000, 5000, 10000]
    .map((u) => Math.ceil(tc / u) * u)
    .filter((v, i, a) => v >= tc && a.indexOf(v) === i && v - tc < 10000)
    .sort((a, b) => a - b);
  const w = [6, 3, 1.4, 0.6, 0.3], o: Record<string, number> = {};
  cands.forEach((_, i) => (o[i] = w[i] || 0.2));
  return cands[+wpick(o)];
}

export interface Checkout {
  c: Customer;
  /** Total en céntimos */
  tc: number;
  m: 'cash' | 'card';
  /** Efectivo: lo que entrega el cliente */
  paid: number;
  /** Cambio que vamos dando */
  given: number[];
  /** TPV: lo tecleado */
  typed: string;
  st: 'pay' | 'tap' | 'ok';
  msg: string;
  say: string;
  err?: number;
}

export function startCheckout(c: Customer): Checkout {
  const tc = Math.round(c.hold!.total * 100);
  const card = rand() < (c.type === 'whale' ? 0.7 : c.type === 'kid' ? 0.12 : c.type === 'investor' ? 0.6 : 0.42);
  const k: Checkout = { c, tc, m: card ? 'card' : 'cash', paid: tc, given: [], typed: '', st: 'pay', msg: '', say: '' };
  if (card) k.say = pick(['Con tarjeta, porfa 💳', '¿Aceptas tarjeta?', 'Pago con el móvil 📱']);
  else {
    k.paid = payWith(tc);
    k.say = k.paid === tc ? 'Te lo doy justo 👌' : pick(['Aquí tienes 💶', 'Tome, cóbrese', '¿Tienes cambio?']);
  }
  return k;
}

export const DENOMS = [[5000, 2000, 1000, 500], [200, 100, 50, 20], [10, 5, 2, 1]];

export type GiveResult = { ok: false; missing: number } | { ok: true; extra: number; tip: number };

/** Entregar el cambio: si falta, el cliente protesta; si es exacto, a veces deja propina */
export function giveChange(g: Game, k: Checkout): GiveResult {
  const due = k.paid - k.tc, giv = k.given.reduce((a, b) => a + b, 0);
  if (giv < due) return { ok: false, missing: due - giv };
  let tip = 0;
  if (giv === due && due > 0) {
    track(g, 'exact');
    loy(g, k.c.reg, 2);
    if (rand() < (k.c.reg && regS(g.S, k.c.reg).loy > 60 ? 0.35 : 0.12)) tip = Math.max(0.2, r05((k.tc / 100) * 0.05));
  }
  return { ok: true, extra: giv - due, tip };
}

/** Cobra lo recibido de verdad (con cambio de más o de menos, o propina) */
export function finishCheckout(g: Game, k: Checkout, recv: number): void {
  pay(g, k.c, recv);
}

/** TPV: teclear importe en céntimos */
export function tpvKey(k: Checkout, key: string): void {
  if (k.st !== 'pay') return;
  k.msg = '';
  if (key === 'C') k.typed = '';
  else if (key === '⌫') k.typed = k.typed.slice(0, -1);
  else if (k.typed.length < 7) k.typed = (k.typed + key).replace(/^0+/, '');
}

/** TPV: OK. Rechaza si se teclea más del total; si es menos, se cobra menos */
export function tpvOk(k: Checkout): 'empty' | 'rejected' | 'accepted' {
  const v = +k.typed || 0;
  if (k.st !== 'pay' || !v) return 'empty';
  if (v > k.tc) {
    k.err = 1;
    k.msg = 'IMPORTE RECHAZADO';
    k.say = '¡Eh! Eso es más de lo que cuesta 😒';
    k.typed = '';
    return 'rejected';
  }
  k.st = 'tap';
  k.msg = 'ACERQUE LA TARJETA';
  return 'accepted';
}
