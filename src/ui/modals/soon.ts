import { A, closeM, defModal, renderM } from '../ctx';
import { audio, setMusic, setSound } from '../sound';

/*
 * Paneles que llegan en las siguientes entregas de la F4 (Álbum, Tareas y el resto de «Más»).
 * «Más» ya trae el menú de la v10 con lo que está disponible.
 */

const soon = (t: string) => `<h2>${t}</h2><p class="mu">Este panel llega en la siguiente entrega de la fase 4.</p>`;

defModal('album', { body: () => soon('Álbum') });
defModal('tasks', { body: () => soon('Tareas') });

defModal('more', {
  body: () =>
    `<h2>Más</h2><div class="menu">` +
    `<button class="b" data-a="m" data-k="backup">💾 Partida y copia</button>` +
    `<button class="b" data-a="sndtog">${audio.on ? '🔊 Sonido: sí' : '🔇 Sonido: no'}</button>` +
    `<button class="b" data-a="mustog">🎵 Música: ${audio.music ? 'sí' : 'no'}</button>` +
    `<button class="b" data-a="zreset">⤢ Ver toda la tienda</button>` +
    `<button class="b" disabled>🗂️ Colecciones</button><button class="b" disabled>📈 Mercado</button>` +
    `<button class="b" disabled>🛠️ Mejoras y personal</button><button class="b" disabled>🔍 Gradeo</button></div>` +
    `<p class="mu">Colecciones, mercado, mejoras y gradeo llegan en la siguiente entrega.</p>`,
});

A.sndtog = () => {
  setSound(!audio.on);
  renderM();
};
A.mustog = () => {
  if (!audio.on) setSound(true);
  setMusic(!audio.music);
  renderM();
};
// Se completa desde main con la cámara
export const moreHooks = { zfit: () => {} };
A.zreset = () => {
  closeM();
  moreHooks.zfit();
};
