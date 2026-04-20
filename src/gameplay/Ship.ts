import { Euler, Group, Quaternion, Vector3 } from 'three';
import { Assets } from './Assets.ts';
import type { InputState } from '../core/Input.ts';
import { CORRIDOR_RADIUS } from './Track.ts';

const FORWARD_SPEED = 48;
const BOOST_MULTIPLIER = 2;
const LATERAL_ACCEL = 60;
const LATERAL_DAMP = 6;
const MAX_LATERAL_VEL = 28;

const SHIP_SCALE = 2.4;

const STUN_DURATION = 0.75;
const STUN_MIN_FACTOR = 0.18;

// Outside the corridor, x/y are applied as rotations around the ship's own
// local axes (not world axes), so "left" is always the ship's own left no
// matter which way its nose is currently pointing.
const FREE_YAW_RATE = 2.2;
const FREE_PITCH_RATE = 1.8;
// How fast the ship eases back toward the active flow's axis when inside.
const INSIDE_RETURN_RATE = 0.9;

// Free-space navigation. Always-on forward thrust along the ship's own nose
// (so "forward" is ship-relative, unlike the old world/flow-axis drift that
// broke once 10 flows sat at arbitrary tilts). Boost doubles the accel and
// cap. Rotation is still driven by x/y input.
const THRUST_ACCEL = 55;
const THRUST_DAMP = 0.9;
const MAX_THRUST_SPEED = 45;

// Distance past the corridor wall where the ship re-emerges on exit. Large
// enough that the next frame's outsideFactor stays > 0.5 (so we don't snap
// again) and the player visually registers "I'm out now".
const EXIT_RADIAL_MARGIN = 18;

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
}

/**
 * GLB-backed ship. Call `init()` after `preloadAssets()` has resolved.
 * Nose is authored along -Z (glTF forward).
 *
 * Orientation model:
 *   • `orient` is the ship's world-space orientation as a Quaternion.
 *   • In free space, pitch/yaw input produces rotations around the ship's
 *     OWN local X/Y axes (post-multiply). That makes controls ship-relative:
 *     pushing left always yaws the ship to its own left, no matter which way
 *     the nose is currently pointing (upside-down, inverted, mid-loop, etc.).
 *   • Inside a flow, the orientation eases toward "forward = flowAxis" via a
 *     swing quaternion, preserving any accumulated twist (no unwinding rolls).
 *   • Lateral velocity is tracked in the flow's local frame, then rotated
 *     into world coordinates for the actual position update, so banking left
 *     while flying through a tilted flow feels the same as banking left in
 *     the Egyptian corridor.
 */
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

  init(): void {
    const model = Assets.cloneShip();
    model.scale.setScalar(SHIP_SCALE);
    model.rotation.y = Math.PI / 2;
    this.group.add(model);
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
    const boostMul = input.boost ? BOOST_MULTIPLIER : 1;
    const speed = FORWARD_SPEED * boostMul * speedFactor;

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
      // the tube near the flow origin). Snapping straight to flowOrigin would
      // land the ship back on the axis (inside the cylinder) — outsideFactor
      // would drop to 0 and the ship would re-enter the flow immediately.
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
        this.thrustVel.set(0, 0, 0);
        this.latVelLocal.set(0, 0, 0);
      }

      // Ship-relative rotations. Post-multiplying a local-axis rotation onto
      // `orient` means the axis is interpreted in the ship's own frame, so
      // left/right always maps to the ship's own left/right regardless of
      // world orientation. Yaw: around local +Y. Pitch: around local +X.
      if (input.x !== 0) {
        this._qDelta.setFromAxisAngle(LOCAL_Y, -input.x * FREE_YAW_RATE * dt);
        this.orient.multiply(this._qDelta);
      }
      if (input.y !== 0) {
        this._qDelta.setFromAxisAngle(LOCAL_X, input.y * FREE_PITCH_RATE * dt);
        this.orient.multiply(this._qDelta);
      }

      // Lateral in-flow velocity fades when outside.
      const dmp = Math.exp(-LATERAL_DAMP * dt);
      this.latVelLocal.multiplyScalar(dmp);

      // Always-on forward thrust along the ship's own nose. Boost (Space)
      // doubles accel and the speed cap so the player has an explicit
      // "go faster" control while free motion remains the default.
      this._forward.copy(FORWARD_LOCAL).applyQuaternion(this.orient);
      this.thrustVel.addScaledVector(this._forward, THRUST_ACCEL * boostMul * dt);
      const maxSpd = MAX_THRUST_SPEED * boostMul;
      if (this.thrustVel.length() > maxSpd) {
        this.thrustVel.setLength(maxSpd);
      }
      const tdmp = Math.exp(-THRUST_DAMP * dt);
      this.thrustVel.multiplyScalar(tdmp);

      this.group.position.addScaledVector(this.thrustVel, dt * speedFactor);
    } else {
      // Constrained corridor flight. Lateral acceleration is in flow-local
      // frame (x = local side, y = local up), then rotated into world for the
      // position update so the ship banks the way you'd expect no matter how
      // the flow is tilted in 3D space.
      this.latVelLocal.x += input.x * LATERAL_ACCEL * dt;
      this.latVelLocal.y += input.y * LATERAL_ACCEL * dt;
      const damp = Math.exp(-LATERAL_DAMP * dt);
      if (input.x === 0) this.latVelLocal.x *= damp;
      if (input.y === 0) this.latVelLocal.y *= damp;
      this.latVelLocal.x = clampN(this.latVelLocal.x, -MAX_LATERAL_VEL, MAX_LATERAL_VEL);
      this.latVelLocal.y = clampN(this.latVelLocal.y, -MAX_LATERAL_VEL, MAX_LATERAL_VEL);

      // Ease the ship toward "nose = flowAxis" via swing quaternion. This
      // preserves any accumulated roll (the ship won't unwind a completed
      // loop) and handles any 3D axis without Euler singularities.
      this._forward.copy(FORWARD_LOCAL).applyQuaternion(this.orient);
      this._qSwing.setFromUnitVectors(this._forward, flowAxis);
      this._qTarget.copy(this._qSwing).multiply(this.orient);
      const k = Math.min(1, dt * INSIDE_RETURN_RATE);
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

    // Cosmetic roll/pitch from lateral velocity. Expressed in local frame via
    // post-multiply, so the roll axis is always the ship's own forward.
    // Fade in with alignment so re-entering upside-down doesn't add fight rolls.
    this._forward.copy(FORWARD_LOCAL).applyQuaternion(this.orient);
    const alignDot = this._forward.dot(flowAxis);
    const aligned = Math.max(0, alignDot);
    const cosmeticStrength = aligned * aligned;
    const targetRoll = -this.latVelLocal.x * 0.04 * cosmeticStrength;
    const targetPitchCosmetic = this.latVelLocal.y * 0.03 * cosmeticStrength;
    this._eul.set(targetPitchCosmetic, 0, targetRoll, 'YXZ');
    this._cosmetic.setFromEuler(this._eul);

    this._qFinal.copy(this.orient).multiply(this._cosmetic);
    this.group.quaternion.slerp(this._qFinal, free ? 1 : Math.min(1, dt * 6));

    this.wasFree = free;
  }
}

function clampN(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
