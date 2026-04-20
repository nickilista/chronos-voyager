import {
  Box3,
  Euler,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { ShipClass, ShipConfig, ShipSlot } from './shipTypes.ts';

/**
 * Builds a visually-assembled spaceship `Group` from a 10-slot composition.
 *
 * Parts load once per `(class, slot)` pair from `/models/ships/…` and are
 * cached on disk-fetch. Every time we assemble a ship (builder preview +
 * actual gameplay ship) we deep-clone the cached scenes so each assembly
 * keeps an independent transform graph.
 *
 * ## Axis convention
 *
 * The AI-authored GLB parts all share the same local-frame convention
 * (confirmed by inspecting bounds across falcon/titan/viper/etc):
 *   • +X = forward (nose/barrel/thrust axis, or root→tip for wings)
 *   • +Y = side (chord for wings, minor axis for hull)
 *   • +Z = up (thickness for wings, height for hull)
 * …except the `tail` slot, which is authored with +Z as its long axis
 * (so it reads as a vertical stabiliser when the +Z becomes world-up).
 *
 * The game expects ships oriented in three.js convention: nose along -Z,
 * up +Y, right +X. To reconcile we pre-rotate each part inside its slot
 * wrapper so that, after the rotation, the mesh's forward axis lines up
 * with the layout's -Z, and its thickness axis points at world +Y.
 *
 * After that, positions in `SLOT_RIGS` are finally in the expected
 * three.js convention (-Z forward, +Y up, +X right) and layouts read
 * like a proper fighter silhouette: nose forward, wings out the sides,
 * engines in the back, tail fin on top of the aft.
 */

interface SlotRig {
  /** Position in assembly-local space. -Z is forward, +Y is up. */
  position: Vector3;
  /** Intrinsic rotation applied to the part mesh to reconcile mesh-local
   *  authoring axes with assembly-local axes (see module docstring). */
  rotation: Euler;
  /** Optional mirror along X — used to reuse a left-side mesh as a right. */
  mirrorX?: boolean;
  /** Uniform scale applied to the mesh after rotation. */
  scale: number;
}

// Shared pre-rotations. Keep as single Euler instances so multiple SLOT_RIGS
// entries share them — three.js clones the transform into a child Group per
// instance so there's no aliasing problem at runtime.
/** Turns the mesh so its +X (authored forward) becomes assembly -Z. */
const ROT_FORWARD = new Euler(0, Math.PI / 2, 0, 'XYZ');
/** Turns wing-style parts so span stays on X, chord (mesh Y) runs forward/
 *  back (-Z), and thickness (mesh Z) points up. */
const ROT_WING = new Euler(-Math.PI / 2, 0, 0, 'XYZ');
/** Turns the tail so its long axis (mesh Z = 1.89u) stands vertically. */
const ROT_TAIL = new Euler(-Math.PI / 2, 0, 0, 'XYZ');
/** Shields are near-spherical; keep them upright without reorientation. */
const ROT_IDENT = new Euler(0, 0, 0, 'XYZ');

const SLOT_RIGS: Record<ShipSlot, SlotRig> = {
  // Core body at origin. Long axis becomes Z after ROT_FORWARD.
  hull: {
    position: new Vector3(0, 0, 0),
    rotation: ROT_FORWARD,
    scale: 1.0,
  },
  // Canopy sits on top of the hull's forward half. Small scale so it
  // reads as a bubble on the hull, not a second fuselage.
  cockpit: {
    position: new Vector3(0, 0.3, -0.25),
    rotation: ROT_FORWARD,
    scale: 0.45,
  },
  // Wings flank the hull. Pushed out past the hull's lateral bounds (~0.5)
  // so the silhouette reads as "hull + wings", not overlapping blobs.
  // Scale trimmed so each wing is roughly as long as the hull's chord.
  wing_L: {
    position: new Vector3(-1.1, -0.05, 0.1),
    rotation: ROT_WING,
    scale: 0.85,
  },
  // Right wing reuses the left mesh, mirrored across YZ so any asymmetric
  // details (hardpoints, markings) read as a proper pair.
  wing_R: {
    position: new Vector3(1.1, -0.05, 0.1),
    rotation: ROT_WING,
    mirrorX: true,
    scale: 0.85,
  },
  // Main thruster at the back. ROT_FORWARD puts its nozzle pointing +Z.
  engine_main: {
    position: new Vector3(0, -0.02, 1.0),
    rotation: ROT_FORWARD,
    scale: 0.65,
  },
  // Aux thruster tucked below & slightly ahead of the main engine.
  engine_aux: {
    position: new Vector3(0, -0.32, 0.75),
    rotation: ROT_FORWARD,
    scale: 0.45,
  },
  // Primary weapon nose-mounted. Its barrel sticks out in front of the hull.
  weapon_primary: {
    position: new Vector3(0, 0.1, -1.15),
    rotation: ROT_FORWARD,
    scale: 0.5,
  },
  // Secondary weapon under-slung, midships.
  weapon_secondary: {
    position: new Vector3(0, -0.3, -0.4),
    rotation: ROT_FORWARD,
    scale: 0.38,
  },
  // Shield wraps the hull — translucent bubble, scaled up so it reads
  // outside the solid body.
  shield: {
    position: new Vector3(0, 0, 0),
    rotation: ROT_IDENT,
    scale: 1.25,
  },
  // Tail fin: vertical stabiliser above the aft hull.
  tail: {
    position: new Vector3(0, 0.4, 0.6),
    rotation: ROT_TAIL,
    scale: 0.45,
  },
};

const loader = new GLTFLoader();

/** `{class}_{slot}` → loaded (un-cloned) root Group. */
const partCache = new Map<string, Promise<Group>>();

function partKey(cls: ShipClass, slot: ShipSlot): string {
  return `${cls}_${slot}`;
}

function partUrl(cls: ShipClass, slot: ShipSlot): string {
  return `/models/ships/${cls}/${cls}_${slot}.glb`;
}

function loadPart(cls: ShipClass, slot: ShipSlot): Promise<Group> {
  const k = partKey(cls, slot);
  let p = partCache.get(k);
  if (!p) {
    p = loader
      .loadAsync(partUrl(cls, slot))
      .then((gltf) => gltf.scene as unknown as Group);
    partCache.set(k, p);
  }
  return p;
}

/**
 * Soften the shield mesh — half-transparent, additive, so it reads as an
 * energy field around the hull rather than an opaque bubble.
 */
function makeShieldEthereal(group: Group): void {
  group.traverse((obj) => {
    const m = obj as Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as MeshStandardMaterial).clone();
    mat.transparent = true;
    mat.opacity = 0.10;
    mat.depthWrite = false;
    if ('emissiveIntensity' in mat) mat.emissiveIntensity = 0.8;
    m.material = mat;
  });
}

