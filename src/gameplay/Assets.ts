import {
  BoxGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

/**
 * Central GLB asset store. Loads every per-era model once at startup and
 * hands out deep clones to the gameplay systems that need independent
 * transforms per instance (obstacles, decorations, collectibles, ship).
 *
 * Per-era content lives in `src/eras/eraContent.ts`; this file just owns
 * the cache / loader.
 */

export const MODEL_NAMES = [
  'ship',
  'pyramid',
  'obelisk',
  'ankh',
  'greece_column',
  'greece_temple',
  'greece_laurel',
  'china_lantern',
  'china_pagoda',
  'china_coin',
  'islamic_dome',
  'islamic_minaret',
  'islamic_star',
  'india_stupa',
  'india_shikhara',
  'india_lotus',
  'renaissance_column',
  'renaissance_dome',
  'renaissance_armillary',
  'edo_lantern',
  'edo_torii',
  'edo_sakura',
  'enlightenment_books',
  'enlightenment_observatory',
  'enlightenment_quill',
  'revolution_gears',
  'revolution_chimney',
  'revolution_cog',
  'codebreakers_terminal',
  'codebreakers_mainframe',
  'codebreakers_binary',
  // Propulsion-flame trails. Shipped as two tiny (~8KB) cone GLBs so the
  // Thruster can clone them per-ship and tint them with the engine palette
  // rather than build ConeGeometry in code. Stored under /models/effects/
  // to keep the root /models/ directory focused on era-content pieces.
  'engine_trail',
  'engine_trail_core',
] as const;

export type ModelName = (typeof MODEL_NAMES)[number];

/**
 * Models that live under /models/effects/<name>.glb rather than the flat
 * /models/<name>.glb path. Segregated so era-content pieces don't pollute
 * the effects directory and vice-versa.
 */
const EFFECT_MODELS: ReadonlySet<ModelName> = new Set<ModelName>([
  'engine_trail',
  'engine_trail_core',
]);

function modelUrl(name: ModelName): string {
  return EFFECT_MODELS.has(name) ? `/models/effects/${name}.glb` : `/models/${name}.glb`;
}

const models = new Map<ModelName, Group>();
let envHDR: DataTexture | null = null;

export async function preloadAssets(): Promise<void> {
  if (envHDR) return;
  const loader = new GLTFLoader();
  const rgbe = new RGBELoader();
  const fetchScene = (url: string) =>
    loader.loadAsync(url).then((g) => g.scene as unknown as Group);
  // 'ankh' is built procedurally — don't fetch the legacy key-shaped GLB.
  const toFetch = MODEL_NAMES.filter((n) => n !== 'ankh');
  const modelPromises = toFetch.map((n) => fetchScene(modelUrl(n)));
  const [modelResults, hdr] = await Promise.all([
    Promise.all(modelPromises),
    rgbe.loadAsync('/hdri/desert_1k.hdr'),
  ]);
  toFetch.forEach((n, i) => models.set(n, modelResults[i]));
  envHDR = hdr;
}

export function getEnvHDR(): DataTexture {
  if (!envHDR) throw new Error('Assets.envHDR not loaded — call preloadAssets() first');
  return envHDR;
}

/**
 * Procedural ankh. The original ankh.glb was a leftover key model from early
 * prototyping — visually a household key, not the Egyptian talisman it's
 * supposed to be. Rather than regenerating the GLB we build the ankh here
 * from primitives: a torus loop on top, a short horizontal crossbar, and a
 * vertical shaft — all wrapped in a single material so `makeEmissive` can
 * tint it consistently.
 */
function buildAnkh(): Group {
  const mat = new MeshStandardMaterial({
    color: 0xe6b94b,
    metalness: 0.75,
    roughness: 0.25,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });
  const group = new Group();

  const loop = new Mesh(new TorusGeometry(0.32, 0.09, 16, 40), mat);
  loop.position.y = 0.48;
  group.add(loop);

  const crossbar = new Mesh(new BoxGeometry(0.9, 0.14, 0.16), mat);
  crossbar.position.y = 0.05;
  group.add(crossbar);

  const shaft = new Mesh(new BoxGeometry(0.18, 0.9, 0.16), mat);
  shaft.position.y = -0.35;
  group.add(shaft);

  return group;
}

function cloneByName(name: ModelName): Group {
  if (name === 'ankh') return buildAnkh();
  const m = models.get(name);
  if (!m) throw new Error(`Assets model "${name}" not loaded — call preloadAssets() first`);
  return m.clone(true);
}

export const Assets = {
  cloneShip: (): Group => cloneByName('ship'),
  clonePyramid: (): Group => cloneByName('pyramid'),
  cloneObelisk: (): Group => cloneByName('obelisk'),
  cloneAnkh: (): Group => cloneByName('ankh'),
  clone: (name: ModelName): Group => cloneByName(name),
};

/**
 * Boost emissive on all StandardMaterials inside a cloned scene so bloom picks
 * it up. Three.js `Object3D.clone(true)` deep-clones the node graph but keeps
 * material references shared — so without cloning the material here, every
 * call would stomp on every other consumer's emissive (decor vs. obstacle,
 * era vs. era). We clone the material per mesh so each monument instance
 * owns its own look.
 */
export function makeEmissive(root: Group, hex: number, intensity = 1.2): Group {
  root.traverse((obj) => {
    const m = obj as Mesh;
    if (!m.isMesh) return;
    if (Array.isArray(m.material)) {
      m.material = m.material.map((mat) => {
        const clone = (mat as MeshStandardMaterial).clone();
        if ('emissive' in clone) {
          clone.emissive.setHex(hex);
          clone.emissiveIntensity = intensity;
          clone.needsUpdate = true;
        }
        return clone;
      });
      return;
    }
    const mat = m.material as MeshStandardMaterial;
    if (!mat || !('emissive' in mat)) return;
    const clone = mat.clone();
    clone.emissive.setHex(hex);
    clone.emissiveIntensity = intensity;
    clone.needsUpdate = true;
    m.material = clone;
  });
  return root;
}
