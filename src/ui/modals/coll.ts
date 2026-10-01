import type { Game } from '../../core/game';
import { fmt, pct } from '../../core/format';
import { RAR } from '../../data/rarity';
import { setName } from '../../data/sets';
import { caseCap, caseItems, invValue, itemVal } from '../../systems/economy';
import { GSVC, GTXT } from '../../systems/grading';
import {
  caseAdd, caseMarkup, caseRemove, groupItems, groups, luxAdd, luxItems, luxRemove, sellToDealer, sendToGrade, type Group,
} from '../../systems/inventory';
import { A, defModal, G, renderM, ui } from '../ctx';
import { chg, cls, face, spark } from '../cards';
import { toast } from '../toast';
import { sfx } from '../sound';

/* Panel «Cartas» de la v10 (mColl): colección, vitrina, peanas, venta al mayorista y gradeo */

export const collUi = { sel: null as string | null, filter: 'all' as 'all' | 'top' | 'case' };

function luxBtns(g: Game, sel: Group): string {
  if (!g.S.decor.lux) return '';
  const it = sel.its[0];
  if (it.gq || it.fkK) return '';
  const inl = sel.its.filter((i) => i.lux).length, used = luxItems(g).length;
  return (
    `<div class="btns"><button class="b" data-a="luxadd"${used >= 3 || inl >= sel.its.length ? ' disabled' : ''}>💎 A peana (${used}/3)</button>` +
    `${inl ? '<button class="b" data-a="luxrem">Quitar de peana</button>' : ''}</div>`
  );
}

function gradeBtns(g: Game, sel: Group): string {
  const it = sel.its[0];
  if (it.fkK) return '<div class="mu" style="margin-top:8px">🚫 Falsificación detectada por el servicio de gradeo. No vale nada: puedes deshacerte de ella con «Vender».</div>';
  if (it.gq) return '<div class="mu" style="margin-top:8px">📮 En gradeo. Mira el estado en Más → Gradeo.</div>';
  if (it.gr) return '';
  const m = g.S.money;
  return (
    `<div class="btns"><button class="b" data-a="inspc">🔍 Examinar</button>` +
    `<button class="b" data-a="grade" data-k="std"${m < GSVC.std.cost ? ' disabled' : ''}>🔍 Gradear · ${fmt(GSVC.std.cost)} · ${GSVC.std.days} días</button>` +
    `<button class="b" data-a="grade" data-k="exp"${m < GSVC.exp.cost ? ' disabled' : ''}>⚡ Exprés · ${fmt(GSVC.exp.cost)} · 1 día</button></div>`
  );
}