export interface AssembledShip {
  readonly group: Group;
  /** Per-slot sub-groups, in case callers want to light/animate individual parts. */
  readonly slots: Record<ShipSlot, Group>;
}

/**
 * Place a loaded part mesh under a fresh wrapper Group, applying the slot's
 * position + intrinsic rotation + scale + optional mirror. We wrap rather
 * than stamping transforms on the cloned mesh directly so negative scale
 * (mirror) doesn't compound when the same cached part is re-cloned later.
 */
function mountPart(loaded: Group, rig: SlotRig): Group {
  const wrapper = new Group();
  wrapper.position.copy(rig.position);

  // Inner group: hosts the intrinsic rotation so the mesh's authored +X
  // becomes the assembly's -Z (forward), etc. Kept separate from the
  // wrapper's position-only transform for clarity.
  const inner = new Group();
  inner.rotation.copy(rig.rotation);
  inner.scale.setScalar(rig.scale);
  if (rig.mirrorX) {
    // Mirror by flipping the inner X scale. Three.js will flip normals on
    // the rendered mesh — that's fine; the shield swap uses its own clone
    // and nothing else reads normals downstream.
    inner.scale.x *= -1;
  }

  const mesh = loaded.clone(true);
  inner.add(mesh);
  wrapper.add(inner);
  return wrapper;
}

/**
 * Build a fully-assembled ship as a single three.js Group.
 *
 * Returns synchronously-resolvable metadata after all 10 GLBs have loaded.
 * The resulting group is centered so (0,0,0) sits at the visual middle of
 * the hull — callers can treat the group like a canonical ship mesh and
 * apply follow-cameras, physics, etc., without extra offsets.
 */
export async function assembleShip(config: ShipConfig): Promise<AssembledShip> {
  const slotNames = Object.keys(SLOT_RIGS) as ShipSlot[];
  const loaded = await Promise.all(
    slotNames.map((slot) => loadPart(config[slot], slot)),
  );

  const root = new Group();
  const slots = {} as Record<ShipSlot, Group>;

  for (let i = 0; i < slotNames.length; i++) {
    const slot = slotNames[i];
    const rig = SLOT_RIGS[slot];
    const mounted = mountPart(loaded[i], rig);
    if (slot === 'shield') makeShieldEthereal(mounted);
    root.add(mounted);
    slots[slot] = mounted;
  }

  // Re-centre the assembled ship so its visual mass sits at the origin,
  // no matter which class contributes which part. Without this, chunkier
  // engines or oversized hulls can visibly pull the ship off-axis in the
  // builder preview.
  recenter(root);

  return { group: root, slots };
}

/**
 * Shift each direct child of `root` so the assembled AABB center lands at
 * the root's local origin. We mutate child offsets (not `root.position`)
 * so callers that later place the ship via `group.position.set(...)` still
 * get a cleanly-centered mesh with no surprise offset.
 */
function recenter(root: Group): void {
  const box = new Box3().setFromObject(root);
  if (!isFinite(box.min.x)) return; // empty group
  const center = new Vector3();
  box.getCenter(center);
  for (const child of root.children) {
    child.position.sub(center);
  }
}

/**
 * Eagerly prefetch a single config so `assembleShip` resolves instantly when
 * the user clicks Launch.
 */
export function prefetchConfig(config: ShipConfig): Promise<Group[]> {
  const slotNames = Object.keys(SLOT_RIGS) as ShipSlot[];
  return Promise.all(slotNames.map((slot) => loadPart(config[slot], slot)));
}
