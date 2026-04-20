import { Group, Vector3 } from 'three';
import type { Obstacle, ObstacleFactory } from './obstacles/types.ts';

/**
 * Obstacle pool / ring buffer along a straight corridor.
 *
 * Corridor geometry: at any z the lane center is `laneX(z)` (currently a
 * straight column). Obstacles sit *around* that center with a random offset
 * inside ±LANE_HALF_X / ±LANE_HALF_Y, so the player can maneuver inside the
 * lane without grazing walls.
 *
 * ## Modular-loop placement
 *
 * Each obstacle owns fixed canonical (x, y, z) coords inside a closed
 * axial loop of length `LOOP_LENGTH`. Every frame (when not being
 * impulsed by a crash) the obstacle is placed at the loop image of its
 * canonical Z nearest the ship's projection:
 *
 *     wrapK    = round((shipZ - ob.loopZ) / LOOP_LENGTH)
 *     mesh.z   = ob.loopZ + wrapK * LOOP_LENGTH
 *
 * This gives a stable, uniformly-spaced window of obstacles that always
 * brackets the ship on both sides regardless of entry Z, flight direction,
 * or whether the flow is being viewed from inside or from free space.
 *
 * Post-crash: when the ship impacts an obstacle, we let physics drive
 * the mesh freely for `impulseRemaining` seconds. Afterwards we mark
 * the obstacle as "settled" at the current wrap iteration and keep it
 * there until the ship advances to a new loop iteration — at which
 * point we snap it back to its canonical spot in the fresh iteration.
 * The result reads as the wreckage being left behind naturally rather
 * than teleporting on top of the player.
 */

const POOL_SIZE = 200;
/** Core lane half-width — obstacles here sit right in the player's main
 *  flight path. Widened slightly from 16.8 so the core corridor has a
 *  touch more room to dodge and a denser central pack of obstacles. */
export const LANE_HALF_X = 19;
export const LANE_HALF_Y = 10;
// Circular corridor boundary: the cylindrical membrane the player must
// cross to leave the Egyptian world. Lateral decorations and the flow
// haze sit just outside this radius, so from inside the obstacle lane
// you cannot see the boundary at all.
export const CORRIDOR_RADIUS = 50;
/** Flanking band: obstacles beyond the core lane fill the sides of the
 *  corridor so the player sees obstacles rushing past in their peripheral
 *  vision, not just straight ahead. Well inside CORRIDOR_RADIUS = 50 so
 *  they never overlap the outer boundary glow. */
const LANE_FLANK_MIN = LANE_HALF_X;
const LANE_FLANK_MAX = 34;
/** Fraction of the pool that lives in the flanking band. The rest stays
 *  in the core lane so gameplay difficulty is still driven by the central
 *  column. 0.30 = roughly 60 of the 200 obstacles go out to the flanks. */
const FLANK_FRACTION = 0.30;
// Tighter axial cadence than the 16-unit baseline so the corridor reads as
// a proper gauntlet at the new, higher ship speeds instead of an empty tube.
const NOMINAL_SPACING = 13.0;
/** Length of one axial loop. POOL_SIZE obstacles at NOMINAL_SPACING ≈ 2240 u. */
const LOOP_LENGTH = POOL_SIZE * NOMINAL_SPACING;
const HALF_LOOP = LOOP_LENGTH / 2;
/** Per-obstacle jitter so the loop doesn't read as perfectly metered. */
const SPACING_JITTER = NOMINAL_SPACING * 0.35;

/**
 * Y-slot bands that rotate across the pool index — guarantees every altitude
 * is occupied somewhere. Widened now that the corridor envelope is taller.
 */
const Y_BANDS: Array<[number, number]> = [
  [-9.0, -4.5],
  [-2.5, 2.5],
  [4.5, 9.0],
];

/**
 * Lane center X as a function of world-z. Kept as a hook so future per-flow
 * offsets (for the planned parallel-flow layout) can plug in here, but the
 * corridor itself is now a straight column — which makes the outer "sky"
 * boundary easy to draw as a fixed box aura.
 */
