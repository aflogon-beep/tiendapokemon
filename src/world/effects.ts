import * as THREE from 'three';
import { clamp } from '../core/rng';
import { LAY } from '../systems/layout';
import { PX_TO_M, toWorld } from './shop';

/*
 * Partículas de la v10 (coinBurst, heartsAt, starsAt) y temblor de cámara (shake).
 * Son sprites: siempre miran a la cámara y no proyectan sombra.
 */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MAX = 96;

function spriteTex(draw: (c: CanvasRenderingContext2D) => void): THREE.SpriteMaterial {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false });
}

const MATS = {
  coin: spriteTex((c) => {
    c.fillStyle = '#f2c14e';
    c.strokeStyle = '#b8860b';
    c.lineWidth = 6;
    c.beginPath();
    c.arc(32, 32, 26, 0, 7);
    c.fill();
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,.5)';
    c.fillRect(24, 16, 6, 30);
  }),
  heart: spriteTex((c) => {
    const x = 32, y = 30, s = 20;
    c.fillStyle = '#ff4f7b';
    c.beginPath();
    c.moveTo(x, y + s * 0.9);
    c.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.4, x, y - s * 0.5);
    c.bezierCurveTo(x + s * 0.6, y - s * 1.4, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
    c.fill();
  }),
  star: spriteTex((c) => {
    c.fillStyle = '#ffd54a';
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? 12 : 28;
      c.lineTo(32 + Math.cos(a) * q, 32 + Math.sin(a) * q);
    }
    c.closePath();
    c.fill();
  }),
};
type Kind = keyof typeof MATS;

interface P {
  s: THREE.Sprite;
  k: Kind;
  t: number;
  d: number;
  p0: THREE.Vector3;
  p1: THREE.Vector3; // destino (monedas)
  v: THREE.Vector3; // velocidad (corazones y estrellas)
  mat: THREE.SpriteMaterial;
}

export interface Effects {
  coins(from: THREE.Vector3, amount: number): void;
  hearts(at: THREE.Vector3, n: number): void;
  stars(at: THREE.Vector3, n: number): void;
  shake(v: number): void;
  update(dt: number): void;
  /** Desplazamiento de la cámara por el temblor (en metros) */
  readonly offset: THREE.Vector3;
}

export function createEffects(scene: THREE.Scene): Effects {
  const live: P[] = [];
  const free: P[] = [];
  let sk = 0;
  const offset = new THREE.Vector3();
  const till = toWorld(LAY.counter.x + 28, LAY.counter.y + 66).setY(1.1);

  const get = (k: Kind, t: number, d: number): P | null => {
    if (live.length >= MAX) return null;
    let p = free.pop();
    if (!p) {
      const mat = MATS[k].clone();
      p = { s: new THREE.Sprite(mat), k, t, d, p0: new THREE.Vector3(), p1: new THREE.Vector3(), v: new THREE.Vector3(), mat };
      scene.add(p.s);
    }
    // Cada partícula reutilizada toma la textura de su tipo
    p.mat.map = MATS[k].map;
    p.k = k;
    p.t = t;
    p.d = d;
    p.s.visible = false;
    live.push(p);
    return p;
  };

  return {
    offset,
    coins(from, amount) {
      const n = clamp(Math.round(Math.log2(amount + 1) * 2), 3, 12);
      for (let i = 0; i < n; i++) {
        const p = get('coin', -i * 0.05, 0.55 + Math.random() * 0.15);
        if (!p) return;
        p.p0.copy(from).add(new THREE.Vector3((Math.random() - 0.5) * 0.25, 0, (Math.random() - 0.5) * 0.25));
        p.p1.copy(till).add(new THREE.Vector3((Math.random() - 0.5) * 0.25, 0, 0));
      }
    },
    hearts(at, n) {
      for (let i = 0; i < n; i++) {
        const p = get('heart', -i * 0.14, 1.3);
        if (!p) return;
        p.p0.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, 0));
        p.v.set((Math.random() - 0.5) * 0.35, 0.65 + Math.random() * 0.35, 0);
      }
    },
    stars(at, n) {
      for (let i = 0; i < n; i++) {
        const p = get('star', -i * 0.02, 1.1);
        if (!p) return;
        const a = Math.random() * Math.PI * 2, sp = (40 + Math.random() * 50) * PX_TO_M;
        p.p0.copy(at);
        p.v.set(Math.cos(a) * sp, 1 + Math.abs(Math.sin(a)) * sp, Math.sin(a) * sp * 0.5);
      }
    },
    shake(v) {
      if (!REDUCED) sk = Math.max(sk, v);
    },
    update(dt) {
      // Temblor: la v10 lo reduce un 12 % por fotograma
      offset.set((Math.random() - 0.5) * sk, 0, (Math.random() - 0.5) * sk).multiplyScalar(PX_TO_M);
      sk = sk > 0.2 ? sk * Math.pow(0.88, dt * 60) : 0;
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i];
        p.t += dt;
        if (p.t >= p.d) {
          p.s.visible = false;
          live.splice(i, 1);
          free.push(p);
          continue;
        }
        if (p.t < 0) continue;
        const k = p.t / p.d, s = p.s;
        // Primer fotograma visible: sale de su punto de origen
        if (!s.visible) s.position.copy(p.p0);
        s.visible = true;
        if (p.k === 'coin') {
          // Arco desde el cliente hasta la caja, girando
          s.position.lerpVectors(p.p0, p.p1, k);
          s.position.y += Math.sin(k * Math.PI) * 1.2;
          s.scale.set(0.24 * Math.max(0.15, Math.abs(Math.cos(p.t * 14))), 0.24, 1);
          p.mat.opacity = 1;
        } else {
          if (p.k === 'star') p.v.y -= 1.7 * dt;
          s.position.addScaledVector(p.v, dt);
          s.scale.setScalar(p.k === 'heart' ? 0.26 : 0.22);
          p.mat.opacity = 1 - k;
        }
      }
    },
  };
}
