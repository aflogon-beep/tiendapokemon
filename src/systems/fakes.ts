import { rand, shuffle } from '../core/rng';

/* Falsificaciones (v10): una falsa falla en dos de las tres pruebas (lupa, luz y balanza) */

export type Tell = 'lens' | 'light' | 'scale';

export const mkTells = (fake: boolean): Tell[] => (fake ? shuffle<Tell>(['lens', 'light', 'scale']).slice(0, 2) : []);

/** Peso en gramos: las auténticas ~1,75 g; las falsas que fallan en la balanza, ~1,55 g */
export const mkWt = (fake: boolean, tl: Tell[]): number => (fake && tl.includes('scale') ? 1.51 + rand() * 0.1 : 1.72 + rand() * 0.07);
