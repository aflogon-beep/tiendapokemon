import { clamp } from '../core/rng';
import { caseItems, sealedCount } from '../systems/economy';
import { front } from '../systems/customers';
import { portrait } from '../world/portraits';
import { G, ui } from './ctx';
import { collUi } from './modals/coll';
import { isOpenSummary } from './packOpening';
import { toast } from './toast';
import { sfx } from './sound';

/* Tutorial de la v10 (TUT, tutStep, tutTick): Carla guía los primeros pasos */

interface Step {
  t: string;
  next?: boolean;
  last?: boolean;
  float?: boolean;
  sel?: () => string | null;
  done?: () => boolean;
}

const M = () => ui.M;
// El botón de cerrar de la hoja (el fondo también lleva data-a=close)
const CLOSE = '.sheet [data-a=close]';

const TUT: Step[] = [
  { t: '¡Hola! Soy Carla, tu socia 👋 Vamos a montar la tienda de cartas más top de la isla. Te enseño lo básico en un par de minutos.', next: true },
  { t: 'Primero necesitas producto. Toca «Stock».', sel: () => (M() && M() !== 'packs' ? CLOSE : '#nav [data-k=packs]'), done: () => M() === 'packs' },
  { t: 'Compra 6 sobres de este set. Los clientes los cogen de las estanterías.', sel: () => (M() === 'packs' ? '[data-a=buyp][data-n="6"]' : '#nav [data-k=packs]'), done: () => sealedCount(G()) > 0 },
  { t: 'Este es el precio de venta de cada sobre. Si lo pones muy alto, los clientes se van sin comprar. Se ajusta con − y +.', sel: () => (M() === 'packs' ? '.pn .step' : null), next: true },
  { t: '¡Ahora lo divertido! Abre un sobre.', sel: () => (M() === 'packs' ? '[data-a=open][data-n="1"]' : '#nav [data-k=packs]'), done: () => M() === 'open' },
  { t: 'Desliza el dedo por el sobre para abrirlo y pasa las cartas. Las buenas brillan 😉', float: true, done: () => M() !== 'open' || isOpenSummary() },
  { t: 'Vamos a poner una carta a la venta. Cierra y toca «Cartas».', sel: () => (M() && M() !== 'coll' ? CLOSE : '#nav [data-k=coll]'), done: () => M() === 'coll' },
  {
    t: 'Toca una carta y luego «+ Vitrina». Lo que está en la vitrina lo pueden comprar los clientes.',
    sel: () => (M() !== 'coll' ? '#nav [data-k=coll]' : collUi.sel ? '[data-a=caseadd]' : '.tiles .tile'),
    done: () => caseItems(G().S).length > 0,
  },
  { t: '¡Todo listo! Cierra el panel y abre la tienda.', sel: () => (M() ? CLOSE : '#act'), done: () => G().S.phase !== 'closed' },
  {
    t: 'Los clientes entran, cogen lo que quieren y hacen cola en la caja. Cuando haya alguien esperando, pulsa «Cobrar».',
    sel: () => (front(G()) && !M() ? '#act' : null),
    float: true,
    done: () => M() === 'ck' || M() === 'hag' || (G().S.lt.served || 0) >= 1,
  },
  { t: 'Si paga en efectivo, dale el cambio exacto tocando billetes y monedas del cajón. Si paga con tarjeta, teclea el total en el TPV y pulsa OK.', float: true, done: () => (G().S.lt.served || 0) >= 1 },
  {
    t: '¡Primera venta! 🎉 Últimos consejos: en «Tareas» tienes encargos, misiones y logros; en «Álbum», tu colección; y en «Más» → Colecciones puedes añadir cualquier set de Pokémon. Ojo con las cartas falsas: examínalas antes de comprar. ¡Te regalo 100 € para empezar!',
    next: true,
    last: true,
  },
];

