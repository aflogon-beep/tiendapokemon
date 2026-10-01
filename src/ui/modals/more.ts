import { fmt, pct } from '../../core/format';
import { rnd } from '../../core/rng';
import { addSets, removeSet } from '../../core/setup';
import { FAILED } from '../../data/cards';
import { COND, RAR } from '../../data/rarity';
import { RECO, SETDEF, seriesList, setName } from '../../data/sets';
import { DECOR, itemVal, price, repv, rvr, STAFF } from '../../systems/economy';
import { GSVC, GTXT } from '../../systems/grading';
import { season, SEAS } from '../../systems/seasons';
import { buyDecor, buyUpgrade, toggleStaff, UPS } from '../../systems/upgrades';
import { A, closeM, defModal, defMount, G, host, I, openM, renderM, ui } from '../ctx';
import { chg, cls, face, faceBig, spark } from '../cards';
import { confetti, tiltTo, untilt } from '../packOpening';
import { toast } from '../toast';
import { audio, setMusic, setSound, sfx, vibe } from '../sound';

/* «Más» de la v10: colecciones, mercado, mejoras y personal, gradeo, partida y ajustes */

export const moreHooks = { zfit: () => {} };

defModal('more', {
  body: () => {
    const S = G().S, se = S.season || 'auto';
    return (
      `<h2>Más</h2><div class="menu"><button class="b" data-a="m" data-k="sets">🗂️ Colecciones</button><button class="b" data-a="m" data-k="mkt">📈 Mercado</button>` +
      `<button class="b" data-a="m" data-k="up">🛠️ Mejoras y personal</button><button class="b" data-a="m" data-k="grading">🔍 Gradeo${S.grNew?.length ? ' · 📬' : ''}</button>` +
      `<button class="b" data-a="m" data-k="backup">💾 Partida y copia</button><button class="b" data-a="sndtog">${audio.on ? '🔊 Sonido: sí' : '🔇 Sonido: no'}</button>` +
      `<button class="b" data-a="mustog">🎵 Música: ${audio.music ? 'sí' : 'no'}</button><button class="b" data-a="tutre">🎓 Repetir tutorial</button>` +
      `<button class="b" data-a="zreset">⤢ Ver toda la tienda</button><button class="b" data-a="seastog">🗓️ ${SEAS[se]}${se === 'auto' ? ' · ' + SEAS[season(S)] : ''}</button></div>` +
      `<div class="pn" style="margin-top:10px"><div class="row"><span>⭐ Reputación</span><b>${repv(S)}</b></div>` +
      `<div class="mu">Sube vendiendo, con encargos, torneos y el álbum. Más reputación = más clientes.</div></div>`
    );
  },
});

A.sndtog = () => {
  setSound(!audio.on);
  renderM();
};
A.mustog = () => {
  if (!audio.on) setSound(true);
  setMusic(!audio.music);
  renderM();
};
A.zreset = () => {
  closeM();
  moreHooks.zfit();
};
A.seastog = () => {
  const S = G().S, k = Object.keys(SEAS), i = k.indexOf(S.season || 'auto');
  S.season = k[(i + 1) % k.length];
  toast('🗓️ Temporada: ' + SEAS[S.season] + (S.season === 'auto' ? ' (' + SEAS[season(S)] + ')' : ''));
  renderM();
};
A.tutre = () => {
  G().S.tut = { on: true, i: 0 };
  closeM();
  toast('🎓 Tutorial reiniciado');
};

/* --- colecciones --- */
let setQ = '';

function setRows(): string {
  const g = G(), S = g.S, q = setQ.trim().toLowerCase();
  let l = SETDEF.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (q) l = l.filter((d) => (d.n + ' ' + (d.series || '') + ' ' + d.year).toLowerCase().includes(q));
  const tot = l.length;
  l = l.slice(0, 60);
  return (
    l
      .map((d) => {
        const inn = S.sets.includes(d.id), used = S.sealed[d.id] > 0 || S.items.some((i) => g.db.byId[i.c]?.s === d.id);
        return (
          `<div class="srow">${d.sym ? `<img src="${d.sym}" alt="" onerror="this.remove()">` : '<span style="width:30px"></span>'}` +
          `<div style="flex:1;min-width:0"><b>${d.n}</b><div class="mu">${d.series || ''} · ${d.year}${d.total ? ' · ' + d.total + ' cartas' : ''}</div></div>` +
          (inn && !g.db.byS[d.id]
            ? `<button class="b pri" data-a="retrysets">⚠️ Reintentar</button>`
            : inn
              ? `<button class="b"${used ? ' disabled' : ''} data-a="delset" data-k="${d.id}">${used ? 'En uso' : 'Quitar'}</button>`
              : `<button class="b pri" data-a="addset" data-k="${d.id}">Añadir</button>`) +
          `</div>`
        );
      })
      .join('') + (tot > 60 ? `<p class="mu">Mostrando 60 de ${tot}. Usa el buscador.</p>` : '') || '<p class="mu">Sin resultados.</p>'
  );
}