export function laneX(_z: number): number {
  return 0;
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

/**
 * Per-obstacle loop state. Held in a parallel array so the public
 * `Obstacle` interface stays unchanged for external consumers (collision,
 * HUD distance-to-next, etc.).
 */
interface LoopSlot {
  loopX: number;
  loopY: number;
  loopZ: number;
  /** Wrap iteration the obstacle is currently settled in after a crash
   *  impulse. NEGATIVE_INFINITY means "not displaced; track the ship". */
  settleWrapK: number;
}

export class Track {
  readonly group = new Group();
  private obstacles: Obstacle[] = [];
  private slots: LoopSlot[] = [];
  private factories: ObstacleFactory[] = [];
  /** Map from obstacle.type → 'tall' | 'wide' for impact-bias lookup. */
  private shapes: Map<string, 'tall' | 'wide'> = new Map();

  init(): void {
    if (this.factories.length === 0) {
      throw new Error('Track.init() called before setFactories()');
    }
    // Distribute POOL_SIZE obstacles evenly across one loop with per-obstacle
    // jitter + Y-band rotation so altitudes are populated uniformly. Each
    // obstacle keeps its canonical (x, y, z) forever; per-frame wrap math
    // in update() places it in the loop image nearest the ship.
    // Every Nth obstacle goes into the flanking band. With FLANK_FRACTION=0.30
    // and a prime-ish stride (every ~3.33), the flanks and the core lane
    // interleave cleanly along the axial axis instead of clumping.
    const flankStride = Math.max(2, Math.round(1 / FLANK_FRACTION));
    for (let i = 0; i < POOL_SIZE; i++) {
      const f = this.factories[i % this.factories.length];
      const ob = f();
      const baseZ = (i + 0.5) * NOMINAL_SPACING - HALF_LOOP;
      const loopZ = baseZ + rand(-SPACING_JITTER, SPACING_JITTER);
      const band = Y_BANDS[i % Y_BANDS.length];
      const loopY = rand(band[0], band[1]);
      const isFlank = i % flankStride === 0;
      let loopX: number;
      if (isFlank) {
        // Flanking obstacle: push it out into the [LANE_FLANK_MIN, LANE_FLANK_MAX]
        // band on one random side. These sit in the player's peripheral
        // vision — visible hazards they don't usually collide with unless
        // they drift wide, but they fill the corridor with motion.
        const side = Math.random() < 0.5 ? -1 : 1;
        loopX = laneX(loopZ) + side * rand(LANE_FLANK_MIN, LANE_FLANK_MAX);
      } else {
        loopX = laneX(loopZ) + rand(-LANE_HALF_X, LANE_HALF_X);
      }
      ob.mesh.position.set(loopX, loopY, loopZ);
      this.randomizeRotation(ob);
      this.obstacles.push(ob);
      this.slots.push({
        loopX,
        loopY,
        loopZ,
        settleWrapK: Number.NEGATIVE_INFINITY,
      });
      this.group.add(ob.mesh);
    }
  }

  get all(): readonly Obstacle[] {
    return this.obstacles;
  }

  private randomizeRotation(ob: Obstacle): void {
    ob.mesh.rotation.set(
      rand(-Math.PI, Math.PI),
      rand(-Math.PI, Math.PI),
      rand(-Math.PI, Math.PI),
    );
  }

  /**
   * Fling the obstacle in response to the ship's impact. The angular velocity
   * axis is derived from where the ship struck (offset from the obstacle's
   * centre) and from the ship's velocity — hitting the left side tips the
   * obstacle around Y toward the right, hitting from above topples it around
   * X, and so on. Obstacle type biases the response: obelisks are tall and
   * topple end-over-end more readily, pyramids have a wide base and wobble
   * around Y.
   */
  hitImpact(ob: Obstacle, shipPos: Vector3, shipVel: Vector3): void {
    const offX = shipPos.x - ob.mesh.position.x;
    const offY = shipPos.y - ob.mesh.position.y;
    const speed = Math.max(30, Math.hypot(shipVel.x, shipVel.y) + 40);

    // Linear: the ship is travelling in -Z, so Newton III pushes the obstacle
    // forward in -Z too (a fraction of the ship's speed). Camera still catches
    // up and overtakes, but the obstacle reads as propelled forward by the
    // collision rather than ricocheting backward toward the player.
    ob.impulseZ = -speed * 0.35;
    ob.impulseX = -Math.sign(offX) * (Math.abs(offX) * 4 + 6);
    ob.impulseY = -Math.sign(offY) * (Math.abs(offY) * 3 + 4);

    // Angular: shape-biased. Tall monuments (obelisks, columns, minarets,
    // chimneys) topple end-over-end; wide ones (pyramids, temples, domes)
    // have a broad base and yaw instead.
    const isTall = this.shapes.get(ob.type) === 'tall';
    const topple = isTall ? 1.8 : 0.8;
    const yaw = isTall ? 0.7 : 1.5;
    const roll = 0.6;
    const k = speed * 0.08;

    // Base forward tumble — the top of the obstacle pitches in the ship's
    // travel direction (-Z), which in Three.js is negative rotation.x.
    const forwardTumble = -speed * (isTall ? 0.22 : 0.14);

    // Impact-offset torque modulates the base tumble and yaw.
    ob.spin.x = forwardTumble + -offY * topple * k * 0.6 + rand(-0.4, 0.4);
    ob.spin.y = offX * yaw * k + rand(-0.6, 0.6);
    ob.spin.z = (offX * 0.2 - offY * 0.2) * roll * k + rand(-0.3, 0.3);

    ob.impulseRemaining = 1.4;
  }

  update(shipZ: number, dt = 0): void {
    for (let i = 0; i < this.obstacles.length; i++) {
      const ob = this.obstacles[i];
      const slot = this.slots[i];

      // -------- Impulse physics --------
      // While the obstacle is flying from a crash, let physics integrate
      // freely; no wrap math. We also mark the wrap iteration it ends up
      // in so the post-impulse "settled" state can be cleaned up when
      // the ship advances to a new loop iteration.
      if (ob.impulseRemaining > 0) {
        ob.mesh.rotation.x += ob.spin.x * dt;
        ob.mesh.rotation.y += ob.spin.y * dt;
        ob.mesh.rotation.z += ob.spin.z * dt;
        ob.mesh.position.x += ob.impulseX * dt;
        ob.mesh.position.y += ob.impulseY * dt;
        ob.mesh.position.z += ob.impulseZ * dt;
        // Decay the linear impulse over time so it doesn't fly forever.
        const decay = Math.exp(-dt * 1.4);
        ob.impulseX *= decay;
        ob.impulseY *= decay;
        ob.impulseZ *= decay;
        // Angular velocity decays a little slower so the tumble reads cleanly.
        const spinDecay = Math.exp(-dt * 0.9);
        ob.spin.x *= spinDecay;
        ob.spin.y *= spinDecay;
        ob.spin.z *= spinDecay;
        ob.impulseRemaining = Math.max(0, ob.impulseRemaining - dt);
        if (ob.impulseRemaining <= 0) {
          // Mark where this obstacle settled so we leave it behind until
          // the ship has moved to a new loop iteration.
          slot.settleWrapK = Math.round(
            (shipZ - slot.loopZ) / LOOP_LENGTH,
          );
        }
        continue;
      }

      // -------- Settled wreckage --------
      // Freshly-crashed obstacle stays where physics left it until the
      // ship advances to a new loop iteration. When wrapK changes we
      // snap the obstacle back to its canonical spot in the new iteration
      // — by then the ship is thousands of units away so the teleport is
      // off-screen.
      if (slot.settleWrapK !== Number.NEGATIVE_INFINITY) {
        const currentWrapK = Math.round(
          (shipZ - slot.loopZ) / LOOP_LENGTH,
        );
        if (currentWrapK !== slot.settleWrapK) {
          slot.settleWrapK = Number.NEGATIVE_INFINITY;
          ob.mesh.position.set(
            slot.loopX,
            slot.loopY,
            slot.loopZ + currentWrapK * LOOP_LENGTH,
          );
          this.randomizeRotation(ob);
        }
        continue;
      }

      // -------- Modular loop wrap --------
      // Closed-form: obstacle sits at the loop image of its canonical Z
      // nearest to the ship's axial projection. No head/tail cursors, no
      // recycling events — the window always brackets the ship.
      const wrapK = Math.round((shipZ - slot.loopZ) / LOOP_LENGTH);
      ob.mesh.position.set(
        slot.loopX,
        slot.loopY,
        slot.loopZ + wrapK * LOOP_LENGTH,
      );
    }
  }

  setFactories(factories: ObstacleFactory[], shapes: Map<string, 'tall' | 'wide'>): void {
    this.factories = factories;
    this.shapes = shapes;
  }

  distanceToNext(shipPos: Vector3): number {
    let best = Infinity;
    for (const ob of this.obstacles) {
      const dz = shipPos.z - ob.mesh.position.z;
      if (dz > 0 && dz < best) best = dz;
    }
    return best;
  }
}
