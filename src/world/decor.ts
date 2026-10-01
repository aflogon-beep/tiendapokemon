import * as THREE from 'three';
import type { Game } from '../core/game';
import { caseCap, level, tierOf } from '../systems/economy';
import { DECOR_POS, FLOOR_T, W, caseRect, type Point } from '../systems/layout';
import { spawnLoaded } from './assets';
import { box, mat } from './props';
import { PX_TO_M, materialsOf, toWorld, type Shop } from './shop';

/*
 * Decoración comprada, personal contratado y aspecto según la categoría de la tienda
 * (v10: drawWall, drawDecorFloor, decorObjs, drawLux y buildBG).
 */

const px = (v: number) => v * PX_TO_M;
const WALL_Z = toWorld(0, FLOOR_T).z + 0.02; // cara interior de la pared del fondo

// Tintes por categoría (multiplican la textura de Kenney)
const FLOOR_TINT = ['#e6e0d4', '#d9a86a', '#fff2dc', '#f4f4f8'];
const WALL_TINT = ['#f0dfc0', '#eef6fb', '#fbefd2', '#56658c'];

/** Plano con un dibujo de canvas (letreros, alfombra, pósters) */
function canvasPlane(w: number, h: number, res: number, draw: (c: CanvasRenderingContext2D, cw: number, ch: number) => void, emissive = false): THREE.Mesh {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * res);
  cv.height = Math.round(h * res);
  draw(cv.getContext('2d')!, cv.width, cv.height);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.7 });
  if (emissive) {
    m.emissive.set('#ffffff');
    m.emissiveMap = t;
  }
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
}

const font = (s: number) => `700 ${s}px Fredoka, system-ui, sans-serif`;

function pokeball(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.fillStyle = '#e3350d';
  c.beginPath();
  c.arc(x, y, r, Math.PI, 0);
  c.fill();
  c.fillStyle = '#f4f4f4';
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI);
  c.fill();
  c.fillStyle = '#1d1d1d';
  c.fillRect(x - r, y - r * 0.1, r * 2, r * 0.2);
  c.beginPath();
  c.arc(x, y, r * 0.28, 0, 7);
  c.fill();
  c.fillStyle = '#f4f4f4';
  c.beginPath();
  c.arc(x, y, r * 0.17, 0, 7);
  c.fill();
}

const rr = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
};

// Letrero del fondo, uno por categoría (drawWall de la v10)
function shopSign(t: number): THREE.Mesh {
  const w = [2.7, 3.1, 3.4, 3.8][t], h = 0.42;
  const m = canvasPlane(w, h, 200, (c, cw, ch) => {
    const txt = (s: string, x: number, col: string, size: number) => {
      c.font = font(size);
      c.fillStyle = col;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(s, x, ch / 2 + 3);
    };
    if (t === 0) {
      c.fillStyle = '#6b4527';
      rr(c, 0, 0, cw, ch, 12);
      c.fillStyle = '#8a5a33';
      rr(c, 8, 8, cw - 16, ch - 16, 8);
      txt('POKÉ CARDS', cw / 2, '#f4e2c0', 54);
    } else if (t === 1) {
      c.fillStyle = '#a37a00';
      rr(c, 0, 0, cw, ch, 22);
      c.fillStyle = '#f2b705';
      rr(c, 5, 5, cw - 10, ch - 10, 18);
      pokeball(c, 50, ch / 2, 28);
      txt('POKÉ CARDS · TIENDA', cw / 2 + 25, '#2a2000', 50);
    } else if (t === 2) {
      c.fillStyle = '#fff';
      rr(c, 0, 0, cw, ch, 18);
      c.fillStyle = '#e3350d';
      c.fillRect(0, 0, cw, ch * 0.45);
      c.fillStyle = '#222';
      c.fillRect(0, ch * 0.45, cw, 6);
      pokeball(c, 60, ch / 2, 34);
      txt('POKÉ CARDS CENTER', cw / 2 + 30, '#1b1f2a', 50);
    } else {
      c.fillStyle = '#0b0f1a';
      rr(c, 0, 0, cw, ch, 16);
      c.fillStyle = '#fff6c0';
      for (let x = 14; x < cw; x += 30) {
        c.beginPath();
        c.arc(x, 10, 4, 0, 7);
        c.arc(x, ch - 10, 4, 0, 7);
        c.fill();
      }
      const g = c.createLinearGradient(0, 20, 0, ch - 20);
      g.addColorStop(0, '#fff3b0');
      g.addColorStop(1, '#c9a227');
      c.shadowColor = '#ffd54a';
      c.shadowBlur = 16;
      c.font = font(54);
      c.fillStyle = g;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('POKÉ CARDS MEGASTORE', cw / 2, ch / 2 + 3);
    }
  }, t === 3);
  const p = toWorld(W / 2, FLOOR_T);
  m.position.set(p.x, 2.0, WALL_Z);
  return m;
}

