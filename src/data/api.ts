// Cliente mínimo de pokemontcg.io con tiempo de espera
export const API = 'https://api.pokemontcg.io/v2/';

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
      throw e;
    });
}
