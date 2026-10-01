/* Paneles inferiores (openM / closeM de la v10) */

let onClose: (() => void) | null = null;
const host = (): HTMLElement => {
  let h = document.getElementById('ovh');
  if (!h) {
    h = document.createElement('div');
    h.id = 'ovh';
    document.body.appendChild(h);
  }
  return h;
};

export const isModalOpen = (): boolean => !!host().firstChild;

/** Abre un panel con el HTML dado; `lock` impide cerrarlo tocando fuera */
export function openModal(html: string, opts: { lock?: boolean; closeText?: string; onClose?: () => void } = {}): HTMLElement {
  onClose = opts.onClose ?? null;
  host().innerHTML =
    `<div class="ov in"${opts.lock ? '' : ' data-close="1"'}><div class="sheet in">${html}` +
    `<button class="b big" data-close="1">${opts.closeText ?? 'Cerrar'}</button></div></div>`;
  const ov = host().firstElementChild as HTMLElement;
  ov.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.close && (t === ov || t.tagName === 'BUTTON')) closeModal();
  });
  return ov.querySelector('.sheet') as HTMLElement;
}

export function closeModal(): void {
  host().innerHTML = '';
  const f = onClose;
  onClose = null;
  f?.();
}
