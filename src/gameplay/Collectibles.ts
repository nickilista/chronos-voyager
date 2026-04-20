import {
  AdditiveBlending,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  RingGeometry,
  Vector3,
} from 'three';
import { Assets, makeEmissive } from './Assets.ts';
import { ERA_CONTENT, type CaptureStyle } from '../eras/eraContent.ts';
import type { EraId } from '../eras/eras.ts';
import { laneX } from './Track.ts';

/**
 * Per-era sacred collectibles. Each era has its own iconic pickup sourced
 * from the era's Rodin-generated GLB (Egypt = ankh, Greece = laurel wreath,
 * China = square-hole coin, Islamic = 8-point girih star, etc.). Ten
 * pickups completes the era and fires the win handoff.
 *
 * Each orb spins gently, bobs, and boosts emissive so the bloom pass picks
 * it up. On pickup it plays a capture animation: lifts up, spins faster,
 * scales up, fades out while a gold ring burst expands around it.
 *
 * ## Modular-loop placement
 *
 * Orbs are NOT a head/tail ring buffer chasing the ship. Instead each orb
 * owns a fixed "canonical" (x, y, z) inside a closed axial loop of length
 * `LOOP_LENGTH`. Every frame we compute a displayed Z:
 *
 *     wrapK    = round((shipZ - orb.loopZ) / LOOP_LENGTH)
 *     displayZ = orb.loopZ + wrapK * LOOP_LENGTH
 *
 * This keeps each orb at the nearest loop image of its canonical Z to the
 * ship's projection. Net effect: orbs form a stable, uniformly-spaced
 * window that always brackets the ship on both sides, regardless of
 * entry point, flight direction, or whether the ship is inside the flow
 * or viewing it from free space. No seeding around entry position, no
 * one-ended chain drift, no empty bands on side-entry.
 *
 * ## Collection respawn
 *
 * When an orb is captured, we remember the wrapK it was in. The orb
 * hides until the ship has moved far enough along the axis that wrapK
 * changes — at which point the orb reappears in the NEXT loop iteration.
 * At ~48 u/s travel and LOOP_LENGTH ≈ 2400, that's roughly a 25-second
 * respawn cadence per orb, but since 80 orbs are distributed across the
 * loop the player sees a new orb about every 0.6 s on average.
 */

const POOL_SIZE = 80;
/** Length of one axial loop. Chosen so POOL_SIZE orbs sit ~30 u apart. */
const LOOP_LENGTH = POOL_SIZE * 30;
/** Half-loop, used in the wrap math (round-nearest). */
const HALF_LOOP = LOOP_LENGTH / 2;
/** Nominal spacing between successive canonical orbs. */
const NOMINAL_SPACING = LOOP_LENGTH / POOL_SIZE;
/** Per-orb jitter applied to the even spacing so the loop doesn't look
 *  like a metronome — kept below half the spacing so orbs never cross. */
const SPACING_JITTER = NOMINAL_SPACING * 0.35;
const PICKUP_RADIUS = 2.4;
const LANE_HALF = 11.0;
const Y_RANGE = 8.0;
// Capture duration varies slightly by style so the flourish feels distinct.
const CAPTURE_DUR: Record<CaptureStyle, number> = {
  ascend: 0.55,
  swirl: 0.70,
  radial: 0.50,
  shatter: 0.45,
  scroll: 0.55,
};
const BURST_RING_COUNT: Record<CaptureStyle, number> = {
  ascend: 1,
  swirl: 2,
  radial: 4,
  shatter: 3,
  scroll: 1,
};

const BURST_GEOM = new RingGeometry(0.3, 0.8, 32);

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