const TUTV = { i: -1, el: null as Element | null, scrolled: false };
const $ = (id: string) => document.getElementById(id);

function tutEnd(done: boolean): void {
  const S = G().S;
  if (!S.tut) return;
  S.tut.on = false;
  $('tut')?.remove();
  TUTV.i = -1;
  if (done) {
    S.money += 100;
    toast('🎓 Tutorial completado · +100 €');
    sfx.ach();
  }
  ui.saveNow();
  ui.hud();
}

function tutStep(): void {
  const T = G().S.tut, st = TUT[T.i];
  let r = $('tut');
  if (!r) {
    r = document.createElement('div');
    r.id = 'tut';
    document.body.appendChild(r);
  }
  const img = portrait('market', 'character-employee');
  r.innerHTML =
    `<div class="tdim" id="tdim"></div><div class="tspot" id="tspot" style="display:none"></div><div class="tbub" id="tbub"><img src="${img}" alt="">` +
    `<div style="flex:1;min-width:0"><b>Carla</b><p>${st.t}</p><div class="tbtn"><span class="n">${T.i + 1}/${TUT.length}</span>` +
    `${st.last ? '' : '<button id="tskip">Saltar tutorial</button>'}${st.next ? `<button class="go" id="tnext">${st.last ? '¡A jugar!' : 'Siguiente'}</button>` : ''}</div></div></div>`;
  const nx = $('tnext');
  if (nx)
    nx.onclick = () => {
      if (st.last) tutEnd(true);
      else {
        T.i++;
        TUTV.i = -1;
      }
    };
  const sk = $('tskip');
  if (sk)
    sk.onclick = () => {
      if (confirm('¿Saltar el tutorial? Puedes repetirlo en Más.')) tutEnd(false);
    };
  TUTV.i = T.i;
  TUTV.scrolled = false;
}

/** Se llama en cada fotograma: avanza pasos y coloca el foco y el bocadillo */
export function tutTick(): void {
  const T = ui.g?.S.tut;
  if (!T || !T.on) {
    if ($('tut')) {
      $('tut')!.remove();
      TUTV.i = -1;
    }
    return;
  }
  if (T.i >= TUT.length) return tutEnd(true);
  const st = TUT[T.i];
  if (st.done?.()) {
    T.i++;
    TUTV.i = -1;
    ui.saveNow();
    return;
  }
  if (TUTV.i !== T.i) tutStep();
  const sel = st.sel ? st.sel() : null, el = sel ? document.querySelector<HTMLElement>(sel) : null;
  const sp = $('tspot'), dim = $('tdim'), bub = $('tbub');
  if (!bub || !sp || !dim) return;
  const H0 = innerHeight, bh = bub.offsetHeight;
  if (el && el.offsetParent !== null) {
    if (!TUTV.scrolled || TUTV.el !== el) {
      TUTV.scrolled = true;
      TUTV.el = el;
      const rr0 = el.getBoundingClientRect();
      if (rr0.top < 60 || rr0.bottom > H0 - 90) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    const q = el.getBoundingClientRect(), pd = 6;
    sp.style.display = 'block';
    dim.style.display = 'none';
    sp.style.left = q.left - pd + 'px';
    sp.style.top = q.top - pd + 'px';
    sp.style.width = q.width + pd * 2 + 'px';
    sp.style.height = q.height + pd * 2 + 'px';
    let top = q.top + q.height / 2 > H0 / 2 ? q.top - bh - 18 : q.bottom + 18;
    top = clamp(top, 8, H0 - bh - 8);
    bub.style.top = top + 'px';
    bub.style.bottom = 'auto';
  } else {
    sp.style.display = 'none';
    dim.style.display = st.float ? 'none' : 'block';
    bub.style.top = (st.float ? (M() === 'open' ? 62 : 8) : Math.max(8, (H0 - bh) / 2)) + 'px';
    bub.style.bottom = 'auto';
  }
}
