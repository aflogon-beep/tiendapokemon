import * as THREE from 'three';
import { createWorld, createGround } from './world/scene';
import { createIsoCamera } from './world/camera';
import { createLighting } from './world/lighting';
import { PACK_SCALE } from './world/assets';
import { buildTestScene, type TestScene } from './world/testScene';

const canvas = document.getElementById('world') as HTMLCanvasElement;
const debug = document.getElementById('debug') as HTMLDivElement;

const { renderer, scene } = createWorld(canvas);
// Parámetros de depuración: ?view=metros&x=&z= para encuadrar la cámara
const params = new URLSearchParams(location.search);
const num = (k: string, d: number) => Number(params.get(k) ?? d);
const iso = createIsoCamera(num('view', 13));
iso.target.set(num('x', -1.5), 1, num('z', -1));
iso.update();
createLighting(scene);

// ?f0 muestra solo la escena vacía de la Fase 0
const onlyGround = params.has('f0');
let test: TestScene | null = null;
if (onlyGround) scene.add(createGround(), new THREE.GridHelper(20, 20, '#4b5640', '#6b7a5a'));
else
  buildTestScene(scene)
    .then((t) => (test = t))
    .catch((err) => {
      console.error(err);
      debug.textContent = `Error cargando assets: ${String(err)}`;
    });

function resize(): void {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  iso.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

// Bucle de render con contador de FPS
const timer = new THREE.Timer();
timer.connect(document);
let frames = 0, acc = 0;
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.1);
  test?.update(dt);
  renderer.render(scene, iso.camera);
  frames++;
  acc += dt;
  if (acc >= 0.5) {
    const s = PACK_SCALE;
    debug.textContent =
      `${Math.round(frames / acc)} fps · ${renderer.info.render.calls} draw calls\n` +
      `escala market ×${s.market} · characters ×${s.characters} · city ×${s.city}`;
    frames = 0;
    acc = 0;
  }
});
