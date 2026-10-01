import * as THREE from 'three';
import type { Game } from '../core/game';
import { setCol } from '../data/sets';
import { caseCap, caseItems } from '../systems/economy';
import { luxItems } from '../systems/inventory';
import { DECOR_POS, SHELF_DEPTH_PX, prodRect, shelfRect, caseRect } from '../systems/layout';
import { pInfo, pStock } from '../systems/products';
import { PACK_SCALE } from './assets';
import { cardTexture } from './cardTextures';
import { toWorld } from './shop';

/*
 * Mercancía en 3D según el estado (lo que la v10 dibujaba en drawShelf, drawCase, drawProd y
 * drawLux): sobres en las estanterías, cartas en la vitrina, productos en la mesa y peanas.
 */

const U = PACK_SCALE.market; // unidades de Mini Market → metros
const SHELF_LEVELS = [0.55 * U, 0.175 * U]; // baldas de shelf-boxes (arriba primero)
const PER_ROW = 7;
const MAX_PACKS = 6 * PER_ROW * 2;
const CASE_TOP = 0.87; // altura del fieltro de la vitrina (props.ts)
const TABLE_TOP = 0.86;

const tmp = new THREE.Object3D();
const col = new THREE.Color();

// Sobre: caja fina con bandas claras arriba y abajo (se tiñe con el color del set)
function packTexture(): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = 32;
  cv.height = 48;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#d9d9d9';
  g.fillRect(0, 0, 32, 48);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 32, 5);
  g.fillRect(0, 43, 32, 5);
  g.beginPath();
  g.arc(16, 24, 7, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface Merch {
  update(g: Game, dt: number): void;
}

export function createMerch(scene: THREE.Scene): Merch {
  // Sobres (instanciados)
  const packs = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.34, 0.5, 0.06),
    new THREE.MeshStandardMaterial({ map: packTexture(), roughness: 0.5, metalness: 0.15 }),
    MAX_PACKS,
  );
  packs.castShadow = true;
  packs.count = 0;
  scene.add(packs);

  // Productos sellados y accesorios (cajas de colores)
  const prods = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 14);
  prods.castShadow = true;
  prods.count = 0;
  scene.add(prods);

  // Cartas de la vitrina (tumbadas) y de las peanas (de pie)
  const cardGeo = new THREE.PlaneGeometry(0.5, 0.7);
  const mkCard = () => {
    const m = new THREE.Mesh(cardGeo, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.05 }));
    m.visible = false;
    scene.add(m);
    return m;
  };
  const caseCards = Array.from({ length: 16 }, mkCard);
  const luxCards = Array.from({ length: 3 }, mkCard);

  let sig = '';
  let spin = 0;

  function layoutPacks(g: Game): void {
    const S = g.S;
    let n = 0;
    S.slots.forEach((sid, i) => {
      if (!sid || i >= 6) return;
      const q = Math.min(S.sealed[sid] || 0, PER_ROW * 2), r = shelfRect(i);
      col.set(setCol(sid));
      for (let k = 0; k < q; k++) {
        const row = Math.floor(k / PER_ROW), j = k % PER_ROW;
        const p = toWorld(r.x + 14 + j * ((r.w - 28) / (PER_ROW - 1)), r.y + SHELF_DEPTH_PX / 2 + 15);
        tmp.position.set(p.x, SHELF_LEVELS[row] + 0.26, p.z);
        tmp.rotation.set(-0.18, 0, 0);
        tmp.updateMatrix();
        packs.setMatrixAt(n, tmp.matrix);
        packs.setColorAt(n, col);
        n++;
      }
    });
    packs.count = n;
    packs.instanceMatrix.needsUpdate = true;
    if (packs.instanceColor) packs.instanceColor.needsUpdate = true;
  }

  function layoutProds(g: Game): void {
    const S = g.S, r = prodRect(), ids = Object.keys(S.prod).filter((p) => pStock(S, p) > 0 && pInfo(S, p));
    const SIZE: Record<string, [number, number, number]> = { box: [0.36, 0.26, 0.24], etb: [0.3, 0.3, 0.18], tin: [0.22, 0.22, 0.22], col: [0.32, 0.26, 0.12], acc: [0.16, 0.22, 0.06] };
    let k = 0;
    for (const pid of ids) {
      const i = pInfo(S, pid)!, n = Math.min(pStock(S, pid), i.t === 'acc' ? 3 : 2);
      for (let j = 0; j < n && k < 14; j++, k++) {
        const [w, h, d] = SIZE[i.t] || SIZE.acc;
        const p = toWorld(r.x + 12 + (k % 7) * ((r.w - 24) / 6), r.y + (k < 7 ? 7 : 19));
        tmp.position.set(p.x, TABLE_TOP + h / 2, p.z);
        tmp.rotation.set(0, (k % 3) * 0.12 - 0.12, 0);
        tmp.scale.set(w, h, d);
        tmp.updateMatrix();
        prods.setMatrixAt(k, tmp.matrix);
        prods.setColorAt(k, col.set(i.t === 'etb' ? '#3b2a66' : i.t === 'col' ? '#d4a017' : i.col));
      }
    }
    tmp.scale.set(1, 1, 1);
    prods.count = k;
    prods.instanceMatrix.needsUpdate = true;
    if (prods.instanceColor) prods.instanceColor.needsUpdate = true;
  }

  function layoutCase(g: Game): void {
    const its = caseItems(g.S), cap = caseCap(g.S), c = caseRect(cap);
    caseCards.forEach((m, k) => {
      const it = its[k];
      m.visible = !!it && k < cap;
      if (!m.visible) return;
      const card = g.db.byId[it.c];
      (m.material as THREE.MeshStandardMaterial).map = cardTexture(card);
      (m.material as THREE.MeshStandardMaterial).needsUpdate = true;
      const p = toWorld(c.x + 24 + (k % 8) * ((c.w - 48) / 7), c.y + 22 + Math.floor(k / 8) * 40);
      m.position.set(p.x, CASE_TOP, p.z);
      // Tumbadas mirando hacia arriba, un poco inclinadas hacia el cliente
      m.rotation.set(-Math.PI / 2 + 0.3, 0, 0);
    });
  }

  function layoutLux(g: Game): void {
    const its = g.S.decor.lux ? luxItems(g) : [];
    luxCards.forEach((m, i) => {
      const it = its[i];
      m.visible = !!it;
      if (!it) return;
      (m.material as THREE.MeshStandardMaterial).map = cardTexture(g.db.byId[it.c]);
      (m.material as THREE.MeshStandardMaterial).needsUpdate = true;
      const p = toWorld(DECOR_POS.lux[i].x, DECOR_POS.lux[i].y);
      m.position.set(p.x, 1.35, p.z);
    });
  }

  return {
    update(g, dt) {
      const S = g.S;
      // Solo se recoloca cuando cambia algo de lo que se ve
      const s =
        S.slots.map((id) => (id ? id + ':' + S.sealed[id] : '-')).join(',') + '|' +
        caseItems(S).map((i) => i.c).join(',') + caseCap(S) + '|' +
        Object.keys(S.prod).map((p) => p + S.prod[p]).join(',') + '|' +
        (S.decor.lux ? luxItems(g).map((i) => i.c).join(',') : '');
      if (s !== sig) {
        sig = s;
        layoutPacks(g);
        layoutProds(g);
        layoutCase(g);
        layoutLux(g);
      }
      // Las cartas de las peanas giran despacio
      spin += dt * 0.8;
      luxCards.forEach((m, i) => (m.rotation.y = Math.sin(spin + i * 2) * 0.6));
    },
  };
}

