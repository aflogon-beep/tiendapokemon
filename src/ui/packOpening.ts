import { fmt } from '../core/format';
import { clamp, pick } from '../core/rng';
import type { Card } from '../data/cards';
import { RAR } from '../data/rarity';
import { setDef, setName } from '../data/sets';
import { openPacks, pulledVal } from '../systems/inventory';
import { price, rvr } from '../systems/economy';
import { PTYPES, type ProdInfo } from '../systems/products';
import { A, closeM, defModal, defMount, G, host, openM, renderM, ui } from './ctx';
import { cls, face, faceBig, big } from './cards';
import { ac, audio, setSound, sfx, vibe } from './sound';

/* Apertura «wow» de sobres y cajas y visor de cartas (v10) */

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s);

interface OCard {
  c: Card;
  rv: boolean;
  nw?: boolean;
}

interface OpenState {
  s: string;
  n: number;
  val: number;
  cards: OCard[];
  total: number;
  quick?: boolean;
  mode: 'seq' | 'sum';
  phase?: 'pack' | 'cards';
  idx: number;
  run: number;
  tp: number;
  tb: number;
  tstep: number;
  torn: boolean;
  rev: boolean;
  lv: number;
  cost: number;
}

let openState: OpenState | null = null;
let CUR: HTMLElement | null = null;

/* --- inclinación: dedo, giroscopio o balanceo automático --- */
const TILT = { el: null as HTMLElement | null, cx: 0.5, cy: 0.5, tx: 0.5, ty: 0.5, pl: 0, g: null as { g: number; b: number; t: number } | null, b0: null as number | null };
window.addEventListener('deviceorientation', (e) => {
  if (e.gamma != null) TILT.g = { g: e.gamma, b: e.beta ?? 0, t: performance.now() };
});
let gyroAsked = false;
function askGyro(): void {
  if (gyroAsked) return;
  gyroAsked = true;
  try {
    const D = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<unknown> };
    D?.requestPermission?.().catch(() => {});
  } catch {
    /* sin giroscopio */
  }
}
function ptTilt(e: PointerEvent): void {
  if (!TILT.el) return;
  const r = TILT.el.getBoundingClientRect();
  TILT.tx = clamp((e.clientX - r.left) / r.width, 0, 1);
  TILT.ty = clamp((e.clientY - r.top) / r.height, 0, 1);
  TILT.pl = performance.now();
}
(function tiltLoop() {
  const el = TILT.el;
  if (el?.isConnected) {
    const now = performance.now();
    let tx = 0.5, ty = 0.5;
    if (now - TILT.pl < 1500) {
      tx = TILT.tx;
      ty = TILT.ty;
    } else if (TILT.g && now - TILT.g.t < 600) {
      if (TILT.b0 == null) TILT.b0 = TILT.g.b;
      TILT.b0 += (TILT.g.b - TILT.b0) * 0.005;
      tx = clamp(0.5 + TILT.g.g / 32, 0, 1);
      ty = clamp(0.5 + (TILT.g.b - TILT.b0) / 32, 0, 1);
    } else if (!RM) {
      const t = now / 1000;
      tx = 0.5 + 0.24 * Math.sin(t * 1.1);
      ty = 0.5 + 0.15 * Math.cos(t * 0.9);
    }
    TILT.cx += (tx - TILT.cx) * 0.12;
    TILT.cy += (ty - TILT.cy) * 0.12;
    const sp = el.style;
    sp.setProperty('--mx', (TILT.cx * 100).toFixed(1) + '%');
    sp.setProperty('--my', (TILT.cy * 100).toFixed(1) + '%');
    sp.setProperty('--rx', ((0.5 - TILT.cy) * 22).toFixed(2) + 'deg');
    sp.setProperty('--ry', ((TILT.cx - 0.5) * 26).toFixed(2) + 'deg');
  }
  requestAnimationFrame(tiltLoop);
})();

