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
 * Pool behavior: the 140 obstacles form a single continuous **chain** along
 * Z. New obstacles never teleport into an arbitrary random slot around the
 * ship — they always land at the chain's current far end (tail for -Z,
 * head for +Z) with a bounded random gap. That guarantees there is never
 * an empty stretch between recycled obstacles and the existing ones, and
 * the stream reads as one continuous infinite flow regardless of where in
 * the corridor the player happens to be.
 */

const POOL_SIZE = 140;
// Narrow obstacle lane: where obstacles actually spawn. Lateral half-width
// bumped 20% so obstacles spread further off-axis, making the corridor feel
// busier at the edges and giving the player more horizontal dodging space
// to read.
export const LANE_HALF_X = 16.8;
export const LANE_HALF_Y = 10;
// Circular corridor boundary: the cylindrical membrane the player must
// cross to leave the Egyptian world. Lateral decorations and the flow
// haze sit just outside this radius, so from inside the obstacle lane
// you cannot see the boundary at all.
export const CORRIDOR_RADIUS = 50;
// Slightly tighter axial spacing than the 16.1 baseline so the corridor
// reads a touch denser without slipping back to the old too-packed tuning.
const MIN_SPACING_Z = 14.5;
// Natural half-length of the chain for POOL_SIZE/2 obstacles per side at the
// spacing above. Recycle threshold sits just past this so obstacles are only
// moved when they've genuinely drifted outside the active window, never
// mid-chain. Buffer accounts for jitter from the random-gap distribution.
const CHAIN_HALF_LENGTH = (POOL_SIZE / 2) * (MIN_SPACING_Z * 1.2);
const RECYCLE_DIST = CHAIN_HALF_LENGTH + 80;

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

export class Track {
  readonly group = new Group();
  private obstacles: Obstacle[] = [];
  private factories: ObstacleFactory[] = [];
  /** Map from obstacle.type → 'tall' | 'wide' for impact-bias lookup. */
  private shapes: Map<string, 'tall' | 'wide'> = new Map();

  init(): void {
    if (this.factories.length === 0) {
      throw new Error('Track.init() called before setFactories()');
    }
    for (let i = 0; i < POOL_SIZE; i++) {
      const f = this.factories[i % this.factories.length];
      const ob = f();
      this.group.add(ob.mesh);
      this.obstacles.push(ob);
    }
    this.layOutChainAround(0);
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
   * Place the obstacle at the given Z with a random XY inside the lane band.
   * Clears any leftover impact physics so recycled/reseeded obstacles never
   * keep spinning or drifting from their previous life.
   */
  private placeAt(ob: Obstacle, z: number): void {
    const cx = laneX(z);
    const band = Y_BANDS[Math.floor(Math.random() * Y_BANDS.length)];
    ob.mesh.position.set(
      cx + rand(-LANE_HALF_X, LANE_HALF_X),
      rand(band[0], band[1]),
      z,
    );
    this.randomizeRotation(ob);
    ob.spin.x = 0;
    ob.spin.y = 0;
    ob.spin.z = 0;
    ob.impulseX = 0;
    ob.impulseY = 0;
    ob.impulseZ = 0;
    ob.impulseRemaining = 0;
  }

  /**
   * Seed the whole pool as a single continuous chain centred on `centerZ`.
   * Alternates sides so the chain grows symmetrically forward and backward.
   * The first obstacle on each side sits half a gap from centerZ so that
   * the gap straddling the midpoint matches the rest of the chain — without
   * this trick, the naive "walk both cursors from the centre" approach
   * leaves a visible double-gap at the midpoint.
   */
  private layOutChainAround(centerZ: number): void {
    let tailZ = centerZ; // running far-ahead cursor (-Z)
    let headZ = centerZ; // running far-behind cursor (+Z)
    let firstAhead = true;
    let firstBehind = true;
    for (let i = 0; i < this.obstacles.length; i++) {
      const gap = rand(MIN_SPACING_Z, MIN_SPACING_Z * 1.4);
      let z: number;
      if (i % 2 === 0) {
        tailZ -= firstAhead ? gap * 0.5 : gap;
        firstAhead = false;
        z = tailZ;
      } else {
        headZ += firstBehind ? gap * 0.5 : gap;
        firstBehind = false;
        z = headZ;
      }
      this.placeAt(this.obstacles[i], z);
    }
  }

  /**
   * Scan the pool (excluding `self`) for its current Z extremes. Cheap at
   * N=140 and avoids stale-cache bugs when recycling runs mid-frame.
   */
  private chainExtremes(self: Obstacle): { minZ: number; maxZ: number } {
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const o of this.obstacles) {
      if (o === self) continue;
      const z = o.mesh.position.z;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    return { minZ, maxZ };
  }

  /**
   * Re-place `ob` at the chain's current far end on the requested side,
   * one random gap past the existing farthest obstacle. This keeps the
   * stream continuous — there is no empty band between the recycled
   * obstacle and the rest of the pool.
   *
   *   side = -1 → extend the ahead (-Z) end of the chain.
   *   side = +1 → extend the behind (+Z) end of the chain.
   */
  private recycle(ob: Obstacle, side: 1 | -1): void {
    const { minZ, maxZ } = this.chainExtremes(ob);
    const gap = rand(MIN_SPACING_Z, MIN_SPACING_Z * 1.4);
    const z = side === -1 ? minZ - gap : maxZ + gap;
    this.placeAt(ob, z);
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
    for (const ob of this.obstacles) {
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
      }
      const dz = ob.mesh.position.z - shipZ;
      if (dz > RECYCLE_DIST) {
        // Too far behind — wrap to the far-ahead end of the chain.
        this.recycle(ob, -1);
      } else if (dz < -RECYCLE_DIST) {
        // Too far ahead — wrap to the far-behind end of the chain.
        this.recycle(ob, 1);
      }
    }
  }

  setFactories(factories: ObstacleFactory[], shapes: Map<string, 'tall' | 'wide'>): void {
    this.factories = factories;
    this.shapes = shapes;
  }

  /**
   * Rebuild the whole chain around the given local-Z. Used on flow entry so
   * the player lands inside a populated corridor regardless of their axial
   * offset — and so the chain's centre is where they actually are rather
   * than the initial z=0 seed.
   */
  recenter(shipZ: number): void {
    this.layOutChainAround(shipZ);
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
