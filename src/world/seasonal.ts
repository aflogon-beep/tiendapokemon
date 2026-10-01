import * as THREE from 'three';
import type { Game } from '../core/game';
import { FLOOR_T, FRONT_Y, W } from '../systems/layout';
import { SIDEWALK, WALL_PX } from '../systems/shopNav';
import { season } from '../systems/seasons';
import { CITY_BOUNDS, FAR_SIDEWALK } from './city';
import { box, mat } from './props';
import { PX_TO_M, toWorld } from './shop';

/*
 * Decoración de temporada (v10: drawWall, drawFrontWall, decorObjs y drawStreet):
 * Navidad (árbol y guirnalda), Halloween (calabazas y luces), primavera (jardineras),
 * verano (cartel de rebajas), nieve y hojas en las aceras.
 */

const BACK_Z = toWorld(0, FLOOR_T).z + 0.03;
const OUT_Z = toWorld(0, FRONT_Y + WALL_PX).z + 0.1;

// Bombillas a lo largo de la pared del fondo (guirnalda de Navidad o luces de Halloween)
function buildBulbs(cols: string[], y: number): { group: THREE.Group; mats: THREE.MeshStandardMaterial[] } {
  const g = new THREE.Group(), mats = cols.map((c) => mat(c, { emissive: c, emissiveIntensity: 1 }));
  const geo = new THREE.SphereGeometry(0.06, 6, 4);
  for (let x = 10, i = 0; x < W; x += 20, i++) {
    const p = toWorld(x, FLOOR_T), sag = Math.sin(((x % 40) / 40) * Math.PI) * 0.12;
    const b = new THREE.Mesh(geo, mats[i % mats.length]);
    b.position.set(p.x, y - sag, BACK_Z + 0.05);
    g.add(b);
  }
  return { group: g, mats };
}

function buildGarland(): THREE.Object3D {
  const g = new THREE.Group(), green = mat('#1f6b35');
  for (let x = 0; x < W; x += 40) {
    const a = toWorld(x, FLOOR_T), b = toWorld(x + 40, FLOOR_T);
    const seg = new THREE.Mesh(new THREE.TorusGeometry((b.x - a.x) / 2, 0.05, 4, 8, Math.PI), green);
    seg.rotation.z = Math.PI;
    seg.position.set((a.x + b.x) / 2, 2.32, BACK_Z + 0.04);
    g.add(seg);
  }
  return g;
}

function buildXmasTree(): THREE.Object3D {
  const g = new THREE.Group(), green = mat('#1f7a3a', { flatShading: true });
  g.add(box(0.14, 0.3, 0.14, mat('#7a4a2b')));
  [[0.75, 0.3, 0.8], [0.6, 0.8, 0.7], [0.42, 1.25, 0.6]].forEach(([r, y, h]) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), green);
    c.position.y = y + h / 2;
    c.castShadow = true;
    g.add(c);
  });
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), mat('#ffd54a', { emissive: '#ffd54a', emissiveIntensity: 0.8 }));
  star.position.y = 1.95;
  g.add(star);
  const balls = ['#ff4d4d', '#ffd54a', '#4dd2ff'].map((c) => mat(c, { emissive: c, emissiveIntensity: 0.6 }));
  [[-0.35, 0.6, 0.3], [0.3, 0.75, 0.32], [-0.15, 1.1, 0.3], [0.2, 1.4, 0.2], [0, 0.95, 0.42], [-0.4, 0.5, -0.1]].forEach(([x, y, z], i) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), balls[i % 3]);
    b.position.set(x, y, z);
    g.add(b);
  });
  const p = toWorld(470, 530);
  g.position.set(p.x, 0, p.z);
  return g;
}

function buildPumpkins(): THREE.Object3D {
  const g = new THREE.Group(), orange = mat('#ff8a1f', { flatShading: true }), stem = mat('#3b6b2b');
  [[280, 0.32], [420, 0.26], [446, 0.2]].forEach(([x, r]) => {
    const p = toWorld(x, SIDEWALK.y0 + 14);
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), orange);
    b.scale.y = 0.75;
    b.position.set(p.x, r * 0.75, p.z);
    b.castShadow = true;
    g.add(b);
    g.add(box(0.05, 0.12, 0.05, stem, p.x, r * 1.45, p.z, false));
  });
  return g;
}

