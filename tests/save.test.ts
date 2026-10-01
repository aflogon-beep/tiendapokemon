import { describe, expect, it } from 'vitest';
import { exportCode, exportStr, hasRealSave, loadSaved, migrate, parseImport, saveKey, saveState, SAVE_VERSION } from '../src/core/save';
import { createGame } from '../src/core/setup';
import { indexCards, offlineCards } from '../src/data/cards';
import { memStorage, testGame } from './helpers';

// Partida como la exporta la v10: {app:"pcs", v:5, mode:"real", date, S}
function v10Export() {
  const S = {
    tut: { on: false, i: 12 }, money: 2345.6, day: 9, sales: 40, nid: 30,
    items: [{ i: 3, c: 'mew-20', k: 'LP', rv: false, cost: 2, case: 1.2, res: true }],
    sealed: { mew: 4 }, shelf: { mew: 6.5 }, pack: { mew: { w: 4.5, ref: 5.85 } }, prices: {},
    up: { cashier: 0, ads: 1, case: 1, shelf: 0 }, sets: ['mew'], log: [], phase: 'open', clock: 55,
    stats: { inc: 10, cust: 3, lost: 1, bought: 0 }, regs: { lucia: { loy: 70, visits: 5, note: '', met: true, fav: 'mew' } },
    decor: { plants: true }, campoRaroDeLaV10: { x: 1 },
  };
  return { app: 'pcs', v: 5, mode: 'real', date: '2026-09-01T10:00:00.000Z', S };
}

describe('importar partidas de la v10', () => {
  it('lee el JSON exportado', () => {
    const r = parseImport(JSON.stringify(v10Export()));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.S.money).toBe(2345.6);
    expect(r.S.day).toBe(9);
    expect(r.mode).toBe('real');
    // Al cargar, la tienda empieza cerrada (como en la v10)
    expect(r.S.phase).toBe('closed');
    expect(r.S.clock).toBe(0);
    // Conserva los campos que no conoce
    expect(r.S.campoRaroDeLaV10).toEqual({ x: 1 });
    expect(r.S.sv).toBe(SAVE_VERSION);
  });

  it('lee el código base64 de la v10 (con acentos)', () => {
    const o = v10Export();
    o.S.regs.lucia.note = 'Le encantó el sobre de Evoluciones Prismáticas';
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(o))));
    const r = parseImport(code);
    expect(r.ok && r.S.regs.lucia.note).toBe('Le encantó el sobre de Evoluciones Prismáticas');
  });

  it('acepta también el objeto S suelto', () => {
    expect(parseImport(JSON.stringify(v10Export().S)).ok).toBe(true);
  });

  it('rechaza lo que no es una partida', () => {
    expect(parseImport('hola').ok).toBe(false);
    expect(parseImport('{"money":"mucho"}').ok).toBe(false);
  });

  it('ensure() completa la partida importada sin perder datos', () => {
    const r = parseImport(JSON.stringify(v10Export()));
    if (!r.ok) throw new Error();
    const g = createGame(r.S, indexCards(offlineCards()), 'offline');
    expect(g.S.money).toBe(2345.6);
    expect(g.S.items.map((i) => i.c)).toEqual(['mew-20']);
    expect(g.S.regs.lucia.loy).toBe(70);
    expect(g.S.staff).toEqual({ cashier: false, appraiser: false, cm: false });
    expect(g.S.prices['mew-20']).toBeTruthy();
    expect(g.S.dm?.list).toHaveLength(3);
  });

  it('aparta las cartas de sets que no han cargado y las recupera después', () => {
    const r = parseImport(JSON.stringify({ ...v10Export().S, items: [{ i: 1, c: 'xy1-5', k: 'NM', rv: false, cost: 1, case: null, res: false }] }));
    if (!r.ok) throw new Error();
    const g = createGame(r.S, indexCards(offlineCards()), 'offline');
    expect(g.S.items).toHaveLength(0);
    expect(g.S.orph?.[0].c).toBe('xy1-5');
  });
});

