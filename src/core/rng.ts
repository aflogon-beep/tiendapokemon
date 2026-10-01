/*
 * Azar y utilidades numéricas de la v10. El generador se puede sustituir en los tests
 * (setRandom) para que los resultados sean reproducibles.
 */

let random: () => number = Math.random;

export function setRandom(fn: () => number): void {
  random = fn;
}

/** Generador con semilla (mulberry32) para tests */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = (): number => random();
export const rnd = (n: number): number => Math.floor(random() * n);
export const pick = <T>(a: readonly T[]): T => a[rnd(a.length)];
export const gauss = (): number => random() + random() + random() - 1.5;
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
/** Redondeo a 5 céntimos, mínimo 0,05 € */
export const r05 = (x: number): number => Math.max(0.05, Math.round(x * 20) / 20);

/** Elige una clave con probabilidad proporcional a su peso */
export function wpick<K extends string>(o: Partial<Record<K, number>>): K {
  let t = 0;
  for (const k in o) t += o[k] ?? 0;
  let r = random() * t;
  for (const k in o) {
    r -= o[k] ?? 0;
    if (r <= 0) return k;
  }
  return Object.keys(o)[0] as K;
}

/** Baraja (como .sort(() => Math.random() - .5) de la v10, pero sin sesgo) */
export function shuffle<T>(a: readonly T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
