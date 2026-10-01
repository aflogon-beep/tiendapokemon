import type { Game } from '../../core/game';
import { fmt } from '../../core/format';
import { RAR } from '../../data/rarity';
import { setName } from '../../data/sets';
import { ACH, achVal } from '../../systems/achievements';
import { price } from '../../systems/economy';
import { claimMission } from '../../systems/missions';
import { deliverOrder, ownFor } from '../../systems/orders';
import { hearts, REGS, regS } from '../../systems/regulars';
import { lookOf } from '../../systems/customers';
import { modelFor } from '../../world/characters';
import { portrait } from '../../world/portraits';
import { A, defModal, G, renderM, ui } from '../ctx';
import { face } from '../cards';
import { toast } from '../toast';
import { sfx } from '../sound';

/* Tareas de la v10 (mTasks): encargos, misiones, logros y clientes habituales */

let tTab: 'ord' | 'mis' | 'ach' | 'reg' = 'ord';

/** Retrato de un habitual (el mismo personaje que entra en la tienda) */
export const regImg = (id: string): string => portrait('characters', modelFor(lookOf(id)));

function mRegs(g: Game): string {
  return (
    REGS.map((r) => {
      const s = regS(g.S, r.id);
      return (
        `<div class="pn" style="display:flex;gap:10px;align-items:center${s.met ? '' : ';opacity:.6'}">` +
        `${s.met ? `<img class="rgimg" src="${regImg(r.id)}" alt="">` : '<div style="font-size:34px">❔</div>'}` +
        `<div style="flex:1;min-width:0"><div class="row"><b>${s.met ? r.n : 'Aún no le conoces'}</b><span style="font-size:12px">${s.met ? hearts(s.loy) : ''}</span></div>` +
        (s.met
          ? `<div class="mu">${r.d}${(r.t === 'kid' || r.t === 'whale') && s.fav ? ' Favorito: ' + setName(s.fav) + '.' : ''} Visitas: ${s.visits}.</div>${s.note ? `<div class="mu">📝 ${s.note}</div>` : ''}`
          : '') +
        `</div></div>`
      );
    }).join('') +
    '<p class="mu">Trátales bien (rápido, buen precio, cambio exacto, encargos) y volverán más, aceptarán precios algo más altos, dejarán propina y traerán amigos. Si se enfadan, dejarán de venir.</p>'
  );
}

function body(): string {
  const g = G(), S = g.S;
  const tabs = [['ord', '📋 Encargos'], ['mis', '✅ Misiones'], ['ach', '🏆 Logros'], ['reg', '👥 Clientes']]
    .map(([k, n]) => `<button class="b ${tTab === k ? 'on' : ''}" data-a="ttab" data-k="${k}">${n}</button>`)
    .join('');
  let b = '';
  if (tTab === 'ord')
    b = S.orders.length
      ? S.orders
          .map((o) => {
            const c = g.db.byId[o.c];
            if (!c) return '';
            const own = ownFor(g, o), dl = o.due - S.day;
            return (
              `<div class="pn" style="display:flex;gap:10px"><div class="zoomable" style="width:70px;flex:none" data-a="zoom" data-k="${c.id}" data-n="0">${face(c, false)}</div>` +
              `<div style="flex:1;min-width:0"><b>${o.who}</b> busca <b>${c.name}</b><div class="mu">${setName(c.s)} · ${RAR[c.r].n} · mercado ${fmt(price(g, c.id))}</div>` +
              `<div>Paga <b class="up">${fmt(o.pay)}</b> · ${dl <= 0 ? 'último día' : dl === 1 ? 'queda 1 día' : 'quedan ' + dl + ' días'}</div>` +
              `<div class="btns">${own ? `<button class="b pri" data-a="deliver" data-n="${o.id}">Entregar</button>` : '<span class="mu">Aún no la tienes: ábrela en sobres o cómprala.</span>'}</div></div></div>`
            );
          })
          .join('')
      : '<p class="mu">No hay encargos ahora. Irán llegando peticiones de clientes.</p>';
  else if (tTab === 'mis')
    b =
      (S.dm?.list ?? [])
        .map(
          (m, i) =>
            `<div class="pn"><div class="row"><b>${m.t}</b><span class="up">+${fmt(m.r)}</span></div><div class="prog"><i style="width:${(m.p / m.g) * 100}%"></i></div>` +
            `<div class="row"><span class="mu">${Math.floor(m.p)}/${m.g}</span>${m.cl ? '<span class="up">Cobrada ✔</span>' : m.done ? `<button class="b pri" data-a="mclaim" data-n="${i}">Cobrar</button>` : ''}</div></div>`,
        )
        .join('') + '<p class="mu">Las misiones se renuevan cada día.</p>';
  else if (tTab === 'reg') b = mRegs(g);
  else
    b = ACH.map((a) => {
      const d = S.ach[a.id], v = achVal(g, a);
      return (
        `<div class="pn" style="${d ? '' : 'opacity:.78'}"><div class="row"><b>${d ? '🏆' : '🔒'} ${a.n}</b><span class="up">+${fmt(a.r)}</span></div><div class="mu">${a.d}</div>` +
        `${d ? '' : `<div class="prog"><i style="width:${Math.min(1, v / a.g) * 100}%"></i></div>`}</div>`
      );
    }).join('');
  return `<h2>Tareas</h2><div class="tabs t4">${tabs}</div>${b}`;
}

defModal('tasks', { body });

A.ttab = (d) => {
  tTab = d.k as typeof tTab;
  renderM();
};
A.mclaim = (d) => {
  const r = claimMission(G(), +d.n!);
  if (!r) return;
  toast('💰 Misión cobrada: +' + fmt(r));
  sfx.coin();
  ui.hud();
  renderM();
};
A.deliver = (d) => {
  const r = deliverOrder(G(), +d.n!);
  if (r.k === 'fake') {
    toast(`😡 ${r.who} ha detectado que la carta es falsa · −2 ⭐`);
    sfx.err();
  } else if (r.k === 'ok') {
    toast(`📋 Encargo entregado a ${r.who}: +${fmt(r.pay)} y +1 ⭐`);
    sfx.chaching();
  }
  ui.hud();
  renderM();
};
