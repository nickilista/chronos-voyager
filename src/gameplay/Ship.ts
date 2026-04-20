import { Euler, Group, Quaternion, Vector3 } from 'three';
import { Assets } from './Assets.ts';
import type { InputState } from '../core/Input.ts';
import type { ShipClass, ShipDerivedStats } from '../shipbuilder/shipTypes.ts';
import { CORRIDOR_RADIUS } from './Track.ts';
import { Thruster } from './Thruster.ts';

/**
 * GLB-backed ship. In the original game all physics constants were hardcoded
 * here; with the modular builder, `ShipDerivedStats` feeds in speed, accel,
 * yaw/pitch/roll rates, boost, and stability so the player's loadout
 * actually shapes how the craft handles.
 *
 * Orientation model (unchanged from pre-builder):
 *   • `orient` is the ship's world-space orientation as a Quaternion.
 *   • In free space, pitch/yaw input rotates around the ship's OWN local
 *     axes, so controls stay ship-relative regardless of orientation.
 *   • Inside a flow, orientation eases toward "forward = flowAxis" via a
 *     swing quaternion, preserving accumulated twist (no unwinding rolls).
 *   • Lateral velocity is tracked in the flow's local frame then rotated
 *     into world coordinates for the position update.
 */

// --- fixed tuning constants (shape feel, not per-ship) ---
const LATERAL_DAMP = 6;
const THRUST_DAMP = 0.9;
// How fast the ship eases back toward the active flow's axis when inside.
const INSIDE_RETURN_RATE = 0.9;
const STUN_DURATION = 0.75;
const STUN_MIN_FACTOR = 0.18;
// Distance past the corridor wall where the ship re-emerges on exit.
const EXIT_RADIAL_MARGIN = 18;
// Preset boost cap multiplier — raw BOOST_MULTIPLIER from stats is tuned
// around 1.3–1.8; we clamp so no loadout breaks collision.
const BOOST_CAP = 2.2;

const FORWARD_LOCAL = new Vector3(0, 0, -1);
const LOCAL_Y = new Vector3(0, 1, 0);
const LOCAL_X = new Vector3(1, 0, 0);

/**
 * Per-frame context telling the ship which flow is currently nearest, so
 * inside-mode motion and orientation ease can align to that flow's tilted
 * axis rather than world -Z.
 */
export interface ShipUpdateContext {
  outsideFactor: number;
  /** World-space unit vector, direction of ship travel through the flow. */
  flowAxis: Vector3;
  /** Rotates flow-local vectors (local -Z forward) into world space. */
  flowQuaternion: Quaternion;
  /** World-space origin of the active flow — needed to snap onto its axis. */
  flowOrigin: Vector3;
  /** Ship position in the active flow's local frame — used for exit-ease side. */
  localShipPos: Vector3;
  /** True while the boost reservoir has been drained and hasn't yet refilled
   *  to the "ready" threshold. The Thruster visually chokes the flame in
   *  response — muted halo, short flicker, low opacity — so the failure
   *  reads even when the player isn't watching the HUD bar. */
  boostDepleted: boolean;
}

/**
 * Fallback stats used when no builder result was provided (dev / tests /
 * direct `new Game()`). Matches the pre-builder hand-tuned values.
 */
export const DEFAULT_SHIP_STATS: ShipDerivedStats = {
  maxHp: 100,
  armor: 4,
  maxShield: 50,
  shieldRechargeRate: 5,
  shieldRechargeDelay: 3,
  hpRegen: 0,
  baseSpeed: 48,
  boostMultiplier: 1.5,
  boostDuration: 3,
  boostCooldown: 8,
  acceleration: 55,
  maxThrustSpeed: 45,
  lateralAccel: 60,
  maxLateralVel: 28,
  yawRate: 2.2,
  pitchRate: 1.8,
  rollRate: 1,
  stability: 0.7,
  dpsPrimary: 125,
  dpsSecondary: 100,
  primaryType: 'laser',
  secondaryType: 'machinegun',
  maneuverability: 80,
  visibility: 85,
  stealth: 0,
  totalWeight: 500,
  specials: [],
};

const SHIP_SCALE_FALLBACK = 2.4;
// Assembled modular ships are authored at ~2.5 units long; scale down so
// they match the old ship collider footprint on-screen. Bumped +50% so the
// ship reads as a proper fighter in the corridor instead of a miniature.
const SHIP_SCALE_ASSEMBLED = 1.65;

