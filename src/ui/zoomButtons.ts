import type { CamController } from '../world/controls';
import { toast } from './toast';

const MODE_TOAST = { fit: '🗺️ Toda la tienda', city: '🏙️ Vista de la calle', auto: '🎥 Cámara automática' } as const;

/** Cambia de vista (automática → tienda → calle) con su aviso, como A.zfit de la v10 */
export function cycleCamera(ctl: CamController): void {
  const m = ctl.cycle();
  if (m !== 'manual') toast(MODE_TOAST[m]);
}

// Botones de cámara de la v10: acercar, alejar y cambiar de vista
export function mountZoomButtons(ctl: CamController): void {
  const box = document.createElement('div');
  box.className = 'zb';
  box.innerHTML =
    '<button data-a="zin" aria-label="Acercar">＋</button>' +
    '<button data-a="zout" aria-label="Alejar">－</button>' +
    '<button data-a="zfit" aria-label="Ver toda la tienda">⤢</button>';
  box.addEventListener('click', (e) => {
    e.stopPropagation();
    const a = (e.target as HTMLElement).closest('button')?.dataset.a;
    if (a === 'zin') ctl.zoom(1.25);
    else if (a === 'zout') ctl.zoom(1 / 1.25);
    else if (a === 'zfit') cycleCamera(ctl);
  });
  document.body.appendChild(box);
}
