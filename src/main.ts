import * as THREE from 'three';
import { createWorld, createGround } from './world/scene';
import { createIsoCamera, type View } from './world/camera';
import { createLighting, followSun } from './world/lighting';
import { createCamController } from './world/controls';
import { createOccluders } from './world/occluders';
import { buildShop, toPx, toWorld } from './world/shop';
import { buildCity, CITY_BOUNDS, FAR_SIDEWALK } from './world/city';
import { createCharacters, type Characters } from './world/characters';
import { cycleCamera, mountZoomButtons } from './ui/zoomButtons';
import { toast } from './ui/toast';
import { hideLoading, loadingText, askOfflineWithRealSave } from './ui/loading';
import { hud, showHud, tickMoney } from './ui/hud';
import { drawBubbles } from './ui/bubbles';
import { bindImportFile } from './ui/modals/backup';
import './ui/modals/packs';
import './ui/modals/coll';
import { moreHooks } from './ui/modals/more';
import './ui/modals/album';
import './ui/modals/tasks';
import { openM, ui } from './ui/ctx';
import './ui/modals/summary';
import { openCustomer } from './ui/modals/cust';
import { paintNav } from './ui/nav';
import { serveFront } from './ui/serve';
import { tutTick } from './ui/tutorial';
import { sfx } from './ui/sound';
import { FLOOR_T, FRONT_Y, LAY, W } from './systems/layout';
import { front, type Customer } from './systems/customers';
import { openShop } from './systems/day';
import { boot } from './core/boot';
import { createGame, newGame } from './core/setup';
import { loadSaved } from './core/save';
import { createLoop, type Loop } from './core/loop';
import { stockForTest } from './core/sandbox';
import type { Game, GameFx } from './core/game';
import { FAILED } from './data/cards';

const canvas = document.getElementById('world') as HTMLCanvasElement;
const debug = document.getElementById('debug') as HTMLDivElement;
const params = new URLSearchParams(location.search);
const showDebug = params.has('debug');
const testMode = params.has('prueba');
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
const CASHIER_BOX = box(LAY.qx - 260, LAY.counter.y - 60, W, LAY.counter.y + LAY.counter.h + 40, 2);
const b0 = toWorld(CITY_BOUNDS.x0 + 400, CITY_BOUNDS.y0 + 200), b1 = toWorld(CITY_BOUNDS.x1 - 400, CITY_BOUNDS.y1 - 200);

let game: Game | null = null;

