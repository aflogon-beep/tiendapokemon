/* localStorage con JSON e IndexedDB clave-valor (como cget/cput e IDB de la v10) */

export const cget = <T>(k: string): T | null => {
  try {
    const v = localStorage.getItem(k);
    return v == null ? null : (JSON.parse(v) as T);
  } catch {
    return null;
  }
};

export const cput = (k: string, v: unknown): boolean => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
};

let dbp: Promise<IDBDatabase> | null = null;
const open = (): Promise<IDBDatabase> =>
  dbp ??
  (dbp = new Promise((res, rej) => {
    try {
      const r = indexedDB.open('pcs', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) {
      rej(e);
    }
  }));

function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest | void): Promise<T | null> {
  return open()
    .then(
      (db) =>
        new Promise<T | null>((res, rej) => {
          const t = db.transaction('kv', mode);
          const q = f(t.objectStore('kv'));
          t.oncomplete = () => res(q ? (q.result as T) : null);
          t.onerror = () => rej(t.error);
        }),
    )
    .catch(() => null);
}

export const IDB = {
  get: <T>(k: string) => tx<T>('readonly', (s) => s.get(k)),
  // Devuelve null si falla (sin IndexedDB o sin espacio)
  put: (k: string, v: unknown) => tx<IDBValidKey>('readwrite', (s) => s.put(v, k)),
};
