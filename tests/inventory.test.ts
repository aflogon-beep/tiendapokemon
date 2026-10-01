import { describe, expect, it } from 'vitest';
import { testGame } from './helpers';
import {
  buyPacks, buyProd, caseAdd, caseMarkup, groups, luxAdd, openPacks, openProd, packCost, sellToDealer, sendToGrade, setShelfPrice,
} from '../src/systems/inventory';
import { caseCap, caseItems } from '../src/systems/economy';
import { endDay } from '../src/systems/day';

describe('stock de sobres', () => {
  it('comprar descuenta el dinero y llena la estantería', () => {
    const g = testGame();
    const c = packCost(g, 'mew', 6);
    expect(buyPacks(g, 'mew', 6).ok).toBe(true);
    expect(g.S.money).toBeCloseTo(1000 - c);
    expect(g.S.sealed.mew).toBe(6);
    expect(g.S.slots).toContain('mew');
  });

  it('la caja de 36 lleva un 7 % de descuento', () => {
    const g = testGame();
    expect(packCost(g, 'mew', 36)).toBeCloseTo(g.S.pack.mew.w * 36 * 0.93);
  });

  it('sin dinero no se compra', () => {
    const g = testGame();
    g.S.money = 1;
    expect(buyPacks(g, 'mew', 6)).toEqual({ ok: false, msg: 'No tienes dinero suficiente' });
    expect(g.S.sealed.mew).toBe(0);
  });

  it('el precio de estantería no baja de 0,25 €', () => {
    const g = testGame();
    for (let i = 0; i < 100; i++) setShelfPrice(g, 'mew', -0.25);
    expect(g.S.shelf.mew).toBe(0.25);
  });

  it('abrir sobres mete las cartas en la colección y marca las nuevas', () => {
    const g = testGame();
    buyPacks(g, 'mew', 2);
    const r = openPacks(g, 'mew', 5)!;
    expect(g.S.sealed.mew).toBe(0);
    expect(r.pulled).toHaveLength(20);
    expect(g.S.items).toHaveLength(20);
    expect(r.pulled[0].nw).toBe(true);
    expect(g.S.lt.packs).toBe(2);
    expect(openPacks(g, 'mew', 1)).toBeNull();
  });
});

describe('sellado', () => {
  it('abrir una ETB añade 9 sobres', () => {
    const g = testGame();
    expect(buyProd(g, 'etb:mew', 1).ok).toBe(true);
    expect(openProd(g, 'etb:mew')).toBe(9);
    expect(g.S.sealed.mew).toBe(9);
    expect(g.S.prod['etb:mew']).toBe(0);
  });
});

describe('colección', () => {
  const withCards = () => {
    const g = testGame();
    buyPacks(g, 'mew', 3);
    openPacks(g, 'mew', 3);
    return g;
  };

  it('la vitrina admite 8 cartas y empieza al 110 %', () => {
    const g = withCards();
    for (const gr of groups(g)) caseAdd(g, gr.key);
    expect(caseItems(g.S)).toHaveLength(caseCap(g.S));
    expect(caseItems(g.S)[0].case).toBe(1.1);
  });

  it('el margen de la vitrina va del 60 % al 160 %', () => {
    const g = withCards(), k = groups(g)[0].key;
    caseAdd(g, k);
    for (let i = 0; i < 40; i++) caseMarkup(g, k, 0.05);
    expect(caseItems(g.S)[0].case).toBe(1.6);
  });

  it('el mayorista paga el 85 % y no paga las falsas', () => {
    const g = withCards(), gr = groups(g)[0], m = g.S.money;
    gr.its[0].fk = true;
    const r = sellToDealer(g, gr.key, true);
    expect(r.fakes).toBe(1);
    expect(g.S.money - m).toBeCloseTo(r.got);
  });

  it('las peanas son solo 3 y suben el precio al 120 %', () => {
    const g = withCards();
    g.S.decor.lux = true;
    const gs = groups(g);
    expect(gs.slice(0, 5).filter((x) => luxAdd(g, x.key))).toHaveLength(3);
  });

  it('una carta enviada a gradear vuelve con nota', () => {
    const g = withCards(), k = groups(g)[0].key;
    expect(sendToGrade(g, k, 'exp').ok).toBe(true);
    const it = g.S.items.find((i) => i.gq)!;
    endDay(g);
    expect(it.gq).toBeUndefined();
    expect(it.gr).toBeGreaterThanOrEqual(1);
    expect(g.S.grNew).toContain(it.i);
  });
});
