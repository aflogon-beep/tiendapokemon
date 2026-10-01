import { indexCards, offlineCards } from '../src/data/cards';
import { resetSets } from '../src/data/sets';
import { seeded, setRandom } from '../src/core/rng';
import { newGame } from '../src/core/setup';
import type { Game } from '../src/core/game';

/** Partida nueva con las cartas del modo sin conexión y azar reproducible */
export function testGame(seed = 1): Game {
  setRandom(seeded(seed));
  resetSets();
  return newGame(indexCards(offlineCards()), 'offline');
}

/** localStorage en memoria */
export function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}
