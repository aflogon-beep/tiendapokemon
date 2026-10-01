import * as THREE from 'three';
import type { Game } from '../core/game';
import { preload, spawnLoaded, type ModelInstance } from './assets';
import { toWorld } from './shop';
import { CT, type Customer } from '../systems/customers';

/*
 * Clientes en 3D: cada cliente del estado tiene un personaje de Mini Characters.
 * El mundo solo lee el estado (posición, situación) y elige animación y orientación.
 */

const MODELS = ['a', 'b', 'c', 'd', 'e', 'f'].flatMap((l) => [`character-female-${l}`, `character-male-${l}`]);
const WALK_ANIM_SPEED = 1.2; // m/s a los que la animación walk no patina
const TURN = 10;

interface View {
  inst: ModelInstance;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  current?: THREE.AnimationAction;
  last: THREE.Vector3;
}

export interface Characters {
  update(g: Game, dt: number): void;
  /** Posición en pantalla de la cabeza de cada cliente (para bocadillos) */
  heads(camera: THREE.Camera, w: number, h: number): Map<number, { x: number; y: number }>;
}

export async function createCharacters(scene: THREE.Scene): Promise<Characters> {
  await preload('characters', MODELS);
  const views = new Map<number, View>();

  const create = (c: Customer): View => {
    const inst = spawnLoaded('characters', MODELS[c.look % MODELS.length]);
    inst.root.scale.multiplyScalar(CT[c.type].sc);
    inst.root.position.copy(toWorld(c.x, c.y));
    scene.add(inst.root);
    const mixer = new THREE.AnimationMixer(inst.root);
    return { inst, mixer, actions: new Map(inst.animations.map((a) => [a.name, mixer.clipAction(a)])), last: inst.root.position.clone() };
  };

  const play = (v: View, name: string, timeScale = 1) => {
    const next = v.actions.get(name);
    if (!next) return;
    next.timeScale = timeScale;
    if (next === v.current) return;
    next.reset().fadeIn(0.2).play();
    v.current?.fadeOut(0.2);
    v.current = next;
  };

  const turnTo = (v: View, want: number, dt: number) => {
    const r = v.inst.root.rotation;
    r.y += Math.atan2(Math.sin(want - r.y), Math.cos(want - r.y)) * Math.min(1, dt * TURN);
  };

  const pos = new THREE.Vector3();
  return {
    update(g, dt) {
      const alive = new Set<number>();
      for (const c of g.custs) {
        alive.add(c.id);
        const v = views.get(c.id) ?? (views.set(c.id, create(c)), views.get(c.id)!);
        const root = v.inst.root;
        pos.copy(toWorld(c.x, c.y));
        const moved = pos.distanceTo(v.last);
        root.position.copy(pos);
        if (c.mv && moved > 1e-4) {
          turnTo(v, Math.atan2(pos.x - v.last.x, pos.z - v.last.z), dt);
          play(v, 'walk', dt > 0 ? Math.max(0.6, moved / dt / WALK_ANIM_SPEED) : 1);
        } else if (c.st === 'browse') {
          turnTo(v, Math.PI, dt); // mirando la estantería o la vitrina (al norte)
          play(v, 'interact-right');
        } else {
          if (c.st === 'wait') turnTo(v, Math.PI / 2, dt); // hacia el mostrador
          play(v, 'idle');
        }
        v.last.copy(pos);
        v.mixer.update(dt);
      }
      for (const [id, v] of views)
        if (!alive.has(id)) {
          scene.remove(v.inst.root);
          v.mixer.stopAllAction();
          views.delete(id);
        }
    },
    heads(camera, w, h) {
      const out = new Map<number, { x: number; y: number }>();
      const p = new THREE.Vector3();
      for (const [id, v] of views) {
        p.copy(v.inst.root.position).setY(2.1 * v.inst.root.scale.y / 2.4);
        p.project(camera);
        out.set(id, { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h });
      }
      return out;
    },
  };
}
