import { cget, cput } from './storage';
import { jget, API } from './api';

/* Colecciones (sets). La lista completa viene de pokemontcg.io; los 3 primeros conservan su id antiguo. */

export interface SetDef {
  id: string;
  api: string;
  n: string;
  year: number;
  total: number;
  /** Precio mayorista por defecto de un sobre */
  dp: number;
  col: string;
  fc?: string;
  series?: string;
  sym?: string;
  date?: string;
}

export const DEFAULT_SETS = ['mew', 'pre', 'obf'];
const LEGACY: Record<string, string> = { sv3pt5: 'mew', sv8pt5: 'pre', sv3: 'obf' };

const hue = (t: string) => {
  let h = 0;
  for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
};

const BASE: SetDef[] = [
  { id: 'mew', api: 'sv3pt5', n: '151', year: 2023, total: 207, dp: 4.5, fc: '#3f9b4a', col: '#3f9b4a' },
  { id: 'pre', api: 'sv8pt5', n: 'Evoluciones Prismáticas', year: 2025, total: 180, dp: 9.5, fc: '#d65fae', col: '#d65fae' },
  { id: 'obf', api: 'sv3', n: 'Llamas Obsidianas', year: 2023, total: 230, dp: 3.4, fc: '#e0622a', col: '#e0622a' },
];

/** Registro global de sets conocidos (SETDEF en la v10) */
export const SETDEF: SetDef[] = BASE.map((d) => ({ ...d }));

export function resetSets(): void {
  SETDEF.splice(0, SETDEF.length, ...BASE.map((d) => ({ ...d })));
}

export const setDef = (id: string): SetDef | undefined => SETDEF.find((x) => x.id === id);
export const setName = (id: string): string => setDef(id)?.n || id;
export const setCol = (id: string): string => setDef(id)?.col || '#888';

export interface ApiSet {
  id: string;
  name: string;
  series?: string;
  releaseDate?: string;
  total?: number;
  printedTotal?: number;
  images?: { symbol?: string };
}

export function mkSetDef(x: ApiSet): SetDef {
  const id = LEGACY[x.id] || x.id;
  const year = +String(x.releaseDate || '2020').slice(0, 4);
  const ex = setDef(id);
  const o: SetDef = ex || { id, api: x.id, n: x.name, year, total: 0, dp: year >= 2020 ? 4.5 : 4, col: '' };
  Object.assign(o, {
    api: x.id,
    n: ex ? ex.n : x.name,
    series: x.series,
    year,
    total: x.total || x.printedTotal || 0,
    sym: x.images?.symbol,
    date: x.releaseDate,
    col: ex?.fc || `hsl(${hue(id)} 55% 48%)`,
  });
  if (!ex) SETDEF.push(o);
  return o;
}

/** Lista de sets de la API (caché de 7 días en localStorage) */
export function loadSetList(): Promise<ApiSet[] | null> {
  const c = cget<{ t: number; sets: ApiSet[] }>('pcs-sets-v1');
  if (c && Date.now() - c.t < 7 * 864e5) return Promise.resolve(c.sets);
  return jget<{ data: ApiSet[] }>(API + 'sets?select=id,name,series,releaseDate,total,printedTotal,images&orderBy=-releaseDate', 25000)
    .then((j) => {
      cput('pcs-sets-v1', { t: Date.now(), sets: j.data });
      return j.data;
    })
    .catch(() => (c ? c.sets : null));
}