defModal('sets', {
  body: () => {
    const g = G(), S = g.S, ser = seriesList(), cur = ser.find((x) => x.n === setQ.trim());
    const miss = cur ? SETDEF.filter((d) => d.series === cur.n && !S.sets.includes(d.id)).length : 0;
    const reco = RECO.filter((id) => SETDEF.some((d) => d.id === id) && !S.sets.includes(id));
    return (
      `<h2>Colecciones</h2>${FAILED.size ? `<div class="pn"><div class="down">⚠️ ${FAILED.size} colección(es) de tu catálogo no han cargado (la API va lenta o limita peticiones).</div><div class="btns"><button class="b pri" data-a="retrysets">Reintentar ahora</button></div></div>` : ''}` +
      `<p class="mu">Añade sets a tu catálogo para comprar sus sobres. En catálogo: <b>${S.sets.length}</b> de ${SETDEF.length}. ${g.mode === 'real' ? '' : 'Sin conexión: solo están los 3 sets básicos.'}</p>` +
      `${g.mode === 'real' && reco.length ? `<button class="b pri big" data-a="addreco" style="margin:0 0 10px">⭐ Añadir ${reco.length} sets populares (Base Set, Evolving Skies…)</button>` : ''}` +
      `<div class="serchips"><button class="b ${setQ ? '' : 'on'}" data-a="serf" data-k="">Todas</button>${ser.map((x) => `<button class="b ${cur && cur.n === x.n ? 'on' : ''}" data-a="serf" data-k="${x.n.replace(/"/g, '')}">${x.n} (${x.c})</button>`).join('')}</div>` +
      `${cur && miss ? `<button class="b pri big" data-a="addseries" style="margin:0 0 10px">➕ Añadir ${miss === 1 ? 'el set que falta' : 'los ' + miss + ' sets'} de ${cur.n}</button>` : ''}` +
      `<input class="inp" data-i="setq" placeholder="Buscar: Evolving Skies, Base Set, 2019…" value="${setQ.replace(/"/g, '')}">` +
      `<p class="mu">Cada set trae todas sus cartas con precio de Cardmarket. Muchos sets a la vez pueden tardar en cargar al abrir el juego.</p><div id="setlist">${setRows()}</div>`
    );
  },
});

function doAdd(ids: string[]): void {
  const g = G();
  if (g.mode !== 'real') {
    toast('Sin conexión con la API: no se pueden añadir sets');
    return;
  }
  const n = ids.filter((id) => !g.S.sets.includes(id)).length;
  if (!n) {
    toast('Ya están todas en tu catálogo');
    return;
  }
  toast(`Cargando ${n} colección(es)…`);
  addSets(g, ids, (d, t) => {
    if (t > 2 && d % 3 === 0) toast(`Cargando… ${d}/${t}`);
  }).then(({ ok, total }) => {
    ui.saveNow();
    toast(`✅ ${ok} colección(es) añadidas${ok < total ? ' (' + (total - ok) + ' fallaron, reintenta)' : ''}`);
    if (ui.M === 'sets') renderM();
    ui.hud();
  });
}

I.setq = (el) => {
  setQ = el.value;
  const e = document.getElementById('setlist');
  if (e) e.innerHTML = setRows();
};
A.serf = (d) => {
  setQ = d.k!;
  renderM();
};
A.addset = (d) => doAdd([d.k!]);
A.addreco = () => doAdd(RECO.slice());
A.addseries = () => {
  const n = setQ.trim();
  doAdd(SETDEF.filter((x) => x.series === n).map((x) => x.id));
};
A.delset = (d) => {
  removeSet(G(), d.k!);
  if (ui.M === 'sets') renderM();
};

/* --- mercado --- */
defModal('mkt', {
  body: () => {
    const g = G(), pool = g.db.cards.filter((c) => c.b >= 1), arr = pool.map((c) => ({ c, d: chg(g, c.id, 7) })).sort((a, b) => b.d - a.d);
    const row = (x: (typeof arr)[number]) =>
      `<div class="pn row"><div style="min-width:0"><b>${x.c.name}</b> <span class="mu">${setName(x.c.s)} · ${RAR[x.c.r].n}</span>` +
      `<div>${fmt(price(g, x.c.id))} · 7 d <span class="${cls(x.d)}">${pct(x.d)}</span> · 30 d <span class="${cls(chg(g, x.c.id, 30))}">${pct(chg(g, x.c.id, 30))}</span></div></div>${spark(g, x.c.id)}</div>`;
    return (
      `<h2>Mercado</h2><p class="mu">${g.mode === 'real' ? 'Precios de Cardmarket (tendencia, €) vía pokemontcg.io, con movimientos diarios del juego encima.' : 'Modo sin conexión: precios simulados.'}</p>` +
      `<h3>Top subidas (7 días)</h3>${arr.slice(0, 6).map(row).join('')}<h3>Top bajadas (7 días)</h3>${arr.slice(-6).reverse().map(row).join('')}`
    );
  },
});

