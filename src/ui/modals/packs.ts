import type { Game } from '../../core/game';
import { fmt } from '../../core/format';
import { RAR } from '../../data/rarity';
import { buyPacks, buyProd, openProd, packCost, setProdPrice, setShelfPrice } from '../../systems/inventory';
import { calcEV, eraCfg, poolR, rvPool } from '../../systems/packs';
import { ACC, pInfo, pPrice, pStock, PTYPES } from '../../systems/products';
import { price, rvr } from '../../systems/economy';
import { A, defModal, G, openM, renderM, ui } from '../ctx';
import { toast } from '../toast';
import { sfx } from '../sound';
import { startBoxOpening, openPacksUi } from '../packOpening';

/* Panel «Stock» de la v10 (mPacks): sobres, sellado y accesorios */

let pTab: 'packs' | 'sealed' | 'acc' = 'packs';

const packTabs = () =>
  `<div class="tabs">${[['packs', '🎴 Sobres'], ['sealed', '🗃️ Sellado'], ['acc', '🛡️ Accesorios']]
    .map(([k, n]) => `<button class="b ${pTab === k ? 'on' : ''}" data-a="ptab" data-k="${k}">${n}</button>`)
    .join('')}</div>`;

// Probabilidades y valor esperado del sobre (evBreak)
function evBreak(g: Game, sid: string): string {
  const e = eraCfg(sid);
  const avg = (l: { id: string }[]) => (l.length ? l.reduce((a, c) => a + price(g, c.id), 0) / l.length : 0);
  const R: [string, number][] = [
    [e.C + ' comunes', e.C * avg(poolR(g, sid, 'C'))],
    [e.U + ' poco comunes', e.U * avg(poolR(g, sid, 'U'))],
  ];
  if (e.rv) {
    const l = rvPool(g, sid);
    R.push(['1 reverse', l.length ? l.reduce((a, c) => a + price(g, c.id) * rvr(c), 0) / l.length : 0]);
  }
  e.slot.forEach(([r, p]) => R.push([(p * 100).toFixed(1).replace('.', ',') + ' % ' + RAR[r].n, p * avg(poolR(g, sid, r))]));
  return (
    `<details><summary class="mu">Probabilidades y valor esperado</summary><p class="mu">${e.d}</p><table class="tb">` +
    R.map((x) => `<tr><td>${x[0]}</td><td>${fmt(x[1])}</td></tr>`).join('') +
    `<tr><td><b>Total</b></td><td><b>${fmt(R.reduce((a, x) => a + x[1], 0))}</b></td></tr></table></details>`
  );
}

function prodRow(g: Game, pid: string): string {
  const S = g.S, i = pInfo(S, pid);
  if (!i) return '';
  const q = pStock(S, pid), pr = pPrice(S, pid), st = pr >= 20 ? 1 : pr >= 5 ? 0.5 : 0.25;
  const buys = i.t === 'acc' ? [6, 24] : i.t === 'box' ? [1, 3] : [1, 4];
  return (
    `<div class="pn"><div class="row"><b>${i.ic} ${i.n}</b><span class="mu">Stock: <b>${q}</b></span></div>` +
    `<div class="row"><span class="mu">Mayorista ${fmt(i.w)} · clientes ~${fmt(i.ref)}${i.packs ? ` · ${i.packs} sobres` : ''}</span>` +
    `<span class="step"><button class="b" data-a="pp" data-k="${pid}" data-n="-${st}">−</button><b>${fmt(pr)}</b><button class="b" data-a="pp" data-k="${pid}" data-n="${st}">+</button></span></div>` +
    `<div class="btns">${buys.map((n) => `<button class="b" data-a="buyprod" data-k="${pid}" data-n="${n}"${S.money < i.w * n ? ' disabled' : ''}>×${n} · ${fmt(i.w * n)}</button>`).join('')}` +
    `${i.packs ? `<button class="b pri" data-a="openprod" data-k="${pid}"${q < 1 ? ' disabled' : ''}>Abrir → ${i.packs} sobres</button>` : ''}</div></div>`
  );
}