function buildTable(): THREE.Group {
  const g = new THREE.Group(), r = DECOR_POS.table;
  const wood = mat('#5c3b20'), felt = mat('#2f7d4a'), stool = mat('#8a5a33');
  const w = px(r.w), d = px(r.h), c = toWorld(r.x + r.w / 2, r.y + r.h / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.08, 0.68, 0.08, wood, c.x + sx * (w / 2 - 0.1), 0, c.z + sz * (d / 2 - 0.1)));
  g.add(box(w, 0.06, d, wood, c.x, 0.68, c.z));
  g.add(box(w - 0.14, 0.01, d - 0.14, felt, c.x, 0.74, c.z, false));
  // Cartas en juego sobre el tapete
  ['#ffffff', '#d9402a', '#4a86c9', '#f2b705'].forEach((col, i) =>
    g.add(box(0.2, 0.005, 0.28, mat(col), c.x - w / 3 + i * (w / 4.5), 0.751, c.z + (i % 2 ? 0.12 : -0.1), false)),
  );
  for (const s of DECOR_POS.tableSeats) {
    const p = toWorld(s.x, s.y);
    g.add(box(0.36, 0.46, 0.36, stool, p.x, 0, p.z));
  }
  return g;
}

function buildCoffee(): THREE.Group {
  const g = new THREE.Group(), r = DECOR_POS.coffee, c = toWorld(r.x + r.w / 2, r.y + r.h / 2);
  const w = px(r.w), d = px(r.h);
  g.add(box(w, 1.2, d, mat('#3a3d46'), c.x, 0, c.z));
  g.add(box(w + 0.02, 0.14, d + 0.02, mat('#c0392b'), c.x, 1.2, c.z));
  g.add(box(w * 0.5, 0.3, 0.02, mat('#111111'), c.x, 0.55, c.z + d / 2 + 0.01, false));
  g.add(box(0.12, 0.12, 0.12, mat('#ffffff'), c.x, 0.5, c.z + d / 2 - 0.05));
  const label = canvasPlane(w * 0.8, 0.18, 300, (cx, cw, ch) => {
    cx.font = font(ch * 0.8);
    cx.fillStyle = '#fff';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText('CAFÉ', cw / 2, ch / 2);
  });
  label.position.set(c.x, 1.0, c.z + d / 2 + 0.012);
  g.add(label);
  return g;
}

function buildSofa(): THREE.Group {
  const g = new THREE.Group(), r = DECOR_POS.sofa, c = toWorld(r.x + r.w / 2, r.y + r.h / 2);
  const w = px(r.w), d = px(r.h), dark = mat('#8e2f2f'), red = mat('#c24545');
  g.add(box(w, 0.42, d, red, c.x, 0, c.z));
  g.add(box(w, 0.85, 0.18, dark, c.x, 0, c.z - d / 2 + 0.09));
  for (const sx of [-1, 1]) g.add(box(0.16, 0.62, d, dark, c.x + sx * (w / 2 - 0.08), 0, c.z));
  return g;
}

function buildRug(): THREE.Mesh {
  const r = px(60);
  const m = canvasPlane(r * 2, r * 2, 120, (c, cw) => pokeball(c, cw / 2, cw / 2, cw / 2 - 1));
  const p = toWorld(DECOR_POS.rug.x, DECOR_POS.rug.y);
  m.rotation.x = -Math.PI / 2;
  m.position.set(p.x, 0.065, p.z);
  m.receiveShadow = true;
  return m;
}