/* --- mejoras y personal --- */
defModal('up', {
  body: () => {
    const S = G().S;
    const dec = DECOR.map(
      (d) =>
        `<div class="pn"><div class="row"><b>${d.ic} ${d.n}</b>${S.decor[d.k] ? '<span class="up">Colocado ✔</span>' : `<button class="b pri" data-a="decor" data-k="${d.k}"${S.money < d.cost ? ' disabled' : ''}>${fmt(d.cost)}</button>`}</div><div class="mu">${d.d}</div></div>`,
    ).join('');
    const stf = STAFF.map(
      (x) =>
        `<div class="pn"><div class="row"><b>${x.ic} ${x.n}</b><button class="b ${S.staff[x.k] ? 'on' : 'pri'}" data-a="staff" data-k="${x.k}">${S.staff[x.k] ? 'Contratado · despedir' : 'Contratar'}</button></div><div class="mu">${x.d} Sueldo: ${fmt(x.sal)}/día.</div></div>`,
    ).join('');
    return (
      `<h2>Mejoras</h2>` +
      UPS.map((u) => {
        const lv = S.up[u.k], done = lv >= u.max, c = u.cost[lv];
        return `<div class="pn"><div class="row"><b>${u.n}${u.max > 1 ? ` (${lv}/${u.max})` : ''}</b>${done ? '<span class="up">Comprada</span>' : `<button class="b pri" data-a="upg" data-k="${u.k}"${S.money < c ? ' disabled' : ''}>${fmt(c)}</button>`}</div><div class="mu">${u.d}</div></div>`;
      }).join('') +
      `<h3>Decoración</h3>${dec}<h3>Personal</h3>${stf}`
    );
  },
});

A.upg = (d) => {
  if (buyUpgrade(G(), d.k as (typeof UPS)[number]['k'])) {
    ui.hud();
    renderM();
  }
};
A.decor = (d) => {
  const x = DECOR.find((y) => y.k === d.k);
  if (!x || !buyDecor(G(), x.k)) return;
  toast(x.ic + ' ' + x.n + ' colocado');
  sfx.coin();
  ui.hud();
  renderM();
};
A.staff = (d) => {
  const k = d.k as (typeof STAFF)[number]['k'], on = toggleStaff(G(), k);
  toast((on ? 'Contratado: ' : 'Despedido: ') + STAFF.find((s) => s.k === k)!.n);
  renderM();
};

/* --- gradeo --- */
defModal('grading', {
  body: () => {
    const g = G(), S = g.S, q = S.items.filter((i) => i.gq), gr = S.items.filter((i) => i.gr).sort((a, b) => itemVal(g, b) - itemVal(g, a));
    return (
      `<h2>Gradeo</h2><p class="mu">Envía cartas desde «Cartas»: selecciona una y pulsa Gradear. La nota depende del estado (una NM tiene más opciones de 9 o 10). Un 10 multiplica el valor ×4; una nota baja lo reduce.</p>` +
      `${S.grNew?.length ? `<button class="b pri big" data-a="grades">📬 Ver ${S.grNew.length} resultado(s)</button>` : ''}` +
      `<h3>En camino (${q.length})</h3>${q.length ? q.map((i) => { const c = g.db.byId[i.c], dd = i.gq!.due - S.day; return `<div class="pn row"><span><b>${c.name}</b> <span class="mu">${i.k} · ${GSVC[i.gq!.svc as keyof typeof GSVC].n}</span></span><span class="mu">${dd <= 1 ? 'llega mañana' : 'llega en ' + dd + ' días'}</span></div>`; }).join('') : '<p class="mu">Nada en gradeo.</p>'}` +
      `<h3>Cartas gradeadas (${gr.length})</h3><div class="tiles">${gr.slice(0, 120).map((i) => { const c = g.db.byId[i.c]; return `<div class="tile zoomable" data-a="zoom" data-k="${c.id}" data-n="${i.rv ? 1 : 0}">${face(c, i.rv)}<div class="pt">${fmt(itemVal(g, i))}</div><div class="gb">PGS ${i.gr}</div></div>`; }).join('')}</div>`
    );
  },
});

