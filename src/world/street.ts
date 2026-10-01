import * as THREE from 'three';
import type { Game } from '../core/game';
import { SIDEWALK } from '../systems/shopNav';
import { season } from '../systems/seasons';
import { spawnLoaded } from './assets';
import { MODELS } from './characters';
import { CITY_BOUNDS, FAR_SIDEWALK, ROAD } from './city';
import { mat } from './props';
import { PX_TO_M, toWorld } from './shop';

/*
 * Vida en la calle (v10: cityTrees, streetLamp, updCars, updPed): árboles, farolas,
 * coches y peatones que pasan. Solo decoración: no toca el estado del juego.
 */

const rr = (a: number, b: number) => a + Math.random() * (b - a);
const pickR = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
const X0 = CITY_BOUNDS.x0, X1 = CITY_BOUNDS.x1;
const NEAR_CURB = SIDEWALK.y1 - 4, FAR_CURB = FAR_SIDEWALK.y0 + 6;
// Delante de la puerta no hay árboles ni farolas (ahí se forma la cola del lanzamiento)
const DOOR_ZONE = (x: number) => x > 180 && x < 740;

/* ---------- árboles ---------- */

const TREE_COLS: Record<string, [string, string]> = {
  autumn: ['#c9661f', '#e0a13a'],
  winter: ['#4f6b5a', '#e8eef2'],
  xmas: ['#4f6b5a', '#e8eef2'],
  default: ['#2f7d43', '#48a862'],
};

function treeSpots(): THREE.Vector3[] {
  const l: THREE.Vector3[] = [];
  for (let x = X0 + 170; x < X1; x += 400) if (!DOOR_ZONE(x)) l.push(toWorld(x, NEAR_CURB));
  for (let x = X0 + 60; x < X1; x += 440) l.push(toWorld(x, FAR_CURB));
  return l;
}

function buildTrees(): { group: THREE.Group; setSeason(k: string): void } {
  const spots = treeSpots(), n = spots.length;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.14, 1.6, 6), mat('#6b4527'), n);
  const crownMat = mat('#2f7d43', { flatShading: true }), topMat = mat('#48a862', { flatShading: true });
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.95, 0), crownMat, n * 2);
  const top = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.55, 0), topMat, n);
  const m = new THREE.Object3D();
  spots.forEach((p, i) => {
    m.position.set(p.x, 0.8, p.z);
    m.rotation.set(0, 0, 0);
    m.scale.setScalar(1);
    m.updateMatrix();
    trunk.setMatrixAt(i, m.matrix);
    const s = 0.9 + ((i * 37) % 10) / 30;
    m.rotation.y = i;
    m.scale.setScalar(s);
    m.position.set(p.x - 0.35, 2.1, p.z);
    m.updateMatrix();
    crown.setMatrixAt(i * 2, m.matrix);
    m.position.set(p.x + 0.35, 2.3, p.z + 0.1);
    m.updateMatrix();
    crown.setMatrixAt(i * 2 + 1, m.matrix);
    m.position.set(p.x - 0.1, 2.95, p.z);
    m.updateMatrix();
    top.setMatrixAt(i, m.matrix);
  });
  for (const o of [trunk, crown, top]) o.castShadow = true;
  const group = new THREE.Group();
  group.add(trunk, crown, top);
  return {
    group,
    setSeason(k) {
      const [a, b] = TREE_COLS[k] || TREE_COLS.default;
      crownMat.color.set(a);
      topMat.color.set(b);
    },
  };
}

/* ---------- farolas ---------- */

function lampSpots(): { p: THREE.Vector3; dir: number }[] {
  const l: { p: THREE.Vector3; dir: number }[] = [];
  for (let x = X0 + 370; x < X1; x += 400) if (!DOOR_ZONE(x)) l.push({ p: toWorld(x, NEAR_CURB), dir: 1 });
  for (let x = X0 + 280; x < X1; x += 440) l.push({ p: toWorld(x, FAR_CURB), dir: -1 });
  return l;
}

