import { rnd } from '../core/rng';
import { API, jget } from './api';
import { RAR, rarOf, type Rarity } from './rarity';
import { setDef, SETDEF, type SetDef } from './sets';
import { cget, cput, IDB } from './storage';

/*
 * Cartas con precios reales de Cardmarket (pokemontcg.io), portado de la v10:
 * caché en IndexedDB de 18 h, 3 intentos con espera, carga de 3 en 3 y, si falla,
 * la última copia guardada. Las colecciones que no cargan quedan en FAILED.
 */

export interface Card {
  id: string;
  /** Set al que pertenece (id interno) */
  s: string;
  name: string;
  num: string | null;
  r: Rarity;
  img: string | null;
  /** Precio base (tendencia de Cardmarket) */
  b: number;
  /** Precio de la versión reverse */
  rv: number | null;
  /** Medias de 30, 7 y 1 días para reconstruir el historial */
  seed: [number, number, number] | null;
}

export interface ApiCard {
  id: string;
  name: string;
  number?: string;
  rarity?: string;
  images?: { small?: string };
  cardmarket?: { prices?: Record<string, number | undefined> };
}

export function mapCard(d: ApiCard, sd: SetDef): Card {
  const r = rarOf(d);
  const p = d.cardmarket?.prices ?? {};
  const b = p.trendPrice || p.averageSellPrice || p.avg30 || p.lowPrice || RAR[r].def;
  return {
    id: d.id,
    s: sd.id,
    name: d.name,
    num: d.number ?? null,
    r,
    img: d.images?.small ?? null,
    b: Math.max(0.02, b),
    rv: p.reverseHoloTrend || null,
    seed: p.avg30 && p.avg7 && p.avg1 ? [p.avg30, p.avg7, p.avg1] : null,
  };
}

/** Índices de búsqueda (BYID, BYSR, BYR, BYS en la v10) */
export interface CardDB {
  cards: Card[];
  byId: Record<string, Card>;
  bySR: Record<string, Card[]>;
  byR: Partial<Record<Rarity, Card[]>>;
  byS: Record<string, Card[]>;
}

export function indexCards(cards: Card[]): CardDB {
  const db: CardDB = { cards, byId: {}, bySR: {}, byR: {}, byS: {} };
  for (const c of cards) {
    db.byId[c.id] = c;
    (db.bySR[c.s + c.r] ??= []).push(c);
    (db.byR[c.r] ??= []).push(c);
    (db.byS[c.s] ??= []).push(c);
  }
  return db;
}

export const FRESH_MS = 18 * 36e5;
export const FAILED = new Set<string>();
export const STALE = new Set<string>();

/** Espera entre reintentos (sustituible en los tests) */
export const loaderTiming = { sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) };

interface CacheRec {
  t: number;
  cards: Card[];
}

function cacheGet(api: string): Promise<CacheRec | null> {
  return IDB.get<CacheRec>('set:' + api).then(
    (v) => v || cget<CacheRec>('pcs-set2-' + api) || cget<CacheRec>('pcs-set-' + api),
  );
}

function cachePut(api: string, rec: CacheRec): void {
  IDB.put('set:' + api, rec).then((ok) => {
    if (ok == null) cput('pcs-set2-' + api, rec);
    else
      try {
        localStorage.removeItem('pcs-set-' + api);
        localStorage.removeItem('pcs-set2-' + api);
      } catch {
        /* sin localStorage */
      }
  });
}

// Una petición con hasta 3 intentos
function getWithRetry<T>(url: string, att = 0): Promise<T> {
  return jget<T>(url, 40000).catch((e) =>
    att < 2 ? loaderTiming.sleep(1500 * (att + 1) + rnd(800)).then(() => getWithRetry<T>(url, att + 1)) : Promise.reject(e),
  );
}

interface CardsPage {
  data: ApiCard[];
  totalCount?: number;
}