function buildMat(): THREE.Mesh {
  const m = canvasPlane(px(54), px(16), 400, (c, cw, ch) => {
    c.fillStyle = '#6b4527';
    rr(c, 0, 0, cw, ch, 14);
    c.font = font(ch * 0.5);
    c.fillStyle = '#e8d5b0';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('BIENVENIDO', cw / 2, ch / 2);
  });
  const p = toWorld(355, 538);
  m.rotation.x = -Math.PI / 2;
  m.position.set(p.x, 0.065, p.z);
  return m;
}

// Maceta con hojas (plant() de la v10)
const POT = mat('#7a4a2b'), LEAF = mat('#2f7d43', { flatShading: true }), LEAF2 = mat('#3f9a55', { flatShading: true });
const LEAF_GEO = new THREE.IcosahedronGeometry(0.22, 0);
function buildPlant(pt: Point): THREE.Group {
  const g = new THREE.Group(), p = toWorld(pt.x, pt.y);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.38, 8), POT);
  pot.position.y = 0.19;
  pot.castShadow = true;
  g.add(pot);
  [[0, 0.62, 0, 1.1], [-0.13, 0.5, 0.05, 0.8], [0.14, 0.52, -0.04, 0.85], [0.02, 0.82, 0.03, 0.7]].forEach(([x, y, z, s], i) => {
    const l = new THREE.Mesh(LEAF_GEO, i % 2 ? LEAF2 : LEAF);
    l.position.set(x, y, z);
    l.scale.setScalar(s);
    l.castShadow = true;
    g.add(l);
  });
  g.position.copy(p);
  return g;
}

// Haz de luz falso (cono aditivo) para focos y peanas
const BEAM_MAT = new THREE.MeshBasicMaterial({ color: '#fff4c8', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
function beam(top: number, bottom: number, r: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, r, top - bottom, 16, 1, true), BEAM_MAT);
  m.position.y = (top + bottom) / 2;
  return m;
}

function buildLux(): THREE.Group {
  const g = new THREE.Group(), base = mat('#23283a'), gold = mat('#c9a227', { metalness: 0.6, roughness: 0.35 });
  for (const pt of DECOR_POS.lux) {
    const p = toWorld(pt.x, pt.y), s = px(34);
    g.add(box(s, 0.9, s, base, p.x, 0, p.z));
    g.add(box(s + 0.02, 0.04, s + 0.02, gold, p.x, 0.9, p.z));
    g.add(box(s + 0.02, 0.04, s + 0.02, gold, p.x, 0, p.z));
    const b = beam(2.4, 0.95, 0.42);
    b.position.x = p.x;
    b.position.z = p.z;
    g.add(b);
  }
  return g;
}

// Focos colgados sobre la vitrina
function buildCaseLights(cap: number): THREE.Group {
  const g = new THREE.Group(), c = caseRect(cap), lamp = mat('#2b2f38'), bulb = mat('#fff6c0', { emissive: '#fff1b0', emissiveIntensity: 1 });
  const n = Math.max(2, Math.round(c.w / 120));
  for (let i = 0; i < n; i++) {
    const p = toWorld(c.x + (c.w * (i + 0.5)) / n, c.y + c.h / 2);
    g.add(box(0.03, 0.5, 0.03, lamp, p.x, 2.0, p.z, false));
    g.add(box(0.22, 0.12, 0.22, lamp, p.x, 1.9, p.z, false));
    g.add(box(0.16, 0.02, 0.16, bulb, p.x, 1.88, p.z, false));
    const b = beam(1.88, 0.9, 0.55);
    b.position.x = p.x;
    b.position.z = p.z;
    g.add(b);
  }
  return g;
}

function buildPosters(): THREE.Group {
  const g = new THREE.Group();
  ([[132, '#3f7fc4'], [184, '#d65fae'], [236, '#2fa557']] as const).forEach(([x, col]) => {
    const m = canvasPlane(0.85, 0.7, 120, (c, cw, ch) => {
      c.fillStyle = '#fff';
      c.fillRect(0, 0, cw, ch);
      c.fillStyle = col;
      c.fillRect(6, 6, cw - 12, ch - 12);
      c.fillStyle = 'rgba(255,255,255,.65)';
      c.beginPath();
      c.arc(cw / 2, ch / 2, ch * 0.22, 0, 7);
      c.fill();
    });
    const p = toWorld(x, FLOOR_T);
    m.position.set(p.x, 1.55, WALL_Z);
    g.add(m);
  });
  return g;
}

