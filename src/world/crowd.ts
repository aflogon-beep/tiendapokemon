import * as THREE from 'three';
import type { Game } from '../core/game';
import { setName } from '../data/sets';
import { LAUNCH_Q, launchSpot } from '../systems/customers';
import { DECOR_POS } from '../systems/layout';
import { spawnLoaded } from './assets';
import { MODELS } from './characters';
import { toWorld } from './shop';

/*
 * Gente que no es cliente (v10: launchQ/drawLQ y los jugadores del torneo):
 * la cola que espera en la acera el día de un lanzamiento y los que juegan en la mesa.
 */

interface Extra {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  seed: number;
}

function extra(scene: THREE.Scene, model: string, anim: string): Extra {
  const inst = spawnLoaded('characters', model);
  const mixer = new THREE.AnimationMixer(inst.root);
  const clip = inst.animations.find((a) => a.name === anim);
  if (clip) mixer.clipAction(clip).play();
  inst.root.visible = false;
  scene.add(inst.root);
  return { root: inst.root, mixer, seed: Math.random() * 6 };
}

// Pancarta «¡<set>!» que sujetan algunos de la cola
function banner(text: string): THREE.Object3D {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 120;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#fff';
  c.fillRect(0, 0, 256, 120);
  c.strokeStyle = '#333';
  c.lineWidth = 6;
  c.strokeRect(3, 3, 250, 114);
  c.font = '700 44px Fredoka, system-ui, sans-serif';
  c.fillStyle = '#c0392b';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 128, 62, 236);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.33), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide }));
  board.position.set(0.25, 2.15, 0);
  board.rotation.y = Math.PI;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9), new THREE.MeshStandardMaterial({ color: '#6b4527' }));
  stick.position.set(0.25, 1.75, 0);
  g.add(board, stick);
  return g;
}

export interface Crowd {
  update(g: Game, dt: number, t: number): void;
}

export function createCrowd(scene: THREE.Scene): Crowd {
  const queue = Array.from({ length: LAUNCH_Q }, (_, i) => extra(scene, MODELS[(i * 5 + 3) % MODELS.length], 'idle'));
  const players = DECOR_POS.tableSeats.map((_, i) => extra(scene, MODELS[(i * 7 + 2) % MODELS.length], 'sit'));
  const table = DECOR_POS.table, tc = toWorld(table.x + table.w / 2, table.y + table.h / 2);
  let signs: THREE.Object3D[] = [], signFor = '';

  players.forEach((p, i) => {
    const s = DECOR_POS.tableSeats[i], w = toWorld(s.x, s.y);
    p.root.position.copy(w);
    p.root.rotation.y = Math.atan2(tc.x - w.x, tc.z - w.z);
  });

  return {
    update(g, dt, t) {
      const S = g.S;
      // Cola del lanzamiento: solo con la tienda cerrada en un día de lanzamiento
      const lq = S.phase === 'closed' && S.ev?.t === 'launch' ? S.ev.s ?? '' : '';
      if (lq !== signFor) {
        signFor = lq;
        signs.forEach((s) => s.parent?.remove(s));
        signs = [];
        if (lq) {
          const n = setName(lq);
          queue.forEach((q, i) => {
            if (i % 3) return;
            const b = banner('¡' + (n.length > 9 ? n.slice(0, 8) + '…' : n) + '!');
            // Las pancartas van en metros reales dentro del personaje escalado
            b.scale.setScalar(1 / q.root.scale.x);
            q.root.add(b);
            signs.push(b);
          });
        }
      }
      queue.forEach((q, i) => {
        q.root.visible = !!lq;
        if (!lq) return;
        const p = launchSpot(i), w = toWorld(p.x, p.y);
        // Dan saltitos de impaciencia, como en la v10
        q.root.position.set(w.x, Math.max(0, Math.sin(t * 3 + q.seed)) * 0.06, w.z);
        q.root.rotation.y = Math.PI;
        q.mixer.update(dt);
      });

      // Jugadores del torneo sentados a la mesa
      const tour = !!S.tour && !!S.decor.table && S.phase !== 'closed';
      for (const p of players) {
        p.root.visible = tour;
        if (tour) p.mixer.update(dt);
      }
    },
  };
}