export class Ship {
  readonly group = new Group();
  /** Lateral velocity expressed in world frame (for camera drift, HUD speedo). */
  readonly velocity = new Vector3();
  /** Lateral velocity in the active flow's local frame (side/up). */
  private readonly latVelLocal = new Vector3();
  private stunT = 0;
  /** Ship's world-space orientation. Nose = orient * (0,0,-1). */
  private readonly orient = new Quaternion();
  private readonly thrustVel = new Vector3();
  private readonly _qDelta = new Quaternion();
  private readonly _qSwing = new Quaternion();
  private readonly _qTarget = new Quaternion();
  private readonly _cosmetic = new Quaternion();
  private readonly _qFinal = new Quaternion();
  private readonly _eul = new Euler();
  private readonly _forward = new Vector3();
  private readonly _scratch = new Vector3();
  private wasFree = false;

  private readonly stats: ShipDerivedStats;
  /**
   * Pre-assembled modular ship mesh from the ShipBuilder. Settable up until
   * `init()` is called; left null to fall back to the legacy `ship.glb`.
   */
  private providedModel: Group | null = null;
  /** Engine class name for the chosen loadout — picks the thruster palette. */
  private providedEngineClass: ShipClass | null = null;
  /** Engine slot group inside the assembled ship — the thruster is parented
   *  here so the flame automatically follows the engine's position/scale/
   *  orientation within the assembly. */
  private providedEngineSlot: Group | null = null;
  /** Per-ship propulsion flame. Built during `init()` when an engine class
   *  is known; remains null on the fallback legacy ship (which has no modular
   *  engine slot to attach to). */
  private thruster: Thruster | null = null;

  constructor(stats: ShipDerivedStats = DEFAULT_SHIP_STATS) {
    this.stats = stats;
  }

  /**
   * Hand the ship a pre-assembled modular model (produced by `assembleShip()`
   * from the builder). Call before `init()`. No-op after init runs.
   *
   * Optional `engineClass` + `engineSlot` trigger propulsion-flame wiring:
   * a Thruster with the palette for the chosen engine class gets mounted
   * as a child of the engine slot group so the flame inherits the engine's
   * transform (position at nozzle, scale = SHIP_SCALE_ASSEMBLED).
   */
  useAssembledModel(
    model: Group,
    engineClass?: ShipClass,
    engineSlot?: Group,
  ): void {
    this.providedModel = model;
    this.providedEngineClass = engineClass ?? null;
    this.providedEngineSlot = engineSlot ?? null;
  }

  init(): void {
    let model: Group;
    let scale: number;
    if (this.providedModel) {
      model = this.providedModel;
      scale = SHIP_SCALE_ASSEMBLED;
    } else {
      model = Assets.cloneShip();
      scale = SHIP_SCALE_FALLBACK;
      // Legacy ship.glb nose points along +X; rotate 90° so nose is -Z.
      model.rotation.y = Math.PI / 2;
    }
    model.scale.setScalar(scale);
    this.group.add(model);

    // Attach the per-engine propulsion flame. Parent it to the engine slot
    // so the flame picks up the slot's assembly-local offset (the (0, -0.02,
    // 1.0) position applied in SLOT_RIGS) plus the SHIP_SCALE_ASSEMBLED
    // inherited from the assembly root. The result: the flame always sits
    // at the nozzle and extrudes aft regardless of which engine class is
    // bolted on.
    if (this.providedEngineClass && this.providedEngineSlot) {
      this.thruster = new Thruster(this.providedEngineClass);
      this.providedEngineSlot.add(this.thruster.group);
    }
  }

  setEraAccent(_accentHex: number): void {
    // no-op for v1
  }

  stun(): void {
    this.stunT = STUN_DURATION;
    this.velocity.multiplyScalar(0.15);
    this.latVelLocal.multiplyScalar(0.15);
    this.thrustVel.multiplyScalar(0.15);
  }

