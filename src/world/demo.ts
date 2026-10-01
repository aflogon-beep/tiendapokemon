import * as THREE from 'three';
import { spawnModel, type ModelInstance } from './assets';
import { toPx, worldOf } from './shop';
import { SHELF_SLOTS, caseSpot, queueSpot, shelfSpot, type Point } from '../systems/layout';
import { findPath, type NavGrid } from '../systems/nav';
import { SIDEWALK } from '../systems/shopNav';

/*
 * Cliente de demostración de la F2 (se sustituye por los clientes de verdad en la F3):
 * entra desde la acera, visita estanterías, vitrina y caja por caminos que esquivan los muebles.
 */

const SPEED = 1.2; // m/s, acorde al paso de la animación walk
const TURN = 10; // rapidez de giro

interface Stop {
  at: Point;
  clip: string;
  wait: number;
  /** Hacia dónde mira al llegar (radianes; 0 = hacia la calle) */
  face?: number;
}

export interface Demo {
  update(dt: number): void;
}

function tour(): Stop[] {
  const out = { x: -250, y: (SIDEWALK.y0 + SIDEWALK.y1) / 2 };
  const shelves = [0, 4, 2].filter((i) => i < SHELF_SLOTS);
  return [
    ...shelves.map((i) => ({ at: shelfSpot(i), clip: 'interact-right', wait: 2, face: Math.PI })),
    { at: caseSpot(), clip: 'interact-left', wait: 2, face: Math.PI },
    { at: queueSpot(0), clip: 'idle', wait: 2.5, face: Math.PI / 2 },
    { at: out, clip: 'idle', wait: 1 },
  ];
}

export async function createDemo(scene: THREE.Scene, nav: NavGrid, door: ModelInstance): Promise<Demo> {
  const who: ModelInstance = await spawnModel('characters', 'character-female-c');
  const stops = tour();
  const start = stops[stops.length - 1].at;
  who.root.position.copy(worldOf(start));
  scene.add(who.root);

  const mixer = new THREE.AnimationMixer(who.root);
  const actions = new Map(who.animations.map((c) => [c.name, mixer.clipAction(c)]));
  let current: THREE.AnimationAction | undefined;
  const play = (name: string) => {
    const next = actions.get(name);
    if (!next || next === current) return;
    next.reset().fadeIn(0.2).play();
    current?.fadeOut(0.2);
    current = next;
  };

  // Puerta: se abre al acercarse alguien y se cierra al alejarse
  const doorMixer = new THREE.AnimationMixer(door.root);
  const clipOf = (n: string) => door.animations.find((c) => c.name === n);
  const openA = clipOf('open') && doorMixer.clipAction(clipOf('open')!);
  const closeA = clipOf('close') && doorMixer.clipAction(clipOf('close')!);
  for (const a of [openA, closeA]) if (a) { a.loop = THREE.LoopOnce; a.clampWhenFinished = true; }
  let doorOpen = false;
  const setDoor = (open: boolean) => {
    if (open === doorOpen || !openA || !closeA) return;
    doorOpen = open;
    const [on, off] = open ? [openA, closeA] : [closeA, openA];
    off.stop();
    on.reset().play();
  };

  let stop = 0, wait = 0;
  let path: THREE.Vector3[] = [];
  const plan = () => {
    const pts = findPath(nav, toPx(who.root.position), stops[stop].at) ?? [stops[stop].at];
    path = pts.slice(1).map(worldOf);
  };
  plan();

  const dir = new THREE.Vector3();
  const turnTo = (want: number, dt: number) => {
    const d = Math.atan2(Math.sin(want - who.root.rotation.y), Math.cos(want - who.root.rotation.y));
    who.root.rotation.y += d * Math.min(1, dt * TURN);
  };
  return {
    update(dt) {
      mixer.update(dt);
      doorMixer.update(dt);
      const pos = who.root.position;
      setDoor(pos.distanceTo(door.root.position) < 2.2);
      if (wait > 0) {
        const face = stops[stop].face;
        if (face !== undefined) turnTo(face, dt);
        wait -= dt;
        if (wait <= 0) {
          stop = (stop + 1) % stops.length;
          plan();
        }
        return;
      }
      const next = path[0];
      if (!next) {
        play(stops[stop].clip);
        wait = stops[stop].wait;
        return;
      }
      play('walk');
      dir.subVectors(next, pos);
      const dist = dir.length();
      const step = SPEED * dt;
      if (dist <= step) {
        pos.copy(next);
        path.shift();
      } else pos.addScaledVector(dir.multiplyScalar(1 / dist), step);
      turnTo(Math.atan2(dir.x, dir.z), dt);
    },
  };
}
