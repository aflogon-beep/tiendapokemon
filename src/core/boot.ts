import { FAILED, indexCards, loadMany, offlineCards, type Card, type CardDB } from '../data/cards';
import { DEFAULT_SETS, loadSetList, mkSetDef, setDef } from '../data/sets';
import { cget } from '../data/storage';
import type { Mode } from './game';
import { hasRealSave, saveKey, v10Keys } from './save';
import type { State } from './state';

/*
 * Arranque (boot de la v10): lista de sets, cartas de los sets de la partida guardada
 * (de 3 en 3, con caché) y, si la API falla, modo sin conexión… salvo que haya una partida
 * real guardada: entonces se pregunta.
 */

export interface BootResult {
  db: CardDB;
  mode: Mode;
  note: string;
}

export interface BootUi {
  progress(text: string): void;
  askOffline(): Promise<'retry' | 'offline'>;
}

// Sets de la partida real guardada (nuestra o de la v10)
function savedSets(): string[] | null {
  for (const k of [saveKey('real'), ...v10Keys('real')]) {
    const s = cget<State>(k);
    if (s?.sets?.length) return s.sets;
  }
  return null;
}

export async function boot(ui: BootUi): Promise<BootResult> {
  for (;;) {
    let ids = savedSets() ?? DEFAULT_SETS;
    try {
      const list = await loadSetList();
      list?.forEach(mkSetDef);
      ids = ids.filter((i) => setDef(i));
      if (!ids.length) ids = DEFAULT_SETS;
      ui.progress(`Cargando ${ids.length} colecciones con precios de Cardmarket…`);
      const all: Card[] = await loadMany(ids, (d, n, sd) => ui.progress(`Cargando colecciones ${d}/${n} · ${sd.n}…`));
      if (all.length < 100) throw new Error('pocas cartas');
      const note = FAILED.size ? `⚠️ ${FAILED.size} colección(es) sin cargar` : 'Precios reales de Cardmarket';
      return { db: indexCards(all), mode: 'real', note };
    } catch {
      if (hasRealSave()) {
        if ((await ui.askOffline()) === 'retry') {
          ui.progress('Reintentando…');
          continue;
        }
        return { db: indexCards(offlineCards()), mode: 'offline', note: 'Sin conexión: partida aparte con cartas ilustradas' };
      }
      return { db: indexCards(offlineCards()), mode: 'offline', note: 'Sin conexión con la API: cartas ilustradas y precios simulados' };
    }
  }
}