/* --- brillo y nivel de «golpe» de cada carta --- */
function holoOf(c: Card, rv: boolean): { ho: number; cl: string } {
  const t = ({ R: [0.18, ''], DR: [0.36, ''], IR: [0.4, ''], UR: [0.45, 'sp'], SIR: [0.5, 'sp'], HR: [0.52, 'gold sp'] } as Record<string, [number, string]>)[c.r] || [0, ''];
  return { ho: Math.max(t[0], rv ? 0.34 : 0), cl: t[1] };
}
const cardVal = (x: OCard) => pulledVal(G(), x);
function hitLv(x: OCard): number {
  const v = cardVal(x);
  let lv = ({ DR: 1, IR: 2, UR: 2, SIR: 3, HR: 3 } as Record<string, number>)[x.c.r] || 0;
  if (v >= 5) lv = Math.max(lv, 1);
  if (v >= 25) lv = Math.max(lv, 2);
  if (v >= 90) lv = 3;
  return lv;
}
function pcHTML(c: Card, rv: boolean, back: boolean, lv: number): string {
  const h = holoOf(c, rv);
  return (
    `<div class="pc${back ? ' back charge' : ''}${back && lv >= 3 ? ' l3' : ''}" style="--rc:${RAR[c.r].c};--ho:${h.ho}"><div class="ent"><div class="wob"><div class="inner">` +
    `<div class="fr">${faceBig(c, rv)}<div class="holo ${h.cl}"></div><div class="glare"></div></div><div class="bk"><div class="pball"></div></div></div></div></div></div>`
  );
}

function confetti(lv: number, col: string): void {
  if (RM) return;
  const root = $('#px') || $('#zv');
  if (!root) return;
  const cv = document.createElement('canvas');
  cv.className = 'conf';
  root.appendChild(cv);
  const dpr = Math.min(2, devicePixelRatio || 1), W0 = innerWidth, H0 = innerHeight;
  cv.width = W0 * dpr;
  cv.height = H0 * dpr;
  const g = cv.getContext('2d')!;
  g.scale(dpr, dpr);
  const cols = [col, '#ffd54a', '#ffffff', '#7fe3ff', '#ff7ab8'], n = lv >= 3 ? 190 : lv === 2 ? 90 : 40;
  const P = Array.from({ length: n }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.3, v = 6 + Math.random() * (lv >= 3 ? 13 : 8);
    return { x: W0 / 2, y: H0 * 0.45, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, w: 5 + Math.random() * 6, h: 3 + Math.random() * 4, c: pick(cols) };
  });
  const t0 = performance.now();
  (function f(t: number) {
    const k = (t - t0) / 1000;
    g.clearRect(0, 0, W0, H0);
    P.forEach((p) => {
      p.vy += 0.25;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.r);
      g.globalAlpha = Math.max(0, 1 - k / 3);
      g.fillStyle = p.c;
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.restore();
    });
    if (k < 3 && cv.isConnected) requestAnimationFrame(f);
    else cv.remove();
  })(t0);
}

function countUp(el: HTMLElement, v: number, ms: number): void {
  const t0 = performance.now();
  (function f(t: number) {
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = fmt(v * (1 - Math.pow(1 - k, 3)));
    if (k < 1 && el.isConnected) requestAnimationFrame(f);
  })(t0);
}

/* --- abrir sobres --- */

export function openPacksUi(s: string, n: number): void {
  const g = G();
  n = Math.min(n, g.S.sealed[s]);
  const r = openPacks(g, s, n);
  if (!r) return;
  const shown = n === 1 ? r.pulled : r.pulled.slice().sort((a, b) => pulledVal(g, b) - pulledVal(g, a)).slice(0, 12);
  openState = {
    s, n, val: r.val, cards: shown.map((x) => ({ c: x.c, rv: x.rv, nw: x.nw })), total: r.pulled.length,
    quick: n > 1, mode: n === 1 ? 'seq' : 'sum', phase: 'pack', idx: 0, run: 0, tp: 0, tb: 0, tstep: 0, torn: false, rev: false, lv: 0,
    cost: n * g.S.pack[s].w,
  };
  ui.hud();
  openM('open');
}

