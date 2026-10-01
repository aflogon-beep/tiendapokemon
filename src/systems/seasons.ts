import type { State } from '../core/state';

/* Temporadas (v10): automática según la fecha o elegida en ajustes */

export type Season = 'spring' | 'summer' | 'autumn' | 'hallo' | 'winter' | 'xmas';

export const SEAS: Record<string, string> = {
  auto: 'Automática', spring: '🌸 Primavera', summer: '☀️ Verano', autumn: '🍂 Otoño',
  hallo: '🎃 Halloween', winter: '❄️ Invierno', xmas: '🎄 Navidad',
};

export function season(S: State | null, d = new Date()): Season {
  const o = S?.season || 'auto';
  if (o !== 'auto') return o as Season;
  const m = d.getMonth() + 1, dd = d.getDate();
  if (m === 12 || (m === 1 && dd <= 6)) return 'xmas';
  if ((m === 10 && dd >= 15) || (m === 11 && dd <= 2)) return 'hallo';
  return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
}