function body(): string {
  const g = G(), S = g.S;
  let gs = groups(g);
  if (collUi.filter === 'case') gs = gs.filter((x) => x.its.some((i) => i.case != null));
  if (collUi.filter === 'top') gs = gs.filter((x) => itemVal(g, x.its[0]) >= 1);
  const tv = invValue(g), tc = S.items.reduce((a, i) => a + i.cost, 0), sel = collUi.sel ? gs.find((x) => x.key === collUi.sel) : undefined;
  let h =
    `<h2>Colección</h2><div class="row"><span>${S.items.length} cartas · valor <b>${fmt(tv)}</b></span><span class="${cls(tv - tc)}">P/L ${tv >= tc ? '+' : ''}${fmt(tv - tc)}</span></div>` +
    `<div class="chips" style="margin-top:8px">${[['all', 'Todas'], ['top', 'Valiosas (≥1 €)'], ['case', 'En vitrina']]
      .map(([k, n]) => `<button class="b ${collUi.filter === k ? 'on' : ''}" data-a="filt" data-k="${k}">${n}</button>`)
      .join('')}</div>`;
  if (sel) {
    const u = itemVal(g, sel.its[0]), inc = sel.its.filter((i) => i.case != null), mk = inc.length ? inc[0].case! : 1;
    const cap = caseCap(S), used = caseItems(S).length, id = sel.c.id, gr = sel.its[0].gr;
    h +=
      `<div class="pn" style="display:flex;gap:12px"><div class="zoomable" style="width:110px;flex:none" data-a="zoom" data-k="${id}" data-n="${sel.rv ? 1 : 0}">${face(sel.c, sel.rv)}</div>` +
      `<div style="flex:1;min-width:0"><b>${sel.c.name}</b> <span class="mu">${gr ? 'PGS ' + gr + ' ' + GTXT[gr] : sel.k}</span>` +
      `<div class="mu">${RAR[sel.c.r].n} · ${setName(sel.c.s)}</div><div>Mercado <b>${fmt(u)}</b> · ×${sel.its.length}</div>${spark(g, id)}` +
      `<div class="mu">7 d <span class="${cls(chg(g, id, 7))}">${pct(chg(g, id, 7))}</span> · 30 d <span class="${cls(chg(g, id, 30))}">${pct(chg(g, id, 30))}</span></div>` +
      `<div class="btns"><button class="b" data-a="sell1">Vender 1 · ${fmt(u * 0.85)}</button>${sel.its.length > 1 ? `<button class="b" data-a="sellall">Todas · ${fmt(u * 0.85 * sel.its.length)}</button>` : ''}</div>` +
      `<div class="btns"><button class="b pri" data-a="caseadd"${used >= cap || inc.length >= sel.its.length || sel.its[0].fkK ? ' disabled' : ''}>+ Vitrina (${used}/${cap})</button>` +
      `${inc.length ? `<button class="b" data-a="caserem">− Vitrina</button><span class="step"><button class="b" data-a="mk" data-n="-.05">−</button><b>${fmt(u * mk)}</b> <span class="mu">(${Math.round(mk * 100)} %)</span><button class="b" data-a="mk" data-n=".05">+</button></span>` : ''}</div>` +
      `${luxBtns(g, sel)}${gradeBtns(g, sel)}</div></div>`;
  }
  if (!gs.length) return h + `<p class="mu">No hay cartas todavía. Abre sobres o compra cartas a los clientes que quieren vender.</p>`;
  h +=
    `<div class="tiles">` +
    gs
      .slice(0, 150)
      .map((x) => {
        const u = itemVal(g, x.its[0]), inc = x.its.filter((i) => i.case != null).length, f = x.its[0];
        return (
          `<div class="tile ${collUi.sel === x.key ? 'sel' : ''}" data-a="sel" data-k="${x.key}">${face(x.c, x.rv)}<div class="pt">${fmt(u)}</div>` +
          `${x.its.length > 1 ? `<div class="qt">×${x.its.length}</div>` : ''}${inc ? `<div class="ct">Vitrina ${inc}</div>` : ''}` +
          `${f.gr ? `<div class="gb">PGS ${f.gr}</div>` : ''}${f.gq ? '<div class="ct">📮 Gradeo</div>' : ''}` +
          `${f.fkK ? '<div class="gb" style="background:#c0392b;color:#fff">FALSA</div>' : ''}` +
          `${x.its.some((i) => i.lux) ? '<div class="nw" style="background:#c9a227;color:#1a1406;right:auto;left:4px;top:24px;bottom:auto">💎</div>' : ''}</div>`
        );
      })
      .join('') +
    `</div>`;
  if (gs.length > 150) h += `<p class="mu">Mostrando las 150 más valiosas.</p>`;
  return h;
}

defModal('coll', { body });

const sel = (): string => collUi.sel!;
const after = () => {
  ui.hud();
  renderM();
};

A.filt = (d) => {
  collUi.filter = d.k as typeof collUi.filter;
  renderM();
};
A.sel = (d) => {
  collUi.sel = collUi.sel === d.k ? null : d.k!;
  renderM();
};
A.sell1 = () => {
  const g = G(), r = sellToDealer(g, sel(), false);
  if (r.fakes) {
    toast('🚫 El mayorista detecta que es falsa: no te paga nada');
    sfx.err();
  }
  if (!groupItems(g, sel()).length) collUi.sel = null;
  after();
};
A.sellall = () => {
  const r = sellToDealer(G(), sel(), true);
  if (r.fakes) toast(`🚫 ${r.fakes} eran falsas: el mayorista no las paga`);
  collUi.sel = null;
  after();
};
A.caseadd = () => {
  caseAdd(G(), sel());
  renderM();
};
A.caserem = () => {
  caseRemove(G(), sel());
  renderM();
};
A.mk = (d) => {
  caseMarkup(G(), sel(), +d.n!);
  renderM();
};
A.luxadd = () => {
  if (luxAdd(G(), sel())) sfx.coin();
  renderM();
};
A.luxrem = () => {
  luxRemove(G(), sel());
  renderM();
};
A.grade = (d) => {
  const svc = d.k as keyof typeof GSVC, r = sendToGrade(G(), sel(), svc);
  if (!r.ok) return;
  const sv = GSVC[svc];
  collUi.sel = null;
  toast(`📮 Enviada a gradear (${sv.n}). Llega en ${sv.days} día${sv.days > 1 ? 's' : ''}`);
  after();
};