const osum = (): string => {
  const o = openState!, d = o.val - o.cost;
  return `<b>Valor: ${fmt(o.val)}</b> · Coste: ${fmt(o.cost)} · <span class="${cls(d)}">${d >= 0 ? '+' : ''}${fmt(d)}</span>`;
};

// Resumen (o apertura rápida de 10)
defModal('open', {
  wide: true,
  body: () => {
    const o = openState!, g = G();
    const sorted = o.cards.slice().sort((a, b) => cardVal(b) - cardVal(a));
    const tiles = sorted
      .map((x, i) => `<div class="tile zoomable${i === 0 ? ' best' : ''}" data-a="zoom" data-k="${x.c.id}" data-n="${x.rv ? 1 : 0}">${face(x.c, x.rv)}<div class="pt">${fmt(cardVal(x))}</div>${x.nw ? '<div class="nw">NUEVA</div>' : ''}</div>`)
      .join('');
    const more = o.total > o.cards.length ? `<p class="mu">+${o.total - o.cards.length} cartas más, ya en tu inventario.</p>` : '';
    return (
      `<h2>${o.n} sobre${o.n > 1 ? 's' : ''} de ${setName(o.s)}</h2><div class="tiles lg">${tiles}</div>${more}<p id="osum">${osum()}</p>` +
      `<p class="mu">Toca una carta para verla en grande.</p><div class="btns">${g.S.sealed[o.s] > 0 ? `<button class="b pri" data-a="open" data-k="${o.s}" data-n="1">Abrir otro</button>` : ''}</div>`
    );
  },
  onClose: () => {
    openState = null;
    TILT.el = null;
    closeM();
  },
});

// Apertura de un sobre a pantalla completa
defMount('open', () => {
  const o = openState;
  if (!o || o.mode !== 'seq') return false;
  mountPX(o);
});

const runTxt = (o: OpenState): string => {
  const d = o.run - o.cost;
  return o.phase === 'pack' ? `Coste del sobre ${fmt(o.cost)}` : `Llevas <b class="${cls(d)}">${fmt(o.run)}</b> de ${fmt(o.cost)}`;
};

