import * as THREE from 'three';

/*
 * Muebles que no traen los packs, con geometría propia sencilla al estilo low-poly de Kenney.
 * Colores de la v10 (nivel de tienda 0). Medidas en metros; origen en el centro de la huella.
 */

const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });

const M = {
  wood: mat('#8a5a33'),
  woodDark: mat('#5c3b20'),
  base: mat('#3b3f4a'),
  felt: mat('#d6e9f0'),
  glass: mat('#cfe6ef', { transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.1, depthWrite: false }),
  edge: mat('#7fe3ff', { emissive: '#3fb6d9', emissiveIntensity: 0.6 }),
  screen: mat('#0d2b1b', { emissive: '#1f7a4a', emissiveIntensity: 0.5 }),
  dark: mat('#222222'),
};

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  return mesh;
}

/** Vitrina de cartas: mueble bajo con tapa de cristal y tira de luz */
export function buildCase(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'vitrina';
  const h = 0.85;
  g.add(box(w, h, d, M.base));
  g.add(box(w - 0.08, 0.02, d - 0.08, M.felt, 0, h, 0, false));
  g.add(box(w, 0.04, 0.04, M.edge, 0, h - 0.12, d / 2 + 0.02, false));
  g.add(box(w, 0.25, d, M.glass, 0, h, 0, false));
  return g;
}

/** Mesa de sellado y accesorios */
export function buildProdTable(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'mesa-sellado';
  g.add(box(w, 0.8, d, M.woodDark));
  g.add(box(w + 0.06, 0.06, d + 0.06, M.wood, 0, 0.8, 0));
  return g;
}

/** Mesa del fondo con el monitor de precios */
export function buildDesk(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'mesa-fondo';
  g.add(box(w, 0.72, d, M.wood));
  g.add(box(0.06, 0.2, 0.06, M.dark, 0, 0.72, -d / 4));
  g.add(box(0.9, 0.55, 0.05, M.dark, 0, 0.9, -d / 4));
  g.add(box(0.8, 0.45, 0.01, M.screen, 0, 0.95, -d / 4 + 0.03, false));
  return g;
}
