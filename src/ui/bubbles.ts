import type { Game } from '../core/game';
import { front } from '../systems/customers';
import { RG } from '../systems/regulars';

/* Bocadillos, nombre de los habituales y paciencia en la cola (drawCust de la v10) */

const box = () => document.getElementById('bubbles')!;
const els = new Map<number, HTMLDivElement>();

export function drawBubbles(g: Game, heads: Map<number, { x: number; y: number }>): void {
  const f = front(g);
  const seen = new Set<number>();
  for (const c of g.custs) {
    const p = heads.get(c.id);
    if (!p) continue;
    seen.add(c.id);
    let el = els.get(c.id);
    if (!el) {
      el = document.createElement('div');
      box().appendChild(el);
      els.set(c.id, el);
    }
    let b = c.bub;
    if (!b && f === c) b = c.want.k === 'sell' ? '🃏 ¿Compras?' : c.want.k === 'lot' ? '📦 ¿Un lote?' : '💶';
    let html = '';
    if (b) html += `<div class="bub" style="left:${p.x}px;top:${p.y - 22}px">${b}</div>`;
    if (c.reg) html += `<div class="tag" style="left:${p.x}px;top:${p.y - 4}px">${RG(c.reg).n}</div>`;
    if (c.st === 'wait') {
      const k = Math.max(0, 1 - c.wt / c.pat), col = k > 0.5 ? '#4cc98a' : k > 0.25 ? '#f2b705' : '#ff7a6b';
      html += `<div class="pat" style="left:${p.x}px;top:${p.y + 2}px"><i style="width:${k * 100}%;background:${col}"></i></div>`;
    }
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  for (const [id, el] of els)
    if (!seen.has(id)) {
      el.remove();
      els.delete(id);
    }
}
