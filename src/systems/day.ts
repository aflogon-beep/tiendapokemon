import { pick, rand, rnd } from '../core/rng';
import type { Game } from '../core/game';
import { anyoneInside, LAUNCH_Q, launchSpot, spawn, updateCusts } from './customers';
import { DAYLEN, netWorth, RENT, repv, spMul, STAFF, step, VOL } from './economy';
import { rollGrade } from './grading';
import { checkAch } from './achievements';
import { genMissions, track } from './missions';
import { genOrder } from './orders';
import { assignSlots, refreshPacks } from './packs';
import { loy } from './regulars';

/* El día en la tienda (v10): abrir, clientes, cierre y ticket del día */

const CLOSE_DELAY = 1.4; // segundos entre que sale el último cliente y se baja la persiana

export interface DayTimers {
  /** Cuenta atrás para cerrar cuando la tienda se ha vaciado */
  endIn: number | null;
  /** Clientes de la cola de lanzamiento que faltan por entrar */
  lq: number;
  lqT: number;
}

export const dayTimers = new WeakMap<Game, DayTimers>();
const timers = (g: Game): DayTimers => {
  let t = dayTimers.get(g);
  if (!t) dayTimers.set(g, (t = { endIn: null, lq: 0, lqT: 0 }));
  return t;
};

export function openShop(g: Game): void {
  const S = g.S;
  if (S.phase !== 'closed') return;
  g.fx.sound('shutter');
  S.phase = 'open';
  S.clock = 0;
  g.spawnT = 1;
  // Día de lanzamiento: entra la cola que esperaba en la acera (en lugar de la ráfaga de 6)
  const launch = S.ev?.t === 'launch';
  S.burst = 0;
  const t = timers(g);
  t.lq = launch ? LAUNCH_Q : 0;
  t.lqT = 0.25;
  if (launch) g.fx.shake(5);
  S.vipDone = false;
  S.stats = { inc: 0, cust: 0, lost: 0, bought: 0 };
}

/** Avanza el día `dt` segundos de juego (ya multiplicados por la velocidad) */
export function tickDay(g: Game, dt: number): void {
  const S = g.S;
  if (S.phase === 'open') {
    S.clock += dt;
    const t = timers(g);
    if (t.lq > 0 && (t.lqT -= dt) <= 0) {
      const c = spawn(g), p = launchSpot(LAUNCH_Q - t.lq);
      c.x = p.x;
      c.y = p.y;
      t.lq--;
      t.lqT = 0.26;
    }
    g.spawnT -= dt;
    if (g.spawnT <= 0) {
      spawn(g);
      if ((S.burst ?? 0) > 0) {
        S.burst!--;
        g.spawnT = 0.8;
      } else {
        const base = 5.5 / (1 + repv(S) * 0.03) / (1 + S.up.ads * 0.3) / spMul(S);
        g.spawnT = base * (0.6 + rand() * 0.8);
      }
    }
    if (S.clock >= DAYLEN) S.phase = 'closing';
  }
  updateCusts(g, dt);
  if (S.phase === 'closing' && !anyoneInside(g)) {
    const t = timers(g);
    if (t.endIn == null) {
      t.endIn = CLOSE_DELAY;
      g.fx.sound('shutter');
    } else if ((t.endIn -= dt) <= 0) {
      t.endIn = null;
      endDay(g);
    }
  }
}

export function endDay(g: Game): void {
  const S = g.S, rent = RENT;
  S.money -= rent;
  const sal = STAFF.reduce((a, x) => a + (S.staff[x.k] ? x.sal : 0), 0);
  S.money -= sal;
  let tourInc: number | null = null;
  if (S.tour) {
    const pl = 8 + rnd(10);
    tourInc = pl * 5 - 40;
    S.money += tourInc;
    S.repB += 2;
    track(g, 'tour');
  }
  if (S.staff.cm) S.repB += 1;
  Object.keys(S.prices).forEach((id) => step(S.prices[id], VOL[g.db.byId[id]?.r] || 0.5));
  // Noticias: a veces un set sube o baja
  let news = '';
  if (rand() < 0.08 && g.sets.length) {
    const sd = pick(g.sets), up = rand() < 0.5, m = up ? 1.06 + rand() * 0.1 : 0.86 + rand() * 0.08;
    g.db.cards.forEach((c) => {
      if (c.s === sd.id && ['DR', 'IR', 'UR', 'SIR', 'HR'].includes(c.r)) S.prices[c.id].p *= m;
    });
    news = up ? `📰 Un torneo popular impulsa ${sd.n}: las cartas raras suben.` : `📰 Reimpresión anunciada de ${sd.n}: las cartas raras bajan.`;
  }
  refreshPacks(g);
  S.slots = S.slots.map((id) => (id && S.sealed[id] > 0 ? id : null));
  assignSlots(g);
  const st = S.stats;
  S.hist = (S.hist || []).concat([{ d: S.day, inc: Math.round(st.inc * 100) / 100 }]).slice(-14);
  S.day++;
  // Gradeos que vuelven (las falsas vuelven marcadas)
  let grN = 0, fkN = 0;
  S.items.forEach((i) => {
    if (i.gq && i.gq.due <= S.day) {
      if (i.fk) {
        delete i.gq;
        i.fkK = true;
        fkN++;
        return;
      }
      i.gr = rollGrade(i.k);
      delete i.gq;
      S.grNew.push(i.i);
      grN++;
      if (i.gr === 10) track(g, 'gem');
    }
  });
  const nOrd = S.orders.length;
  S.orders = S.orders.filter((o) => o.due >= S.day);
  const exp = nOrd - S.orders.length;
  let newOrd = false;
  if (S.orders.length < 3 && rand() < 0.6) {
    genOrder(g);
    newOrd = true;
  }
  // Cartas falsas vendidas: algunos clientes vuelven a reclamar
  let refund = 0, refN = 0;
  S.fkRet.forEach((x) => {
    if (rand() < 0.45) {
      refund += x.got;
      refN++;
      S.repB = Math.max(0, S.repB - 3);
      loy(g, x.reg, -25, 'Le vendiste una carta falsa');
    }
  });
  S.money -= refund;
  S.fkRet = [];
  S.ev = null;
  S.tour = false;
  S.vipDone = false;
  if (S.day % 7 === 0 && S.sets.length) S.ev = { t: 'launch', s: pick(S.sets) };
  else {
    const r = rand();
    if (r < 0.12) S.ev = { t: 'rain' };
    else if (r < 0.22) S.ev = { t: 'vip' };
  }
  genMissions(g);
  S.summary = { day: S.day - 1, inc: st.inc, cust: st.cust, lost: st.lost, bought: st.bought, rent, sal, tourInc, news, net: netWorth(g), grN, newOrd, exp, fkN, refund, refN };
  S.phase = 'closed';
  S.clock = 0;
  S.stats = { inc: 0, cust: 0, lost: 0, bought: 0 };
  checkAch(g);
  g.fx.sound('print');
  g.fx.daySummary();
}
