import * as THREE from 'three';
import type { Game } from '../core/game';
import { clamp } from '../core/rng';
import { DAYLEN } from '../systems/economy';
import type { Lights } from './lighting';
import { toWorld } from './shop';

/*
 * Día y noche (dayT, nightK y lighting de la v10): por la mañana luz blanca, a media tarde
 * luz dorada y al final del día anochece. Al cerrar, amanece poco a poco.
 */

const DAY = { hemi: new THREE.Color('#dfefff'), ground: new THREE.Color('#6b5a48'), sun: new THREE.Color('#fff3dd'), bg: new THREE.Color('#5d636c') };
const NIGHT = { hemi: new THREE.Color('#4a5a9a'), ground: new THREE.Color('#1c1a2a'), sun: new THREE.Color('#8fa6ff'), bg: new THREE.Color('#151a2e') };
const GOLD = new THREE.Color('#ffb070');
const DAWN_RATE = 1 / 2.8; // la v10 tarda 2,8 s en amanecer

// Lámparas del techo de la tienda (sin sombras)
const CEILING = [{ x: 200, y: 200 }, { x: 560, y: 200 }, { x: 220, y: 430 }, { x: 600, y: 430 }];

export interface DayNight {
  /** 0 = día, 1 = noche cerrada */
  night: number;
  update(g: Game, dt: number): void;
}

/** Momento del día (0–1); con la tienda cerrada es por la mañana */
export const dayT = (g: Game): number => (g.S.phase === 'closed' ? 0 : g.S.phase === 'closing' ? 1 : clamp(g.S.clock / DAYLEN, 0, 1));
const nightTarget = (g: Game): number => (g.S.phase === 'closing' ? 1 : clamp((dayT(g) - 0.72) / 0.28, 0, 1));

export function createDayNight(scene: THREE.Scene, { sun, hemi }: Lights): DayNight {
  const bg = scene.background as THREE.Color;
  const lamps = CEILING.map((p) => {
    const l = new THREE.PointLight('#ffe2b0', 0, 9, 1.6);
    const w = toWorld(p.x, p.y);
    l.position.set(w.x, 2.6, w.z);
    scene.add(l);
    return l;
  });
  let cloud = 0;
  const dn: DayNight = {
    night: 0,
    update(g, dt) {
      const want = nightTarget(g);
      // Anochece al ritmo del reloj del juego; amanece despacio después del cierre
      dn.night = want > dn.night ? want : Math.max(want, dn.night - dt * DAWN_RATE);
      const n = dn.night, t = dayT(g);
      // Día de lluvia: cielo cubierto
      cloud += ((g.S.ev?.t === 'rain' ? 1 : 0) - cloud) * Math.min(1, dt * 2);
      const gold = t > 0.45 && t < 0.9 ? Math.sin(((t - 0.45) / 0.45) * Math.PI) : 0;
      hemi.color.copy(DAY.hemi).lerp(NIGHT.hemi, n);
      hemi.groundColor.copy(DAY.ground).lerp(NIGHT.ground, n);
      hemi.intensity = THREE.MathUtils.lerp(1.4, 0.55, n);
      sun.color.copy(DAY.sun).lerp(GOLD, gold * 0.45).lerp(NIGHT.sun, n);
      sun.intensity = THREE.MathUtils.lerp(2.2, 0.25, n) * (1 - cloud * 0.6);
      hemi.intensity *= 1 - cloud * 0.2;
      bg.copy(DAY.bg).lerp(NIGHT.bg, n).multiplyScalar(1 - cloud * 0.15);
      for (const l of lamps) l.intensity = 2 + n * 9;
    },
  };
  return dn;
}