describe('guardado', () => {
  it('guarda y carga con clave versionada', () => {
    const store = memStorage();
    const g = testGame();
    g.S.money = 777;
    expect(saveState(g.S, 'real', store)).toBe(true);
    expect(store.getItem(saveKey('real'))).toContain('"money":777');
    const l = loadSaved('real', store);
    expect(l?.from).toBe('save');
    expect(l?.S.money).toBe(777);
  });

  it('si no hay partida 3D usa la de la v10 del mismo navegador sin borrarla', () => {
    const store = memStorage();
    store.setItem('pcs-save-real-v3', JSON.stringify(v10Export().S));
    const l = loadSaved('real', store);
    expect(l?.from).toBe('v10');
    expect(l?.S.day).toBe(9);
    expect(store.getItem('pcs-save-real-v3')).not.toBeNull();
    expect(hasRealSave(store)).toBe(true);
  });

  it('la partida 3D tiene prioridad sobre la de la v10', () => {
    const store = memStorage();
    store.setItem('pcs-save-real-v3', JSON.stringify(v10Export().S));
    const g = testGame();
    g.S.day = 42;
    saveState(g.S, 'real', store);
    expect(loadSaved('real', store)?.S.day).toBe(42);
  });

  it('el modo sin conexión es una partida aparte', () => {
    const store = memStorage();
    saveState(testGame().S, 'offline', store);
    expect(loadSaved('real', store)).toBeNull();
    expect(hasRealSave(store)).toBe(false);
  });

  it('si no cabe, borra la caché antigua de cartas y lo vuelve a intentar', () => {
    const store = memStorage();
    let full = true;
    const set = store.setItem.bind(store);
    store.setItem = (k, v) => {
      if (k.startsWith('pcs3d') && full && store.getItem('pcs-set-old')) throw new Error('QuotaExceededError');
      set(k, v);
    };
    set('pcs-set-old', 'x'.repeat(10));
    const ok = saveState(testGame().S, 'real', store);
    full = false;
    expect(ok).toBe(true);
    expect(store.getItem('pcs-set-old')).toBeNull();
  });

  it('exportar → importar devuelve la misma partida', () => {
    const g = testGame();
    g.S.money = 1234.5;
    for (const txt of [exportStr(g.S, 'real'), exportCode(g.S, 'real')]) {
      const r = parseImport(txt);
      expect(r.ok && r.S.money).toBe(1234.5);
    }
  });

  it('no carga partidas de una versión más nueva', () => {
    expect(() => migrate({ sv: SAVE_VERSION + 1 } as never)).toThrow();
  });
});

describe('colecciones que fallan', () => {
  it('se reintentan y las cartas apartadas vuelven a la partida', async () => {
    const { FAILED, loaderTiming } = await import('../src/data/cards');
    const { retrySets } = await import('../src/core/setup');
    const { vi } = await import('vitest');
    loaderTiming.sleep = () => Promise.resolve();
    const g = testGame();
    g.mode = 'real';
    g.S.orph = [{ i: 99, c: 'sv3pt5-1', k: 'NM', rv: false, cost: 1, case: null, res: false }];
    FAILED.add('mew');
    vi.stubGlobal('fetch', async () => ({
      ok: true, status: 200,
      json: async () => ({ totalCount: 1, data: [{ id: 'sv3pt5-1', name: 'Bulbasaur', number: '1', rarity: 'Common', cardmarket: { prices: { trendPrice: 0.2 } } }] }),
    }));
    const r = await retrySets(g);
    vi.unstubAllGlobals();
    expect(r).toEqual({ tried: 1, left: 0 });
    expect(g.S.items.map((i) => i.c)).toContain('sv3pt5-1');
    expect(g.S.orph).toHaveLength(0);
  });
});