interface Orb {
  readonly group: Group;
  readonly model: Object3D;
  /** Primary flourish ring (always present). */
  readonly burst: Mesh;
  readonly burstMat: MeshBasicMaterial;
  /** Extra rings for multi-ring styles (radial, swirl, shatter). */
  readonly extraBursts: Array<{ mesh: Mesh; mat: MeshBasicMaterial; phase: number }>;
  /** Canonical X — fixed once at init, applied every frame. */
  loopX: number;
  /** Canonical Y — fixed, applied every frame (plus bob). */
  loopY: number;
  /** Canonical Z within one loop iteration, in [-HALF_LOOP, +HALF_LOOP). */
  loopZ: number;
  /** Current displayed position (canonical + wrap offset + bob). Kept in
   *  sync each frame so animateCapture and pickup reads one spot. */
  readonly basePos: Vector3;
  active: boolean;
  phase: number;
  capturing: boolean;
  captureT: number;
  /** Post-capture hide: orb waits in this wrap-K until the ship advances
   *  to a new one, then reappears in the fresh loop iteration. `-Infinity`
   *  means "not hidden". */
  respawnWrapK: number;
}

export interface CollectiblesEvents {
  onPickup(collectedSoFar: number, target: number): void;
}

export class Collectibles {
  readonly group = new Group();
  readonly target: number;
  private orbs: Orb[] = [];
  private _collected = 0;
  private events: CollectiblesEvents;
  private readonly eraId: EraId;
  private readonly captureStyle: CaptureStyle;
  private readonly captureDur: number;

  constructor(eraId: EraId, events: CollectiblesEvents, target = 10) {
    this.eraId = eraId;
    this.events = events;
    this.target = target;
    this.captureStyle = ERA_CONTENT[eraId].collectible.captureStyle;
    this.captureDur = CAPTURE_DUR[this.captureStyle];
  }

