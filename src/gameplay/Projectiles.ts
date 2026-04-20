import {
  AdditiveBlending,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Scene,
  SphereGeometry,
  Vector3,
} from 'three';
import type { Meteorites } from './Meteorites.ts';
import { type WeaponKind, WEAPON_PALETTE } from './WeaponTypes.ts';

/**
 * Ship weapons — three distinct render kinds, one shared pool architecture.
 *
 * A single `Projectiles` instance owns:
 *   • 32 projectile slots shared between `pulse` (chunky plasma orbs) and
 *     `bolt` (fast narrow slugs). Both travel, both collide per-frame via
 *     Meteorites.tryHit — only geometry / color / speed / damage differ.
 *   • 12 beam-effect slots for `beam` (hit-scan lasers). Beams are NOT
 *     projectiles: we raycast at fire time, apply damage immediately, and
 *     render a brief (~90ms) glowing cylinder from muzzle to impact point.
 *     Players see "a line of light" connecting ship to target — the laser
 *     promise that the old orb-spam was breaking.
 *
 * The `weaponKind` decision lives in WeaponTypes.ts — this file is the
 * renderer / physics, not the rules. Passed in per shot so the player
 * switching loadouts mid-session picks up new visuals on the next trigger
 * pull.
 *
 * Why pool sizes 32 / 12: cadence × lifetime. Bolts fire at ~11/s with
 * 2.5s lifetime → ~28 max, 32 covers the worst case. Beams fire at ~5/s
 * with 90ms fade → well under 12 even at full-auto.
 */

const PROJECTILE_POOL_SIZE = 32;
const BEAM_POOL_SIZE = 12;
/** How long the beam line stays visible on screen after a shot. 90ms is
 *  long enough to register as a discrete "zap" without leaving a
 *  continuous laser-sword look. */
const BEAM_VISUAL_DURATION = 0.09;
/** Max projectile lifetime (safety cap independent of range). */
const PROJECTILE_LIFETIME = 2.5;
/** Tunable radii so the three kinds are visually distinct at a glance. */
const BOLT_RADIUS = 0.16;
const PULSE_RADIUS = 0.55;
const BEAM_RADIUS = 0.14;

interface Projectile {
  mesh: Mesh;
  position: Vector3;
  velocity: Vector3;
  direction: Vector3;
  life: number;
  distanceTraveled: number;
  range: number;
  damage: number;
  kind: WeaponKind; // never 'beam' while active — beams don't live here
  active: boolean;
}

interface BeamEffect {
  mesh: Mesh;
  material: MeshBasicMaterial;
  life: number;
  active: boolean;
}

export type FireChannel = 'primary' | 'secondary';

export class Projectiles {
  private scene: Scene | null = null;
  private readonly group = new Group();
  private readonly projectiles: Projectile[] = [];
  private readonly beams: BeamEffect[] = [];
  /** Cooldowns tracked per channel so holding both LMB and RMB fires
   *  each weapon at its own rate — without this the secondary weapon
   *  would just eat the primary's cadence or vice-versa. */
  private primaryCooldown = 0;
  private secondaryCooldown = 0;

  // Shared materials per projectile kind, so a pulse bolt and a bolt bolt
  // don't share geometry/material and don't need per-shot allocations.
  private pulseMat!: MeshBasicMaterial;
  private boltMat!: MeshBasicMaterial;
  private pulseGeo!: SphereGeometry;
  private boltGeo!: SphereGeometry;
  /** Beam geometry is a unit cylinder along +Y; per-shot we scale Y to
   *  the beam length and rotate to point at the hit. Shared across all
   *  beams because the visual only differs in color, which the material
   *  owns — we clone the material per beam for independent fade. */
  private beamGeo!: CylinderGeometry;