  update(dt: number, input: InputState, ctx: ShipUpdateContext): void {
    const { outsideFactor, flowAxis, flowQuaternion, flowOrigin, localShipPos } = ctx;

    let speedFactor = 1;
    if (this.stunT > 0) {
      const k = this.stunT / STUN_DURATION;
      speedFactor = STUN_MIN_FACTOR + (1 - STUN_MIN_FACTOR) * (1 - k);
      this.stunT = Math.max(0, this.stunT - dt);
    }
    const boostMul = input.boost
      ? Math.min(BOOST_CAP, this.stats.boostMultiplier)
      : 1;
    const speed = this.stats.baseSpeed * boostMul * speedFactor;

    const free = outsideFactor > 0.5;

    // Entry snap: on the outside→inside transition, center the ship on the
    // flow's axis and align its nose with the flow's forward direction so the
    // player always starts play in a canonical pose, no matter which angle
    // they crossed the boundary at.
    if (this.wasFree && !free) {
      this._scratch.subVectors(this.group.position, flowOrigin);
      const axial = this._scratch.dot(flowAxis);
      this.group.position
        .copy(flowAxis)
        .multiplyScalar(axial)
        .add(flowOrigin);
      this.orient.copy(flowQuaternion);
      this.latVelLocal.set(0, 0, 0);
      this.thrustVel.set(0, 0, 0);
    }

    if (free) {
      // Exit snap: on inside→outside, pop the ship out just past the corridor
      // wall on the same side where it crossed, at axial=0 (the "mouth" of
      // the tube near the flow origin).
      if (!this.wasFree) {
        const rx = localShipPos.x;
        const ry = localShipPos.y;
        const r = Math.hypot(rx, ry);
        let ux = 1;
        let uy = 0;
        if (r > 1e-4) {
          ux = rx / r;
          uy = ry / r;
        }
        this._scratch.set(
          ux * (CORRIDOR_RADIUS + EXIT_RADIAL_MARGIN),
          uy * (CORRIDOR_RADIUS + EXIT_RADIAL_MARGIN),
          0,
        );
        this._scratch.applyQuaternion(flowQuaternion);
        this.group.position.copy(flowOrigin).add(this._scratch);
        // Carry the corridor's forward speed into world-frame thrust so the
        // ship doesn't stall when it pops outside. Without this, the player
        // crosses the boundary at ~48 u/s and is suddenly at 0 — visibly
        // "scattoso". latVel is dropped because it was expressed in the
        // flow-local frame and would mean something different outside.
        this.thrustVel
          .copy(flowAxis)
          .multiplyScalar(this.stats.baseSpeed * boostMul * speedFactor);
        this.latVelLocal.set(0, 0, 0);
      }

      // Ship-relative rotations driven by stats-derived yaw/pitch rates.
      if (input.x !== 0) {
        this._qDelta.setFromAxisAngle(LOCAL_Y, -input.x * this.stats.yawRate * dt);
        this.orient.multiply(this._qDelta);
      }
      if (input.y !== 0) {
        this._qDelta.setFromAxisAngle(LOCAL_X, input.y * this.stats.pitchRate * dt);
        this.orient.multiply(this._qDelta);
      }

      // Lateral in-flow velocity fades when outside.
      const dmp = Math.exp(-LATERAL_DAMP * dt);
      this.latVelLocal.multiplyScalar(dmp);

      // Always-on forward thrust along the ship's own nose. Engine accel
      // and cap come from the loadout, so heavy Golem hulls feel leaden
      // while a Viper interceptor snaps to max speed.
      this._forward.copy(FORWARD_LOCAL).applyQuaternion(this.orient);
      this.thrustVel.addScaledVector(
        this._forward,
        this.stats.acceleration * boostMul * dt,
      );
      const maxSpd = this.stats.maxThrustSpeed * boostMul;
      if (this.thrustVel.length() > maxSpd) {
        this.thrustVel.setLength(maxSpd);
      }
      const tdmp = Math.exp(-THRUST_DAMP * dt);
      this.thrustVel.multiplyScalar(tdmp);

      this.group.position.addScaledVector(this.thrustVel, dt * speedFactor);
    } else {
      // Constrained corridor flight. Lateral acceleration comes from the
      // wings (maneuverability), cap from total weight.
      this.latVelLocal.x += input.x * this.stats.lateralAccel * dt;
      this.latVelLocal.y += input.y * this.stats.lateralAccel * dt;
      const damp = Math.exp(-LATERAL_DAMP * dt);
      if (input.x === 0) this.latVelLocal.x *= damp;
      if (input.y === 0) this.latVelLocal.y *= damp;
      const maxLat = this.stats.maxLateralVel;
      this.latVelLocal.x = clampN(this.latVelLocal.x, -maxLat, maxLat);
      this.latVelLocal.y = clampN(this.latVelLocal.y, -maxLat, maxLat);

      // Ease toward "nose = flowAxis". Stability modulates ease rate —
      // stable tails (golem, titan) snap back faster; agile viper floats.
      this._forward.copy(FORWARD_LOCAL).applyQuaternion(this.orient);
      this._qSwing.setFromUnitVectors(this._forward, flowAxis);
      this._qTarget.copy(this._qSwing).multiply(this.orient);
      const ease = INSIDE_RETURN_RATE * (0.6 + 0.8 * this.stats.stability);
      const k = Math.min(1, dt * ease);
      this.orient.slerp(this._qTarget, k);

      const tdmp = Math.exp(-THRUST_DAMP * 3 * dt);
      this.thrustVel.multiplyScalar(tdmp);

      this._scratch.set(this.latVelLocal.x * dt, this.latVelLocal.y * dt, 0);
      this._scratch.applyQuaternion(flowQuaternion);
      this.group.position.add(this._scratch);
      this.group.position.addScaledVector(flowAxis, speed * dt);
    }

    // Export world-frame lateral velocity for camera drift / HUD.
    this._scratch.set(this.latVelLocal.x, this.latVelLocal.y, 0);
    this._scratch.applyQuaternion(flowQuaternion);
    this.velocity.copy(this._scratch);

    // Cosmetic roll/pitch from lateral velocity, scaled by the loadout's
    // visual roll rate (wings × hull). Fade in with alignment so re-entering
    // upside-down doesn't add fight rolls.
    this._forward.copy(FORWARD_LOCAL).applyQuaternion(this.orient);
    const alignDot = this._forward.dot(flowAxis);
    const aligned = Math.max(0, alignDot);
    const cosmeticStrength = aligned * aligned;
    const targetRoll =
      -this.latVelLocal.x * 0.04 * cosmeticStrength * this.stats.rollRate;
    const targetPitchCosmetic =
      this.latVelLocal.y * 0.03 * cosmeticStrength * this.stats.rollRate;
    this._eul.set(targetPitchCosmetic, 0, targetRoll, 'YXZ');
    this._cosmetic.setFromEuler(this._eul);

    this._qFinal.copy(this.orient).multiply(this._cosmetic);
    // Smooth the visual quaternion in both modes. Previously free-mode used
    // an instant slerp (k=1), which made orientation pop at the inside→
    // outside transition (cosmetic roll fades differently when alignDot
    // changes). A fast-but-not-instant follow (dt * 14) keeps the visual
    // responsive without the snap.
    this.group.quaternion.slerp(this._qFinal, Math.min(1, dt * (free ? 14 : 6)));

    // Drive the propulsion flame. Throttle is the current forward speed as
    // a fraction of the loadout's max-thrust cap — clamped to [0,1]. Inside
    // a corridor the ship cruises at `baseSpeed` constantly, so we fold
    // that in so the flame doesn't collapse to zero just because
    // `thrustVel` is idle-damped under corridor physics.
    if (this.thruster) {
      const maxRef = Math.max(1, this.stats.maxThrustSpeed);
      const currentSpd = free ? this.thrustVel.length() : this.stats.baseSpeed;
      const throttle = Math.min(1, currentSpd / maxRef) * speedFactor;
      this.thruster.update(dt, throttle, input.boost, ctx.boostDepleted);
    }

    this.wasFree = free;
  }

