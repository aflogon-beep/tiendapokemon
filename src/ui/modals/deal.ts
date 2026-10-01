import { fmt } from '../../core/format';
import { clamp, r05 } from '../../core/rng';
import type { Card } from '../../data/cards';
import { RAR } from '../../data/rarity';
import { setName } from '../../data/sets';
import { say, type Customer, type Deal } from '../../systems/customers';
import { accuseDeal, closeDeal, finishDeal, offerDeal } from '../../systems/deals';
import { mkTells, mkWt, type Tell } from '../../systems/fakes';
import { groupItems } from '../../systems/inventory';
import { RG } from '../../systems/regulars';
import { A, closeM, defModal, G, I, openM, renderM, ui } from '../ctx';
import { face, faceBig } from '../cards';
import { toast } from '../toast';
import { sfx } from '../sound';
import { collUi } from './coll';

/* Comprar cartas a clientes (mSell) y examinar falsificaciones (mInsp) de la v10 */

let deal: (Deal & { tells?: Tell[]; wt?: number }) | null = null;

interface Insp {
  c: Card;
  rv: boolean;
  fake: boolean;
  src: 'deal' | 'coll';
  item?: number;
  tells: Tell[];
  wt: number;
  mode: Tell;
}
let INSP: Insp | null = null;

export function openSell(c: Customer): void {
  deal = c.deal!;
  deal.cust = c;
  openM('sell');
}

function sellBody(): string {
  const g = G(), d = deal!, mn = r05(d.val * 0.3), mx = r05(d.val * 1.1), R = d.reg ? RG(d.reg) : null;
  return (
    `<h2>${R ? R.e + ' ' + R.n + ' quiere venderte' : 'Un cliente quiere vender'}</h2><div class="pn" style="display:flex;gap:12px"><div style="width:120px;flex:none">${face(d.c, d.rv)}</div>` +
    `<div style="flex:1"><b>${d.c.name}</b> <span class="mu">${d.k}${d.rv ? ' · Reverse' : ''}</span><div class="mu">${RAR[d.c.r].n} · ${setName(d.c.s)}</div>` +
    `<div>Valor de mercado: <b>${fmt(d.val)}</b></div><div>Pide: <b>${fmt(d.ask)}</b></div>` +
    `${d.msg ? `<div style="margin-top:8px;background:var(--panel2);border-radius:8px;padding:8px">🗣️ ${d.msg}</div>` : ''}</div></div>` +
    `<div class="pn"><div class="row"><span>Tu oferta</span><b id="olab">${fmt(d.offer)}</b></div><input type="range" data-i="offer" min="${mn}" max="${mx}" step="0.05" value="${clamp(d.offer, mn, mx)}">` +
    `<div class="mu">Si compras por debajo de mercado, luego lo vendes con margen.</div>` +
    `<div class="btns"><button class="b pri" data-a="dealoffer">Ofrecer</button><button class="b" data-a="dealask"${g.S.money < d.ask ? ' disabled' : ''}>Pagar lo que pide (${fmt(d.ask)})</button>` +
    `${d.counter ? `<button class="b pri" data-a="dealcounter"${g.S.money < d.counter ? ' disabled' : ''}>Cerrar por ${fmt(d.counter)}</button>` : ''}` +
    `<button class="b" data-a="inspd">🔍 Examinar${d.chk ? ' ✔' : ''}</button><button class="b" data-a="dealno">Rechazar</button></div></div>`
  );
}

const endDeal = (angry: boolean) => {
  closeDeal(G(), deal?.cust, angry);
  deal = null;
  closeM();
};

defModal('sell', { body: sellBody, lock: true, onClose: () => endDeal(false) });

function buy(p: number): void {
  const d = deal!, r = finishDeal(G(), d, p);
  if (!r.ok) {
    toast(r.msg);
    return;
  }
  toast(`Comprada ${d.c.name} por ${fmt(p)}`);
  deal = null;
  closeM();
}

I.offer = (el) => {
  deal!.offer = +el.value;
  document.getElementById('olab')!.textContent = fmt(+el.value);
};
A.dealask = () => buy(deal!.ask);
A.dealcounter = () => buy(deal!.counter);
A.dealno = () => endDeal(false);
A.dealoffer = () => {
  const d = deal!, o = +(document.querySelector('[data-i=offer]') as HTMLInputElement).value, r = offerDeal(d, o);
  if (r.k === 'buy') return buy(r.price);
  if (r.k === 'angry') {
    say(d.cust!, '😠');
    return endDeal(true);
  }
  renderM();
};

/* --- examinar con lupa, luz y balanza --- */
A.inspd = () => {
  const d = deal!;
  d.tells ||= mkTells(d.fake);
  d.wt ||= mkWt(d.fake, d.tells);
  INSP = { c: d.c, rv: d.rv, fake: !!d.fake, src: 'deal', tells: d.tells, wt: d.wt, mode: 'lens' };
  openM('insp');
};

