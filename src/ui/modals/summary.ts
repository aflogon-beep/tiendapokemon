import { fmt } from '../../core/format';
import type { Summary } from '../../core/state';
import { level, tierOf, TIERS } from '../../systems/economy';
import { evLabel } from '../../systems/events';
import { toggleTour } from '../../systems/upgrades';
import { A, closeM, defModal, defMount, G, host, renderM } from '../ctx';
import { confetti } from '../packOpening';
import { sfx, vibe } from '../sound';

/* Ticket del día (mSum) y nueva categoría de tienda (mountTier) de la v10 */

function ticketHTML(s: Summary): string {
  const g = G(), S = g.S, T = TIERS[tierOf(level(g))], res = s.inc + (s.tourInc || 0) - s.rent - (s.sal || 0) - (s.refund || 0);
  const L = (a: string, b: string | number, c?: string) => `<div class="tl${c ? ' ' + c : ''}"><span>${a}</span><i></i><span>${b}</span></div>`;
  const hist = (S.hist || []).slice(-7), mx = Math.max(1, ...hist.map((h) => h.inc));
  const bars = hist
    .map((h, i) => {
      const bh = Math.max(2, (h.inc / mx) * 44);
      return `<rect x="${i * 28 + 4}" y="${50 - bh}" width="18" height="${bh}" rx="2" fill="${i === hist.length - 1 ? '#e3350d' : '#9aa0a8'}"/><text x="${i * 28 + 13}" y="62" font-size="8" text-anchor="middle" fill="#666">D${h.d}</text>`;
    })
    .join('');
  return (
    `<div class="ticket"><div class="tc"><b>${T.n.toUpperCase()}</b><br>${T.sub}<br>TICKET DE CIERRE · DÍA ${s.day}</div><div class="tdash"></div>` +
    `${L('Clientes', s.cust)}${L('Se fueron sin comprar', s.lost)}<div class="tdash"></div>` +
    `${L('Ventas', fmt(s.inc), 'pos')}${s.tourInc != null ? L('Torneo', (s.tourInc >= 0 ? '+' : '') + fmt(s.tourInc), s.tourInc >= 0 ? 'pos' : 'neg') : ''}` +
    `${L('Alquiler', '−' + fmt(s.rent), 'neg')}${s.sal ? L('Sueldos', '−' + fmt(s.sal), 'neg') : ''}${s.refund ? L('Devoluciones', '−' + fmt(s.refund), 'neg') : ''}` +
    `<div class="tdash"></div>${L('<b>RESULTADO DEL DÍA</b>', `<b>${res >= 0 ? '+' : ''}${fmt(res)}</b>`, res >= 0 ? 'pos' : 'neg')}${L('Valor de la empresa', fmt(s.net))}` +
    `${hist.length > 1 ? `<div class="tchart">Ventas de los últimos días<svg viewBox="0 0 ${hist.length * 28 + 4} 66" width="100%" height="72">${bars}</svg></div>` : ''}` +
    `<div class="tdash"></div><div class="tc">¡GRACIAS POR SU VISITA!<br>${new Date().toLocaleDateString('es-ES')}</div></div>`
  );
}

defModal('sum', {
  body: () => {
    const S = G().S, s = S.summary!;
    return (
      `<h2>Fin del día ${s.day}</h2>${ticketHTML(s)}${s.news ? `<div class="pn">${s.news}</div>` : ''}` +
      `${s.grN ? `<div class="pn"><div>📬 Han llegado ${s.grN} carta(s) del gradeo.</div><div class="btns"><button class="b pri" data-a="grades">Ver resultados</button></div></div>` : ''}` +
      `${s.fkN ? `<div class="pn">🚫 El servicio de gradeo ha detectado ${s.fkN} falsificación(es). Esas cartas ya no valen nada.</div>` : ''}` +
      `${s.refN ? `<div class="pn down">😡 ${s.refN} cliente(s) descubrieron que les vendiste una carta falsa: devuelves ${fmt(s.refund)} y pierdes reputación.</div>` : ''}` +
      `${s.newOrd ? `<div class="pn">📋 Hay un encargo nuevo en Tareas.</div>` : ''}${s.exp ? `<div class="pn mu">⌛ ${s.exp} encargo(s) han caducado.</div>` : ''}` +
      `<div class="pn"><b>Día ${S.day}</b><div>${evLabel(S) || 'Un día normal.'}</div>${S.decor.table ? `<div class="btns"><button class="b ${S.tour ? 'on' : ''}" data-a="tourtog">🏆 ${S.tour ? 'Torneo organizado ✔' : 'Organizar torneo (40 € en premios)'}</button></div>` : '<div class="mu">Con la mesa de juego (Más → Mejoras) podrás organizar torneos.</div>'}</div>` +
      `<p class="mu">Misiones nuevas en Tareas. Repón stock y ajusta la vitrina antes de abrir.</p>`
    );
  },
});

A.tourtog = () => {
  toggleTour(G());
  renderM();
};

/* --- nueva categoría --- */
export const tierUi = { show: null as number | null };

defMount('tierup', () => {
  const t = tierUi.show;
  if (t == null) return false;
  const T = TIERS[t];
  host().innerHTML =
    `<div class="px" id="px" style="--sc:#c9a227"><div class="pxstage"><div class="rays on" style="--rc:#ffd54a"></div><div class="tier">` +
    `<div class="ttl">¡NUEVA CATEGORÍA!</div><div class="tsign ts${t}">${T.n.toUpperCase()}</div><div style="font-family:var(--fd);font-size:20px;color:#fff">${T.sub}</div>` +
    `<div class="tlist">🏗️ Suelo, paredes y cartel nuevos<br>🎨 La interfaz cambia de estilo<br>⭐ Más prestigio para atraer clientes</div>` +
    `<button class="b pri" id="tierok" style="font-size:18px;padding:12px 26px">¡Vamos!</button></div></div></div>`;
  confetti(3, '#ffd54a');
  sfx.hit(3);
  vibe([60, 40, 140]);
  G().fx.shake(8);
  document.getElementById('tierok')!.onclick = () => {
    tierUi.show = null;
    closeM();
  };
});
