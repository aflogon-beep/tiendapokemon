import { setName } from '../../data/sets';
import { front, type Customer } from '../../systems/customers';
import { pInfo } from '../../systems/products';
import { hearts, RG, regS } from '../../systems/regulars';
import { modelFor } from '../../world/characters';
import { portrait } from '../../world/portraits';
import { A, closeM, defModal, G, openM } from '../ctx';
import { serveFront } from '../serve';

/* Ficha de cliente (mCust de la v10): se abre al tocar a alguien en la tienda */

const TDESC: Record<string, string> = {
  kid: 'Niño/a: sobres y accesorios baratos.',
  collector: 'Coleccionista: busca cartas sueltas.',
  investor: 'Inversor: cartas caras y cajas.',
  whale: 'Gasta mucho: sobres en cantidad y productos premium.',
  seller: 'Viene a venderte cartas.',
  lot: 'Viene a venderte una colección.',
};

let CUSTC: Customer | null = null;

export function openCustomer(c: Customer): void {
  CUSTC = c;
  openM('custc');
}

function wantTxt(c: Customer): string {
  const w = c.want;
  if (w.k === 'pack') return 'Quiere sobres de ' + setName(w.s!);
  if (w.k === 'prod') {
    const i = pInfo(G().S, w.pid!);
    return 'Busca: ' + (i ? i.n : 'un producto');
  }
  if (w.k === 'sell') return 'Quiere venderte una carta';
  if (w.k === 'lot') return 'Quiere venderte una colección';
  return 'Mira la vitrina';
}

defModal('custc', {
  body: () => {
    const g = G(), c = CUSTC!, R = c.reg ? RG(c.reg) : null, rs = R ? regS(g.S, c.reg!) : null;
    const img = portrait('characters', modelFor(c.look));
    const st =
      c.st === 'wait' ? `Esperando en la cola · paciencia ${Math.round(Math.max(0, 1 - c.wt / c.pat) * 100)} %`
      : c.st === 'browse' ? 'Mirando productos'
      : c.st === 'leave' ? (c.bought ? 'Se va contento 🛍️' : 'Se va')
      : 'Entrando';
    return (
      `<div class="ccard"><img src="${img}" alt=""><div style="min-width:0"><h3>${R ? R.n : 'Cliente'}</h3>` +
      `${R && rs ? `<div>${hearts(rs.loy)}</div><div class="mu">${R.d} Visitas: ${rs.visits}.</div>` : `<div class="mu">${TDESC[c.type] || ''}</div>`}</div></div>` +
      `<div class="ccw"><div><b>${wantTxt(c)}</b></div><div class="mu">${st}</div>` +
      `${rs && R && (R.t === 'kid' || R.t === 'whale') && rs.fav ? `<div class="mu">Set favorito: ${setName(rs.fav)}</div>` : ''}${rs?.note ? `<div class="mu">📝 ${rs.note}</div>` : ''}</div>` +
      `${front(g) === c ? '<div class="btns"><button class="b pri big" data-a="custserve">Atender ahora</button></div>' : ''}`
    );
  },
  onClose: () => {
    CUSTC = null;
    closeM();
  },
});

A.custserve = () => {
  CUSTC = null;
  closeM();
  serveFront(G());
};
