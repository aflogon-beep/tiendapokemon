import { fmt } from '../../core/format';
import { setName } from '../../data/sets';
import { DENOMS, finishCheckout, giveChange, startCheckout, tpvKey, tpvOk, type Checkout } from '../../systems/checkout';
import { leave, say, type Customer } from '../../systems/customers';
import { counterOffer, fixedPrice, startHaggle, type Haggle } from '../../systems/haggle';
import { pInfo } from '../../systems/products';
import { track } from '../../systems/missions';
import { itemVal } from '../../systems/economy';
import { hearts, loy, RG, regS } from '../../systems/regulars';
import { A, closeM, defModal, G, I, openM, renderM, ui } from '../ctx';
import { face } from '../cards';
import { toast } from '../toast';
import { sfx } from '../sound';

/* Caja con efectivo y TPV (mCk) y regateo (mHag) de la v10 */

let CK: Checkout | null = null;
let HG: Haggle | null = null;

export function openCheckout(c: Customer): void {
  CK = startCheckout(c);
  if (CK.m === 'cash') sfx.drawer();
  openM('ck');
}

export function openHaggle(c: Customer): void {
  HG = startHaggle(c);
  openM('hag');
}

const denCls = (v: number) => (v >= 500 ? 'bill e' + v / 100 : v === 200 ? 'coin cb2' : v === 100 ? 'coin cb' : v >= 10 ? 'coin cg' : 'coin cc');
const denLab = (v: number) => (v >= 100 ? v / 100 + ' €' : v + ' c');

/** Cara del cliente y su frase (los habituales con nombre y corazones) */
export function custTop(c: Customer, line: string): string {
  const g = G(), R = c.reg ? RG(c.reg) : null;
  const av = R ? R.e : ({ kid: '🧒', collector: '🧑', investor: '🧑‍💼', whale: '🤑' } as Record<string, string>)[c.type] || '🙂';
  return `<div class="cust"><div class="av">${av}</div><div class="sp">${R ? `<b>${R.n}</b> <span style="font-size:11px">${hearts(regS(g.S, c.reg!).loy)}</span><br>` : ''}${line}</div></div>`;
}

function ckBody(): string {
  const g = G(), k = CK!, c = k.c, h = c.hold!;
  const items =
    h.k === 'prod' ? `${pInfo(g.S, h.pid!)!.ic} ${pInfo(g.S, h.pid!)!.n}`
    : h.k === 'pack' ? `${h.qty} × sobre ${setName(h.s!)} · ${fmt(g.S.shelf[h.s!])} c/u`
    : `${g.db.byId[h.it!.c].name}${h.it!.gr ? ' · PGS ' + h.it!.gr : ''} · carta suelta`;
  const top = `${custTop(c, k.say)}<div class="lcd"><span>TOTAL</span><b>${fmt(k.tc / 100)}</b></div><div class="ckitems">${items}</div>`;
  if (k.m === 'cash') {
    const due = k.paid - k.tc, giv = k.given.reduce((a, b) => a + b, 0), df = giv - due;
    const paid = `<div class="pn" style="text-align:center;margin:0"><div class="mu">Te paga con</div><div class="paid"><div class="${denCls(Math.min(k.paid, 10000))}">${fmt(k.paid / 100)}</div></div></div>`;
    if (due === 0) return `<h2>Caja</h2><div class="ckwrap">${top}${paid}<button class="b pri big" data-a="ckgive">Cobrar · importe exacto</button></div>`;
    return (
      `<h2>Caja</h2><div class="ckwrap">${top}${paid}` +
      `<div class="chg"><div class="pn"><span class="mu">Cambio a devolver</span><b>${fmt(due / 100)}</b></div><div class="pn"><span class="mu">Entregado</span><b class="${df === 0 ? 'up' : df > 0 ? 'down' : ''}">${fmt(giv / 100)}</b></div></div>` +
      `<div class="tray">${k.given.length ? k.given.map((v, i) => `<button class="${denCls(v)}" data-a="ckrem" data-n="${i}">${denLab(v)}</button>`).join('') : '<span class="mu">Toca billetes y monedas del cajón para dar el cambio. Toca aquí uno para quitarlo.</span>'}</div>` +
      `<div class="drawer">${DENOMS.map((r) => `<div class="drow">${r.map((v) => `<button class="${denCls(v)}" data-a="ckadd" data-n="${v}">${denLab(v)}</button>`).join('')}</div>`).join('')}</div>` +
      `<div class="btns"><button class="b" data-a="ckclr"${k.given.length ? '' : ' disabled'}>Borrar</button><button class="b pri" data-a="ckgive" style="flex:1">Entregar cambio</button></div></div>`
    );
  }
  const busy = k.st === 'tap' || k.st === 'ok';
  return (
    `<h2>Caja</h2><div class="ckwrap">${top}<div class="tpv${k.st === 'ok' ? ' appr' : ''}${k.err ? ' shake' : ''}"><div class="tpvscr"><div class="ms">${k.msg || 'IMPORTE'}</div><div class="amt">${fmt((+k.typed || 0) / 100)}</div></div>` +
    (busy
      ? `<div class="card3"></div><div class="nfc">${k.st === 'ok' ? '✔ Pago aprobado · imprimiendo ticket…' : '📶 Esperando la tarjeta…'}</div>`
      : `<div class="keys">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((x) => `<button class="key${x === 'C' ? ' cl' : x === '⌫' ? ' bs' : ''}" data-a="ckkey" data-k="${x}">${x}</button>`).join('')}</div>` +
        `<button class="key ok" style="width:100%;margin-top:8px" data-a="ckok">OK</button><div class="nfc">Teclea el total (en céntimos: 735 = 7,35 €) y pulsa OK</div>`) +
    `</div></div>`
  );
}