  /**
   * Place the ship at a free-space spawn point with its nose optionally
   * aimed at a target. Called once from Game after `init()` to start the
   * player in the galaxy-map view rather than baked inside Egypt.
   *
   * Sets `wasFree = true` so the first `update()` frame does NOT interpret
   * the spawn as an inside→outside transition (which would teleport the
   * ship to the corridor wall via the exit-snap branch).
   */
  spawn(position: Vector3, lookAt?: Vector3): void {
    this.group.position.copy(position);
    if (lookAt) {
      // Build an orient that rotates FORWARD_LOCAL onto the direction to
      // the target. Mirrors the camera lookAt idiom used elsewhere, but
      // we keep the roll aligned with world-Y by running through a
      // unit-vector swing rather than a full look matrix.
      const dir = new Vector3().subVectors(lookAt, position).normalize();
      if (dir.lengthSq() > 1e-6) {
        this.orient.setFromUnitVectors(FORWARD_LOCAL, dir);
        this.group.quaternion.copy(this.orient);
      }
    }
    // Pretend the previous frame was also free so neither the entry-snap
    // nor the exit-snap fires on frame 1 — the spawn position sticks.
    this.wasFree = true;
    this.thrustVel.set(0, 0, 0);
    this.latVelLocal.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
  }
}

function clampN(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
