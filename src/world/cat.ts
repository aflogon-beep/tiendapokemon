import * as THREE from 'three';
import type { Game } from '../core/game';
import type { Point } from '../systems/layout';
import { DECOR_POS } from '../systems/layout';
import { findPath } from '../systems/nav';
import { mat } from './props';
import { toWorld } from './shop';

/*
 * Gato de la tienda (CAT de la v10): duerme, se sienta y pasea entre unos cuantos sitios.
 * Al tocarlo maúlla y suelta corazones. Usa la misma rejilla que los clientes para no
 * atravesar los muebles. Es solo decoración: no se guarda.
 */

const SPEED = 34; // px/s, como en la v10
const SOFA_H = 0.42;

// Sitios de la v10 ajustados a nuestra distribución (alfombra, rincones, junto a la mesa…)
function spots(g: Game): Point[] {
  const l: Point[] = [{ x: 262, y: 500 }, { x: 80, y: 470 }, { x: 240, y: 410 }, { x: 470, y: 490 }, { x: 700, y: 470 }, { x: 160, y: 250 }];
  if (g.S.decor.sofa) l.push(SOFA, SOFA);
  return l;
}
const S0 = DECOR_POS.sofa;
const SOFA: Point = { x: S0.x + S0.w / 2, y: S0.y + S0.h / 2 };
const SOFA_FRONT: Point = { x: SOFA.x, y: S0.y + S0.h + 14 };

function buildCat(): { root: THREE.Group; head: THREE.Object3D; tail: THREE.Object3D; legs: THREE.Object3D[]; body: THREE.Object3D } {
  const orange = mat('#e8913a', { flatShading: true }), dark = mat('#c96f22'), black = mat('#1a1a1a'), pink = mat('#ff9eb0');
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.2), orange);
  body.position.y = 0.22;
  body.castShadow = true;
  // Rayas
  for (const x of [-0.1, 0, 0.1]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.2), dark);
    s.position.set(x, 0.105, 0);
    body.add(s);
  }
  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.18), orange);
  skull.castShadow = true;
  head.add(skull);
  for (const z of [-0.05, 0.05]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 4), orange);
    ear.position.set(-0.02, 0.11, z);
    head.add(ear);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.025, 0.025), black);
    eye.position.set(0.091, 0.02, z * 0.8);
    head.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.015, 0.02), pink);
  nose.position.set(0.091, -0.02, 0);
  head.add(nose);
  head.position.set(0.26, 0.34, 0);
  const tail = new THREE.Group();
  const tm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.26, 5), orange);
  tm.position.y = 0.13;
  tail.add(tm);
  tail.position.set(-0.2, 0.26, 0);
  tail.rotation.z = 0.6;
  const legs = [-0.14, 0.14].flatMap((x) =>
    [-0.06, 0.06].map((z) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.05), dark);
      leg.geometry.translate(0, -0.065, 0);
      leg.position.set(x, 0.13, z);
      return leg;
    }),
  );
  root.add(body, head, tail, ...legs);
  return { root, head, tail, legs, body };
}

// «z» que sube mientras duerme
function zzz(): THREE.Sprite {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const c = cv.getContext('2d')!;
  c.font = '700 26px Fredoka, system-ui, sans-serif';
  c.fillStyle = '#fff';
  c.textAlign = 'center';
  c.fillText('z', 16, 26);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  s.scale.setScalar(0.22);
  return s;
}

export interface Cat {
  update(g: Game, dt: number, t: number): void;
  /** Posición en px de la v10 (para tocarlo) */
  readonly pos: Point;
  /** Maullido: se sienta un rato */
  meow(): void;
}

export function createCat(scene: THREE.Scene): Cat {
  const m = buildCat(), z = zzz();
  scene.add(m.root, z);
  const pos: Point = { x: 120, y: 470 };
  let st: 'sleep' | 'sit' | 'walk' = 'sleep', timer = 6, path: Point[] = [], goal: Point | null = null, ph = 0, zt = 0, onSofa = false, dir = 0;

  const pickGoal = (g: Game) => {
    const target = spots(g)[Math.floor(Math.random() * spots(g).length)];
    goal = target;
    const walkTo = target === SOFA ? SOFA_FRONT : target;
    const from = onSofa ? SOFA_FRONT : pos;
    if (onSofa) Object.assign(pos, SOFA_FRONT);
    onSofa = false;
    path = findPath(g.nav, from, walkTo) ?? [walkTo];
    st = 'walk';
  };

  return {
    pos,
    meow() {
      if (st !== 'walk') {
        st = 'sit';
        timer = 3;
      }
    },
    update(g, dt, t) {
      timer -= dt;
      zt += dt;
      if (st === 'walk') {
        const next = path[0];
        if (!next) {
          // Llegó: al sofá sube de un salto
          if (goal === SOFA) {
            Object.assign(pos, SOFA);
            onSofa = true;
          }
          st = Math.random() < 0.6 ? 'sleep' : 'sit';
          timer = st === 'sleep' ? 10 + Math.random() * 10 : 3 + Math.random() * 4;
        } else {
          const dx = next.x - pos.x, dy = next.y - pos.y, d = Math.hypot(dx, dy);
          if (d < 2) path.shift();
          else {
            const s = Math.min(d, SPEED * dt);
            pos.x += (dx / d) * s;
            pos.y += (dy / d) * s;
            dir = Math.atan2(-dy, dx); // el modelo mira hacia +x
            ph += dt * 12;
          }
        }
      } else if (timer <= 0) pickGoal(g);

      const w = toWorld(pos.x, pos.y);
      m.root.position.set(w.x, onSofa ? SOFA_H : 0, w.z);
      m.root.rotation.y = dir;
      const walking = st === 'walk', sleeping = st === 'sleep';
      m.legs.forEach((l, i) => (l.rotation.z = walking ? Math.sin(ph + (i % 2 ? Math.PI : 0)) * 0.5 : 0));
      // Dormido: tumbado, con la cabeza baja; sentado: cabeza alta
      m.body.position.y = sleeping ? 0.12 : 0.22;
      m.legs.forEach((l) => (l.visible = !sleeping));
      m.head.position.set(sleeping ? 0.22 : 0.26, sleeping ? 0.17 : st === 'sit' ? 0.4 : 0.34, 0);
      m.tail.rotation.z = sleeping ? 1.4 : 0.6 + Math.sin(t * 3) * 0.3;
      z.visible = sleeping;
      if (sleeping) {
        const k = (zt % 2) / 2;
        z.position.set(w.x + 0.2, (onSofa ? SOFA_H : 0) + 0.4 + k * 0.35, w.z);
        (z.material as THREE.SpriteMaterial).opacity = 1 - k;
      }
    },
  };
}
