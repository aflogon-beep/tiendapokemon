import * as THREE from 'three';
import type { Game } from '../core/game';
import { FLOOR_T, FRONT_Y, W } from '../systems/layout';
import { season } from '../systems/seasons';
import { toWorld } from './shop';

/*
 * Lluvia y partículas de temporada (streetFx de la v10): nieve en invierno y Navidad,
 * hojas en otoño y pétalos en primavera. Caen alrededor de la cámara y no dentro de la tienda.
 */

const N_FLAKES = 260;
const N_DROPS = 420;
const TOP = 12;

const shopMin = toWorld(-10, FLOOR_T - 10), shopMax = toWorld(W + 10, FRONT_Y + 10);
// Se mira dónde cae la partícula en el suelo según la cámara: si se ve sobre la tienda, no se dibuja
const view = new THREE.Vector3(0, -1, 0);
const inShopAt = (x: number, z: number) => x > shopMin.x && x < shopMax.x && z > shopMin.z && z < shopMax.z;
const inShop = (x: number, y: number, z: number) => inShopAt(x, z) || inShopAt(x - (view.x / view.y) * y, z - (view.z / view.y) * y);

function discTexture(): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#fff';
  c.beginPath();
  c.ellipse(16, 16, 14, 9, 0.5, 0, 7);
  c.fill();
  return new THREE.CanvasTexture(cv);
}

const KIND: Record<string, { cols: string[]; fall: number; size: number } | undefined> = {
  // size: metros (se pasa a píxeles según el zoom)
  snow: { cols: ['#ffffff'], fall: 1.1, size: 0.09 },
  leaf: { cols: ['#d9822b', '#b5451b', '#e0b43a'], fall: 1.0, size: 0.16 },
  petal: { cols: ['#ffb3d9', '#ffc9e4'], fall: 0.8, size: 0.13 },
};

export interface Weather {
  /** pxPerM: píxeles de pantalla por metro con el zoom actual */
  update(g: Game, dt: number, center: THREE.Vector3, viewSize: number, pxPerM: number, viewDir: THREE.Vector3): void;
}

export function createWeather(scene: THREE.Scene, pixelRatio: number): Weather {
  // Copos / hojas / pétalos
  const fPos = new Float32Array(N_FLAKES * 3), fCol = new Float32Array(N_FLAKES * 3), seed = new Float32Array(N_FLAKES);
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fGeo.setAttribute('color', new THREE.BufferAttribute(fCol, 3));
  const fMat = new THREE.PointsMaterial({ size: 4 * pixelRatio, map: discTexture(), vertexColors: true, transparent: true, alphaTest: 0.3, depthWrite: false });
  const flakes = new THREE.Points(fGeo, fMat);
  flakes.frustumCulled = false;
  flakes.visible = false;
  scene.add(flakes);

  // Gotas de lluvia: segmentos inclinados
  const rPos = new Float32Array(N_DROPS * 6);
  const rGeo = new THREE.BufferGeometry();
  rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
  const rain = new THREE.LineSegments(rGeo, new THREE.LineBasicMaterial({ color: '#aac8ff', transparent: true, opacity: 0.6 }));
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  let kind = '', t = 0, half = 20;
  const cx = { x: 0, z: 0 };
  const col = new THREE.Color();

  // Coloca una partícula en un punto al azar de la caja que rodea la vista
  const scatter = (a: Float32Array, i: number, stride: number, y: number) => {
    a[i * stride] = cx.x + (Math.random() * 2 - 1) * half;
    a[i * stride + 1] = y;
    a[i * stride + 2] = cx.z + (Math.random() * 2 - 1) * half;
  };
  const wrap = (a: Float32Array, i: number, stride: number) => {
    const dx = a[i * stride] - cx.x, dz = a[i * stride + 2] - cx.z;
    if (Math.abs(dx) > half) a[i * stride] -= Math.sign(dx) * half * 2;
    if (Math.abs(dz) > half) a[i * stride + 2] -= Math.sign(dz) * half * 2;
  };

  const setKind = (k: string) => {
    kind = k;
    const K = KIND[k];
    flakes.visible = !!K;
    if (!K) return;
    for (let i = 0; i < N_FLAKES; i++) {
      scatter(fPos, i, 3, Math.random() * TOP);
      col.set(K.cols[i % K.cols.length]);
      fCol.set([col.r, col.g, col.b], i * 3);
      seed[i] = Math.random() * 6.28;
    }
    fGeo.attributes.color.needsUpdate = true;
  };

  return {
    update(g, dt, center, viewSize, pxPerM, viewDir) {
      view.copy(viewDir);
      t += dt;
      cx.x = center.x;
      cx.z = center.z;
      half = Math.max(12, viewSize * 1.1);
      const se = season(g.S);
      const k = se === 'xmas' || se === 'winter' ? 'snow' : se === 'autumn' ? 'leaf' : se === 'spring' ? 'petal' : '';
      if (k !== kind) setKind(k);
      const K = KIND[kind];
      if (K) {
        fMat.size = THREE.MathUtils.clamp(K.size * pxPerM, 1.5, 9) * pixelRatio;
        for (let i = 0; i < N_FLAKES; i++) {
          const j = i * 3;
          fPos[j] += Math.sin(t + seed[i]) * dt * 0.6;
          fPos[j + 1] -= K.fall * dt * (0.7 + (i % 5) * 0.1);
          wrap(fPos, i, 3);
          // Dentro de la tienda no nieva (no tiene techo): vuelve a caer en otro sitio
          if (fPos[j + 1] < 0 || inShop(fPos[j], fPos[j + 1], fPos[j + 2])) scatter(fPos, i, 3, fPos[j + 1] < 0 ? TOP : fPos[j + 1]);
        }
        fGeo.attributes.position.needsUpdate = true;
      }

      const raining = g.S.ev?.t === 'rain';
      if (raining && !rain.visible) for (let i = 0; i < N_DROPS; i++) scatter(rPos, i, 6, Math.random() * TOP);
      rain.visible = raining;
      if (raining) {
        for (let i = 0; i < N_DROPS; i++) {
          const j = i * 6;
          rPos[j] += dt * 1.5;
          rPos[j + 1] -= dt * 14;
          wrap(rPos, i, 6);
          if (rPos[j + 1] < 0 || inShop(rPos[j], rPos[j + 1], rPos[j + 2])) scatter(rPos, i, 6, rPos[j + 1] < 0 ? TOP : rPos[j + 1]);
          // Segmento de 0,5 m con algo de inclinación
          rPos[j + 3] = rPos[j] - 0.08;
          rPos[j + 4] = rPos[j + 1] + 0.5;
          rPos[j + 5] = rPos[j + 2];
        }
        rGeo.attributes.position.needsUpdate = true;
      }
    },
  };
}