// Mancha de luz en el suelo (más barata que una luz puntual por farola)
function glowTexture(): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d')!, g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,230,160,1)');
  g.addColorStop(1, 'rgba(255,230,160,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}
export const GLOW_TEX = glowTexture();

function buildLamps(): { group: THREE.Group; setNight(n: number): void } {
  const spots = lampSpots(), n = spots.length, m = new THREE.Object3D();
  const pole = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 4, 0.12), mat('#2b2f38'), n);
  const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.08, 0.9), mat('#2b2f38'), n);
  const bulbMat = mat('#c9ccd2', { emissive: '#fff1b0', emissiveIntensity: 0 });
  const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.16, 0.5), bulbMat, n);
  const glowMat = new THREE.MeshBasicMaterial({ map: GLOW_TEX, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(5, 5).rotateX(-Math.PI / 2), glowMat, n);
  spots.forEach(({ p, dir }, i) => {
    // El brazo apunta hacia la calzada
    const z = p.z + dir * 0.45;
    m.position.set(p.x, 2, p.z);
    m.updateMatrix();
    pole.setMatrixAt(i, m.matrix);
    m.position.set(p.x, 3.95, z);
    m.updateMatrix();
    arm.setMatrixAt(i, m.matrix);
    m.position.set(p.x, 3.85, p.z + dir * 0.8);
    m.updateMatrix();
    head.setMatrixAt(i, m.matrix);
    m.position.set(p.x, 0.03, p.z + dir * 0.9);
    m.updateMatrix();
    glow.setMatrixAt(i, m.matrix);
  });
  pole.castShadow = true;
  const group = new THREE.Group();
  group.add(pole, arm, head, glow);
  return {
    group,
    setNight(k) {
      bulbMat.emissiveIntensity = k > 0.2 ? 1.2 : 0;
      glowMat.opacity = k * 0.55;
      glow.visible = k > 0.01;
    },
  };
}

/* ---------- coches ---------- */

const CAR_COLS = ['#e3350d', '#3f7fc4', '#f2b705', '#2fa557', '#eeeeee', '#222222', '#8e4cb5', '#e07a2f'];
const WHEEL_GEO = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10).rotateX(Math.PI / 2);
const WHEEL_MAT = mat('#1d1d1d');
const GLASS_MAT = mat('#9fc3d6', { roughness: 0.2, metalness: 0.3 });
const LIGHT_MAT = mat('#fff6c0', { emissive: '#fff1b0', emissiveIntensity: 0.3 });
const REAR_MAT = mat('#d62828', { emissive: '#d62828', emissiveIntensity: 0.3 });
const BEAM_MAT = new THREE.MeshBasicMaterial({ map: GLOW_TEX, color: '#fff0be', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });

interface Car {
  obj: THREE.Group;
  x: number;
  dir: number;
  sp: number;
}

// Coche (o autobús) mirando hacia +x; mide `len` metros
function buildCar(bus: boolean): THREE.Group {
  const g = new THREE.Group(), len = bus ? 10 : rr(3.8, 4.6), w = bus ? 2.4 : 1.8;
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, bus ? 2.6 : 0.8, w), mat(bus ? '#2f6fb3' : pickR(CAR_COLS), { roughness: 0.5 }));
  body.position.y = bus ? 1.65 : 0.75;
  body.castShadow = true;
  g.add(body);
  if (bus) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(len - 0.6, 0.8, w + 0.02), GLASS_MAT);
    win.position.y = 2.2;
    g.add(win);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(len * 0.5, 0.6, w - 0.12), GLASS_MAT);
    cabin.position.set(-len * 0.05, 1.45, 0);
    cabin.castShadow = true;
    g.add(cabin);
  }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const wh = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
      wh.position.set(sx * (len / 2 - 0.8), 0.34, sz * (w / 2 - 0.05));
      g.add(wh);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.3), sx > 0 ? LIGHT_MAT : REAR_MAT);
      l.position.set(sx * (len / 2 + 0.01), bus ? 0.8 : 0.85, sz * (w / 2 - 0.3));
      g.add(l);
    }
  // Haz de los faros (solo de noche)
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.6).rotateX(-Math.PI / 2), BEAM_MAT);
  beam.position.set(len / 2 + 3.2, 0.03, 0);
  g.add(beam);
  g.userData.len = len;
  return g;
}

/* ---------- peatones ---------- */

interface Ped {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  umbrella: THREE.Object3D;
  x: number;
  y: number;
  dir: number;
  sp: number;
  active: boolean;
}

const UMB_COLS = ['#3f7fc4', '#e3350d', '#f2b705', '#2fa557', '#8e4cb5'];
function buildUmbrella(): THREE.Object3D {
  const g = new THREE.Group();
  const cloth = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.32, 8), mat(pickR(UMB_COLS), { side: THREE.DoubleSide }));
  cloth.position.y = 2.25;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8), mat('#222222'));
  stick.position.set(0, 1.85, 0);
  g.add(cloth, stick);
  g.visible = false;
  return g;
}