  init(scene: Scene): void {
    this.scene = scene;
    scene.add(this.group);

    // One geometry per projectile size — reused across the pool.
    this.pulseGeo = new SphereGeometry(PULSE_RADIUS, 12, 10);
    this.boltGeo = new SphereGeometry(BOLT_RADIUS, 10, 8);
    this.beamGeo = new CylinderGeometry(BEAM_RADIUS, BEAM_RADIUS, 1, 10, 1, true);

    this.pulseMat = new MeshBasicMaterial({
      color: WEAPON_PALETTE.pulse.core,
      transparent: true,
      opacity: 0.92,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.boltMat = new MeshBasicMaterial({
      color: WEAPON_PALETTE.bolt.core,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
    });

    // Projectile pool — allocate both geometries so we can swap a slot
    // from bolt to pulse without reallocating. Initial state: bolt.
    for (let i = 0; i < PROJECTILE_POOL_SIZE; i++) {
      const mesh = new Mesh(this.boltGeo, this.boltMat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.projectiles.push({
        mesh,
        position: new Vector3(),
        velocity: new Vector3(),
        direction: new Vector3(0, 0, -1),
        life: 0,
        distanceTraveled: 0,
        range: 0,
        damage: 0,
        kind: 'bolt',
        active: false,
      });
    }

    // Beam pool — each beam owns its own material so the fade timer
    // doesn't leak across shots. Geometry is shared (cylinders are cheap
    // to scale; per-shot allocation would add ~100µs * 5/s of GC churn).
    for (let i = 0; i < BEAM_POOL_SIZE; i++) {
      const mat = new MeshBasicMaterial({
        color: WEAPON_PALETTE.beam.core,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new Mesh(this.beamGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.beams.push({ mesh, material: mat, life: 0, active: false });
    }
  }

  /**
   * Request a shot this frame. Rate-limits internally via per-channel
   * cooldowns so the caller can hand `input.fire` / `input.fireSecondary`
   * straight every tick without the primary weapon stealing the
   * secondary's timing or vice-versa. `meteorites` is needed here (not
   * just in update) because beams are hitscan — they resolve damage at
   * fire time, not next frame.
   */
  pullTrigger(
    origin: Vector3,
    direction: Vector3,
    shipVelWorld: Vector3,
    kind: WeaponKind,
    meteorites: Meteorites,
    channel: FireChannel = 'primary',
  ): void {
    const cd = channel === 'primary' ? this.primaryCooldown : this.secondaryCooldown;
    if (cd > 0) return;
    const spec = WEAPON_PALETTE[kind];
    if (kind === 'beam') {
      this.fireBeam(origin, direction, meteorites, spec.range, spec.damage);
    } else {
      this.fireProjectile(origin, direction, shipVelWorld, kind, spec);
    }
    if (channel === 'primary') this.primaryCooldown = spec.cooldown;
    else this.secondaryCooldown = spec.cooldown;
  }

  private fireBeam(
    origin: Vector3,
    direction: Vector3,
    meteorites: Meteorites,
    range: number,
    damage: number,
  ): void {
    // Hitscan: step along the ray in discrete chunks and let
    // Meteorites.tryHit do the sphere test at each step. Stop on first
    // hit. Stepping is cheaper than a full O(N) swept test and keeps
    // the point-vs-sphere code paths aligned with bolts/pulse.
    const STEP = 4; // world units per sample
    const maxSteps = Math.ceil(range / STEP);
    const probe = _scratchProbe;
    let hitAt: Vector3 | null = null;
    for (let i = 1; i <= maxSteps; i++) {
      probe.copy(direction).multiplyScalar(i * STEP).add(origin);
      const hit = meteorites.tryHit(probe, direction, damage);
      if (hit) {
        hitAt = hit.position.clone();
        break;
      }
    }

    const endpoint = hitAt ?? _scratchEnd.copy(direction).multiplyScalar(range).add(origin);
    const slot = this.acquireBeam();
    if (!slot) return;
    this.orientBeam(slot, origin, endpoint);
    slot.material.opacity = 1;
    slot.life = BEAM_VISUAL_DURATION;
    slot.active = true;
    slot.mesh.visible = true;
  }

  private fireProjectile(
    origin: Vector3,
    direction: Vector3,
    shipVelWorld: Vector3,
    kind: 'pulse' | 'bolt',
    spec: { core: number; glow: number; speed: number; damage: number; cooldown: number; range: number },
  ): void {
    const slot = this.acquireProjectile();
    if (!slot) return;
    // Swap geometry/material if this slot was previously a different kind.
    if (slot.kind !== kind) {
      slot.mesh.geometry = kind === 'pulse' ? this.pulseGeo : this.boltGeo;
      slot.mesh.material = kind === 'pulse' ? this.pulseMat : this.boltMat;
      slot.kind = kind;
    }
    slot.position.copy(origin);
    slot.direction.copy(direction).normalize();
    slot.velocity.copy(slot.direction).multiplyScalar(spec.speed).add(shipVelWorld);
    slot.life = PROJECTILE_LIFETIME;
    slot.distanceTraveled = 0;
    slot.range = spec.range;
    slot.damage = spec.damage;
    slot.mesh.position.copy(origin);
    slot.mesh.visible = true;
    slot.active = true;
  }

  update(dt: number, meteorites: Meteorites): void {
    this.primaryCooldown = Math.max(0, this.primaryCooldown - dt);
    this.secondaryCooldown = Math.max(0, this.secondaryCooldown - dt);

    // ---- projectiles ----
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (!p.active) continue;

      const stepX = p.velocity.x * dt;
      const stepY = p.velocity.y * dt;
      const stepZ = p.velocity.z * dt;
      p.position.x += stepX;
      p.position.y += stepY;
      p.position.z += stepZ;
      p.distanceTraveled += Math.hypot(stepX, stepY, stepZ);
      p.mesh.position.copy(p.position);
      p.life -= dt;

      if (p.life <= 0 || p.distanceTraveled >= p.range) {
        this.deactivateProjectile(p);
        continue;
      }
      const hit = meteorites.tryHit(p.position, p.direction, p.damage);
      if (hit) this.deactivateProjectile(p);
    }

    // ---- beams ----
    for (let i = 0; i < this.beams.length; i++) {
      const b = this.beams[i];
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.active = false;
        b.mesh.visible = false;
        b.material.opacity = 0;
        continue;
      }
      // Linear fade 1→0 over BEAM_VISUAL_DURATION.
      b.material.opacity = Math.max(0, b.life / BEAM_VISUAL_DURATION);
    }
  }

  dispose(): void {
    // Shared geos + mats are owned by this class — free them.
    this.pulseGeo?.dispose();
    this.boltGeo?.dispose();
    this.beamGeo?.dispose();
    this.pulseMat?.dispose();
    this.boltMat?.dispose();
    for (const b of this.beams) b.material.dispose();
    if (this.scene) this.scene.remove(this.group);
    this.scene = null;
    this.projectiles.length = 0;
    this.beams.length = 0;
  }

  // ---- internals ----

  private acquireProjectile(): Projectile | null {
    for (let i = 0; i < this.projectiles.length; i++) {
      if (!this.projectiles[i].active) return this.projectiles[i];
    }
    return null;
  }

  private acquireBeam(): BeamEffect | null {
    for (let i = 0; i < this.beams.length; i++) {
      if (!this.beams[i].active) return this.beams[i];
    }
    return null;
  }

  private deactivateProjectile(p: Projectile): void {
    p.active = false;
    p.mesh.visible = false;
  }

  /**
   * Orient a beam mesh so a unit cylinder (Y-axis, length 1) becomes a
   * segment from `from` to `to`. three.js's built-in cylinder is Y-up
   * centred at origin, so we scale Y to the segment length, translate
   * to the midpoint, and rotate the cylinder's up axis onto the
   * segment direction.
   */
  private orientBeam(slot: BeamEffect, from: Vector3, to: Vector3): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dy, dz) || 1;
    const mid = _scratchMid.set(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2,
      (from.z + to.z) / 2,
    );
    slot.mesh.position.copy(mid);
    slot.mesh.scale.set(1, length, 1);
    // Rotation: align +Y with the segment direction. lookAt expects a
    // +Z alignment, so we aim the mesh at `to` and then tilt -90° X so
    // the cylinder's length (Y) lies along what was previously forward.
    slot.mesh.lookAt(to);
    slot.mesh.rotateX(Math.PI / 2);
  }
}

// Scratch vectors kept at module scope so the hot path doesn't allocate.
const _scratchProbe = new Vector3();
const _scratchEnd = new Vector3();
const _scratchMid = new Vector3();
