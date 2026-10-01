import { describe, expect, it } from 'vitest';
import { testGame } from './helpers';
import { stockForTest } from '../src/core/sandbox';
import { decide, makeDeal, spawn, type Customer } from '../src/systems/customers';
import { giveChange, payWith, startCheckout, tpvKey, tpvOk, finishCheckout } from '../src/systems/checkout';
import { counterOffer, startHaggle } from '../src/systems/haggle';
import { accuseDeal, finishDeal, offerDeal } from '../src/systems/deals';
import { mkTells, mkWt } from '../src/systems/fakes';
import { endLot, lotBuy, lotEst, lotOffer, makeLot, payReview } from '../src/systems/lots';
import type { Game } from '../src/core/game';

// Cliente en la cola con un sobre en la mano
function buyer(g: Game): Customer {
  stockForTest(g);
  g.S.shelf.mew = 1;
  const c = spawn(g);
  c.type = 'kid';
  c.want = { k: 'pack', s: 'mew' };
  c.st = 'browse';
  decide(g, c);
  g.queue.push(c);
  return c;
}

describe('caja', () => {
  it('se paga con un billete que cubre el total', () => {
    for (let i = 0; i < 50; i++) {
      const v = payWith(735);
      expect(v).toBeGreaterThanOrEqual(735);
      expect([735, 1000, 2000, 5000, 10000]).toContain(v);
    }
  });

  it('el cambio exacto cuenta para las misiones y puede dar propina', () => {
    const g = testGame(), c = buyer(g), k = startCheckout(c);
    k.m = 'cash';
    k.paid = 500;
    k.tc = 135;
    expect(giveChange(g, k)).toEqual({ ok: false, missing: 365 });
    k.given = [200, 100, 50, 10, 5];
    const r = giveChange(g, k);
    expect(r.ok && r.extra).toBe(0);
    expect(g.S.lt.exact).toBe(1);
  });

  it('el TPV rechaza un importe mayor y acepta el exacto', () => {
    const g = testGame(), c = buyer(g), k = startCheckout(c);
    k.m = 'card';
    k.tc = 735;
    '9999'.split('').forEach((x) => tpvKey(k, x));
    expect(tpvOk(k)).toBe('rejected');
    '735'.split('').forEach((x) => tpvKey(k, x));
    expect(tpvOk(k)).toBe('accepted');
    expect(k.st).toBe('tap');
  });

  it('cobrar de menos se nota en la caja', () => {
    const g = testGame(), c = buyer(g), k = startCheckout(c), m = g.S.money;
    finishCheckout(g, k, 0.5);
    expect(g.S.money).toBeCloseTo(m + 0.5);
    expect(c.st).toBe('leave');
  });
});

describe('regateo', () => {
  it('acepta una contraoferta razonable y se enfada al segundo intento abusivo', () => {
    const g = testGame(), c = buyer(g);
    c.hold = { k: 'single', qty: 1, total: 20 };
    const h = startHaggle(c);
    expect(h.offer).toBeLessThan(20);
    h.x = h.offer;
    expect(counterOffer(h)).toBe('deal');
    const h2 = startHaggle(c);
    h2.x = h2.full + 1;
    h2.max = h2.offer;
    expect(counterOffer(h2)).toBe('again');
    expect(counterOffer(h2)).toBe('angry');
  });
});

describe('comprar cartas a clientes', () => {
  it('ofrecer por encima del mínimo cierra el trato y la carta entra en la colección', () => {
    const g = testGame(), c = spawn(g), d = makeDeal(g, null)!;
    d.cust = c;
    g.queue.push(c);
    const r = offerDeal(d, d.floor);
    expect(r.k).toBe('buy');
    const n = g.S.items.length;
    expect(finishDeal(g, d, d.floor).ok).toBe(true);
    expect(g.S.items).toHaveLength(n + 1);
    expect(g.S.lt.served ?? 0).toBe(0);
    expect(c.st).toBe('leave');
  });

  it('una oferta ridícula ofende y la segunda le echa', () => {
    const g = testGame(), d = makeDeal(g, null)!;
    expect(offerDeal(d, 0.05).k).toBe('insulted');
    expect(offerDeal(d, 0.05).k).toBe('angry');
  });

  it('acusar de falsa da reputación si lo era', () => {
    const g = testGame(), c = spawn(g), d = makeDeal(g, null)!;
    d.cust = c;
    d.fake = true;
    expect(accuseDeal(g, d)).toBe(true);
    expect(g.S.repB).toBe(1);
  });

  it('una falsa falla en dos de las tres pruebas y pesa menos si falla la balanza', () => {
    const t = mkTells(true);
    expect(t).toHaveLength(2);
    expect(mkTells(false)).toHaveLength(0);
    expect(mkWt(true, ['scale', 'lens'])).toBeLessThan(1.62);
    expect(mkWt(false, [])).toBeGreaterThan(1.71);
  });
});

describe('lotes', () => {
  it('revisar cartas afina la estimación y comprar las añade todas', () => {
    const g = testGame(), L = makeLot(g, null);
    const [lo0, hi0] = lotEst(g, L);
    expect(payReview(g, L, 50)).toBe(true);
    const [lo1, hi1] = lotEst(g, L);
    expect(hi1 - lo1).toBeLessThan((hi0 - lo0) * 1.5);
    const n = g.S.items.length;
    expect(lotBuy(g, L, L.ask)).toBe(true);
    expect(g.S.items).toHaveLength(n + L.n);
    expect(g.S.lt.lots).toBe(1);
  });

  it('una oferta baja recibe contraoferta y a la segunda se va', () => {
    const g = testGame(), c = spawn(g), L = makeLot(g, c);
    L.offer = L.floor * 0.5;
    expect(lotOffer(L)).toBe('counter');
    expect(lotOffer(L)).toBe('gone');
    endLot(g, L);
    expect(c.st).toBe('leave');
  });
});
