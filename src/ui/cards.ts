import type { Game } from '../core/game';
import type { Card } from '../data/cards';
import { RAR } from '../data/rarity';
import { setName } from '../data/sets';

/* Cara de carta, versión grande y minigráfica de precio (face, faceBig, spark de la v10) */

export function face(c: Card, rv: boolean): string {
  return (
    `<div class="cf" style="--rc:${RAR[c.r].c}"><div class="fb"><b>${c.name}</b><i>${RAR[c.r].n}</i><span>${setName(c.s)}${c.num ? ' · ' + c.num : ''}</span></div>` +
    `${c.img ? `<img src="${c.img}" alt="${c.name}" loading="lazy" onerror="this.remove()">` : ''}${rv ? '<u class="rvb">Reverse</u>' : ''}</div>`
  );
}

export const big = (u: string): string => u.replace(/\.png$/, '_hires.png');

export function faceBig(c: Card, rv: boolean): string {
  return (
    `<div class="cf" style="--rc:${RAR[c.r].c}"><div class="fb"><b>${c.name}</b><i>${RAR[c.r].n}</i><span>${setName(c.s)}${c.num ? ' · ' + c.num : ''}</span></div>` +
    `${c.img ? `<img src="${big(c.img)}" alt="${c.name}" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${c.img}'}else this.remove()">` : ''}` +
    `${rv ? '<u class="rvb">Reverse</u>' : ''}</div>`
  );
}

export function spark(g: Game, id: string): string {
  const h = g.S.prices[id].h.slice(-30), mn = Math.min(...h), mx = Math.max(...h);
  const pts = h.map((v, i) => ((i / (h.length - 1)) * 84).toFixed(1) + ',' + (24 - (mx === mn ? 0.5 : (v - mn) / (mx - mn)) * 22).toFixed(1)).join(' ');
  return `<svg class="spark" viewBox="0 0 84 26"><polyline fill="none" stroke="${h[h.length - 1] >= h[0] ? '#4cc98a' : '#ff7a6b'}" stroke-width="2" points="${pts}"/></svg>`;
}

/** Variación del precio en los últimos d días */
export const chg = (g: Game, id: string, d: number): number => {
  const h = g.S.prices[id].h;
  return h[h.length - 1] / h[Math.max(0, h.length - 1 - d)] - 1;
};

export const cls = (x: number): string => (x >= 0 ? 'up' : 'down');
