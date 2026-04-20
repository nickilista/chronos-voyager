import { Group, Object3D } from 'three';
import { Assets, makeEmissive } from './Assets.ts';
import { ERA_CONTENT } from '../eras/eraContent.ts';
import type { EraId } from '../eras/eras.ts';
import { CORRIDOR_RADIUS, laneX } from './Track.ts';

/**
 * Background scenery — themed monuments flanking the corridor just outside
 * the obstacle lane. Each era reuses the same two monument GLBs that appear
 * as obstacles on track, but at a larger decor-specific scale with tuned
 * emissive glow so they read from a distance.
 *
 * Items are seeded as a symmetric chain around local-Z = 0 (half ahead, half
 * behind) and recycle on both ends as the ship advances, so the scatter is
 * continuous and covers the full visible tube uniformly. This matters for
 * the outside/galaxy-map view where every flow's tube needs a halo of
 * monuments around it, not a tight cluster ahead of the ship's projection.
 */

const POOL_SIZE = 32;
// Lateral ring the decor occupies: a wider band than before so from the
// galaxy map view each flow is ringed by a visible cloud of era scenery,
// not a single narrow line of monuments.
const SIDE_X_MIN = CORRIDOR_RADIUS + 8;
const SIDE_X_MAX = CORRIDOR_RADIUS + 62;
const Y_MIN = -8;
const Y_MAX = 6;
// Axial cadence: tight enough that the decor reads as a continuous halo
// around the corridor at normal play distance.
const MIN_SPACING_Z = 22;
const MAX_SPACING_Z = 32;
// Chain-tail window: when an item drifts past this distance from the ship's
// axial projection it respawns at the opposite end of the chain.
const CHAIN_HALF_LENGTH = (POOL_SIZE / 2) * MAX_SPACING_Z;
const RECYCLE_DIST = CHAIN_HALF_LENGTH + 60;

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

interface DecorItem {
  readonly mesh: Object3D;
  readonly kindIndex: 0 | 1;
}

export class Decorations {
  readonly group = new Group();
  private items: DecorItem[] = [];
  private readonly eraId: EraId;
  /** Axial Z of the tail (most-behind) end of the chain. */
  private tailZ = 0;
  /** Axial Z of the head (most-ahead) end of the chain. */
  private headZ = 0;

  constructor(eraId: EraId) {
    this.eraId = eraId;
  }

  private buildMonument(kindIndex: 0 | 1): DecorItem {
    const spec = ERA_CONTENT[this.eraId].obstacles[kindIndex];
    const group = new Group();
    const model = Assets.clone(spec.name);
    model.scale.setScalar(spec.decorScale);
    // Anchor the base at y=0 so decor stands on the horizon rather than
    // floating mid-air.
    model.position.y = -spec.halfUnit.y * spec.decorScale * 0.5;
    makeEmissive(model, spec.decorEmissive, spec.decorEmissiveI);
    group.add(model);
    return { mesh: group, kindIndex };
  }

  init(): void {
    for (let i = 0; i < POOL_SIZE; i++) {
      // Alternate the two monument kinds: secondary (index 1) every third,
      // primary (index 0) the rest — matches the original mix.
      const kindIndex: 0 | 1 = i % 3 === 0 ? 1 : 0;
      const item = this.buildMonument(kindIndex);
      this.items.push(item);
      this.group.add(item.mesh);
    }
    this.layOutChainAround(0);
  }

  /** Seed the chain symmetrically around the given axial centre. */
  private layOutChainAround(centerZ: number): void {
    const half = Math.floor(this.items.length / 2);
    // Behind half: z increases from centerZ backward (positive Z in local,
    // since ship travels in -Z). Alternate sides per index.
    let z = centerZ;
    for (let i = 0; i < half; i++) {
      z += rand(MIN_SPACING_Z, MAX_SPACING_Z);
      this.placeAt(this.items[i], z, i % 2 === 0 ? -1 : 1);
    }
    this.tailZ = z;
    // Ahead half: z decreases forward.
    z = centerZ;
    for (let i = half; i < this.items.length; i++) {
      z -= rand(MIN_SPACING_Z, MAX_SPACING_Z);
      this.placeAt(this.items[i], z, i % 2 === 0 ? -1 : 1);
    }
    this.headZ = z;
  }

  private placeAt(item: DecorItem, z: number, side: -1 | 1): void {
    const distFromLane = rand(SIDE_X_MIN, SIDE_X_MAX);
    item.mesh.position.set(laneX(z) + side * distFromLane, rand(Y_MIN, Y_MAX), z);
    item.mesh.rotation.y = rand(0, Math.PI * 2);
  }

  /**
   * Recycle: any item that has drifted more than RECYCLE_DIST from the ship's
   * axial position is re-seeded at the opposite end of the chain. Both ends
   * refill so the decor forms a stable window around the ship at all times.
   */
  update(shipZ: number, _dt = 0): void {
    for (const item of this.items) {
      const dz = item.mesh.position.z - shipZ;
      if (dz > RECYCLE_DIST) {
        // Too far behind (z > shipZ by a lot): append ahead of current head.
        this.headZ -= rand(MIN_SPACING_Z, MAX_SPACING_Z);
        this.placeAt(item, this.headZ, Math.random() < 0.5 ? -1 : 1);
      } else if (dz < -RECYCLE_DIST) {
        // Too far ahead: append behind current tail.
        this.tailZ += rand(MIN_SPACING_Z, MAX_SPACING_Z);
        this.placeAt(item, this.tailZ, Math.random() < 0.5 ? -1 : 1);
      }
    }
  }

  /**
   * Reseed the whole chain around the given axial — used on flow entry so
   * the player lands inside a full halo of decorations instead of a gap
   * while the ring buffer catches up.
   */
  recenter(shipZ: number): void {
    this.layOutChainAround(shipZ);
  }
}