defModal('ck', {
  body: ckBody,
  lock: true,
  closeText: () => 'Atender luego',
  onClose: () => {
    CK = null;
    closeM();
  },
});

function finish(recv: number): void {
  const k = CK!;
  CK = null;
  closeM();
  finishCheckout(G(), k, recv);
  sfx.chaching();
  ui.hud();
}

A.ckadd = (d) => {
  CK!.given.push(+d.n!);
  if (+d.n! >= 500) sfx.bill();
  else sfx.coin();
  renderM();
};
A.ckrem = (d) => {
  CK!.given.splice(+d.n!, 1);
  sfx.coin();
  renderM();
};
A.ckclr = () => {
  CK!.given = [];
  renderM();
};
A.ckgive = () => {
  const k = CK!, r = giveChange(G(), k);
  if (!r.ok) {
    k.say = `¡Me falta cambio! Faltan ${fmt(r.missing / 100)} 😕`;
    sfx.err();
    renderM();
    return;
  }
  if (r.extra > 0) toast(`Has dado ${fmt(r.extra / 100)} de más`);
  if (r.tip) toast('🙏 Propina: +' + fmt(r.tip));
  finish((k.paid - k.given.reduce((a, b) => a + b, 0)) / 100 + r.tip);
};
A.ckkey = (d) => {
  sfx.key();
  tpvKey(CK!, d.k!);
  renderM();
};
A.ckok = () => {
  const k = CK!, r = tpvOk(k);
  if (r === 'empty') return;
  if (r === 'rejected') {
    sfx.err();
    renderM();
    setTimeout(() => {
      if (CK === k) k.err = 0;
    }, 400);
    return;
  }
  sfx.key();
  renderM();
  const v = +k.typed;
  setTimeout(() => {
    if (CK !== k) return;
    k.st = 'ok';
    k.msg = 'APROBADO';
    sfx.ok();
    renderM();
    setTimeout(() => {
      if (CK !== k) return;
      if (v < k.tc) toast('Has cobrado ' + fmt((k.tc - v) / 100) + ' de menos');
      track(G(), 'cardpay');
      finish(v / 100);
    }, 950);
  }, 850);
};

/* --- regateo --- */
function hagBody(): string {
  const g = G(), h = HG!, it = h.c.hold!.it!, cd = g.db.byId[it.c];
  return (
    `<h2>Regateo</h2><div class="pn" style="display:flex;gap:12px"><div style="width:100px;flex:none">${face(cd, it.rv)}</div><div style="flex:1;min-width:0">` +
    `<b>${cd.name}</b>${it.gr ? ` <span class="mu">PGS ${it.gr}</span>` : ''}<div>En vitrina: <b>${fmt(h.full)}</b></div>` +
    `<div class="mu">Mercado: ${fmt(itemVal(g, it))}</div><div style="margin-top:8px;background:var(--panel2);border-radius:8px;padding:8px">🗣️ ${h.msg}</div></div></div>` +
    `<div class="pn"><div class="row"><span>Tu contraoferta</span><b id="hglab">${fmt(h.x)}</b></div><input type="range" data-i="hgx" min="${h.offer}" max="${h.full}" step="0.05" value="${h.x}">` +
    `<div class="btns"><button class="b" data-a="hgacc">Aceptar ${fmt(h.offer)}</button><button class="b pri" data-a="hgcnt">Contraofertar</button><button class="b" data-a="hgfix">Precio fijo</button></div></div>`
  );
}

defModal('hag', {
  body: hagBody,
  lock: true,
  onClose: () => {
    HG = null;
    closeM();
  },
});

// Trato cerrado: el cliente paga el precio pactado en la caja
function dealHg(v: number): void {
  const c = HG!.c;
  c.hold!.total = v;
  HG = null;
  openCheckout(c);
}
function angry(): void {
  const c = HG!.c;
  say(c, '😤');
  leave(G(), c, true);
  HG = null;
  closeM();
}

I.hgx = (el) => {
  HG!.x = +el.value;
  document.getElementById('hglab')!.textContent = fmt(HG!.x);
};
A.hgacc = () => {
  loy(G(), HG!.c.reg, 3);
  dealHg(HG!.offer);
};
A.hgcnt = () => {
  const h = HG!, r = counterOffer(h);
  if (r === 'deal') return dealHg(h.x);
  sfx.err();
  if (r === 'angry') return angry();
  renderM();
};
A.hgfix = () => {
  if (fixedPrice(HG!)) dealHg(HG!.full);
  else angry();
};