/** Cartas de un set: caché fresca, o API (paginada de 250 en 250), o la última copia guardada */
export function fetchSetCards(sd: SetDef, force = false): Promise<Card[]> {
  return cacheGet(sd.api).then((c) => {
    const has = !!c?.cards?.length;
    if (c && has && !force && Date.now() - c.t < FRESH_MS) {
      FAILED.delete(sd.id);
      return c.cards;
    }
    const q = (n: number) =>
      `${API}cards?q=set.id:${sd.api}&pageSize=250&page=${n}&select=id,name,number,rarity,images,cardmarket`;
    return getWithRetry<CardsPage>(q(1))
      .then((j) => {
        const pages = Math.ceil((j.totalCount || j.data.length) / 250);
        if (pages <= 1) return j.data;
        const more: Promise<ApiCard[]>[] = [];
        for (let n = 2; n <= pages; n++) more.push(getWithRetry<CardsPage>(q(n)).then((x) => x.data));
        return Promise.all(more).then((arr) => j.data.concat(...arr));
      })
      .then((data) => {
        const cards = data.filter((d) => d?.id).map((d) => mapCard(d, sd));
        if (!cards.length) throw new Error('sin cartas');
        cachePut(sd.api, { t: Date.now(), cards });
        FAILED.delete(sd.id);
        STALE.delete(sd.id);
        return cards;
      })
      .catch(() => {
        if (c && has) {
          STALE.add(sd.id);
          FAILED.delete(sd.id);
          return c.cards;
        }
        FAILED.add(sd.id);
        return [];
      });
  });
}

/** Carga varios sets de 3 en 3 */
export function loadMany(ids: string[], onProgress?: (done: number, total: number, sd: SetDef) => void): Promise<Card[]> {
  let i = 0, done = 0;
  const out: Card[] = [];
  const work = (): Promise<void> => {
    if (i >= ids.length) return Promise.resolve();
    const sd = setDef(ids[i++]);
    if (!sd) return work();
    return fetchSetCards(sd)
      .then((cs) => {
        cs.forEach((c) => (c.s = sd.id));
        out.push(...cs);
        done++;
        onProgress?.(done, ids.length, sd);
      })
      .then(work);
  };
  return Promise.all([work(), work(), work()]).then(() => out);
}

/* --- modo sin conexión: cartas ilustradas y precios simulados --- */
export function offlineCards(): Card[] {
  const COM = ['Pidgey', 'Rattata', 'Zubat', 'Magikarp', 'Geodude', 'Oddish', 'Weedle', 'Psyduck'];
  const UNC = ['Pidgeotto', 'Machoke', 'Haunter', 'Kadabra', 'Growlithe'];
  const RAREN = ['Ninetales', 'Arcanine', 'Gyarados'];
  const H: Record<string, [string, Rarity, number][]> = {
    mew: [['Charizard ex', 'SIR', 180], ['Mew ex', 'SIR', 85], ['Invitación de Erika', 'SIR', 120], ['Blastoise ex', 'SIR', 45], ['Venusaur ex', 'SIR', 35], ['Alakazam ex', 'SIR', 28], ['Zapdos ex', 'SIR', 22], ['Pikachu', 'IR', 22], ['Charmander', 'IR', 14], ['Squirtle', 'IR', 12], ['Charizard ex', 'DR', 9], ['Mew ex', 'DR', 3], ['Kangaskhan ex', 'DR', 2], ['Mewtwo', 'UR', 6], ['Energía Psíquica', 'HR', 8]],
    pre: [['Umbreon ex', 'SIR', 900], ['Sylveon ex', 'SIR', 240], ['Espeon ex', 'SIR', 130], ['Vaporeon ex', 'SIR', 110], ['Leafeon ex', 'SIR', 95], ['Glaceon ex', 'SIR', 85], ['Jolteon ex', 'SIR', 80], ['Flareon ex', 'SIR', 75], ['Eevee', 'IR', 30], ['Umbreon ex', 'DR', 12], ['Sylveon ex', 'DR', 7], ['Espeon ex', 'DR', 5], ['Pikachu', 'UR', 8], ['Energía Fuego', 'HR', 10]],
    obf: [['Charizard ex', 'SIR', 95], ['Tyranitar ex', 'SIR', 30], ['Pidgeot ex', 'SIR', 18], ['Charmander', 'IR', 6], ['Dreepy', 'IR', 5], ['Bellibolt ex', 'IR', 4], ['Charizard ex', 'DR', 4], ['Tyranitar ex', 'DR', 2], ['Pidgeot ex', 'DR', 2], ['Charizard ex', 'UR', 7], ['Energía Fuego', 'HR', 4]],
  };
  const out: Card[] = [];
  SETDEF.filter((sd) => H[sd.id]).forEach((sd) => {
    const add = (name: string, r: Rarity, b: number) =>
      out.push({ id: sd.id + '-' + out.length, s: sd.id, name, num: null, r, img: null, b, rv: null, seed: null });
    COM.forEach((n) => add(n, 'C', 0.05));
    UNC.forEach((n) => add(n, 'U', 0.1));
    RAREN.forEach((n) => add(n, 'R', 0.35));
    H[sd.id].forEach((h) => add(h[0], h[1], h[2]));
  });
  return out;
}
