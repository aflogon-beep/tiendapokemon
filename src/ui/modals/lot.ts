import { fmt } from '../../core/format';
import { clamp, r05 } from '../../core/rng';
import type { Customer } from '../../systems/customers';
import { endLot, expCost, lotBuy, lotEst, lotOffer, makeLot, payExpert, payReview, type Lot } from '../../systems/lots';
import { A, closeM, defModal, G, I, openM, renderM, ui } from '../ctx';
import { cls, face } from '../cards';
import { toast } from '../toast';
import { sfx } from '../sound';

/* Lotes misteriosos (mLot de la v10) */

let LOT: Lot | null = null;

export function openLot(c: Customer): void {
  LOT = makeLot(G(), c);
  openM('lot');
}

function body(): string {
  const g = G(), L = LOT!;
  if (L.done) {
    const d = L.v - L.paid!, top = L.cards.slice().sort((a, b) => b.v - a.v).slice(0, 9);
    return (
      `<h2>¡Lote comprado!</h2><div class="pn"><div>Has pagado <b>${fmt(L.paid!)}</b> por ${L.n} cartas.</div>` +
      `<div class="est">Valor real: <b>${fmt(L.v)}</b> <span class="${cls(d)}">(${d >= 0 ? '+' : ''}${fmt(d)})</span></div>` +
      `<div class="mu">${d > L.paid! * 0.5 ? '¡Menudo chollo! 🤑' : d >= 0 ? 'Buen negocio 👍' : 'Vaya, te la han colado 😅'}</div></div>` +
      `<h3>Lo mejor del lote</h3><div class="tiles">${top.map((x) => `<div class="tile zoomable" data-a="zoom" data-k="${x.c.id}" data-n="${x.rv ? 1 : 0}">${face(x.c, x.rv)}<div class="pt">${fmt(x.v)}</div></div>`).join('')}</div>` +
      `<p class="mu">Las cartas ya están en tu colección.</p>`
    );
  }
  const [lo, hi] = lotEst(g, L), rv = L.rev.map((i) => L.cards[i]).sort((a, b) => b.v - a.v), mn = r05(L.ask * 0.4);
  return (
    `<h2>Lote misterioso</h2><div class="cust"><div class="av">👴</div><div class="sp">Vendo mi colección: ${L.n} cartas. Te la dejo en ${fmt(L.ask)}.</div></div>` +
    `<div class="pn" style="margin-top:10px"><div class="mu">${L.expert ? 'Valor exacto (experto)' : L.rev.length ? `Estimación tras revisar ${L.rev.length} cartas` : 'Estimación a ojo'}</div>` +
    `<div class="est"><b>${L.expert ? fmt(L.v) : fmt(lo) + ' – ' + fmt(hi)}</b></div>` +
    `<div class="btns"><button class="b" data-a="lotrev" data-n="10"${L.rev.length >= L.n ? ' disabled' : ''}>🔎 Revisar 10 · ${L.free ? 'gratis' : fmt(10)}</button>` +
    `<button class="b" data-a="lotrev" data-n="50"${L.rev.length >= L.n ? ' disabled' : ''}>🔎 Revisar 50 · ${fmt(35)}</button>` +
    `<button class="b" data-a="lotexp"${L.expert ? ' disabled' : ''}>🧐 Experto · ${fmt(expCost(L))}</button></div>` +
    `${rv.length ? `<div class="rev">${rv.slice(0, 60).map((x) => `<div class="tile">${face(x.c, x.rv)}<div class="pt">${fmt(x.v)}</div></div>`).join('')}</div>` : ''}</div>` +
    `${L.msg ? `<div class="pn">🗣️ ${L.msg}</div>` : ''}` +
    `<div class="pn"><div class="row"><span>Tu oferta</span><b id="lotlab">${fmt(L.offer)}</b></div><input type="range" data-i="lotx" min="${mn}" max="${L.ask}" step="0.05" value="${clamp(L.offer, mn, L.ask)}">` +
    `<div class="btns"><button class="b pri" data-a="lotbuy"${g.S.money < L.ask ? ' disabled' : ''}>Comprar por ${fmt(L.ask)}</button><button class="b" data-a="lotoff">Ofrecer</button>` +
    `${L.counter ? `<button class="b pri" data-a="lotcnt"${g.S.money < L.counter ? ' disabled' : ''}>Cerrar por ${fmt(L.counter)}</button>` : ''}<button class="b" data-a="lotno">Rechazar</button></div></div>`
  );
}

const finish = () => {
  if (LOT) endLot(G(), LOT);
  LOT = null;
  closeM();
};

defModal('lot', {
  body,
  lock: true,
  closeText: () => (LOT && !LOT.done ? 'Rechazar y cerrar' : 'Cerrar'),
  onClose: finish,
});

const NO_MONEY = () => toast('No tienes dinero suficiente');

function buy(p: number): void {
  const g = G(), L = LOT!;
  if (!lotBuy(g, L, p)) return NO_MONEY();
  sfx.chaching();
  if (L.v - p > p * 0.5) g.fx.shake(6);
  ui.hud();
  renderM();
}

I.lotx = (el) => {
  LOT!.offer = +el.value;
  document.getElementById('lotlab')!.textContent = fmt(LOT!.offer);
};
A.lotrev = (d) => {
  if (!payReview(G(), LOT!, +d.n! as 10 | 50)) return NO_MONEY();
  sfx.flip();
  ui.hud();
  renderM();
};
A.lotexp = () => {
  if (!payExpert(G(), LOT!)) return NO_MONEY();
  sfx.ach();
  ui.hud();
  renderM();
};
A.lotbuy = () => buy(LOT!.ask);
A.lotcnt = () => buy(LOT!.counter);
A.lotoff = () => {
  const L = LOT!, r = lotOffer(L);
  if (r === 'buy') return buy(L.offer);
  if (r === 'counter') {
    sfx.err();
    renderM();
    return;
  }
  finish();
  toast('El coleccionista se ha ido');
};
A.lotno = finish;
