import { type Camera, Vector3 } from 'three';
import type { Enemies } from './Enemies.ts';
import type { Meteorites } from './Meteorites.ts';

const _scratch = new Vector3();

/**
 * Soft lock-on aim assist.
 *
 * Two target classes, different dwell rules:
 *
 *   • Meteorites — dwell-to-lock. Point near a rock for 2 seconds inside
 *     the lock cone and the crosshair latches. Looking away or switching
 *     rocks resets the timer.
 *   • Enemy ships — INSTANT lock. The moment ship-forward lands inside
 *     the cone on an enemy, we jump straight to locked. Enemies are
 *     rarer + more important to hit, and 2s of "wait to aim assist"
 *     during a duel felt wrong.
 *
 * When both an enemy AND a meteorite are in the cone, the enemy wins
 * regardless of which is more closely aligned — a duel target always
 * takes priority over ambient debris.
 *
 * The "cone" is the max angle between ship-forward and the line to the
 * target. 12 degrees is the usable-aim zone.
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
  /** True when the current target is an enemy ship (vs a meteorite).
   *  The crosshair uses this to skip drawing the progress arc — enemy
   *  locks are instant, so a "filling" ring would just flash for one
   *  frame and look buggy. */
  isEnemyTarget: boolean;
}

export class AimAssist {
  /** The currently-watched target (may or may not be locked yet). Set
   *  to null when nothing is in the cone. */
  private target: { id: object; world: Vector3; isEnemy: boolean } | null = null;
  private dwell = 0;

  /**
   * Walk the meteorite + enemy lists, find the best candidate in the
   * lock cone (enemies preferred over meteorites), and advance / reset
   * the dwell timer. Enemy targets skip the dwell entirely.
   */
  update(
    dt: number,
    shipPos: Vector3,
    shipForward: Vector3,
    camera: Camera,
    meteorites: Meteorites,
    enemies?: Enemies,
  ): AimAssistState {
    // Scan enemies FIRST — they outrank any meteorite within the cone.
    // We still need to know if ANY enemy is in the cone; if so, pick
    // the most aligned one.
    let bestEnemyAlignment = LOCK_CONE_COS;
    let bestEnemy: { id: object; world: Vector3 } | null = null;
    if (enemies) {
      const ea = enemies.getActive();
      for (let i = 0; i < ea.length; i++) {
        const e = ea[i];
        const dx = e.position.x - shipPos.x;
        const dy = e.position.y - shipPos.y;
        const dz = e.position.z - shipPos.z;
        const len = Math.hypot(dx, dy, dz);
        if (len < 1e-3) continue;
        const dot =
          (dx * shipForward.x + dy * shipForward.y + dz * shipForward.z) / len;
        if (dot > bestEnemyAlignment) {
          bestEnemyAlignment = dot;
          bestEnemy = { id: e, world: e.position };
        }
      }
    }

    let best: { id: object; world: Vector3; isEnemy: boolean } | null = null;
    if (bestEnemy) {
      best = { id: bestEnemy.id, world: bestEnemy.world, isEnemy: true };
    } else {
      // No enemy in cone — fall back to scanning meteorites for a
      // dwell-style lock candidate.
      let bestAlignment = LOCK_CONE_COS;
      const active = meteorites.getActive();
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
          best = { id: m, world: m.position, isEnemy: false };
        }
      }
    }

    // Advance / reset dwell. Enemy targets skip the timer entirely and
    // go straight to locked state; meteorites accumulate as before.
    if (best == null) {
      this.target = null;
      this.dwell = 0;
    } else if (this.target == null || this.target.id !== best.id) {
      this.target = best;
      this.dwell = best.isEnemy ? LOCK_DWELL_SECONDS : 0;
    } else {
      if (best.isEnemy) {
        // Already locked on enemy; just keep it pinned at threshold.
        this.dwell = LOCK_DWELL_SECONDS;
      } else {
        this.dwell = Math.min(LOCK_DWELL_SECONDS, this.dwell + dt);
      }
      // Keep the world-pos fresh — the source instance reuses the same
      // Vector3 every frame, but storing the reference (not a clone)
      // means we naturally stay up to date.
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
      isEnemyTarget: this.target ? this.target.isEnemy : false,
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
    // Clone so `.project()` doesn't mutate the target's live position.
    const v = _scratch.copy(world);
    v.project(camera);
    if (v.z > 1 || v.z < -1) return null;
    return {
      x: ((v.x + 1) / 2) * window.innerWidth,
      y: ((1 - v.y) / 2) * window.innerHeight,
    };
  }
}

