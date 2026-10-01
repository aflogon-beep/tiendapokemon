// Pantalla de carga (#load de la v10)
const el = () => document.getElementById('load');

export function loadingText(t: string): void {
  const p = document.getElementById('loadtxt');
  if (p) p.textContent = t;
}

export function hideLoading(): void {
  el()?.remove();
}

/**
 * La API no responde pero hay una partida real guardada: nunca se pasa solo al modo sin
 * conexión. Se avisa y se ofrece reintentar; jugar sin conexión es una partida aparte.
 */
export function askOfflineWithRealSave(): Promise<'retry' | 'offline'> {
  const box = el();
  if (!box) return Promise.resolve('retry');
  box.innerHTML =
    '<div><h2>No se pudieron cargar las cartas</h2><p class="mu">La API de cartas no responde ahora mismo. ' +
    'Tu partida está guardada y no se pierde.</p><div class="btns" style="justify-content:center">' +
    '<button class="b pri" id="lretry">Reintentar</button><button class="b" id="loff">Jugar sin conexión (partida aparte)</button></div></div>';
  return new Promise((res) => {
    document.getElementById('lretry')!.onclick = () => res('retry');
    document.getElementById('loff')!.onclick = () => res('offline');
  });
}
