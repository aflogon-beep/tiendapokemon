import type { Game } from '../core/game';

/*
 * Núcleo de la interfaz, como en la v10: un panel abierto a la vez (M), cuerpos que
 * devuelven HTML, acciones por data-a (A) y entradas por data-i (I).
 */

export interface Ui {
  g: Game | null;
  /** Panel abierto */
  M: string | null;
  prevM: string | null;
  note: string;
  saveNow(): boolean;
  hud(): void;
}

export const ui: Ui = { g: null, M: null, prevM: null, note: '', saveNow: () => true, hud: () => {} };

/** Partida en curso (los paneles solo se abren con una cargada) */
export const G = (): Game => ui.g!;

export type Act = (d: DOMStringMap, b: HTMLElement) => void;
export const A: Record<string, Act> = {};
export const I: Record<string, (el: HTMLInputElement) => void> = {};

interface ModalDef {
  body(): string;
  /** No se cierra tocando fuera */
  lock?: boolean;
  wide?: boolean;
  closeText?(): string;
  /** Qué hacer al cerrar (por defecto, cerrar sin más) */
  onClose?(): void;
  /** Tras pintar, enganchar eventos especiales */
  after?(sheet: HTMLElement): void;
}

const modals: Record<string, ModalDef> = {};
const mounts: Record<string, () => boolean | void> = {};

export function defModal(name: string, def: ModalDef): void {
  modals[name] = def;
}
/** Panel a pantalla completa con su propio dibujo (apertura de sobres, cajas…). Si devuelve false se pinta el panel normal. */
export function defMount(name: string, mount: () => boolean | void): void {
  mounts[name] = mount;
}

export const host = (): HTMLElement => document.getElementById('ovh')!;
const navListeners: (() => void)[] = [];
export const onNavChange = (f: () => void): void => void navListeners.push(f);

export function openM(t: string): void {
  ui.M = t;
  renderM();
  navListeners.forEach((f) => f());
}

export function closeM(): void {
  ui.M = null;
  ui.prevM = null;
  host().innerHTML = '';
  navListeners.forEach((f) => f());
  ui.saveNow();
  ui.hud();
}

export function renderM(): void {
  const M = ui.M;
  if (!M) {
    host().innerHTML = '';
    return;
  }
  if (mounts[M] && mounts[M]() !== false) {
    ui.prevM = M;
    return;
  }
  const def = modals[M];
  if (!def) return;
  const isNew = ui.prevM !== M;
  const old = host().querySelector('.sheet');
  const sc = old && !isNew ? old.scrollTop : 0;
  host().innerHTML =
    `<div class="ov${isNew ? ' in' : ''}"${def.lock ? '' : ' data-a="close"'}><div class="sheet${def.wide ? ' wide' : ''}${isNew ? ' in' : ''}">` +
    `${def.body()}<button class="b big" data-a="close">${def.closeText?.() ?? 'Cerrar'}</button></div></div>`;
  const sheet = host().querySelector('.sheet') as HTMLElement;
  if (sc) sheet.scrollTop = sc;
  ui.prevM = M;
  def.after?.(sheet);
}

A.m = (d) => openM(d.k!);
A.close = () => {
  const def = ui.M ? modals[ui.M] : undefined;
  if (def?.onClose) def.onClose();
  else closeM();
};

document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
  if (!b) return;
  // El fondo del panel solo cierra si se toca fuera de la hoja
  if (b.classList.contains('ov') && e.target !== b) return;
  const f = A[b.dataset.a!];
  if (f) f(b.dataset, b);
});
document.addEventListener('input', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLInputElement>('[data-i]');
  if (b && I[b.dataset.i!]) I[b.dataset.i!](b);
});