function mountPX(o: OpenState): void {
  const sd = setDef(o.s);
  host().innerHTML =
    `<div class="px" id="px" style="--sc:${sd?.col || '#888'}">` +
    `<div class="pxbar"><div><b>${sd?.n || setName(o.s)}</b><div class="pxrun" id="pxrun">Coste del sobre ${fmt(o.cost)}</div></div>` +
    `<div class="step"><button class="ib" id="pxsnd" aria-label="Sonido">${audio.on ? '🔊' : '🔇'}</button><button class="ib" id="pxskip">Saltar</button></div></div>` +
    `<div class="dots" id="pxdots">${o.cards.map(() => '<i></i>').join('')}</div>` +
    `<div class="pxstage" id="pxst"><div class="rays" id="pxrays"></div></div><div class="pxhint" id="pxhint"></div><div class="flash" id="pxflash"></div></div>`;
  o.cards.forEach((y) => {
    if (y.c.img) new Image().src = big(y.c.img);
  });
  $('#pxsnd')!.onclick = (e) => {
    setSound(!audio.on);
    (e.currentTarget as HTMLElement).textContent = audio.on ? '🔊' : '🔇';
  };
  $('#pxskip')!.onclick = () => {
    o.mode = 'sum';
    TILT.el = null;
    CUR = null;
    renderM();
  };
  const st = $('#pxst')!;
  let P: { x: number; moved: boolean } | null = null;
  st.addEventListener('pointerdown', (e) => {
    ac();
    askGyro();
    P = { x: e.clientX, moved: false };
    try {
      st.setPointerCapture(e.pointerId);
    } catch {
      /* sin captura */
    }
  });
  st.addEventListener('pointermove', (e) => {
    ptTilt(e);
    if (!P) return;
    const dx = e.clientX - P.x;
    if (Math.abs(dx) > 8) P.moved = true;
    if (o.phase === 'pack' && !o.torn) {
      const w = $('#pxpack')!.getBoundingClientRect().width;
      tearTo(o, o.tb + Math.abs(dx) / (w * 0.75));
    } else if (o.phase === 'cards' && o.rev && CUR) {
      CUR.classList.remove('snap');
      CUR.style.setProperty('--dx', dx + 'px');
      CUR.style.setProperty('--dr', (dx / 18).toFixed(1) + 'deg');
    }
  });
  const up = (e: PointerEvent) => {
    if (!P) return;
    const dx = e.clientX - P.x, pp = P;
    P = null;
    if (o.phase === 'pack') {
      if (o.torn) return;
      if (!pp.moved) autoTear(o);
      else o.tb = o.tp;
      return;
    }
    if (o.phase !== 'cards' || !CUR) return;
    if (!o.rev) {
      if (Math.abs(dx) < 40) reveal(o);
      return;
    }
    if (Math.abs(dx) > 70) nextCard(o, Math.sign(dx));
    else if (!pp.moved) nextCard(o, 1);
    else {
      CUR.classList.add('snap');
      CUR.style.setProperty('--dx', '0px');
      CUR.style.setProperty('--dr', '0deg');
    }
  };
  st.addEventListener('pointerup', up);
  st.addEventListener('pointercancel', up);
  for (let i = 0; i < o.idx; i++) markDot(i, RAR[o.cards[i].c.r].c);
  $('#pxrun')!.innerHTML = runTxt(o);
  if (o.phase === 'pack') buildPack(o);
  else {
    buildStack();
    showCard(o, o.idx);
  }
}

function markDot(i: number, col: string): void {
  const e = $('#pxdots')?.children[i] as HTMLElement | undefined;
  if (!e) return;
  e.style.background = col;
  e.style.color = col;
  e.classList.add('on');
}

function buildPack(o: OpenState): void {
  const sd = setDef(o.s);
  $('#pxst')!.insertAdjacentHTML(
    'beforeend',
    `<div class="packwrap" id="pxpw"><div class="bobw"><div class="pack" id="pxpack">` +
      `<div class="pbody"><div class="pcnt">${sd?.sym ? `<img class="psym" src="${sd.sym}" alt="" onerror="this.remove()">` : ''}<div class="pball"></div>` +
      `<div class="pname">${sd?.n || setName(o.s)}</div><div class="psub">Sobre de ampliación · ${o.cards.length} cartas</div></div>` +
      `<div class="holo" style="--ho:.3"></div><div class="sweep"></div><div class="glare"></div></div>` +
      `<div class="ptop">POKÉ CARDS</div><div class="tear"></div></div></div></div>`,
  );
  TILT.el = $('#pxpack');
  $('#pxhint')!.innerHTML = `<div style="font-size:16px;color:#fff;font-weight:700">Desliza el dedo por el sobre para abrirlo</div><div class="mu">o tócalo · inclina el móvil para ver el brillo</div>`;
}

function tearTo(o: OpenState, v: number): void {
  o.tp = clamp(v, 0, 1);
  const pk = $('#pxpack');
  if (!pk) return;
  pk.style.setProperty('--tp', String(o.tp));
  const stp = Math.floor(o.tp * 8);
  if (stp > o.tstep) {
    o.tstep = stp;
    sfx.tick();
    vibe(6);
  }
  if (o.tp >= 1 && !o.torn) tear(o);
}

