import { fmt } from '../../core/format';
import { clamp } from '../../core/rng';
import type { Card } from '../../data/cards';
import { setCol, setDef, setName } from '../../data/sets';
import { ALBR, albPct, claimAlbum } from '../../systems/achievements';
import { A, defModal, G, renderM, ui } from '../ctx';
import { face } from '../cards';
import { toast } from '../toast';
import { sfx } from '../sound';

/* Álbum de la v10 (mAlbum): carpeta con páginas de 9 fundas por set */

let albS: string | null = null;
let albPg = 0;

const albCards = (sid: string): Card[] =>
  (G().db.byS[sid] || []).slice().sort((a, b) => (parseInt(a.num ?? '') || 9999) - (parseInt(b.num ?? '') || 9999));
const albPages = (sid: string) => 1 + Math.ceil(albCards(sid).length / 9);

function albPageHTML(sid: string, pg: number): string {
  const S = G().S, sd = setDef(sid), l = albCards(sid);
  if (pg === 0) {
    const own = l.filter((c) => S.dex[c.id]).length;
    return (
      `<div class="bcover"><div class="bc-in">${sd?.sym ? `<img src="${sd.sym}" alt="" onerror="this.remove()">` : '<div class="pball" style="width:74px;margin:0"></div>'}` +
      `<b>${sd?.n || setName(sid)}</b><span>${sd?.series || ''} ${sd?.year || ''}</span><div class="bc-pc">${own}/${l.length}</div><span>Desliza o pulsa ▶ para pasar página</span></div></div>`
    );
  }
  const part = l.slice((pg - 1) * 9, pg * 9);
  return (
    `<div class="bgrid">${part.map((c) => (S.dex[c.id] ? `<div class="pk own" data-a="zoom" data-k="${c.id}" data-n="0">${face(c, false)}</div>` : `<div class="pk miss"><span>${c.num || '?'}</span></div>`)).join('')}` +
    `${'<div class="pk empty"></div>'.repeat(9 - part.length)}</div>`
  );
}

function body(): string {
  const g = G(), S = g.S;
  if (!albS || !S.sets.includes(albS)) albS = S.sets[0];
  const sid = albS, l = albCards(sid), own = l.filter((c) => S.dex[c.id]).length, pc = l.length ? own / l.length : 0, cl = S.albR[sid] || [], np = albPages(sid);
  albPg = clamp(albPg, 0, np - 1);
  const chips = S.sets.map((s) => `<button class="b ${s === sid ? 'on' : ''}" data-a="albset" data-k="${s}">${setName(s)} · ${Math.round(albPct(g, s) * 100)} %</button>`).join('');
  const rw = ALBR.map(([t, m], i) => `<button class="b ${!cl.includes(i) && pc >= t ? 'pri' : ''}" data-a="albclaim" data-n="${i}"${cl.includes(i) || pc < t ? ' disabled' : ''}>${t * 100} % · ${fmt(m)}${cl.includes(i) ? ' ✔' : ''}</button>`).join('');
  return (
    `<h2>Álbum</h2><div class="chips">${chips}</div><div class="pn"><div class="row"><b>${setName(sid)}</b><span>${own}/${l.length} · ${Math.round(pc * 100)} %</span></div>` +
    `<div class="prog"><i style="width:${pc * 100}%"></i></div><div class="btns">${rw}</div></div>` +
    `<div class="binder" id="binder" style="--bc:${setCol(sid)}"><div class="rings"></div><div class="bpage" id="bpage">${albPageHTML(sid, albPg)}</div></div>` +
    `<div class="row" style="margin-top:10px"><button class="b" data-a="albprev"${albPg <= 0 ? ' disabled' : ''}>◀ Anterior</button>` +
    `<span class="mu" id="albpn">${albPg === 0 ? 'Portada' : 'Página ' + albPg + ' de ' + (np - 1)}</span>` +
    `<button class="b" data-a="albnext"${albPg >= np - 1 ? ' disabled' : ''}>Siguiente ▶</button></div>` +
    `<p class="mu">Cuenta cada carta que hayas tenido alguna vez, aunque la hayas vendido. Toca una carta para verla en grande.</p>`
  );
}

// Pasar página con animación de hoja
function albTurn(dir: number): void {
  const sid = albS!, np = albPages(sid), nx = albPg + dir;
  if (nx < 0 || nx >= np) return;
  const b = document.getElementById('binder'), bp = document.getElementById('bpage');
  if (!b || !bp || b.dataset.busy) return;
  b.dataset.busy = '1';
  const oldH = bp.innerHTML, newH = albPageHTML(sid, nx);
  albPg = nx;
  sfx.page();
  const ov = document.createElement('div');
  ov.className = 'bpage bflip ' + (dir > 0 ? 'fnext' : 'fprev');
  if (dir > 0) {
    ov.innerHTML = oldH;
    bp.innerHTML = newH;
  } else ov.innerHTML = newH;
  b.appendChild(ov);
  setTimeout(() => {
    if (dir < 0) bp.innerHTML = newH;
    ov.remove();
    delete b.dataset.busy;
  }, 620);
  const pn = document.getElementById('albpn');
  if (pn) pn.textContent = albPg === 0 ? 'Portada' : 'Página ' + albPg + ' de ' + (np - 1);
  document.querySelectorAll<HTMLButtonElement>('[data-a=albprev]').forEach((e) => (e.disabled = albPg <= 0));
  document.querySelectorAll<HTMLButtonElement>('[data-a=albnext]').forEach((e) => (e.disabled = albPg >= np - 1));
}

// Deslizar el dedo sobre la carpeta pasa página
function bindAlbum(sheet: HTMLElement): void {
  const b = sheet.querySelector<HTMLElement & { _sw?: number }>('#binder');
  if (!b) return;
  let x0: number | null = null;
  b.addEventListener('pointerdown', (e) => (x0 = e.clientX));
  b.addEventListener('pointerup', (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 45) {
      b._sw = 1;
      albTurn(dx < 0 ? 1 : -1);
    }
  });
  b.addEventListener(
    'click',
    (e) => {
      if (b._sw) {
        e.stopPropagation();
        e.preventDefault();
        b._sw = 0;
      }
    },
    true,
  );
}

defModal('album', { body, after: bindAlbum });

A.albset = (d) => {
  albS = d.k!;
  albPg = 0;
  renderM();
};
A.albnext = () => albTurn(1);
A.albprev = () => albTurn(-1);
A.albclaim = (d) => {
  const r = claimAlbum(G(), albS!, +d.n!);
  if (!r) return;
  toast(`📒 Premio del álbum: +${fmt(r[0])} y +${r[1]} ⭐`);
  sfx.ach();
  ui.hud();
  renderM();
};