/* Revelación de notas (mountGR): el número gira y cae en la funda */
let GR: { ids: number[]; idx: number; ready?: boolean } | null = null;

export function openGrades(): void {
  const S = G().S;
  if (!S.grNew?.length) {
    toast('No hay resultados nuevos');
    return;
  }
  GR = { ids: S.grNew.slice(), idx: 0 };
  S.grNew = [];
  ui.saveNow();
  openM('grev');
}
A.grades = openGrades;

const slabHTML = (c: Parameters<typeof faceBig>[0], rv: boolean, gr: number, hide: boolean): string =>
  `<div class="slab"><div class="slab-lb"><div><b>${c.name}</b><span>${setName(c.s)}${c.num ? ' #' + c.num : ''}${rv ? ' · Reverse' : ''}</span></div>` +
  `<div class="gnum">${hide ? '?' : gr}</div><div class="gtx">${hide ? '' : GTXT[gr]}</div></div>` +
  `<div class="slab-card">${faceBig(c, rv)}<div class="holo"></div><div class="glare"></div></div><div class="glare2"></div></div>`;

defMount('grev', () => {
  const g = G(), S = g.S, gr = GR;
  if (!gr) return false;
  let it = null;
  while (gr.idx < gr.ids.length && !(it = S.items.find((i) => i.i === gr.ids[gr.idx]))) gr.idx++;
  if (!it || !it.gr) {
    GR = null;
    untilt();
    closeM();
    return;
  }
  const item = it, grade = it.gr, c = g.db.byId[item.c];
  gr.ready = false;
  host().innerHTML =
    `<div class="px" id="px" style="--sc:#c0392b"><div class="pxbar"><div><b>Resultados de gradeo</b><div class="pxrun">${gr.idx + 1} de ${gr.ids.length}</div></div>` +
    `<div class="step"><button class="ib" id="grclose">Cerrar</button></div></div><div class="pxstage" id="pxst"><div class="rays" id="pxrays"></div>${slabHTML(c, item.rv, grade, true)}</div>` +
    `<div class="pxhint" id="pxhint"><div class="cinfo"><div class="cv">Calificando…</div></div></div><div class="flash" id="pxflash"></div></div>`;
  const st = document.getElementById('pxst')!, sl = st.querySelector('.slab') as HTMLElement, gn = sl.querySelector('.gnum') as HTMLElement;
  tiltTo(sl, st);
  document.getElementById('grclose')!.onclick = () => {
    GR = null;
    untilt();
    closeM();
  };
  sfx.charge(grade >= 9 ? 3 : 1);
  const iv = setInterval(() => {
    gn.textContent = String(1 + rnd(10));
    sfx.tick();
  }, 85);
  setTimeout(() => {
    clearInterval(iv);
    if (!document.getElementById('px') || GR !== gr) return;
    gn.textContent = String(grade);
    gn.classList.add('land');
    (sl.querySelector('.gtx') as HTMLElement).textContent = GTXT[grade];
    const lv = grade >= 10 ? 3 : grade === 9 ? 2 : grade === 8 ? 1 : 0, v = itemVal(g, item), before = price(g, item.c) * (item.rv ? rvr(c) : 1) * COND[item.k];
    if (lv) {
      document.getElementById('pxflash')!.classList.add('on');
      const ry = document.getElementById('pxrays')!;
      ry.style.setProperty('--rc', lv >= 3 ? '#ffd54a' : '#e3350d');
      ry.classList.add('on');
      confetti(lv, '#e3350d');
      sfx.hit(lv);
      vibe(lv >= 3 ? [60, 40, 140] : 40);
      st.insertAdjacentHTML('beforeend', `<div class="banner" style="--rc:#c0392b">${grade >= 10 ? '💎 GEM MINT 10 💎' : grade === 9 ? 'MINT 9' : 'NM-MT 8'}</div>`);
    } else sfx.sad();
    document.getElementById('pxhint')!.innerHTML =
      `<div class="cinfo"><div><b style="color:#fff">${c.name}</b> · PGS ${grade} ${GTXT[grade]}</div><div class="cv ${v >= before ? 'up' : 'down'}">${fmt(v)}</div>` +
      `<div class="mu">Antes ${fmt(before)} · toca para ${gr.idx < gr.ids.length - 1 ? 'la siguiente' : 'terminar'}</div></div>`;
    gr.ready = true;
  }, 1500);
  st.addEventListener('click', () => {
    if (!gr.ready) return;
    gr.idx++;
    if (gr.idx >= gr.ids.length) {
      GR = null;
      untilt();
      closeM();
    } else renderM();
  });
});
