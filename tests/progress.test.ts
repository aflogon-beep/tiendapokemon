import { describe, expect, it } from 'vitest';
import { testGame } from './helpers';
import { buyDecor, buyUpgrade, toggleStaff, toggleTour } from '../src/systems/upgrades';
import { caseCap, slotCount, spMul } from '../src/systems/economy';
import { claimMission, track } from '../src/systems/missions';
import { deliverOrder } from '../src/systems/orders';
import { claimAlbum } from '../src/systems/achievements';
import { endDay } from '../src/systems/day';

describe('mejoras', () => {
  it('la vitrina grande pasa de 8 a 16 cartas y no se compra dos veces', () => {
    const g = testGame();
    expect(buyUpgrade(g, 'case')).toBe(true);
    expect(caseCap(g.S)).toBe(16);
    expect(buyUpgrade(g, 'case')).toBe(false);
    expect(g.S.money).toBe(500);
  });

  it('la segunda fila da 6 huecos de estantería', () => {
    const g = testGame();
    buyUpgrade(g, 'shelf');
    expect(slotCount(g.S)).toBe(6);
    expect(g.S.slots).toHaveLength(6);
  });

  it('la decoración sube la llegada de clientes', () => {
    const g = testGame(), before = spMul(g.S);
    expect(buyDecor(g, 'neon')).toBe(true);
    expect(spMul(g.S)).toBeGreaterThan(before);
    expect(buyDecor(g, 'neon')).toBe(false);
  });

  it('el personal cobra sueldo al acabar el día', () => {
    const g = testGame();
    toggleStaff(g, 'cm');
    const m = g.S.money;
    endDay(g);
    expect(g.S.money).toBeCloseTo(m - 15 - 30);
    expect(g.S.repB).toBe(1);
  });

  it('el torneo necesita la mesa de juego', () => {
    const g = testGame();
    toggleTour(g);
    expect(g.S.tour).toBe(false);
    buyDecor(g, 'table');
    toggleTour(g);
    expect(g.S.tour).toBe(true);
  });
});

describe('tareas', () => {
  it('una misión completada se cobra una sola vez', () => {
    const g = testGame(), m = g.S.dm!.list[0];
    track(g, m.k, m.g);
    expect(m.done).toBe(1);
    const money = g.S.money;
    expect(claimMission(g, 0)).toBe(m.r);
    expect(claimMission(g, 0)).toBe(0);
    expect(g.S.money).toBe(money + m.r);
  });

  it('entregar un encargo paga, da reputación y lo quita', () => {
    const g = testGame(), o = g.S.orders[0];
    g.S.items.push({ i: 999, c: o.c, k: 'NM', rv: false, cost: 0, case: null, res: false });
    const m = g.S.money;
    const r = deliverOrder(g, o.id);
    expect(r.k).toBe('ok');
    expect(g.S.money).toBeCloseTo(m + o.pay);
    expect(g.S.orders.find((x) => x.id === o.id)).toBeUndefined();
    expect(g.S.lt.orders).toBe(1);
  });

  it('el premio del álbum exige el porcentaje', () => {
    const g = testGame();
    expect(claimAlbum(g, 'mew', 0)).toBeNull();
    g.db.byS.mew.forEach((c) => (g.S.dex[c.id] = 1));
    expect(claimAlbum(g, 'mew', 3)).toEqual([1000, 5]);
    expect(claimAlbum(g, 'mew', 3)).toBeNull();
  });
});
