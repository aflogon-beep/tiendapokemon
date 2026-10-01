// Cliente mínimo de pokemontcg.io con tiempo de espera
export const API = 'https://api.pokemontcg.io/v2/';

/** Último fallo de la API (para mostrar el motivo al jugador) */
export const apiStatus = { lastError: '' };

const why = (e: unknown): string => {
  const m = (e as Error)?.name === 'AbortError' ? 'tiempo de espera agotado' : String((e as Error)?.message || e);
  return /^\d+$/.test(m) ? `el servidor respondió ${m}` : m === 'Failed to fetch' ? 'sin conexión con el servidor' : m;
};

export function jget<T>(url: string, ms = 20000): Promise<T> {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), ms);
  return fetch(url, { signal: ac.signal })
    .then((r) => {
      clearTimeout(to);
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<T>;
    })
    .catch((e) => {
      clearTimeout(to);
      apiStatus.lastError = why(e);
      throw e;
    });
}
