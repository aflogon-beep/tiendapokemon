import type { Cond } from '../data/rarity';

/*
 * Estado de la partida: el objeto `S` de la v10, con los mismos campos y nombres para poder
 * importar sus partidas. Los campos que no conocemos se conservan tal cual (índice abierto).
 */

export type Phase = 'closed' | 'open' | 'closing';

export interface PriceState {
  /** Precio actual */
  p: number;
  /** Tendencia */
  t: number;
  /** Precio base de Cardmarket */
  b: number;
  /** Historial (máx. 60) */
  h: number[];
}

export interface Item {
  /** Id único del ejemplar */
  i: number;
  /** Id de la carta */
  c: string;
  k: Cond;
  rv: boolean;
  cost: number;
  /** En la vitrina: multiplicador sobre el precio de mercado (null = no está en la vitrina) */
  case: number | null;
  /** Reservada por un cliente */
  res: boolean;
  /** Falsa (el jugador no lo sabe) */
  fk?: boolean;
  /** Falsa descubierta */
  fkK?: boolean;
  /** Nota PGS */
  gr?: number;
  /** En gradeo */
  gq?: { due: number; svc?: string };
  /** En una peana de lujo */
  lux?: boolean;
  [extra: string]: unknown;
}

export interface Order {
  id: number;
  c: string;
  pay: number;
  due: number;
  who: string;
  reg: string;
}

export interface Mission {
  k: string;
  t: string;
  g: number;
  p: number;
  r: number;
  done: number;
  cl: number;
}

export interface RegState {
  loy: number;
  visits: number;
  note: string;
  met: boolean;
  fav: string;
  out?: unknown;
}

export interface DayEvent {
  t: 'launch' | 'rain' | 'vip';
  s?: string;
}

export interface Summary {
  day: number;
  inc: number;
  cust: number;
  lost: number;
  bought: number;
  rent: number;
  sal: number;
  tourInc: number | null;
  news: string;
  net: number;
  grN: number;
  newOrd: boolean;
  exp: number;
  fkN: number;
  refund: number;
  refN: number;
}

export interface Stats {
  inc: number;
  cust: number;
  lost: number;
  bought: number;
}

export interface State {
  tut: { on: boolean; i: number };
  money: number;
  day: number;
  sales: number;
  nid: number;
  items: Item[];
  sealed: Record<string, number>;
  /** Precio de venta de los sobres en la estantería */
  shelf: Record<string, number>;
  /** Precio mayorista (w) y precio de referencia de los clientes (ref) */
  pack: Record<string, { w: number; ref: number; init?: number }>;
  prices: Record<string, PriceState>;
  up: { cashier: number; ads: number; case: number; shelf: number };
  sets: string[];
  log: unknown[];
  phase: Phase;
  clock: number;
  stats: Stats;
  dex: Record<string, number>;
  slots: (string | null)[];
  staff: { cashier: boolean; appraiser: boolean; cm: boolean };
  decor: Record<string, boolean | number>;
  prod: Record<string, number>;
  pp: Record<string, number>;
  regs: Record<string, RegState>;
  fkRet: { got: number; reg: string | null }[];
  repB: number;
  lt: Record<string, number>;
  ach: Record<string, number>;
  albR: Record<string, number[]>;
  orders: Order[];
  grNew: number[];
  ev: DayEvent | null;
  tour: boolean;
  vipDone?: boolean;
  burst?: number;
  dm?: { day: number; list: Mission[] };
  hist?: { d: number; inc: number }[];
  summary?: Summary;
  savedAt?: number;
  orph?: Item[];
  tierSeen?: number;
  prodSeen?: boolean;
  season?: string;
  [extra: string]: unknown;
}

/** Partida nueva (newState de la v10, sin ensure) */
export function blankState(defaultSets: string[]): State {
  return {
    tut: { on: true, i: 0 },
    money: 1000,
    day: 1,
    sales: 0,
    nid: 1,
    items: [],
    sealed: {},
    shelf: {},
    pack: {},
    prices: {},
    up: { cashier: 0, ads: 0, case: 0, shelf: 0 },
    sets: defaultSets.slice(),
    log: [],
    phase: 'closed',
    clock: 0,
    stats: { inc: 0, cust: 0, lost: 0, bought: 0 },
  } as unknown as State;
}
