import { describe, expect, it } from 'vitest';
import { testGame } from './helpers';
import { stockForTest } from '../src/core/sandbox';
import { initPrice, itemVal, level, netWorth, step } from '../src/systems/economy';
import { eraCfg, roll, poolR } from '../src/systems/packs';
import { decide, front, pay, qpos, spawn, type Customer } from '../src/systems/customers';
import { endDay, openShop, tickDay } from '../src/systems/day';
import { obstacles, type Rect } from '../src/systems/layout';
import { CHAR_RADIUS } from '../src/systems/shopNav';
import { mkSetDef, resetSets } from '../src/data/sets';

describe('economía', () => {
  it('los precios evolucionan sin bajar de 0,02 € y guardan 60 días', () => {
    const p = { p: 0.03, t: -0.5, b: 0.03, h: [] as number[] };
    for (let i = 0; i < 200; i++) step(p, 1.3);
    expect(p.p).toBeGreaterThanOrEqual(0.02);
    expect(p.h).toHaveLength(60);
  });

  it('el historial inicial termina en el precio de Cardmarket', () => {
    const p = initPrice({ id: 'x', s: 'mew', name: 'x', num: null, r: 'SIR', img: null, b: 50, rv: null, seed: [40, 45, 49] });
    expect(p.h).toHaveLength(30);
    expect(p.h[29]).toBe(50);
  });

  it('una partida nueva empieza con 1000 € en el nivel 1', () => {
    const g = testGame();
    expect(g.S.money).toBe(1000);
    expect(level(g)).toBe(1);
    expect(netWorth(g)).toBe(1000);
  });

  it('el valor de una carta depende del estado', () => {
    const g = testGame();
    const c = g.db.cards.find((x) => x.r === 'SIR')!;
    const nm = itemVal(g, { i: 1, c: c.id, k: 'NM', rv: false, cost: 0, case: null, res: false });
    const mp = itemVal(g, { i: 2, c: c.id, k: 'MP', rv: false, cost: 0, case: null, res: false });
    expect(mp / nm).toBeCloseTo(0.7);
  });
});

describe('sobres', () => {
  it('la época del set decide las cartas del sobre', () => {
    resetSets();
    mkSetDef({ id: 'base1', name: 'Base', releaseDate: '1999/01/09' });
    mkSetDef({ id: 'swsh7', name: 'Evolving Skies', releaseDate: '2021/08/27' });
    expect(eraCfg('base1').id).toBe('wotc');
    expect(eraCfg('swsh7').id).toBe('mid');
    expect(eraCfg('mew').id).toBe('sv');
  });

  it('un sobre de Escarlata y Púrpura trae 10 cartas con 1 reverse', () => {
    const g = testGame();
    const p = roll(g, 'mew');
    expect(p).toHaveLength(10);
    expect(p.filter((x) => x.rv)).toHaveLength(1);
    expect(p.every((x) => x.c.s === 'mew')).toBe(true);
  });

  it('si falta una rareza, usa la siguiente más baja', () => {
    const g = testGame();
    expect(poolR(g, 'obf', 'HR').every((c) => c.r === 'HR')).toBe(true);
    expect(poolR(g, 'mew', 'UR')[0].r).toBe('UR');
  });
});

