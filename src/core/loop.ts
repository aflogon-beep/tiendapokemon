import type { Game } from './game';
import { saveState } from './save';
import { tickDay } from '../systems/day';

/*
 * Bucle de juego (frame() de la v10, sin el dibujo): avanza el día con la velocidad elegida,
 * refresca el HUD y guarda cada 10 s, al ocultar o cerrar la página y al terminar el día.
 */

const SAVE_EVERY = 10;
const HUD_EVERY = 0.25;
const MAX_STEP = 0.05;

export interface Loop {
  frame(raw: number): void;
  saveNow(): boolean;
}

export function createLoop(g: Game, opts: { save: boolean; onHud(): void; onSaveFail(): void }): Loop {
  let hudT = 0, saveT = 0;

  const saveNow = () => {
    if (!opts.save) return true;
    const ok = saveState(g.S, g.mode);
    if (!ok) opts.onSaveFail();
    return ok;
  };

  window.addEventListener('beforeunload', () => saveNow());
  window.addEventListener('pagehide', () => saveNow());
  // Al salir de la app en el móvil: pausa si la tienda está abierta y guarda
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (g.S.phase !== 'closed') g.paused = true;
    saveNow();
    opts.onHud();
  });

  return {
    saveNow,
    frame(raw) {
      raw = Math.min(MAX_STEP, raw);
      if (!g.paused) tickDay(g, raw * g.speed);
      hudT += raw;
      saveT += raw;
      if (hudT > HUD_EVERY) {
        hudT = 0;
        opts.onHud();
      }
      if (saveT > SAVE_EVERY) {
        saveT = 0;
        saveNow();
      }
    },
  };
}
