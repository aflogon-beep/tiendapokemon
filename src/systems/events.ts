import type { State } from '../core/state';
import { setName } from '../data/sets';
import { season } from './seasons';

/* Eventos del día (lanzamiento, lluvia, VIP) y torneo (v10) */

export function evMul(S: State): number {
  const t = S.ev?.t;
  const ev = t === 'launch' ? 1.8 : t === 'rain' ? 0.65 : t === 'vip' ? 1.25 : 1;
  const se = ({ xmas: 1.25, hallo: 1.1, summer: 0.95 } as Record<string, number>)[season(S)] || 1;
  return ev * (S.tour ? 1.35 : 1) * se;
}

export function evLabel(S: State): string {
  const a: string[] = [], e = S.ev;
  if (e?.t === 'launch') a.push(`🎉 Lanzamiento de ${setName(e.s!)}: casi el doble de clientes y más ganas de sus sobres.`);
  if (e?.t === 'rain') a.push('🌧️ Día de lluvia: vendrá menos gente.');
  if (e?.t === 'vip') a.push('⭐ Visita VIP: vendrá alguien con mucho dinero.');
  if (S.tour) a.push('🏆 Torneo en la tienda: más coleccionistas e ingresos por inscripción.');
  return a.join(' ');
}

export function evShort(S: State): string {
  const e = S.ev, a: string[] = [];
  if (e?.t === 'launch') a.push('🎉 Lanzamiento: ' + setName(e.s!));
  if (e?.t === 'rain') a.push('🌧️ Lluvia');
  if (e?.t === 'vip') a.push('⭐ Día VIP');
  if (S.tour) a.push('🏆 Torneo');
  return a.join(' · ');
}
