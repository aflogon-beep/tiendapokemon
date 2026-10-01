import type { Mode } from './game';
import type { State } from './state';

/*
 * Guardado (crítico: no perder partidas).
 * - Clave versionada en localStorage: pcs3d-save-<modo>-v<SAVE_VERSION>.
 * - Si no hay partida 3D pero sí una de la v10 en este navegador, se usa esa (sin borrarla).
 * - Importa el JSON exportado por la v10 ({app:"pcs", v:5, mode, date, S}) o su código base64.
 * - Migraciones explícitas: cada versión del esquema (S.sv) sabe pasar a la siguiente.
 */

export const SAVE_VERSION = 1;

export const saveKey = (mode: Mode, v = SAVE_VERSION): string => `pcs3d-save-${mode}-v${v}`;
/** Claves de la v10 (pcs-save-real-v3 y la anterior v2) */
export const v10Keys = (mode: Mode): string[] => [`pcs-save-${mode}-v3`, `pcs-save-${mode}-v2`];

/** Migraciones: índice = versión de origen. La 0 es una partida de la v10 (sin S.sv). */
const MIGRATIONS: ((S: State) => void)[] = [
  // v10 → 1: mismo formato; solo se marca la versión. ensure() completa lo que falte.
  (S) => {
    S.sv = 1;
  },
];

export function migrate(S: State): State {
  let v = typeof S.sv === 'number' ? S.sv : 0;
  if (v > SAVE_VERSION) throw new Error(`Partida de una versión más nueva (${v})`);
  while (v < SAVE_VERSION) MIGRATIONS[v++](S);
  return S;
}

/** Comprobación mínima de que es una partida (la misma que la v10) */
export const isState = (o: unknown): o is State =>
  !!o && typeof (o as State).money === 'number' && Array.isArray((o as State).items);

/** Al cargar, el día siempre empieza con la tienda cerrada (como en la v10) */
function prepare(S: State): State {
  migrate(S);
  S.phase = 'closed';
  S.clock = 0;
  return S;
}

export interface LoadResult {
  S: State;
  from: 'save' | 'v10';
}

function parse(raw: string | null): State | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    return isState(o) ? o : null;
  } catch {
    return null;
  }
}

/** Partida guardada de ese modo, o null */
export function loadSaved(mode: Mode, store: Storage = localStorage): LoadResult | null {
  try {
    const own = parse(store.getItem(saveKey(mode)));
    if (own) return { S: prepare(own), from: 'save' };
    for (const k of v10Keys(mode)) {
      const old = parse(store.getItem(k));
      if (old) return { S: prepare(old), from: 'v10' };
    }
  } catch {
    /* sin acceso a localStorage */
  }
  return null;
}

/** ¿Hay una partida con precios reales guardada (nuestra o de la v10)? */
export function hasRealSave(store: Storage = localStorage): boolean {
  try {
    return [saveKey('real'), ...v10Keys('real')].some((k) => isState(parse(store.getItem(k))));
  } catch {
    return false;
  }
}

/** Guarda. Si no cabe, libera la caché antigua de cartas y lo reintenta. */
export function saveState(S: State, mode: Mode, store: Storage = localStorage): boolean {
  S.savedAt = Date.now();
  S.sv = SAVE_VERSION;
  const js = JSON.stringify(S);
  try {
    store.setItem(saveKey(mode), js);
    return true;
  } catch {
    try {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) keys.push(store.key(i)!);
      keys.filter((k) => k.startsWith('pcs-set')).forEach((k) => store.removeItem(k));
      store.setItem(saveKey(mode), js);
      return true;
    } catch {
      return false;
    }
  }
}

/** Texto de exportación (mismo formato que la v10, que lo puede leer) */
export const exportStr = (S: State, mode: Mode): string =>
  JSON.stringify({ app: 'pcs', v: 6, sv: SAVE_VERSION, mode, date: new Date().toISOString(), S });

/** Código compacto para copiar y pegar (base64 del JSON) */
export const exportCode = (S: State, mode: Mode): string => btoa(unescape(encodeURIComponent(exportStr(S, mode))));

export type ImportResult = { ok: true; S: State; mode?: Mode } | { ok: false; msg: string };

/** Lee un archivo exportado o un código (de la v10 o de esta versión) */
export function parseImport(txt: string): ImportResult {
  let o: unknown = null;
  txt = (txt || '').trim();
  try {
    o = JSON.parse(txt);
  } catch {
    try {
      o = JSON.parse(decodeURIComponent(escape(atob(txt))));
    } catch {
      /* no es JSON ni código */
    }
  }
  const wrap = o as { S?: unknown; mode?: Mode } | null;
  const ns = wrap && (wrap.S ?? wrap);
  if (!isState(ns)) return { ok: false, msg: '⚠️ Ese archivo o código no es una partida válida' };
  try {
    return { ok: true, S: prepare(ns), mode: wrap?.mode };
  } catch (e) {
    return { ok: false, msg: '⚠️ ' + (e as Error).message };
  }
}