describe('clientes', () => {
  const atShelf = (g: ReturnType<typeof testGame>, c: Customer) => {
    c.st = 'browse';
    decide(g, c);
  };

  it('compra un sobre si el precio es razonable', () => {
    const g = testGame();
    stockForTest(g);
    const c = spawn(g);
    c.type = 'kid';
    c.want = { k: 'pack', s: 'mew' };
    g.S.shelf.mew = Math.round(g.S.pack.mew.ref * 0.8 * 20) / 20;
    const before = g.S.sealed.mew;
    atShelf(g, c);
    expect(c.st).toBe('toq');
    expect(g.S.sealed.mew).toBe(before - 1);
    expect(c.hold?.total).toBe(g.S.shelf.mew);
  });

  it('se va enfadado si el sobre está muy caro', () => {
    const g = testGame();
    stockForTest(g);
    g.S.shelf.mew = 999;
    const c = spawn(g);
    c.type = 'collector';
    c.want = { k: 'pack', s: 'mew' };
    atShelf(g, c);
    expect(c.st).toBe('leave');
    expect(c.bub).toBe('💸 Muy caro');
    expect(g.S.stats.lost).toBe(1);
  });

  it('con la vitrina vacía se va', () => {
    const g = testGame();
    g.S.tut.on = false;
    const c = spawn(g);
    c.want = { k: 'single' };
    atShelf(g, c);
    expect(c.bub).toBe('😕 Vitrina vacía');
  });

  it('cobrar suma el dinero y quita la carta vendida', () => {
    const g = testGame();
    stockForTest(g);
    const c = spawn(g);
    c.type = 'whale';
    c.want = { k: 'single' };
    atShelf(g, c);
    expect(c.hold?.k).toBe('single');
    const money = g.S.money, n = g.S.items.length, total = c.hold!.total;
    pay(g, c);
    expect(g.S.money).toBeCloseTo(money + total);
    expect(g.S.items).toHaveLength(n - 1);
    expect(g.S.lt.served).toBe(1);
    expect(c.st).toBe('leave');
  });

  it('la cola se forma hacia abajo desde la caja', () => {
    const g = testGame();
    const a = spawn(g), b = spawn(g);
    g.queue.push(a, b);
    expect(qpos(g, a)).toEqual({ x: 622, y: 262 });
    expect(qpos(g, b)).toEqual({ x: 622, y: 294 });
  });
});

describe('un día completo', () => {
  const distToRect = (x: number, y: number, r: Rect) =>
    Math.hypot(Math.max(r.x - x, 0, x - r.x - r.w), Math.max(r.y - y, 0, y - r.y - r.h));

  it('abre, llegan clientes, se les cobra y cierra con el ticket', () => {
    const g = testGame(7);
    stockForTest(g);
    const money0 = g.S.money;
    let summaries = 0, served = 0, clipped = 0;
    g.fx = { ...g.fx, daySummary: () => summaries++ };
    openShop(g);
    expect(g.S.phase).toBe('open');
    for (let t = 0; t < 400 && summaries === 0; t += 0.05) {
      tickDay(g, 0.05);
      const f = front(g);
      if (f && f.hold) {
        pay(g, f);
        served++;
      } else if (f) {
        f.st = 'leave';
        g.queue.shift();
      }
      // Nadie atraviesa los muebles
      for (const c of g.custs) if (obstacles().some((o) => distToRect(c.x, c.y, o) < CHAR_RADIUS - 8)) clipped++;
    }
    expect(summaries).toBe(1);
    expect(g.S.day).toBe(2);
    expect(g.S.phase).toBe('closed');
    expect(g.S.summary?.cust).toBeGreaterThan(5);
    expect(served).toBeGreaterThan(0);
    // Los que quedan ya han salido y se alejan por la acera
    expect(g.custs.every((c) => c.st === 'leave' && c.y >= 608)).toBe(true);
    expect(clipped).toBe(0);
    // Ingresos menos alquiler
    expect(g.S.money).toBeCloseTo(money0 + g.S.summary!.inc - 15, 5);
  });

  it('al acabar el día cobra alquiler y sueldos y prepara el siguiente', () => {
    const g = testGame();
    g.S.staff.cashier = true;
    g.S.phase = 'open';
    const m = g.S.money;
    endDay(g);
    expect(g.S.money).toBeCloseTo(m - 15 - 20);
    expect(g.S.day).toBe(2);
    expect(g.S.dm?.day).toBe(2);
    expect(g.S.hist).toHaveLength(1);
  });

  it('con cajero/a se cobra solo', () => {
    const g = testGame(3);
    stockForTest(g);
    g.S.staff.cashier = true;
    openShop(g);
    for (let t = 0; t < 120; t += 0.05) tickDay(g, 0.05);
    expect(g.S.lt.served).toBeGreaterThan(0);
  });
});