function buildNeon(): THREE.Mesh {
  const m = canvasPlane(1.8, 0.4, 220, (c, cw, ch) => {
    c.font = font(ch * 0.62);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = '#ff4fd8';
    c.shadowBlur = 18;
    c.fillStyle = '#ffc4f3';
    c.fillText('★ ABIERTO ★', cw / 2, ch / 2);
  }, true);
  m.position.set(toWorld(DECOR_POS.neon.x, 0).x, 1.95, WALL_Z + 0.01);
  return m;
}

export interface Decor {
  update(g: Game, t: number): void;
}

export function createDecor(scene: THREE.Scene, shop: Shop): Decor {
  const root = new THREE.Group();
  root.name = 'decoración';
  scene.add(root);

  // Plantas que siempre están
  for (const p of DECOR_POS.basePlants) root.add(buildPlant(p));
  root.add(buildMat());

  const parts: Record<string, () => THREE.Object3D> = {
    table: buildTable,
    coffee: buildCoffee,
    sofa: buildSofa,
    rug: buildRug,
    poster: buildPosters,
    lux: buildLux,
    neon: buildNeon,
    plants: () => {
      const g = new THREE.Group();
      for (const p of DECOR_POS.plants) g.add(buildPlant(p));
      return g;
    },
  };
  const built = new Map<string, THREE.Object3D>();
  let lights: THREE.Object3D | null = null, lightsCap = -1;
  let sign: THREE.Mesh | null = null, tier = -1;
  const staff: Record<string, { obj: THREE.Object3D; mixer: THREE.AnimationMixer } | undefined> = {};
  const floorMats = materialsOf(shop.floor), wallMats = shop.walls.flatMap(materialsOf);

  const setTier = (t: number) => {
    tier = t;
    if (sign) root.remove(sign);
    sign = shopSign(t);
    root.add(sign);
    for (const m of floorMats) m.color.set(FLOOR_TINT[t]);
    for (const m of wallMats) m.color.set(WALL_TINT[t]);
  };

  // Empleados contratados (v10: cajero en 748,250 y tasador en 706,150)
  const hire = (k: 'cashier' | 'appraiser', model: string, pt: Point, rotY: number) => {
    const inst = spawnLoaded('characters', model);
    inst.root.position.copy(toWorld(pt.x, pt.y));
    inst.root.rotation.y = rotY;
    const mixer = new THREE.AnimationMixer(inst.root);
    const idle = inst.animations.find((a) => a.name === 'idle');
    if (idle) mixer.clipAction(idle).play();
    root.add(inst.root);
    staff[k] = { obj: inst.root, mixer };
  };

  return {
    update(g, dt) {
      const S = g.S, D = S.decor;
      const t = tierOf(level(g));
      if (t !== tier) setTier(t);
      for (const k of Object.keys(parts)) {
        const want = !!D[k], has = built.get(k);
        if (want && !has) {
          const o = parts[k]();
          built.set(k, o);
          root.add(o);
        } else if (!want && has) {
          root.remove(has);
          built.delete(k);
        }
      }
      // Los focos siguen el tamaño de la vitrina
      const cap = D.lights ? caseCap(S) : 0;
      if (cap !== lightsCap) {
        if (lights) root.remove(lights);
        lights = cap ? buildCaseLights(cap) : null;
        if (lights) root.add(lights);
        lightsCap = cap;
      }
      const neon = built.get('neon') as THREE.Mesh | undefined;
      if (neon) (neon.material as THREE.MeshStandardMaterial).emissiveIntensity = S.phase === 'closed' ? 0.05 : 0.9;
      if (sign && t === 3) (sign.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.55 + 0.15 * Math.sin(performance.now() / 300);
      if (S.staff.cashier && !staff.cashier) hire('cashier', 'character-male-c', { x: 748, y: 250 }, -Math.PI / 2);
      if (S.staff.appraiser && !staff.appraiser) hire('appraiser', 'character-female-b', { x: 706, y: 150 }, 0);
      for (const k of ['cashier', 'appraiser'] as const) {
        const s = staff[k];
        if (!s) continue;
        s.obj.visible = !!S.staff[k];
        s.mixer.update(dt);
      }
    },
  };
}
