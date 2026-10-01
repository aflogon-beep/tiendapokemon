/* Rarezas, mapa de la API y estado de las cartas (tal cual en la v10) */

export type Rarity = 'C' | 'U' | 'R' | 'DR' | 'IR' | 'UR' | 'SIR' | 'HR';
export type Cond = 'NM' | 'LP' | 'MP';

export const RAR: Record<Rarity, { n: string; c: string; def: number }> = {
  C: { n: 'Común', c: '#8a94a3', def: 0.05 },
  U: { n: 'Poco común', c: '#4a86c9', def: 0.1 },
  R: { n: 'Rara', c: '#b48a1e', def: 0.4 },
  DR: { n: 'Doble rara', c: '#d9782a', def: 2.5 },
  IR: { n: 'Ilustración rara', c: '#2fa557', def: 8 },
  UR: { n: 'Ultra rara', c: '#8e4cb5', def: 8 },
  SIR: { n: 'Ilustración especial', c: '#d9402a', def: 40 },
  HR: { n: 'Hyper rara', c: '#c9950f', def: 12 },
};

export const RMAP: Record<string, Rarity> = {
  Common: 'C', Uncommon: 'U', Rare: 'R',
  'Rare Holo': 'DR', 'Rare Holo EX': 'DR', 'Rare Holo GX': 'DR', 'Rare Holo V': 'DR', 'Rare Holo VMAX': 'DR',
  'Rare Holo VSTAR': 'DR', 'Rare Holo LV.X': 'DR', 'Rare Holo Star': 'DR', 'Rare Prime': 'DR', LEGEND: 'DR',
  'Rare BREAK': 'DR', 'Double Rare': 'DR', 'ACE SPEC Rare': 'DR', 'Rare ACE': 'DR',
  'Radiant Rare': 'IR', 'Amazing Rare': 'IR', 'Illustration Rare': 'IR', 'Trainer Gallery Rare Holo': 'IR',
  'Classic Collection': 'IR',
  'Ultra Rare': 'UR', 'Rare Ultra': 'UR', 'Shiny Rare': 'UR', 'Shiny Ultra Rare': 'UR', 'Rare Shiny': 'UR',
  'Rare Shiny GX': 'UR',
  'Special Illustration Rare': 'SIR',
  'Hyper Rare': 'HR', 'Rare Secret': 'HR', 'Rare Rainbow': 'HR', 'Mega Hyper Rare': 'HR',
};

/** Rareza de una carta de la API; las desconocidas se clasifican por palabras clave (no se descartan) */
export function rarOf(d: { rarity?: string | null }): Rarity {
  const r = d.rarity;
  if (r && RMAP[r]) return RMAP[r];
  if (!r) return 'R';
  if (/secret|rainbow|hyper|gold|black white/i.test(r)) return 'HR';
  if (/special illustration/i.test(r)) return 'SIR';
  if (/illustration|radiant|amazing|gallery/i.test(r)) return 'IR';
  if (/ultra|shiny|shining|prism|star|vmax|vstar|gx|ex|lv\.x|break|legend/i.test(r)) return 'UR';
  if (/holo|double/i.test(r)) return 'DR';
  if (/uncommon/i.test(r)) return 'U';
  if (/common/i.test(r)) return 'C';
  return 'R';
}

export const COND: Record<Cond, number> = { NM: 1, LP: 0.85, MP: 0.7 };

/** Orden de rarezas de mayor a menor (para buscar la siguiente disponible) */
export const RORD: Rarity[] = ['HR', 'SIR', 'UR', 'IR', 'DR', 'R', 'U', 'C'];