function buildFlowerBoxes(): THREE.Object3D {
  const g = new THREE.Group(), wood = mat('#6b4527'), leaf = mat('#3b8a3b');
  ([[40, '#ff9ecf'], [200, '#ffe066'], [470, '#ff9ecf'], [690, '#b39dff']] as const).forEach(([x, col]) => {
    const p = toWorld(x + 30, SIDEWALK.y0 + 8), w = 60 * PX_TO_M, fl = mat(col);
    g.add(box(w, 0.3, 0.3, wood, p.x, 0, p.z));
    for (let i = 0; i < 6; i++) {
      const fx = p.x - w / 2 + 0.15 + (i * (w - 0.3)) / 5;
      g.add(box(0.04, 0.2, 0.04, leaf, fx, 0.3, p.z, false));
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), fl);
      f.position.set(fx, 0.52, p.z);
      g.add(f);
    }
  });
  return g;
}

function buildSaleSign(): THREE.Object3D {
  const cv = document.createElement('canvas');
  cv.width = 640;
  cv.height = 96;
  const c = cv.getContext('2d')!;
  c.font = '700 64px Fredoka, system-ui, sans-serif';
  c.fillStyle = 'rgba(255,120,40,.95)';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('¡REBAJAS DE VERANO!', 320, 50);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.48), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
  const p = toWorld(160, 0);
  m.position.set(p.x, 1.6, OUT_Z);
  return m;
}

// Manchas en las aceras: nieve (blanca) u hojas caídas (de colores)
function buildGroundSpots(kind: 'snow' | 'leaf'): THREE.Object3D {
  const snow = kind === 'snow';
  const n = snow ? 120 : 260, m = new THREE.Object3D();
  const geo = snow ? new THREE.CircleGeometry(0.9, 10).rotateX(-Math.PI / 2) : new THREE.PlaneGeometry(0.14, 0.08).rotateX(-Math.PI / 2);
  const inst = new THREE.InstancedMesh(geo, mat('#ffffff', { roughness: 1 }), n);
  const cols = ['#d9822b', '#b5451b', '#e0b43a'], col = new THREE.Color();
  const W0 = CITY_BOUNDS.x0, W1 = CITY_BOUNDS.x1;
  for (let i = 0; i < n; i++) {
    const far = i % 2 === 1;
    const y = far ? FAR_SIDEWALK.y0 + 10 + Math.random() * (snow ? 30 : 110) : SIDEWALK.y0 + (snow ? 100 + Math.random() * 20 : 6 + Math.random() * 115);
    const p = toWorld(W0 + Math.random() * (W1 - W0), y);
    m.position.set(p.x, 0.012 + i * 0.00002, p.z);
    m.rotation.set(0, Math.random() * 6, 0);
    m.scale.set(snow ? 1 + Math.random() : 1, 1, snow ? 0.35 : 1);
    m.updateMatrix();
    inst.setMatrixAt(i, m.matrix);
    inst.setColorAt(i, col.set(snow ? '#f4f8fb' : cols[i % 3]));
  }
  inst.receiveShadow = true;
  return inst;
}

export interface Seasonal {
  update(g: Game, t: number): void;
}

export function createSeasonal(scene: THREE.Scene): Seasonal {
  let cur = '';
  let group: THREE.Group | null = null;
  let blink: THREE.MeshStandardMaterial[] = [];

  const build = (se: string) => {
    if (group) scene.remove(group);
    group = new THREE.Group();
    blink = [];
    if (se === 'xmas') {
      group.add(buildGarland(), buildXmasTree());
      const b = buildBulbs(['#ff4d4d', '#ffd54a', '#4dd2ff', '#7dff7a'], 2.2);
      group.add(b.group);
      blink = b.mats;
    }
    if (se === 'hallo') {
      group.add(buildPumpkins());
      const b = buildBulbs(['#ff8a1f', '#9b4dff'], 2.3);
      group.add(b.group);
      blink = b.mats;
    }
    if (se === 'spring') group.add(buildFlowerBoxes());
    if (se === 'summer') group.add(buildSaleSign());
    if (se === 'xmas' || se === 'winter') group.add(buildGroundSpots('snow'));
    if (se === 'autumn') group.add(buildGroundSpots('leaf'));
    scene.add(group);
  };

  return {
    update(g, t) {
      const se = season(g.S);
      if (se !== cur) {
        cur = se;
        build(se);
      }
      // Las bombillas parpadean por turnos
      blink.forEach((m, i) => (m.emissiveIntensity = Math.sin(t * 3 + i * 1.7) > 0 ? 1.4 : 0.1));
    },
  };
}