function body(): string {
  const g = G(), S = g.S;
  if (pTab === 'sealed')
    return (
      `<h2>Stock</h2>${packTabs()}<p class="mu">Se venden en el mueble central. Si abres uno, sus sobres pasan a tu stock de sobres.</p>` +
      g.sets.map((sd) => `<h3>${sd.n}</h3>` + Object.keys(PTYPES).map((t) => prodRow(g, t + ':' + sd.id)).join('')).join('')
    );
  if (pTab === 'acc')
    return `<h2>Stock</h2>${packTabs()}<p class="mu">Poco dinero por unidad pero mucho margen. Los compran sobre todo niños y jugadores.</p>` + ACC.map((a) => prodRow(g, 'acc:' + a.id)).join('');
  return (
    `<h2>Stock</h2>${packTabs()}` +
    g.sets
      .map((sd) => {
        const s = sd.id, p = S.pack[s], q = S.sealed[s];
        return (
          `<div class="pn"><div class="row"><b style="color:${sd.col}">${sd.n}</b><span class="mu">Mayorista ${fmt(p.w)} · valor esperado ${fmt(g.evc[s] ?? calcEV(g, s))}</span></div>` +
          `<div class="row"><span>Stock: <b>${q}</b></span><span class="step"><button class="b" data-a="shelf" data-k="${s}" data-n="-.25">−</button><b>${fmt(S.shelf[s])}</b><button class="b" data-a="shelf" data-k="${s}" data-n=".25">+</button></span></div>` +
          `<div class="mu">Precio en estantería. Los clientes pagan alrededor de ${fmt(p.ref)}.</div>` +
          `${q > 0 && !S.slots.includes(s) ? '<div class="mu down">Sin hueco en las estanterías. Compra la mejora «Segunda fila» o agota otro set.</div>' : ''}${evBreak(g, s)}` +
          `<div class="btns">${[1, 6, 36].map((n) => { const c = packCost(g, s, n); return `<button class="b" data-a="buyp" data-k="${s}" data-n="${n}"${S.money < c ? ' disabled' : ''}>${n === 36 ? 'Caja 36' : '×' + n} · ${fmt(c)}</button>`; }).join('')}` +
          `<button class="b pri" data-a="open" data-k="${s}" data-n="1"${q < 1 ? ' disabled' : ''}>Abrir 1</button>` +
          `<button class="b pri" data-a="open" data-k="${s}" data-n="10"${q < 1 ? ' disabled' : ''}>Abrir 10 (rápido)</button></div></div>`
        );
      })
      .join('') +
    `<p class="mu">Abrir sobres tiene azar: de media sale algo menos que lo que cuestan al mayorista. Ganas más vendiendo sobres cerrados o comprando cartas a los clientes por debajo de mercado.</p>`
  );
}

defModal('packs', { body });

A.ptab = (d) => {
  pTab = d.k as typeof pTab;
  renderM();
};
A.shelf = (d) => {
  setShelfPrice(G(), d.k!, +d.n!);
  renderM();
};
A.buyp = (d) => {
  const r = buyPacks(G(), d.k!, +d.n!);
  if (!r.ok) toast(r.msg);
  ui.hud();
  renderM();
};
A.pp = (d) => {
  setProdPrice(G(), d.k!, +d.n!);
  renderM();
};
A.buyprod = (d) => {
  const r = buyProd(G(), d.k!, +d.n!);
  if (!r.ok) toast(r.msg);
  else sfx.coin();
  ui.hud();
  renderM();
};
A.openprod = (d) => {
  const g = G(), i = pInfo(g.S, d.k!);
  if (!i || !openProd(g, d.k!)) return;
  ui.saveNow();
  ui.hud();
  startBoxOpening(i);
};
A.open = (d) => openPacksUi(d.k!, +d.n!);

export const openStock = (): void => openM('packs');
