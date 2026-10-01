import { claimables } from '../systems/missions';
import { A, onNavChange, ui } from './ctx';

/* Barra inferior de la v10 (paintNav): paneles, pausa y velocidad */

const ICON: Record<string, string> = {
  packs: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  coll: '<rect x="3" y="5" width="11" height="15" rx="2"/><path d="M10 4.5l7.5-1.3a2 2 0 012.3 1.6l2 11.6a2 2 0 01-1.6 2.3L14 19.8"/>',
  album: '<path d="M5 3h12a2 2 0 012 2v16H7a2 2 0 01-2-2z"/><path d="M5 17a2 2 0 012-2h12M9 7h6"/>',
  tasks: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 12l2 2 4-4M9 17h6"/>',
  more: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  speed: '<path d="M3 5l9 7-9 7zM12 5l9 7-9 7z"/>',
};
const svgI = (k: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;

export function paintNav(): void {
  const n = document.getElementById('nav')!, g = ui.g;
  if (!g) return;
  n.hidden = false;
  const b = [['packs', 'Stock'], ['coll', 'Cartas'], ['album', 'Álbum'], ['tasks', 'Tareas'], ['more', 'Más']]
    .map(([k, l]) => `<button data-a="m" data-k="${k}"${k === 'tasks' ? ' id="navtask"' : ''}>${svgI(k)}<span>${l}</span></button>`)
    .join('');
  n.innerHTML =
    b +
    `<button data-a="pause" id="pz" aria-label="Pausa">${svgI(g.paused ? 'play' : 'pause')}<span>${g.paused ? 'Seguir' : 'Pausa'}</span></button>` +
    `<button data-a="speed" id="spd" aria-label="Velocidad">${svgI('speed')}<span>${g.speed}×</span></button>`;
  navAct();
}

/** Marca el botón del panel abierto y el aviso de Tareas */
export function navAct(): void {
  document.querySelectorAll<HTMLElement>('#nav [data-a=m]').forEach((b) => b.classList.toggle('act', b.dataset.k === ui.M));
  const nb = document.getElementById('navtask');
  if (nb && ui.g) nb.classList.toggle('bdg', claimables(ui.g) > 0);
}

export function setPause(v: boolean): void {
  if (!ui.g) return;
  ui.g.paused = v;
  paintNav();
  ui.hud();
}

A.pause = () => setPause(!ui.g?.paused);
A.speed = () => {
  const g = ui.g;
  if (!g) return;
  g.speed = g.speed === 1 ? 2 : g.speed === 2 ? 4 : 1;
  paintNav();
};
onNavChange(navAct);

// Espacio o «p» pausan (como en la v10)
document.addEventListener('keydown', (e) => {
  if ((e.code === 'Space' || e.key === 'p') && !ui.M && ui.g && !/INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)) {
    e.preventDefault();
    setPause(!ui.g.paused);
  }
});