  private buildOrb(loopX: number, loopY: number, loopZ: number): Orb {
    const spec = ERA_CONTENT[this.eraId].collectible;
    const group = new Group();
    const model = Assets.clone(spec.name);
    model.scale.setScalar(spec.scale);
    makeEmissive(model, spec.emissive, spec.emissiveI);
    group.add(model);

    const makeRing = (): { mesh: Mesh; mat: MeshBasicMaterial } => {
      const mat = new MeshBasicMaterial({
        color: spec.emissive,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new Mesh(BURST_GEOM, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.setScalar(0.001);
      mesh.visible = false;
      group.add(mesh);
      return { mesh, mat };
    };

    const primary = makeRing();
    const extras: Array<{ mesh: Mesh; mat: MeshBasicMaterial; phase: number }> = [];
    const count = BURST_RING_COUNT[this.captureStyle];
    for (let i = 1; i < count; i++) {
      const r = makeRing();
      // Evenly spaced phase offsets so extra rings emit at staggered times,
      // giving the radial/shatter flourishes a layered pulse feel.
      extras.push({ mesh: r.mesh, mat: r.mat, phase: i / count });
    }
    return {
      group,
      model,
      burst: primary.mesh,
      burstMat: primary.mat,
      extraBursts: extras,
      loopX,
      loopY,
      loopZ,
      basePos: new Vector3(loopX, loopY, loopZ),
      active: true,
      phase: Math.random() * Math.PI * 2,
      capturing: false,
      captureT: 0,
      respawnWrapK: Number.NEGATIVE_INFINITY,
    };
  }

  init(): void {
    // Distribute POOL_SIZE orbs evenly across one loop with per-orb jitter.
    // Canonical Z lives in [-HALF_LOOP, +HALF_LOOP); the wrap math in update()
    // places each orb in the loop image nearest the ship every frame.
    for (let i = 0; i < POOL_SIZE; i++) {
      const baseZ = (i + 0.5) * NOMINAL_SPACING - HALF_LOOP;
      const loopZ = baseZ + rand(-SPACING_JITTER, SPACING_JITTER);
      const loopX = laneX(loopZ) + rand(-LANE_HALF, LANE_HALF);
      const loopY = rand(-Y_RANGE, Y_RANGE);
      const o = this.buildOrb(loopX, loopY, loopZ);
      this.orbs.push(o);
      this.group.add(o.group);
    }
  }

  get collected(): number {
    return this._collected;
  }

  /** Reset capture animation state + visibility for an orb returning to
   *  the loop (either post-capture respawn or hard reset). */
  private resetOrbVisuals(o: Orb): void {
    o.group.scale.setScalar(1);
    o.model.rotation.set(0, 0, 0);
    o.model.visible = true;
    o.group.visible = true;
    o.burst.visible = false;
    o.burstMat.opacity = 0;
    for (const e of o.extraBursts) {
      e.mesh.visible = false;
      e.mat.opacity = 0;
    }
    // Orbs past the collection target remain visible but uncollectable —
    // ambient flavour rather than a gameplay beat.
    o.active = this._collected < this.target;
    o.capturing = false;
    o.captureT = 0;
    o.respawnWrapK = Number.NEGATIVE_INFINITY;
  }

  update(dt: number, shipPos: Vector3, _cameraPos: Vector3): void {
    for (const o of this.orbs) {
      // -------- Capture animation phase --------
      if (o.capturing) {
        o.captureT += dt;
        const k = Math.min(1, o.captureT / this.captureDur);
        this.animateCapture(o, k, dt);
        if (k >= 1) {
          // Hide the orb and stamp the wrap iteration it was captured in.
          // It reappears in the next loop iteration (see respawn branch
          // below) — same canonical spot, fresh loop copy.
          o.capturing = false;
          o.respawnWrapK = Math.round(
            (shipPos.z - o.loopZ) / LOOP_LENGTH,
          );
          o.group.visible = false;
        }
        continue;
      }

      // -------- Modular loop wrap --------
      // Closed-form: orb sits at the loop image of its canonical Z nearest
      // the ship's projection. No head/tail cursors, no seeding events —
      // works identically at entry, mid-flight, and free-space viewing.
      const wrapK = Math.round((shipPos.z - o.loopZ) / LOOP_LENGTH);

      // -------- Post-capture respawn gate --------
      if (o.respawnWrapK !== Number.NEGATIVE_INFINITY) {
        if (wrapK !== o.respawnWrapK) {
          this.resetOrbVisuals(o);
          // Fall through to position + bob below.
        } else {
          continue;
        }
      }

      o.basePos.set(o.loopX, o.loopY, o.loopZ + wrapK * LOOP_LENGTH);

      // Idle bob + spin.
      o.phase += dt;
      o.group.position.x = o.basePos.x;
      o.group.position.y = o.basePos.y + Math.sin(o.phase * 1.8) * 0.35;
      o.group.position.z = o.basePos.z;
      o.model.rotation.y += dt * 1.3;

      if (!o.active) continue;

      // -------- Pickup check --------
      const ddx = o.group.position.x - shipPos.x;
      const ddy = o.group.position.y - shipPos.y;
      const ddz = o.basePos.z - shipPos.z;
      const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
      if (d2 < PICKUP_RADIUS * PICKUP_RADIUS) {
        this.pickup(o);
      }
    }
  }

  /**
   * Style-specific capture flourish. `k` is normalised progress in [0,1].
   *
   * Each style renders the orb differently:
   *  - ascend  : baseline ankh rise + spin + single ring
   *  - swirl   : steeper rise + orbital sway + paired rings on stagger
   *  - radial  : no rise, flat spin, 4 rings pulsing outward in sequence
   *  - shatter : hold then fast scale-down + 3 quick small rings
   *  - scroll  : tall quick rise + vertical stretch + slim ring
   */
  private animateCapture(o: Orb, k: number, dt: number): void {
    switch (this.captureStyle) {
      case 'ascend': {
        const rise = k * 2.2;
        o.group.position.y = o.basePos.y + rise;
        const preScale = 1 + k * 0.9;
        const shrink = k < 0.5 ? 1 : 1 - (k - 0.5) * 2;
        o.group.scale.setScalar(preScale * shrink);
        o.model.rotation.y += dt * (6 + k * 14);
        break;
      }
      case 'swirl': {
        const rise = k * 2.8;
        const orbitR = Math.sin(k * Math.PI) * 0.9;
        o.group.position.x = o.basePos.x + Math.cos(k * Math.PI * 4) * orbitR;
        o.group.position.z = o.basePos.z + Math.sin(k * Math.PI * 4) * orbitR;
        o.group.position.y = o.basePos.y + rise;
        const s = 1 + k * 0.7;
        const shrink = k < 0.6 ? 1 : 1 - (k - 0.6) * 2.5;
        o.group.scale.setScalar(s * shrink);
        o.model.rotation.y += dt * (10 + k * 22);
        o.model.rotation.x += dt * 3;
        break;
      }
      case 'radial': {
        o.group.position.y = o.basePos.y;
        const s = 1 + Math.sin(k * Math.PI) * 0.35;
        const shrink = k < 0.7 ? 1 : 1 - (k - 0.7) * 3.3;
        o.group.scale.setScalar(s * Math.max(0, shrink));
        // Spin on Z so the flat face of coin/star/cog whirls like a token.
        o.model.rotation.z += dt * (12 + k * 26);
        break;
      }
      case 'shatter': {
        // Brief hold, then rapid scale-down to a glitched burst.
        const hold = k < 0.3 ? 0 : (k - 0.3) / 0.7;
        const jitter = k < 0.3 ? 0 : (Math.random() * 2 - 1) * 0.15;
        o.group.position.x = o.basePos.x + jitter;
        o.group.position.y = o.basePos.y + jitter;
        o.group.scale.setScalar(1 - hold * 0.98);
        o.model.rotation.x += dt * 4;
        o.model.rotation.y += dt * 12;
        break;
      }
      case 'scroll': {
        // Tall, fast vertical launch with a stretched scale so the pickup
        // reads like a quill or scroll jetting skyward.
        const rise = k * 3.4;
        o.group.position.y = o.basePos.y + rise;
        const fade = k < 0.5 ? 1 : 1 - (k - 0.5) * 2;
        o.group.scale.set(1 + k * 0.3, (1 + k * 1.4) * fade, 1 + k * 0.3);
        o.model.rotation.y += dt * (4 + k * 10);
        break;
      }
    }

    // Primary ring burst — common to every style, but sized and faded per-style.
    this.animateBurstRing(o.burst, o.burstMat, k, 0);
    for (const e of o.extraBursts) {
      this.animateBurstRing(e.mesh, e.mat, k, e.phase);
    }
  }

  /** Single expanding ring. `phase` offsets its fire-time in [0,1). */
  private animateBurstRing(
    mesh: Mesh,
    mat: MeshBasicMaterial,
    k: number,
    phase: number,
  ): void {
    const local = k - phase;
    if (local <= 0) {
      mesh.visible = false;
      mat.opacity = 0;
      return;
    }
    mesh.visible = true;
    const bk = Math.min(1, local * 1.4);
    // Different styles get different max expansion. Radial/shatter are larger
    // to sell the pulse; swirl/scroll are tighter.
    const maxR = this.captureStyle === 'radial' ? 6.0
      : this.captureStyle === 'shatter' ? 3.2
      : this.captureStyle === 'swirl' ? 4.2
      : this.captureStyle === 'scroll' ? 3.0
      : 4.6;
    mesh.scale.setScalar(0.4 + bk * maxR);
    mat.opacity = bk < 0.2 ? bk * 5 : Math.max(0, 1 - (bk - 0.2) / 0.8);
  }

  private pickup(o: Orb): void {
    o.active = false;
    o.capturing = true;
    o.captureT = 0;
    o.burst.visible = true;
    o.burst.position.set(0, 0.3, 0);
    for (const e of o.extraBursts) {
      e.mesh.position.set(0, 0.3, 0);
    }
    // Freeze basePos at the actual displayed position so the capture
    // flourish animates around where the player saw the orb, not the
    // canonical pre-wrap coords.
    o.basePos.copy(o.group.position);
    this._collected = Math.min(this.target, this._collected + 1);
    this.events.onPickup(this._collected, this.target);
  }

  /** Remove one collected pickup (e.g. when the player loses a full heart). */
  losePickup(): boolean {
    if (this._collected <= 0) return false;
    this._collected--;
    this.events.onPickup(this._collected, this.target);
    return true;
  }

  reset(): void {
    this._collected = 0;
    for (const o of this.orbs) this.resetOrbVisuals(o);
  }

}
