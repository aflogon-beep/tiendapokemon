import * as THREE from 'three';
import type { Game } from '../core/game';
import { clamp } from '../core/rng';
import { DOOR, FRONT_Y, W } from '../systems/layout';
import { WALL_PX } from '../systems/shopNav';
import type { Occluders } from './occluders';
import { box, mat } from './props';
import { PX_TO_M, toWorld } from './shop';

/*
 * Fachada (drawShutter y el cartel OPEN/CLOSED de la v10): la persiana baja al cerrar
 * y sube al abrir. Desde la vista de tienda se recorta con las paredes.
 */

const TOP = 2.3; // altura del cajón de la persiana
const OUT_Z = toWorld(0, FRONT_Y + WALL_PX).z + 0.04; // cara exterior de la fachada

function textPlane(w: number, h: number, draw: (c: CanvasRenderingContext2D, cw: number, ch: number) => void): THREE.Mesh {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * 160);
  cv.height = Math.round(h * 160);
  draw(cv.getContext('2d')!, cv.width, cv.height);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8 }));
}

// Lamas de la persiana dibujadas en una textura
function slatTexture(): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = 16;
  cv.height = 64;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#8f98a3';
  c.fillRect(0, 0, 16, 64);
  c.fillStyle = 'rgba(0,0,0,.18)';
  for (let y = 4; y < 64; y += 8) c.fillRect(0, y, 16, 2);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface Facade {
  update(g: Game, dt: number): void;
}

export function createFacade(scene: THREE.Scene, occ: Occluders): Facade {
  const w = W * PX_TO_M, cx = toWorld(W / 2, 0).x;
  const group = new THREE.Group();
  // Cajón de la persiana
  group.add(box(w + 0.3, 0.22, 0.3, mat('#3b4049'), cx, TOP, OUT_Z + 0.15));
  // La persiana cuelga del cajón: se escala hacia abajo
  const tex = slatTexture();
  tex.repeat.set(w / 0.4, TOP / 0.4);
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(w, TOP).translate(0, -TOP / 2, 0), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide }));
  curtain.position.set(cx, TOP, OUT_Z + 0.05);
  curtain.castShadow = true;
  group.add(curtain);
  const closedTxt = textPlane(4.2, 0.4, (c, cw, ch) => {
    c.font = `700 ${ch * 0.55}px Fredoka, system-ui, sans-serif`;
    c.fillStyle = '#2a2f3a';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('CERRADO · VOLVEMOS PRONTO', cw / 2, ch / 2);
  });
  closedTxt.position.set(cx, TOP / 2, OUT_Z + 0.07);
  group.add(closedTxt);
  scene.add(group);
  occ.addWall(group);

  // Cartel OPEN / CLOSED junto a la puerta
  const mkSign = (open: boolean) =>
    textPlane(0.5, 0.32, (c, cw, ch) => {
      c.fillStyle = '#fff';
      c.beginPath();
      c.roundRect(0, 0, cw, ch, 8);
      c.fill();
      c.font = `700 ${ch * 0.42}px Fredoka, system-ui, sans-serif`;
      c.fillStyle = open ? '#2fa557' : '#c0392b';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(open ? 'OPEN' : 'CLOSED', cw / 2, ch / 2);
    });
  const signOpen = mkSign(true), signClosed = mkSign(false);
  const sp = toWorld(DOOR.x1 + 12, 0);
  for (const s of [signOpen, signClosed]) {
    s.position.set(sp.x, 1.5, OUT_Z + 0.08);
    scene.add(s);
  }

  let shut = 1;
  return {
    update(g, dt) {
      const closed = g.S.phase === 'closed';
      shut += clamp((closed ? 1 : 0) - shut, -dt * 1.4, dt * 1.4);
      curtain.scale.y = Math.max(0.001, shut);
      curtain.visible = shut > 0.01;
      closedTxt.visible = shut > 0.8;
      (closedTxt.material as THREE.MeshStandardMaterial).opacity = (shut - 0.8) * 5;
      // El cartel solo se ve con la fachada entera (vista de calle)
      const show = occ.cut < 0.5;
      signOpen.visible = show && !closed;
      signClosed.visible = show && closed;
    },
  };
}
