import type { Game } from '../../core/game';
import { fmt } from '../../core/format';
import { exportCode, exportStr, parseImport } from '../../core/save';
import { blankState } from '../../core/state';
import { loadSetsFor, replaceState, retrySets } from '../../core/setup';
import { FAILED, type Card } from '../../data/cards';
import { apiStatus } from '../../data/api';
import { RAR } from '../../data/rarity';
import { price } from '../../systems/economy';
import { setName } from '../../data/sets';
import { DEFAULT_SETS } from '../../data/sets';
import { closeModal, openModal } from '../modal';
import { toast } from '../toast';

/* Panel «Partida» de la v10 (mBackup): guardar, copia de seguridad, importar y empezar de cero */

export interface BackupDeps {
  game(): Game | null;
  saveNow(): boolean;
  refresh(): void;
}

const when = (t?: number) => (t ? new Date(t).toLocaleString('es-ES') : '—');

// Estado de las cartas: reales o sin conexión, cuántas y las más caras con su imagen
function cardsInfo(g: Game): string {
  const real = g.mode === 'real';
  const top = g.db.cards
    .filter((c: Card) => g.S.prices[c.id])
    .sort((a, b) => price(g, b.id) - price(g, a.id))
    .slice(0, 6);
  const tile = (c: Card) =>
    `<div class="ctile">${c.img ? `<img src="${c.img}" alt="${c.name}" loading="lazy">` : `<div class="cph" style="--rc:${RAR[c.r].c}">${c.name}</div>`}` +
    `<span>${fmt(price(g, c.id))}</span></div>`;
  return (
    `<div class="pn"><b>${real ? '✅ Cartas reales con precios de Cardmarket' : '⚠️ Modo sin conexión (cartas ilustradas)'}</b>` +
    `<div class="mu">${g.db.cards.length} cartas de ${g.sets.length} colecciones: ${g.sets.map((s) => s.n).join(', ')}.` +
    `${!real && apiStatus.lastError ? ` Motivo: ${apiStatus.lastError}.` : ''} El panel para ver y vender tus cartas llega en la próxima fase.</div>` +
    `<div class="ctiles">${top.map(tile).join('')}</div>` +
    `${real ? '' : '<div class="btns"><button class="b pri" data-a="reload">🔄 Reintentar conexión</button></div>'}</div>`
  );
}

export function openBackup(d: BackupDeps): void {
  const g = d.game();
  if (!g) return;
  const sheet = openModal(
    `<h2>Partida</h2>` + cardsInfo(g) + `<div class="pn"><div>Se guarda sola cada 10 segundos, al cerrar y al terminar el día.</div>` +
      `<div class="mu">Último guardado: ${when(g.S.savedAt)}</div><div class="btns"><button class="b pri" data-a="savebtn">💾 Guardar ahora</button></div></div>` +
      `<div class="pn"><b>Copia de seguridad</b><div class="mu">Si el navegador borra sus datos, perderías la partida. Descarga una copia de vez en cuando. ` +
      `También puedes cargar aquí la copia exportada desde la versión anterior del juego.</div>` +
      `<div class="btns"><button class="b pri" data-a="export">⬇️ Exportar archivo</button><button class="b" data-a="importf">⬆️ Importar archivo</button>` +
      `<button class="b" data-a="copycode">📋 Copiar código</button></div>` +
      `<textarea class="inp" id="impcode" rows="3" placeholder="…o pega aquí un código de partida"></textarea>` +
      `<button class="b" data-a="importc">Cargar código</button></div>` +
      (FAILED.size
        ? `<div class="pn"><b>⚠️ Colecciones sin cargar</b><div class="mu">${[...FAILED].map(setName).join(', ')}</div>` +
          `<div class="btns"><button class="b pri" data-a="retry">🔄 Reintentar</button></div></div>`
        : '') +
      `<div class="pn"><b>Empezar de cero</b><div class="btns"><button class="b" data-a="reset">🗑️ Borrar partida</button></div></div>`,
  );
  sheet.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
    const g = d.game();
    if (!a || !g) return;
    if (a === 'reload') {
      d.saveNow();
      location.reload();
    } else if (a === 'savebtn') {
      if (d.saveNow()) toast('💾 Partida guardada · ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
      closeModal();
      openBackup(d);
    } else if (a === 'export') exportFile(g, d);
    else if (a === 'importf') document.getElementById('impfile')!.click();
    else if (a === 'copycode') copyCode(g);
    else if (a === 'retry') {
      toast(`Reintentando ${FAILED.size} colección(es)…`);
      retrySets(g).then(({ left }) => {
        d.saveNow();
        d.refresh();
        toast(left ? `⚠️ Aún faltan ${left}. Prueba más tarde` : '✅ Todas las colecciones cargadas');
        closeModal();
      });
    } else if (a === 'importc') importText((document.getElementById('impcode') as HTMLTextAreaElement).value, d);
    else if (a === 'reset') {
      if (!confirm('¿Borrar la partida y empezar de cero? No se puede deshacer.')) return;
      replaceState(g, blankState(DEFAULT_SETS));
      d.saveNow();
      closeModal();
      d.refresh();
      toast('Partida nueva');
    }
  });
}

function exportFile(g: Game, d: BackupDeps): void {
  d.saveNow();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([exportStr(g.S, g.mode)], { type: 'application/json' }));
  a.download = `pokemon-card-shop-dia${g.S.day}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1500);
  toast('⬇️ Copia descargada');
}

function copyCode(g: Game): void {
  const code = exportCode(g.S, g.mode);
  const box = () => {
    (document.getElementById('impcode') as HTMLTextAreaElement).value = code;
    toast('Selecciona y copia el código del cuadro');
  };
  if (navigator.clipboard?.writeText)
    navigator.clipboard.writeText(code).then(() => toast('📋 Código copiado. Guárdalo en tus notas')).catch(box);
  else box();
}

/** importData de la v10: comprueba, pide confirmación, carga los sets que falten y sustituye */
export async function importText(txt: string, d: BackupDeps): Promise<void> {
  const g = d.game();
  if (!g) return;
  const r = parseImport(txt);
  if (!r.ok) {
    toast(r.msg);
    return;
  }
  if (!confirm(`¿Cargar la partida del día ${r.S.day} con ${fmt(r.S.money)}? Se sustituirá la actual.`)) return;
  toast('Cargando partida…');
  await loadSetsFor(g, r.S.sets);
  replaceState(g, r.S);
  d.saveNow();
  closeModal();
  d.refresh();
  toast('✅ Partida cargada');
}

/** Selector de archivo para importar */
export function bindImportFile(d: BackupDeps): void {
  const inp = document.getElementById('impfile') as HTMLInputElement;
  inp.addEventListener('change', () => {
    const f = inp.files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => importText(String(rd.result), d);
    rd.readAsText(f);
    inp.value = '';
  });
}
