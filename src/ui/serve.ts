import type { Game } from '../core/game';
import { canHaggle, front, pay } from '../systems/customers';
import { ui } from './ctx';
import { openCheckout, openHaggle } from './modals/checkout';
import { openSell } from './modals/deal';
import { openLot } from './modals/lot';
import { sfx } from './sound';

/** Atender al primero de la cola (serveFront de la v10) */
export function serveFront(g: Game): void {
  const c = front(g);
  if (!c || ui.M || g.paused) return;
  if (c.want.k === 'sell') return openSell(c);
  if (c.want.k === 'lot') return openLot(c);
  if (g.S.staff.cashier) {
    pay(g, c);
    sfx.chaching();
    ui.hud();
    return;
  }
  if (canHaggle(c)) openHaggle(c);
  else openCheckout(c);
}
