import * as THREE from 'three';
import { createWorld, createGround } from './world/scene';
import { createIsoCamera, type View } from './world/camera';
import { createLighting, followSun } from './world/lighting';
import { createCamController } from './world/controls';
import { createOccluders } from './world/occluders';
import { buildShop, toWorld } from './world/shop';
import { buildCity, CITY_BOUNDS, FAR_SIDEWALK } from './world/city';
import { createDemo, type Demo } from './world/demo';
import { mountZoomButtons } from './ui/zoomButtons';
import { createShopNav } from './systems/shopNav';
import { FLOOR_T, FRONT_Y, LAY, W } from './systems/layout';

const canvas = document.getElementById('world') as HTMLCanvasElement;
const debug = document.getElementById('debug') as HTMLDivElement;
const params = new URLSearchParams(location.search);
const showDebug = params.has('debug');
debug.hidden = !showDebug;

const { renderer, scene } = createWorld(canvas);
const iso = createIsoCamera();
const sun = createLighting(scene);
const occ = createOccluders();

// Esquinas (en px de la v10) de lo que encuadra cada vista; incluye algo de altura
const box = (x0: number, y0: number, x1: number, y1: number, h: number) =>
  [toWorld(x0, y0), toWorld(x1, y0), toWorld(x0, y1), toWorld(x1, y1)].flatMap((p) => [p, p.clone().setY(h)]);
const SHOP_BOX = box(0, FLOOR_T - 30, W, FRONT_Y + 60, 2.4);
const CITY_BOX = box(-500, FLOOR_T - 200, W + 500, FAR_SIDEWALK.y1, 8);
const CASHIER_BOX = box(LAY.qx - 150, LAY.counter.y - 40, W, LAY.counter.y + LAY.counter.h, 2);
const b0 = toWorld(CITY_BOUNDS.x0 + 400, CITY_BOUNDS.y0 + 200), b1 = toWorld(CITY_BOUNDS.x1 - 400, CITY_BOUNDS.y1 - 200);

// Sin clientes todavía (F3). La automática encuadra la tienda un poco más cerca que «toda la
// tienda» (o la caja si hay cliente delante); en horizontal llena la pantalla como el «cover» de la v10
const hasFront = () => false;
const autoView = (): View => {
  if (hasFront()) return iso.frame(CASHIER_BOX);
  const fit = iso.frame(SHOP_BOX), cover = iso.frame(SHOP_BOX, true);
  return { target: fit.target, size: Math.max(cover.size, fit.size * 0.8) };
};
const presets = {
  auto: autoView,
  fit: (): View => {
    const v = iso.frame(SHOP_BOX);
    return { target: v.target, size: v.size * 1.08 };
  },
  city: (): View => iso.frame(CITY_BOX),
  bounds: { x0: b0.x, z0: b0.z, x1: b1.x, z1: b1.z },
};

function resize(): void {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  iso.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

const cam = createCamController(canvas, iso, presets);
mountZoomButtons(cam);

let demo: Demo | null = null;
if (params.has('f0')) scene.add(createGround(), new THREE.GridHelper(20, 20, '#4b5640', '#6b7a5a'));
else
  Promise.all([buildShop(scene, occ), buildCity(scene, occ)])
    .then(async ([shop]) => {
      demo = await createDemo(scene, createShopNav(), shop.door);
      // Dependienta en reposo tras el mostrador
      const mixer = new THREE.AnimationMixer(shop.cashier.root);
      const idle = shop.cashier.animations.find((c) => c.name === 'idle');
      if (idle) mixer.clipAction(idle).play();
      mixers.push(mixer);
    })
    .catch((err) => {
      console.error(err);
      debug.hidden = false;
      debug.textContent = `Error cargando assets: ${String(err)}`;
    });
const mixers: THREE.AnimationMixer[] = [];

// Bucle de render con contador de FPS (visible con ?debug)
const timer = new THREE.Timer();
timer.connect(document);
let frames = 0, acc = 0;
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.1);
  cam.update(dt);
  occ.setHidden(cam.mode !== 'city');
  occ.update(dt);
  followSun(sun, iso.view.target, iso.view.size);
  demo?.update(dt);
  for (const m of mixers) m.update(dt);
  renderer.render(scene, iso.camera);
  frames++;
  acc += dt;
  if (showDebug && acc >= 0.5) {
    debug.textContent = `${Math.round(frames / acc)} fps · ${renderer.info.render.calls} draw calls · cámara ${cam.mode}`;
    frames = 0;
    acc = 0;
  }
});
