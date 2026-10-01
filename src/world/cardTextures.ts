import * as THREE from 'three';
import type { Card } from '../data/cards';
import { RAR } from '../data/rarity';

/*
 * Texturas de cartas para el mundo 3D (vitrina, peanas): se cargan bajo demanda desde
 * images.pokemontcg.io y se guardan en una caché limitada (las más antiguas se liberan).
 * Sin imagen (modo sin conexión o error) se dibuja una carta con el color de su rareza.
 */

const MAX = 40;
const cache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();
loader.setCrossOrigin('anonymous');

// Carta ilustrada: fondo del color de la rareza y el nombre
function drawn(c: Card): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = 126;
  cv.height = 176;
  const g = cv.getContext('2d')!;
  const col = RAR[c.r].c;
  const grd = g.createLinearGradient(0, 0, 126, 176);
  grd.addColorStop(0, col);
  grd.addColorStop(1, '#111');
  g.fillStyle = grd;
  g.fillRect(0, 0, 126, 176);
  g.strokeStyle = col;
  g.lineWidth = 6;
  g.strokeRect(3, 3, 120, 170);
  g.fillStyle = '#fff';
  g.font = 'bold 14px system-ui, sans-serif';
  g.fillText(c.name.slice(0, 14), 10, 26);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function remember(key: string, t: THREE.Texture): THREE.Texture {
  cache.set(key, t);
  // La más antigua sale de la caché y libera memoria de la GPU
  while (cache.size > MAX) {
    const [k, old] = cache.entries().next().value as [string, THREE.Texture];
    cache.delete(k);
    old.dispose();
  }
  return t;
}

export function cardTexture(c: Card): THREE.Texture {
  const hit = cache.get(c.id);
  if (hit) {
    // Uso reciente: al final de la cola
    cache.delete(c.id);
    cache.set(c.id, hit);
    return hit;
  }
  const t = drawn(c);
  if (c.img)
    loader.load(
      c.img,
      (img) => {
        img.colorSpace = THREE.SRGBColorSpace;
        t.image = img.image;
        t.needsUpdate = true;
      },
      undefined,
      () => {
        /* sin CORS o sin red: se queda la ilustrada */
      },
    );
  return remember(c.id, t);
}