function autoTear(o: OpenState): void {
  const a = o.tp, t0 = performance.now();
  (function f(t: number) {
    const k = Math.min(1, (t - t0) / 380);
    tearTo(o, a + (1 - a) * k);
    if (k < 1 && !o.torn) requestAnimationFrame(f);
  })(t0);
}

function tear(o: OpenState): void {
  o.torn = true;
  sfx.rip();
  vibe(25);
  const pk = $('#pxpack')!;
  pk.querySelector('.ptop')!.classList.add('fly');
  (pk.querySelector('.tear') as HTMLElement).style.opacity = '0';
  $('#pxhint')!.innerHTML = '';
  setTimeout(() => {
    $('#pxpw')?.classList.add('done');
    sfx.swish();
  }, 450);
  setTimeout(() => {
    $('#pxpw')?.remove();
    if (!$('#px')) return;
    o.phase = 'cards';
    buildStack();
    showCard(o, o.idx);
  }, 950);
}

function buildStack(): void {
  $('#pxst')!.insertAdjacentHTML('beforeend', `<div class="cstack" id="pxcs">${[3, 2, 1].map((i) => `<div class="under" style="--i:${i}"></div>`).join('')}</div>`);
}

function showCard(o: OpenState, i: number): void {
  const x = o.cards[i], c = x.c, lv = hitLv(x), rc = RAR[c.r].c, cs = $('#pxcs');
  if (!cs) return;
  const left = o.cards.length - i - 1;
  cs.querySelectorAll<HTMLElement>('.under').forEach((u) => u.classList.toggle('off', +u.style.getPropertyValue('--i') > left));
  cs.insertAdjacentHTML('beforeend', pcHTML(c, x.rv, lv > 0, lv));
  const all = cs.querySelectorAll<HTMLElement>('.pc');
  CUR = all[all.length - 1];
  [...all].filter((e) => e !== CUR && !e.classList.contains('fly')).forEach((e) => e.remove());
  const fl = cs.querySelector('.pc.fly');
  if (fl) cs.appendChild(fl);
  TILT.el = CUR;
  o.lv = lv;
  o.rev = !lv;
  $('#pxrays')!.classList.remove('on');
  $('#px .banner')?.remove();
  if (!lv) {
    sfx.flip();
    markDot(i, rc);
    o.run += cardVal(x);
    $('#pxrun')!.innerHTML = runTxt(o);
    setInfo(o, x, false);
  } else {
    sfx.charge(lv);
    vibe(lv >= 3 ? [20, 40, 20, 40, 20] : 15);
    $('#pxhint')!.innerHTML =
      `<div class="cinfo"><div class="cv" style="color:${rc}">${lv >= 3 ? '¡¡Algo brilla muchísimo!!' : lv === 2 ? '¡Algo brilla!' : 'Esto brilla…'}</div>` +
      `<div class="mu">Toca la carta para revelarla · ${i + 1}/${o.cards.length}</div></div>`;
  }
}

const lv2ms = (lv: number) => (lv >= 3 ? 1400 : lv === 2 ? 900 : 600);

function setInfo(o: OpenState, x: OCard, anim: boolean): void {
  const c = x.c, v = cardVal(x);
  $('#pxhint')!.innerHTML =
    `<div class="cinfo" style="--rc:${RAR[c.r].c}"><div><b style="color:#fff">${c.name}</b> <span class="rchip">${RAR[c.r].n}</span>` +
    `${x.rv ? ' <span class="rchip rv">Reverse</span>' : ''}${x.nw ? ' <span class="nwb">NUEVA</span>' : ''}</div>` +
    `<div class="cv" id="pxcv">${anim ? fmt(0) : fmt(v)}</div><div class="mu">${o.idx >= o.cards.length - 1 ? 'Toca para ver el resumen' : 'Desliza o toca para la siguiente'} · ${o.idx + 1}/${o.cards.length}</div></div>`;
  if (anim) countUp($('#pxcv')!, v, lv2ms(o.lv));
}

