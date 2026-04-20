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
 * ## Modular-loop placement
 *
 * Each decor item owns a canonical `(loopX, loopY, loopZ)` position inside
 * a closed axial loop of length `LOOP_LENGTH`. Every frame the mesh is
 * placed at the loop image of its canonical Z nearest the ship:
 *
 *     wrapK  = round((shipZ - item.loopZ) / LOOP_LENGTH)
 *     mesh.z = item.loopZ + wrapK * LOOP_LENGTH
 *
 * Result: a stable, uniformly-spaced halo of monuments bracketing the ship
 * regardless of entry Z, flight direction, or whether the flow is being
 * observed from inside or from free space on the galaxy map.
 */

// Pool is sized so the decor loop spans thousands of axial units — from
// the galaxy map view each flow's tube reads as endlessly lined with its
// era's monuments. Halved from 96 → 48 because all 10 flows render their
// decor pool simultaneously in free-space view, and ~960 large GLB meshes
// was pushing frame time over budget. 48 per flow still gives a continuous
// halo around each tube with no visible gaps at play speed.
const POOL_SIZE = 48;
// Lateral ring the decor occupies: a wider band so from the galaxy map
// view each flow is ringed by a visible cloud of era scenery, not a
// single narrow line of monuments.
const SIDE_X_MIN = CORRIDOR_RADIUS + 8;
const SIDE_X_MAX = CORRIDOR_RADIUS + 62;
const Y_MIN = -8;
const Y_MAX = 6;
// Axial cadence: ~27 units between monuments.
const NOMINAL_SPACING = 27;
const LOOP_LENGTH = POOL_SIZE * NOMINAL_SPACING;
const HALF_LOOP = LOOP_LENGTH / 2;
const SPACING_JITTER = NOMINAL_SPACING * 0.35;

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

interface DecorItem {
  readonly mesh: Object3D;
  readonly kindIndex: 0 | 1;
  /** Canonical axial position inside the loop. */
  loopZ: number;
  loopX: number;
  loopY: number;
}

export class Decorations {
  readonly group = new Group();
  private items: DecorItem[] = [];
  private readonly eraId: EraId;

  constructor(eraId: EraId) {
    this.eraId = eraId;
  }

  private buildMonument(kindIndex: 0 | 1): Object3D {
    const spec = ERA_CONTENT[this.eraId].obstacles[kindIndex];
    const group = new Group();
    const model = Assets.clone(spec.name);
    model.scale.setScalar(spec.decorScale);
    // Anchor the base at y=0 so decor stands on the horizon rather than
    // floating mid-air.
    model.position.y = -spec.halfUnit.y * spec.decorScale * 0.5;
    makeEmissive(model, spec.decorEmissive, spec.decorEmissiveI);
    group.add(model);
    return group;
  }

  init(): void {
    // Distribute POOL_SIZE monuments evenly across one loop. Sides alternate
    // per index so the halo reads as a symmetric flanking corridor, not a
    // one-sided parade.
    for (let i = 0; i < POOL_SIZE; i++) {
      const kindIndex: 0 | 1 = i % 3 === 0 ? 1 : 0;
      const mesh = this.buildMonument(kindIndex);
      const baseZ = (i + 0.5) * NOMINAL_SPACING - HALF_LOOP;
      const loopZ = baseZ + rand(-SPACING_JITTER, SPACING_JITTER);
      const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
      const distFromLane = rand(SIDE_X_MIN, SIDE_X_MAX);
      const loopX = laneX(loopZ) + side * distFromLane;
      const loopY = rand(Y_MIN, Y_MAX);
      mesh.position.set(loopX, loopY, loopZ);
      mesh.rotation.y = rand(0, Math.PI * 2);
      this.items.push({ mesh, kindIndex, loopZ, loopX, loopY });
      this.group.add(mesh);
    }
  }

  /**
   * Per-frame: place each decor item at the loop image of its canonical Z
   * nearest the ship's axial projection. Pure closed-form — no head/tail
   * cursors, no spawn events, and the halo always brackets the ship.
   */
  update(shipZ: number, _dt = 0): void {
    for (const item of this.items) {
      const wrapK = Math.round((shipZ - item.loopZ) / LOOP_LENGTH);
      item.mesh.position.z = item.loopZ + wrapK * LOOP_LENGTH;
    }
  }

}
