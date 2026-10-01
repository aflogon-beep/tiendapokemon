import { pick, r05, rand } from '../core/rng';
import { fmt } from '../core/format';
import type { Customer } from './customers';

/* Regateo (v10): el cliente pide rebaja de una carta de la vitrina */

export interface Haggle {
  c: Customer;
  /** Precio de vitrina */
  full: number;
  /** Lo que ofrece */
  offer: number;
  /** Máximo que aceptaría (oculto) */
  max: number;
  /** Nuestra contraoferta */
  x: number;
  tries: number;
  msg: string;
}

export function startHaggle(c: Customer): Haggle {
  c.hg = true;
  const full = r05(c.hold!.total), offer = r05(full * (0.74 + rand() * 0.14));
  return { c, full, offer, max: offer + (full - offer) * (0.3 + rand() * 0.7), x: r05((offer + full) / 2), tries: 0, msg: `¿Me la dejas en ${fmt(offer)}?` };
}

/** Contraoferta: acepta si no pasa de su máximo; al segundo intento fallido se enfada */
export function counterOffer(h: Haggle): 'deal' | 'again' | 'angry' {
  if (h.x <= h.max) {
    h.msg = '¡Trato hecho!';
    return 'deal';
  }
  h.tries++;
  if (h.tries >= 2) return 'angry';
  h.msg = pick(['Uff… es demasiado. ¿Algo menos?', 'No sé, no sé… baja un poco más.']);
  return 'again';
}

/** Precio fijo: lo acepta si estaba dispuesto a casi todo o por suerte */
export const fixedPrice = (h: Haggle): boolean => h.max >= h.full * 0.95 || rand() < 0.35;