function reveal(o: OpenState): void {
  const x = o.cards[o.idx], c = x.c, lv = o.lv, rc = RAR[c.r].c, el = CUR!;
  o.rev = true;
  el.classList.remove('back');
  sfx.flip();
  setTimeout(() => {
    if (!$('#px')) return;
    el.classList.remove('charge', 'l3');
    const fl = $('#pxflash')!;
    fl.classList.remove('on');
    void fl.offsetWidth;
    fl.classList.add('on');
    const ry = $('#pxrays')!;
    ry.style.setProperty('--rc', rc);
    ry.classList.add('on');
    const base = ({ DR: 1, IR: 2, UR: 2, SIR: 3, HR: 3 } as Record<string, number>)[c.r];
    $('#pxst')!.insertAdjacentHTML('beforeend', `<div class="banner" style="--rc:${rc}">${lv >= 3 ? '✨ ' : ''}${base ? RAR[c.r].n : '¡Carta valiosa!'}${lv >= 3 ? ' ✨' : ''}</div>`);
    confetti(lv, rc);
    sfx.hit(lv);
    vibe(lv >= 3 ? [60, 40, 140] : lv === 2 ? [40, 30, 60] : 30);
    markDot(o.idx, rc);
    o.run += cardVal(x);
    $('#pxrun')!.innerHTML = runTxt(o);
    setInfo(o, x, true);
  }, 280);
}

function nextCard(o: OpenState, dir: number): void {
  const el = CUR;
  if (!el) return;
  el.classList.remove('snap');
  el.classList.add('fly');
  el.style.setProperty('--dx', dir * innerWidth * 1.1 + 'px');
  el.style.setProperty('--dr', dir * 28 + 'deg');
  sfx.swish();
  CUR = null;
  setTimeout(() => el.remove(), 450);
  o.idx++;
  if (o.idx >= o.cards.length) {
    $('#pxrays')!.classList.remove('on');
    setTimeout(() => {
      if (openState !== o || !$('#px')) return;
      o.mode = 'sum';
      TILT.el = null;
      renderM();
    }, 320);
  } else showCard(o, o.idx);
}

/* --- visor de carta a pantalla completa --- */
export function zoom(id: string, rv: boolean): void {
  const g = G(), c = g.db.byId[id];
  if (!c) return;
  $('#zv')?.remove();
  const el = document.createElement('div');
  el.id = 'zv';
  el.className = 'px zv';
  el.style.setProperty('--sc', RAR[c.r].c);
  el.innerHTML =
    `<div class="pxstage"><div class="cstack">${pcHTML(c, rv, false, 0)}</div></div><div class="pxhint"><div class="cinfo" style="--rc:${RAR[c.r].c}">` +
    `<div><b style="color:#fff">${c.name}</b> <span class="rchip">${RAR[c.r].n}</span>${rv ? ' <span class="rchip rv">Reverse</span>' : ''}</div>` +
    `<div class="cv">${fmt(price(g, id) * (rv ? rvr(c) : 1))}</div><div class="mu">Mueve el dedo o inclina el móvil · toca para cerrar</div></div></div>`;
  document.body.appendChild(el);
  const prev = TILT.el;
  TILT.el = el.querySelector('.pc');
  el.addEventListener('pointerdown', () => askGyro());
  el.addEventListener('pointermove', ptTilt);
  el.addEventListener('click', () => {
    el.remove();
    TILT.el = prev?.isConnected ? prev : null;
  });
}
A.zoom = (d) => zoom(d.k!, d.n === '1');

/* --- abrir cajas (mountBox) --- */
let BOXO: { i: ProdInfo; done?: boolean } | null = null;

export function startBoxOpening(i: ProdInfo): void {
  BOXO = { i };
  openM('boxo');
}

