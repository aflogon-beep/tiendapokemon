import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type Pack = 'market' | 'city' | 'characters';

/**
 * Factor de escala por pack: unidades del pack → metros (1 unidad Three.js = 1 m).
 * Se fijan en la F1 y no se tocan después sin motivo (ver docs/assets.md).
 */
export const PACK_SCALE: Record<Pack, number> = {
  market: 2.4, // rejilla de 1 unidad → baldosas y paredes de 2,4 m
  city: 7.5,
  characters: 2.4, // misma serie que Mini Market
};

const BASE = `${import.meta.env.BASE_URL}assets/kenney/`;
const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();

export function assetUrl(pack: Pack, name: string): string {
  return `${BASE}${pack}/${name}.glb`;
}

// Carga (una sola vez por archivo) y prepara sombras
function loadGltf(pack: Pack, name: string): Promise<GLTF> {
  const url = assetUrl(pack, name);
  let p = cache.get(url);
  if (!p) {
    p = loader.loadAsync(url).then((gltf) => {
      gltf.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      return gltf;
    });
    cache.set(url, p);
  }
  return p;
}

export interface Placement {
  x: number;
  z: number;
  rotY?: number;
  y?: number;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Muchas copias de un modelo estático (baldosas, paredes…) con InstancedMesh:
 * una llamada de dibujo por malla del modelo en lugar de una por copia.
 */
export async function spawnInstanced(pack: Pack, name: string, places: Placement[]): Promise<THREE.Group> {
  const gltf = await loadGltf(pack, name);
  const group = new THREE.Group();
  group.name = `${pack}/${name}×${places.length}`;
  gltf.scene.updateMatrixWorld(true);
  const scale = PACK_SCALE[pack];
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, places.length);
    inst.castShadow = mesh.castShadow;
    inst.receiveShadow = mesh.receiveShadow;
    places.forEach((p, i) => {
      tmpQ.setFromAxisAngle(UP, p.rotY ?? 0);
      tmpM.compose(tmpP.set(p.x, p.y ?? 0, p.z), tmpQ, tmpS.setScalar(scale));
      inst.setMatrixAt(i, tmpM.multiply(mesh.matrixWorld));
    });
    inst.computeBoundingSphere();
    group.add(inst);
  });
  return group;
}

export interface ModelInstance {
  root: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

/** Devuelve una copia del modelo ya escalada a metros (geometría y materiales compartidos). */
export async function spawnModel(pack: Pack, name: string): Promise<ModelInstance> {
  return instantiate(pack, name, await loadGltf(pack, name));
}

const loaded = new Map<string, GLTF>();

/** Carga varios modelos para poder copiarlos después sin esperar (spawnLoaded) */
export async function preload(pack: Pack, names: string[]): Promise<void> {
  await Promise.all(names.map((n) => loadGltf(pack, n).then((g) => loaded.set(assetUrl(pack, n), g))));
}

export function spawnLoaded(pack: Pack, name: string): ModelInstance {
  const gltf = loaded.get(assetUrl(pack, name));
  if (!gltf) throw new Error(`Modelo sin precargar: ${pack}/${name}`);
  return instantiate(pack, name, gltf);
}

function instantiate(pack: Pack, name: string, gltf: GLTF): ModelInstance {
  const skinned = gltf.animations.length > 0;
  const model = skinned ? cloneSkinned(gltf.scene) : gltf.scene.clone(true);
  // Envoltorio: la escala del pack va aquí y el modelo conserva la suya
  const root = new THREE.Group();
  root.name = `${pack}/${name}`;
  root.scale.setScalar(PACK_SCALE[pack]);
  root.add(model);
  return { root, animations: gltf.animations };
}
