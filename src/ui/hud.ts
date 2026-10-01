import type { Game } from '../core/game';
import { fmt } from '../core/format';
import { caseItems, DAYLEN, level, netWorth, repv, sealedCount, tierOf } from '../systems/economy';
import { evLabel } from '../systems/events';
import { front } from '../systems/customers';

/* HUD de la v10 (cabecera, reloj del día, ayuda y botón principal). Se completa en la F4. */

const $ = (id: string) => document.getElementById(id)!;
let shown: number | null = null;

export function showHud(): void {
  $('hud').hidden = false;
  $('dock').hidden = false;
}

export function hud(g: Game, note: string): void {
  const S = g.S;
  shown ??= S.money;
  $('money').innerHTML = fmt(shown) + '<small>capital</small>';
  document.documentElement.dataset.tier = String(tierOf(level(g)));
  $('lv').textContent = `Nivel ${level(g)} · Día ${S.day} · ⭐ ${repv(S)} · Empresa ${fmt(netWorth(g))}`;
  ($('clk') as HTMLElement).style.width = (S.phase === 'closed' ? 0 : Math.min(100, (S.clock / DAYLEN) * 100)) + '%';
  const a = $('act') as HTMLButtonElement, f = front(g);
  a.classList.remove('pulse');
  if (g.paused) {
    a.disabled = false;
    a.textContent = '⏸ En pausa · pulsa para continuar';
  } else if (f) {
    a.disabled = false;
    a.classList.add('pulse');
    a.textContent =
      f.want.k === 'sell' ? '🃏 Atender: quiere vender una carta'
      : f.want.k === 'lot' ? '📦 Atender: vende un lote'
      : (S.staff.cashier ? 'Cobrando… ' : '💶 Cobrar ') + fmt(f.hold!.total);
  } else if (S.phase === 'closed') {
    a.disabled = false;
    a.textContent = `Abrir la tienda (día ${S.day})`;
  } else {
    a.disabled = true;
    a.textContent = S.phase === 'open' ? 'Tienda abierta · esperando clientes…' : 'Cerrando…';
  }
  let h = '';
  if (S.phase === 'closed') {
    if (sealedCount(g) === 0 && caseItems(S).length === 0)
      h = '📦 Compra sobres en «Sobres» y ponles precio. Puedes abrirlos para sacar cartas y ponerlas en la vitrina.';
    else h = 'Todo listo. Ajusta precios, coloca cartas en la vitrina y abre la tienda.';
  } else if (S.phase === 'open')
    h = 'Los clientes hacen cola en la caja: toca «Cobrar» o pulsa sobre el cliente. Cuidado con el aburrimiento de la cola.';
  else h = 'No entran más clientes. Atiende a los que quedan.';
  const ev = evLabel(S);
  $('hint').textContent = (ev ? ev + ' ' : '') + h + (S.phase === 'closed' ? ' Pellizca la tienda para hacer zoom.' : '') + (note ? '  ·  ' + note : '');
}

/** El dinero mostrado se acerca poco a poco al real (animación de la v10) */
export function tickMoney(g: Game, raw: number): void {
  if (shown == null) return;
  const d = g.S.money - shown;
  if (Math.abs(d) <= 0.004) return;
  shown = Math.abs(d) < 0.02 ? g.S.money : shown + d * Math.min(1, raw * 7);
  const el = $('money');
  if (el.firstChild) el.firstChild.nodeValue = fmt(shown);
}
