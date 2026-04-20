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
import { ERA_CONTENT } from '../eras/eraContent.ts';
import type { EraId } from '../eras/eras.ts';

/**
 * Central GLB asset store. Lazy-loads per-era models on demand and hands
 * out deep clones to the gameplay systems that need independent transforms
 * per instance (obstacles, decorations, collectibles, ship).
 *
 * At boot only the HDRI environment map, Egypt models (pyramid, obelisk),
 * and engine-trail effects are fetched (~6 MB). Other eras are loaded when
 * the player approaches them, cutting the initial download from ~64 MB.
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

/** Shared loader instance — reused across preload and lazy-load calls. */
const gltfLoader = new GLTFLoader();

function fetchScene(url: string): Promise<Group> {
  return gltfLoader.loadAsync(url).then((g) => g.scene as unknown as Group);
}

/**
 * Boot-time preload: HDRI + Egypt era models + engine trail effects.
 * This is all the player needs to start playing (~6 MB). Other eras are
 * loaded lazily via `loadEraModels()`.
 */
export async function preloadAssets(): Promise<void> {
  if (envHDR) return;
  const rgbe = new RGBELoader();
  // Only load Egypt + effects at boot. 'ankh' is procedural.
  const bootModels: ModelName[] = [
    'pyramid',
    'obelisk',
    'engine_trail',
    'engine_trail_core',
  ];
  const modelPromises = bootModels.map((n) => fetchScene(modelUrl(n)));
  const [modelResults, hdr] = await Promise.all([
    Promise.all(modelPromises),
    rgbe.loadAsync('/hdri/desert_1k.hdr'),
  ]);
  bootModels.forEach((n, i) => models.set(n, modelResults[i]));
  envHDR = hdr;
}

/**
 * In-flight loading promises keyed by era. Prevents duplicate fetches when
 * `loadEraModels` is called multiple times for the same era concurrently.
 */
const eraLoadPromises = new Map<EraId, Promise<void>>();

/**
 * Load the 2-3 GLB models required by a specific era. No-op if the models
 * are already cached. Safe to call concurrently — duplicate fetches are
 * deduplicated.
 */
export async function loadEraModels(eraId: EraId): Promise<void> {
  // Collect the model names this era needs.
  const content = ERA_CONTENT[eraId];
  const needed: ModelName[] = [];
  for (const obs of content.obstacles) {
    if (obs.name !== 'ankh' && !models.has(obs.name)) needed.push(obs.name);
  }
  if (content.collectible.name !== 'ankh' && !models.has(content.collectible.name)) {
    needed.push(content.collectible.name);
  }
  if (needed.length === 0) return;

  // Deduplicate concurrent calls for the same era.
  if (eraLoadPromises.has(eraId)) {
    return eraLoadPromises.get(eraId)!;
  }

  const promise = (async () => {
    const results = await Promise.all(needed.map((n) => fetchScene(modelUrl(n))));
    needed.forEach((n, i) => models.set(n, results[i]));
  })();
  eraLoadPromises.set(eraId, promise);
  await promise;
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
  if (!m) {
    // Model not yet loaded — return a tiny placeholder box so callers don't
    // crash. This path should only fire if `loadEraModels()` wasn't awaited
    // before building meshes; the placeholder is intentionally visible (pink)
    // so it's obvious in dev builds.
    // eslint-disable-next-line no-console
    console.warn(`Assets.clone("${name}"): model not loaded yet, returning placeholder`);
    const placeholder = new Group();
    placeholder.add(
      new Mesh(
        new BoxGeometry(0.5, 0.5, 0.5),
        new MeshStandardMaterial({ color: 0xff00ff }),
      ),
    );
    return placeholder;
  }
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
