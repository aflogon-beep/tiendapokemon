import { afterEach, describe, expect, it, vi } from 'vitest';
import { FAILED, STALE, fetchSetCards, loadMany, loaderTiming, mapCard, type ApiCard } from '../src/data/cards';
import { rarOf } from '../src/data/rarity';
import { resetSets, setDef } from '../src/data/sets';

loaderTiming.sleep = () => Promise.resolve();

const apiCard = (i: number, rarity = 'Common', prices: Record<string, number> = { trendPrice: 1 }): ApiCard => ({
  id: `sv3pt5-${i}`, name: `Carta ${i}`, number: String(i), rarity, images: { small: `img${i}` }, cardmarket: { prices },
});

function mockFetch(pages: (n: number, url: string) => unknown, failTimes = 0) {
  let calls = 0;
  const f = vi.fn(async (url: string) => {
    calls++;
    if (calls <= failTimes) return { ok: false, status: 503, json: async () => ({}) };
    const n = Number(/page=(\d+)/.exec(url)?.[1] ?? 1);
    return { ok: true, status: 200, json: async () => pages(n, url) };
  });
  vi.stubGlobal('fetch', f);
  return f;
}

afterEach(() => {
  vi.unstubAllGlobals();
  FAILED.clear();
  STALE.clear();
  resetSets();
});

describe('rarezas', () => {
  it('usa RMAP y clasifica las desconocidas sin descartarlas', () => {
    expect(rarOf({ rarity: 'Special Illustration Rare' })).toBe('SIR');
    expect(rarOf({ rarity: 'Rare Holo VMAX' })).toBe('DR');
    expect(rarOf({ rarity: 'Rare Secret Gold Star' })).toBe('HR');
    expect(rarOf({ rarity: 'Something Shiny New' })).toBe('UR');
    expect(rarOf({ rarity: 'Rarísima inventada' })).toBe('R');
    expect(rarOf({})).toBe('R');
  });
});

describe('cartas de la API', () => {
  it('toma el precio de tendencia y, si falta, el de la rareza', () => {
    const sd = setDef('mew')!;
    expect(mapCard(apiCard(1, 'Common', { trendPrice: 3.2, avg30: 9 }), sd).b).toBe(3.2);
    expect(mapCard(apiCard(1, 'Special Illustration Rare', {}), sd).b).toBe(40);
    expect(mapCard(apiCard(1, 'Common', { avg30: 2, avg7: 3, avg1: 4, trendPrice: 5 }), sd).seed).toEqual([2, 3, 4]);
  });

  it('pagina de 250 en 250', async () => {
    const f = mockFetch((n) => ({ totalCount: 300, data: Array.from({ length: n === 1 ? 250 : 50 }, (_, i) => apiCard((n - 1) * 250 + i)) }));
    const cards = await fetchSetCards(setDef('mew')!);
    expect(cards).toHaveLength(300);
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[0][0]).toContain('q=set.id:sv3pt5');
  });

  it('reintenta hasta 3 veces', async () => {
    const f = mockFetch(() => ({ totalCount: 1, data: [apiCard(1)] }), 2);
    expect(await fetchSetCards(setDef('mew')!)).toHaveLength(1);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('si falla del todo, la colección queda en FAILED', async () => {
    mockFetch(() => ({}), 99);
    expect(await fetchSetCards(setDef('mew')!)).toEqual([]);
    expect(FAILED.has('mew')).toBe(true);
  });

  it('carga como mucho 3 sets a la vez', async () => {
    let active = 0, max = 0;
    vi.stubGlobal('fetch', async () => {
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return { ok: true, status: 200, json: async () => ({ totalCount: 1, data: [apiCard(Math.random() * 1e6 | 0)] }) };
    });
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      const { mkSetDef } = await import('../src/data/sets');
      mkSetDef({ id, name: id, releaseDate: '2024/01/01' });
    }
    const cards = await loadMany(['a', 'b', 'c', 'd', 'e']);
    expect(cards).toHaveLength(5);
    expect(max).toBe(3);
  });
});