A.inspc = () => {
  const g = G(), l = groupItems(g, collUi.sel!).filter((i) => !i.res && !i.gq && !i.fkK), it = l.find((i) => i.fk) || l[0];
  if (!it) return;
  it.tl ||= mkTells(!!it.fk);
  it.wg ||= mkWt(!!it.fk, it.tl as Tell[]);
  INSP = { c: g.db.byId[it.c], rv: it.rv, fake: !!it.fk, src: 'coll', item: it.i, tells: it.tl as Tell[], wt: it.wg as number, mode: 'lens' };
  openM('insp');
};

function inspBody(): string {
  const X = INSP!, c = X.c, t = X.tells, lensFk = X.fake && t.includes('lens'), lightFk = X.fake && t.includes('light');
  const tabs = [['lens', '🔍 Lupa'], ['light', '💡 Luz'], ['scale', '⚖️ Balanza']].map(([k, n]) => `<button class="b ${X.mode === k ? 'on' : ''}" data-a="imode" data-k="${k}">${n}</button>`).join('');
  const info = {
    lens: 'Mueve el dedo por la carta. Las auténticas tienen el texto y los bordes nítidos, sin trama de puntos de colores.',
    light: 'Luz por detrás: las auténticas tienen una capa interior negra y casi no deja pasar la luz.',
    scale: 'Una carta auténtica pesa unos 1,75 g.',
  }[X.mode];
  const stage =
    X.mode === 'scale'
      ? `<div class="scale"><div class="scl-card">${face(c, X.rv)}</div><div class="scl-base"><div class="scl-lcd">${X.wt.toFixed(2).replace('.', ',')} g</div></div></div>`
      : `<div class="insp${X.mode === 'light' ? ' light' : ''}${X.mode === 'light' && lightFk ? ' thru' : ''}${lensFk ? ' fk' : ''}" id="insp"><div class="ic">${faceBig(c, X.rv)}</div>` +
        `${X.mode === 'lens' ? `<div class="lens" id="lens"><div class="lin">${faceBig(c, X.rv)}</div>${lensFk ? '<div class="ldots"></div>' : ''}</div>` : ''}</div>`;
  return (
    `<h2>Examinar carta</h2><div class="tabs">${tabs}</div><div class="mu" style="margin-bottom:10px">${info}</div>${stage}` +
    `<div class="pn" style="margin-top:12px"><b>${c.name}</b> <span class="mu">${RAR[c.r].n} · ${setName(c.s)}</span><div class="mu">Usa las tres pruebas si dudas: una falsificación suele fallar en dos.</div>` +
    `<div class="btns"><button class="b pri" data-a="iok">✅ Es auténtica</button><button class="b" data-a="ifake">❌ Es falsa</button></div></div>`
  );
}

// La lupa sigue al dedo y amplía ×2,6
function bindInsp(): void {
  const el = document.getElementById('insp'), ln = document.getElementById('lens');
  if (!el || !ln) return;
  const r0 = el.getBoundingClientRect(), li = ln.querySelector('.lin') as HTMLElement;
  li.style.setProperty('--cw0', r0.width + 'px');
  li.style.setProperty('--ch0', r0.height + 'px');
  const mv = (x: number, y: number) => {
    ln.style.setProperty('--lx', x + 'px');
    ln.style.setProperty('--ly', y + 'px');
    li.style.setProperty('--tx', 65 - x * 2.6 + 'px');
    li.style.setProperty('--ty', 65 - y * 2.6 + 'px');
  };
  mv(r0.width * 0.5, r0.height * 0.3);
  const h = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    mv(clamp(e.clientX - r.left, 0, r.width), clamp(e.clientY - r.top, 0, r.height));
  };
  el.addEventListener('pointermove', h);
  el.addEventListener('pointerdown', h);
}

const backFromInsp = () => {
  const src = INSP?.src;
  INSP = null;
  openM(src === 'deal' && deal ? 'sell' : 'coll');
};

defModal('insp', { body: inspBody, lock: true, closeText: () => 'Volver', onClose: backFromInsp, after: bindInsp });

A.imode = (d) => {
  INSP!.mode = d.k as Tell;
  sfx.flip();
  renderM();
};
A.iok = () => {
  const src = INSP!.src;
  INSP = null;
  if (src === 'deal') {
    deal!.chk = true;
    openM('sell');
  } else openM('coll');
};
A.ifake = () => {
  const X = INSP!, g = G();
  INSP = null;
  if (X.src === 'deal') {
    const d = deal!;
    if (accuseDeal(g, d)) {
      toast('🕵️ ¡Bien visto! Era falsa · +1 ⭐');
      sfx.ach();
    } else {
      toast('😬 Era auténtica. Se ha ido ofendido');
      sfx.err();
    }
    deal = null;
    closeM();
    return;
  }
  const it = g.S.items.find((i) => i.i === X.item);
  if (it) {
    g.S.items.splice(g.S.items.indexOf(it), 1);
    if (it.fk) {
      toast('🗑️ Tirada: era falsa. ¡Bien visto!');
      sfx.ach();
    } else {
      toast('😬 Has tirado una carta auténtica…');
      sfx.err();
    }
  }
  collUi.sel = null;
  ui.hud();
  openM('coll');
};
