import type { CardDB } from '../data/cards';
import type { SetDef } from '../data/sets';
import type { Customer } from '../systems/customers';
import type { NavGrid } from '../systems/nav';
import type { State } from './state';

/*
 * Contexto de una partida: el estado guardable `S` más lo que la v10 tenía en variables
 * globales (cartas cargadas, clientes en pantalla, cola…). Los sistemas reciben este objeto.
 */

export type Mode = 'real' | 'offline';

export type Sound = 'bell' | 'coin' | 'chaching' | 'shutter' | 'ach' | 'print';

/** Efectos que los sistemas piden a la interfaz y al mundo 3D (todos opcionales) */
export interface GameFx {
  toast(html: string): void;
  sound(s: Sound): void;
  hearts(c: Customer, n: number): void;
  coins(c: Customer, amount: number): void;
  shake(v: number): void;
  /** Fin del día: mostrar el ticket */
  daySummary(): void;
}

export interface Game {
  S: State;
  db: CardDB;
  mode: Mode;
  /** Sets activos con cartas cargadas (SETS en la v10) */
  sets: SetDef[];
  /** Valor esperado de un sobre por set (EVC) */
  evc: Record<string, number>;
  custs: Customer[];
  queue: Customer[];
  cid: number;
  spawnT: number;
  nav: NavGrid;
  fx: GameFx;
  paused: boolean;
  speed: number;
}

export const noFx: GameFx = {
  toast() {},
  sound() {},
  hearts() {},
  coins() {},
  shake() {},
  daySummary() {},
};