const MAX_PEDS = 8;
const MAX_CARS = 7;

export interface Street {
  update(g: Game, dt: number, night: number): void;
}

export function createStreet(scene: THREE.Scene): Street {
  const trees = buildTrees(), lamps = buildLamps();
  scene.add(trees.group, lamps.group);
  let seasonK = '';

  const cars: Car[] = [];
  let carT = 1;
  const peds: Ped[] = [];
  let pedT = 0.5;
  const lane = (dir: number) => toWorld(0, ROAD.y0 + (dir > 0 ? 0.28 : 0.74) * (ROAD.y1 - ROAD.y0)).z;

  // Los coches se reutilizan al salir de la calle (sin crear geometría nueva cada vez)
  const spawnCar = () => {
    const dir = Math.random() < 0.5 ? 1 : -1;
    let c = cars.find((x) => !x.obj.visible);
    if (!c) {
      if (cars.length >= MAX_CARS + 2) return;
      cars.push((c = { obj: buildCar(Math.random() < 0.12), x: 0, dir, sp: 0 }));
      scene.add(c.obj);
    }
    c.dir = dir;
    c.sp = c.obj.userData.len > 6 ? rr(5, 7) : rr(6, 10);
    c.x = toWorld(dir > 0 ? X0 - 300 : X1 + 300, 0).x;
    c.obj.rotation.y = dir > 0 ? 0 : Math.PI;
    c.obj.position.set(c.x, 0, lane(dir));
    c.obj.visible = true;
  };

  const newPed = (): Ped => {
    const inst = spawnLoaded('characters', pickR(MODELS));
    const mixer = new THREE.AnimationMixer(inst.root);
    const walk = inst.animations.find((a) => a.name === 'walk');
    if (walk) mixer.clipAction(walk).play();
    const umbrella = buildUmbrella();
    inst.root.add(umbrella);
    // El paraguas va en metros reales: deshace la escala del pack
    umbrella.scale.setScalar(1 / inst.root.scale.x);
    scene.add(inst.root);
    return { root: inst.root, mixer, umbrella, x: 0, y: 0, dir: 1, sp: 40, active: false };
  };

  const startPed = (p: Ped, rain: boolean) => {
    const dir = Math.random() < 0.5 ? 1 : -1, far = Math.random() < 0.45;
    p.dir = dir;
    p.x = dir > 0 ? X0 - 40 : X1 + 40;
    p.y = far ? FAR_SIDEWALK.y0 + rr(30, 100) : SIDEWALK.y0 + rr(35, 95);
    p.sp = rr(30, 52);
    p.active = true;
    p.root.visible = true;
    p.root.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    p.umbrella.visible = rain;
    p.mixer.timeScale = (p.sp * PX_TO_M) / 1.2;
  };

  return {
    update(g, dt, night) {
      const se = season(g.S), rain = g.S.ev?.t === 'rain';
      const k = se === 'autumn' ? 'autumn' : se === 'winter' || se === 'xmas' ? se : 'default';
      if (k !== seasonK) {
        seasonK = k;
        trees.setSeason(k);
      }
      lamps.setNight(night);

      // Coches
      if ((carT -= dt) <= 0) {
        carT = rr(1.8, 5.3);
        if (cars.filter((c) => c.obj.visible).length < MAX_CARS) spawnCar();
      }
      BEAM_MAT.opacity = night * 0.4;
      LIGHT_MAT.emissiveIntensity = REAR_MAT.emissiveIntensity = 0.3 + night * 1.5;
      const xMin = toWorld(X0 - 400, 0).x, xMax = toWorld(X1 + 400, 0).x;
      for (const c of cars) {
        if (!c.obj.visible) continue;
        c.x += c.dir * c.sp * dt;
        c.obj.position.x = c.x;
        if (c.x < xMin || c.x > xMax) c.obj.visible = false;
      }

      // Peatones: de noche pasan menos
      if ((pedT -= dt) <= 0) {
        pedT = rr(1, 3.2) * (1 + night * 2);
        let p = peds.find((x) => !x.active);
        if (!p && peds.length < MAX_PEDS) peds.push((p = newPed()));
        if (p) startPed(p, rain);
      }
      for (const p of peds) {
        if (!p.active) continue;
        p.x += p.dir * p.sp * dt;
        p.root.position.copy(toWorld(p.x, p.y));
        p.mixer.update(dt);
        if (p.x < X0 - 60 || p.x > X1 + 60) {
          p.active = false;
          p.root.visible = false;
        }
      }
    },
  };
}
