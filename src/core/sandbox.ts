import type { Game } from './game';
import { DECOR, caseCap, itemVal } from '../systems/economy';
import { createShopNav } from '../systems/shopNav';
import { assignSlots, roll } from '../systems/packs';

/*
 * Modo ?prueba (solo para probar el bucle del día hasta que lleguen los paneles de la F4):
 * compra sobres, abre unos cuantos y llena la vitrina. Esta partida no se guarda nunca.
 */
export function stockForTest(g: Game): void {
  const S = g.S;
  S.tut.on = false;
  for (const sd of g.sets) {
    S.sealed[sd.id] += 12;
    S.money -= S.pack[sd.id].w * 12;
    for (let k = 0; k < 2; k++)
      for (const x of roll(g, sd.id)) {
        S.items.push({ i: S.nid++, c: x.c.id, k: 'NM', rv: x.rv, cost: 0, case: null, res: false });
        S.dex[x.c.id] = 1;
      }
  }
  // Las 8 mejores cartas a la vitrina con el margen por defecto de la v10 (precio × 1,1)
  S.items
    .slice()
    .sort((a, b) => itemVal(g, b) - itemVal(g, a))
    .slice(0, 8)
    .forEach((it) => (it.case = 1.1));
  assignSlots(g);
}

/** ?prueba&deco: toda la decoración y el personal; ?prueba&dinero=N: dinero para ver otra categoría */
export function decorForTest(g: Game, money: number | null): void {
  const S = g.S;
  for (const d of DECOR) S.decor[d.k] = 1;
  S.staff.cashier = S.staff.appraiser = true;
  const sid = g.sets[0]?.id;
  if (sid) for (const t of ['box', 'etb', 'tin', 'col']) S.prod[`${t}:${sid}`] = 2;
  S.prod['acc:sleeves'] = S.prod['acc:dice'] = 3;
  if (money != null) S.money = money;
  g.nav = createShopNav(caseCap(S), S.decor);
}
