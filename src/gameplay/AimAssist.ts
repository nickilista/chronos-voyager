import { type Camera, Vector3 } from 'three';
import type { Meteorites } from './Meteorites.ts';

const _scratch = new Vector3();

/**
 * Soft lock-on aim assist.
 *
 * Rules the player deduces without being told:
 *   1. Pointing near a meteorite for 2 seconds locks onto it — a red
 *      bracket appears on the target and bullets auto-aim at it.
 *   2. Looking away or letting the target die resets the timer.
 *   3. Switching to a different meteorite (closer to center) resets the
 *      timer for the new candidate rather than carrying it over — this
 *      stops accidental locks on rocks that happened to pass through
 *      the crosshair for half a second.
 *
 * The "cone" is expressed as a max angle between ship-forward and the
 * line to the meteorite. 12 degrees is roughly where a reticle is still
 * usefully aimed; 2 seconds of dwell inside that cone is the lock.
 */

const LOCK_CONE_COS = Math.cos((12 * Math.PI) / 180); // ~11.7° half-angle
const LOCK_DWELL_SECONDS = 2.0;
/** While locked, how much of the fire direction comes from the target
 *  vector vs. the player's own aim. 1.0 = full assist (always hit),
 *  0.0 = no assist (purely manual). 0.85 feels like "gentle help" — the
 *  player still has to point roughly right, but last-second target
 *  movement is compensated. */
const LOCK_ASSIST_STRENGTH = 0.85;

/**
 * Public snapshot returned by `update()` — consumed by the HUD crosshair
 * and the fire-direction override in Game.
 */
export interface AimAssistState {
  /** Screen-space pixel coordinates of the current target, or null
   *  when there's no candidate in the cone. */
  targetScreen: { x: number; y: number } | null;
  /** Target's world position — stable reference for fire override. */
  targetWorld: Vector3 | null;
  /** 0..1 dwell progress; 1 = locked. */
  dwell01: number;
  /** True iff dwell reached the lock threshold. */
  locked: boolean;
}

export class AimAssist {
  /** The currently-watched target (may or may not be locked yet). Set
   *  to null when nothing is in the cone. */
  private target: { id: object; world: Vector3 } | null = null;
  private dwell = 0;

  /**
   * Walk the meteorite list, find the one closest to the ship's forward
   * direction that lies within the lock cone, and advance / reset the
   * dwell timer accordingly.
   *
   * @param dt           frame delta in seconds
   * @param shipPos      world-space ship position
   * @param shipForward  unit vector, world-space ship forward direction
   * @param camera       camera used for world → screen projection
   * @param meteorites   free-space meteorite pool
   */
  update(
    dt: number,
    shipPos: Vector3,
    shipForward: Vector3,
    camera: Camera,
    meteorites: Meteorites,
  ): AimAssistState {
    // Scan: find the meteorite most aligned with ship-forward.
    const active = meteorites.getActive();
    let bestAlignment = LOCK_CONE_COS;
    let best: { id: object; world: Vector3 } | null = null;
    for (let i = 0; i < active.length; i++) {
      const m = active[i];
      const dx = m.position.x - shipPos.x;
      const dy = m.position.y - shipPos.y;
      const dz = m.position.z - shipPos.z;
      const len = Math.hypot(dx, dy, dz);
      if (len < 1e-3) continue;
      const dot =
        (dx * shipForward.x + dy * shipForward.y + dz * shipForward.z) / len;
      if (dot > bestAlignment) {
        bestAlignment = dot;
        best = { id: m, world: m.position };
      }
    }

    // Advance / reset dwell. `id` is a stable object reference (the
    // MeteoriteInstance itself) so we can cheaply tell "same target" vs
    // "switched target" without comparing positions.
    if (best == null) {
      this.target = null;
      this.dwell = 0;
    } else if (this.target == null || this.target.id !== best.id) {
      this.target = best;
      this.dwell = 0;
    } else {
      this.dwell = Math.min(LOCK_DWELL_SECONDS, this.dwell + dt);
      // Keep the world-pos fresh — the MeteoriteInstance reuses the
      // same Vector3 every frame, but storing the reference (not a
      // clone) means we naturally stay up to date.
      this.target.world = best.world;
    }

    const dwell01 = this.dwell / LOCK_DWELL_SECONDS;
    const locked = this.dwell >= LOCK_DWELL_SECONDS;

    let targetScreen: { x: number; y: number } | null = null;
    if (this.target) {
      targetScreen = this.projectToScreen(this.target.world, camera);
    }

    return {
      targetScreen,
      targetWorld: this.target ? this.target.world : null,
      dwell01,
      locked,
    };
  }

  /**
   * Apply the assist to a raw fire direction. If we're locked and the
   * target still exists, blend the player's aim toward the target line
   * by LOCK_ASSIST_STRENGTH. Writes into `out` so the caller doesn't
   * allocate in the hot path.
   */
  applyAssist(
    fireOrigin: Vector3,
    fireDirection: Vector3,
    locked: boolean,
    targetWorld: Vector3 | null,
    out: Vector3,
  ): Vector3 {
    if (!locked || !targetWorld) {
      out.copy(fireDirection);
      return out;
    }
    // Direction from muzzle to target.
    const dx = targetWorld.x - fireOrigin.x;
    const dy = targetWorld.y - fireOrigin.y;
    const dz = targetWorld.z - fireOrigin.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-3) {
      out.copy(fireDirection);
      return out;
    }
    const tx = dx / len;
    const ty = dy / len;
    const tz = dz / len;
    const k = LOCK_ASSIST_STRENGTH;
    // Slerp approximation: cheap lerp + renormalize. Good enough for
    // small deviations (we're already within the lock cone).
    out.set(
      fireDirection.x * (1 - k) + tx * k,
      fireDirection.y * (1 - k) + ty * k,
      fireDirection.z * (1 - k) + tz * k,
    );
    const outLen = Math.hypot(out.x, out.y, out.z);
    if (outLen > 1e-6) out.multiplyScalar(1 / outLen);
    return out;
  }

  /**
   * World-space → screen pixels. Returns null if the point is behind
   * the camera (NDC.z > 1). The HUD lives in CSS pixels, so we convert
   * NDC x/y to [0, window.innerWidth/Height].
   */
  private projectToScreen(world: Vector3, camera: Camera): { x: number; y: number } | null {
    // Clone so `.project()` doesn't mutate the meteorite's live position.
    const v = _scratch.copy(world);
    v.project(camera);
    if (v.z > 1 || v.z < -1) return null;
    return {
      x: ((v.x + 1) / 2) * window.innerWidth,
      y: ((1 - v.y) / 2) * window.innerHeight,
    };
  }
}