defMount('boxo', () => {
  const B = BOXO;
  if (!B) return false;
  const i = B.i, sd = setDef(i.s!);
  host().innerHTML =
    `<div class="px" id="px" style="--sc:${i.col}"><div class="pxbar"><div><b>${i.ic} ${i.n}</b><div class="pxrun">${i.packs} sobres dentro</div></div>` +
    `<div class="step"><button class="ib" id="bxclose">Cerrar</button></div></div>` +
    `<div class="pxstage" id="bxst"><div class="rays" id="pxrays" style="--rc:${i.col}"></div><div class="bxw" id="bxw"><div class="bx-lid"></div>` +
    `<div class="bx-body">${sd?.sym ? `<img src="${sd.sym}" alt="" onerror="this.remove()">` : '<div class="pball" style="width:56px;margin:0"></div>'}<b>${setName(i.s!)}</b><span>${PTYPES[i.t].n}</span></div>` +
    `<div class="tape"><i></i></div></div></div>` +
    `<div class="pxhint" id="bxhint"><div style="font-size:16px;color:#fff;font-weight:700">Desliza por la cinta para cortarla</div><div class="mu">o toca la caja</div></div><div class="flash" id="pxflash"></div></div>`;
  const w = $('#bxw')!, st = $('#bxst')!;
  let x0: number | null = null;
  const done = () => {
    BOXO = null;
    closeM();
  };
  $('#bxclose')!.onclick = done;
  const cut = () => {
    if (B.done) return;
    B.done = true;
    sfx.rip();
    vibe(25);
    w.classList.add('cut');
    setTimeout(() => {
      w.classList.add('open');
      sfx.swish();
    }, 250);
    setTimeout(() => {
      if (!$('#px')) return;
      $('#pxrays')!.classList.add('on');
      const n = i.packs!, rows = n > 12 ? 3 : n > 6 ? 2 : 1, per = Math.ceil(n / rows);
      let h = '';
      for (let k = 0; k < n; k++) {
        const r = Math.floor(k / per), j = k % per, cnt = Math.min(per, n - r * per);
        const a = ((-65 + 130 * (cnt > 1 ? j / (cnt - 1) : 0.5)) * Math.PI) / 180, R = 95 + r * 38;
        h += `<div class="fp" style="--tx:${(Math.sin(a) * R).toFixed(1)}px;--ty:${(-Math.cos(a) * R + 30).toFixed(1)}px;--r:${(a * 57.3).toFixed(0)}deg;animation-delay:${k * 28}ms">${sd?.sym ? `<img src="${sd.sym}" alt="">` : ''}</div>`;
      }
      w.insertAdjacentHTML('beforeend', h);
      for (let k = 0; k < Math.min(n, 14); k++) setTimeout(() => sfx.tick(), k * 60);
      confetti(n >= 20 ? 2 : 1, i.col);
      $('#bxhint')!.innerHTML =
        `<div class="cinfo"><div class="cv">+${n} sobres</div><div class="mu">de ${setName(i.s!)} añadidos a tu stock</div>` +
        `<div class="btns" style="justify-content:center"><button class="b pri" id="bxok">¡Genial!</button></div></div>`;
      $('#bxok')!.onclick = done;
    }, 900);
  };
  const tape = w.querySelector('.tape i') as HTMLElement;
  st.addEventListener('pointerdown', (e) => {
    ac();
    x0 = e.clientX;
  });
  st.addEventListener('pointermove', (e) => {
    if (x0 == null || B.done) return;
    const p = clamp(Math.abs(e.clientX - x0) / (w.getBoundingClientRect().width * 0.7), 0, 1);
    tape.style.setProperty('--cut', p * 100 + '%');
    if (p >= 1) cut();
  });
  st.addEventListener('pointerup', () => {
    if (x0 != null && !B.done && !(+getComputedStyle(tape).getPropertyValue('--cut').replace('%', '') > 5)) cut();
    x0 = null;
  });
});

