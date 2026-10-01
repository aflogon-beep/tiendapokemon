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

export interface ModelInstance {
  root: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

/** Devuelve una copia del modelo ya escalada a metros (geometría y materiales compartidos). */
export async function spawnModel(pack: Pack, name: string): Promise<ModelInstance> {
  const gltf = await loadGltf(pack, name);
  const skinned = gltf.animations.length > 0;
  const model = skinned ? cloneSkinned(gltf.scene) : gltf.scene.clone(true);
  // Envoltorio: la escala del pack va aquí y el modelo conserva la suya
  const root = new THREE.Group();
  root.name = `${pack}/${name}`;
  root.scale.setScalar(PACK_SCALE[pack]);
  root.add(model);
  return { root, animations: gltf.animations };
}