// Cámara automática: la tienda, o la caja cuando hay alguien esperando (camFollow de la v10)
const autoView = (): View => {
  if (game && front(game)) return iso.frame(CASHIER_BOX);
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

// La cámara encuadra el hueco entre la cabecera y el panel de abajo
function fitInsets(): void {
  const hudEl = document.getElementById('hud')!, dock = document.getElementById('dock')!, nav = document.getElementById('nav')!;
  // El panel de ayuda y el botón principal van justo encima de la barra inferior
  document.documentElement.style.setProperty('--navh', (nav.hidden ? 0 : nav.offsetHeight) + 'px');
  document.documentElement.style.setProperty('--hudh', (hudEl.hidden ? 0 : hudEl.offsetHeight) + 'px');
  iso.setInsets(hudEl.hidden ? 0 : hudEl.offsetHeight, dock.hidden ? 0 : window.innerHeight - dock.getBoundingClientRect().top);
}
const insetObserver = new ResizeObserver(fitInsets);
for (const id of ['hud', 'dock', 'nav']) insetObserver.observe(document.getElementById(id)!);
window.addEventListener('resize', resize);
resize();

const cam = createCamController(canvas, iso, presets);
mountZoomButtons(cam);
moreHooks.zfit = () => cycleCamera(cam);

/* ---------- partida ---------- */

let loop: Loop | null = null;
let chars: Characters | null = null;
let note = '';

const fx: GameFx = {
  toast,
  sound: (s) => sfx[s](),
  hearts: () => {},
  coins: () => {},
  shake: () => {},
  daySummary: () => {
    loop?.saveNow();
    refreshHud();
    openM('sum');
  },
};

const refreshHud = () => game && hud(game, note);

function onAct(): void {
  const g = game;
  if (!g) return;
  if (g.paused) {
    g.paused = false;
    refreshHud();
    return;
  }
  if (front(g)) return serveFront(g);
  if (g.S.phase === 'closed') {
    openShop(g);
    refreshHud();
  }
}
document.getElementById('act')!.addEventListener('click', onAct);

bindImportFile();

// Tocar al cliente que espera en la caja también le atiende (tapWorld de la v10)
cam.onTap = (ground) => {
  const g = game;
  if (!g) return;
  const p = toPx(ground), f = front(g);
  if (f && Math.hypot(p.x - f.x, p.y - f.y) < 40) return serveFront(g);
  // Si no, la ficha del cliente más cercano al dedo
  let best: Customer | null = null, bd = 30;
  for (const c of g.custs) {
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  if (best && !ui.M) openCustomer(best);
};

async function start(): Promise<void> {
  const [cards, shop] = await Promise.all([
    boot({ progress: loadingText, askOffline: askOfflineWithRealSave }),
    buildShop(scene, occ),
    buildCity(scene, occ),
  ]);
  note = cards.note;
  const saved = testMode ? null : loadSaved(cards.mode);
  const g = saved ? createGame(saved.S, cards.db, cards.mode, fx) : newGame(cards.db, cards.mode, fx);
  if (testMode) stockForTest(g);
  // Velocidad del juego (1×, 2× o 4× como en la v10; el botón llega en la F4)
  const vel = Number(params.get('vel'));
  if ([1, 2, 4].includes(vel)) g.speed = vel;
  game = g;
  ui.g = g;
  ui.note = note;
  ui.hud = () => void refreshHud();
  chars = await createCharacters(scene);
  // Dependienta en reposo tras el mostrador
  const mixer = new THREE.AnimationMixer(shop.cashier.root);
  const idle = shop.cashier.animations.find((c) => c.name === 'idle');
  if (idle) mixer.clipAction(idle).play();
  mixers.push(mixer);

  loop = createLoop(g, { save: !testMode, onHud: refreshHud, onSaveFail: () => toast('⚠️ No se pudo guardar. Exporta una copia en Más → Partida') });
  ui.saveNow = () => loop!.saveNow();
  loop.saveNow();
  hideLoading();
  showHud();
  paintNav();
  refreshHud();
  fitInsets();
  if (saved?.from === 'v10') toast('✅ Partida de la versión anterior cargada');
  if (testMode) toast('🧪 Modo prueba: tienda llena y sin guardar');
  if (FAILED.size) setTimeout(() => toast(`⚠️ ${FAILED.size} colección(es) no cargaron. Reinténtalo en Más → Colecciones`), 800);
}

const mixers: THREE.AnimationMixer[] = [];
if (params.has('f0')) {
  scene.add(createGround(), new THREE.GridHelper(20, 20, '#4b5640', '#6b7a5a'));
  hideLoading();
} else
  start().catch((err) => {
    console.error(err);
    loadingText(`Error al arrancar: ${String(err)}`);
  });

/* ---------- render ---------- */

const timer = new THREE.Timer();
timer.connect(document);
let frames = 0, acc = 0;
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const real = timer.getDelta();
  const raw = Math.min(real, 0.1);
  if (game && loop) {
    const halted = game.paused || !!ui.M;
    if (!ui.M) loop.frame(raw);
    tickMoney(game, raw);
    const dt = halted ? 0 : raw * game.speed;
    chars?.update(game, dt);
    if (chars) drawBubbles(game, chars.heads(iso.camera, canvas.clientWidth, canvas.clientHeight));
    tutTick();
  }
  cam.update(raw);
  occ.setHidden(cam.mode !== 'city');
  occ.update(raw);
  followSun(sun, iso.view.target, iso.view.size);
  for (const m of mixers) m.update(raw);
  renderer.render(scene, iso.camera);
  frames++;
  acc += real;
  if (showDebug && acc >= 0.5) {
    debug.textContent = `${Math.round(frames / acc)} fps · ${renderer.info.render.calls} draw calls · cámara ${cam.mode}`;
    frames = 0;
    acc = 0;
  }
});
