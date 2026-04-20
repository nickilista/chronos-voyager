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
import type { Enemies } from './Enemies.ts';
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

const PROJECTILE_POOL_SIZE = 48;
const BEAM_POOL_SIZE = 12;
const TRAIL_POOL_SIZE = 64;
/** How long the beam line stays visible on screen after a shot. 90ms is
 *  long enough to register as a discrete "zap" without leaving a
 *  continuous laser-sword look. */
const BEAM_VISUAL_DURATION = 0.09;
/** Max projectile lifetime (safety cap independent of range).
 *  Tuned so the slowest projectile (missile at 95 u/s, range 1100)
 *  can reach its full range: 1100/95 ≈ 11.6s, so 15s = comfortable
 *  buffer. Faster weapons (bolt, gatling) will still hit their range
 *  cutoff in the 2–4s span — this cap only fires when a missile
 *  somehow misses everything and flies into the void. */
const PROJECTILE_LIFETIME = 15;
/** Tunable radii so each kind is visually distinct at a glance. */
const BOLT_RADIUS = 0.16;
const PULSE_RADIUS = 0.55;
const BEAM_RADIUS = 0.14;
const MISSILE_RADIUS = 0.42;
const GATLING_RADIUS = 0.09;
/** How often a missile spawns a new smoke puff behind itself (seconds). */
const MISSILE_TRAIL_INTERVAL = 0.04;
/** Lifetime of a single trail puff (seconds). Dictates how long the
 *  smoky ribbon stays visible after the missile has passed. */
const TRAIL_PUFF_LIFETIME = 0.55;

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
  /** For missiles only: seconds since the last trail puff was emitted.
   *  When > MISSILE_TRAIL_INTERVAL, a new puff is spawned at the
   *  missile's current position. Unused for non-missile kinds. */
  trailTimer: number;
}

interface TrailPuff {
  mesh: Mesh;
  material: MeshBasicMaterial;
  life: number;
  maxLife: number;
  baseScale: number;
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

  // Shared materials + geometries per projectile kind. Pool slots swap
  // their mesh.geometry / .material pointers when the kind changes
  // between shots (a single slot might be a pulse one frame and a bolt
  // the next) — zero allocations per-shot.
  private pulseMat!: MeshBasicMaterial;
  private boltMat!: MeshBasicMaterial;
  private missileMat!: MeshBasicMaterial;
  private gatlingMat!: MeshBasicMaterial;
  private pulseGeo!: SphereGeometry;
  private boltGeo!: SphereGeometry;
  private missileGeo!: SphereGeometry;
  private gatlingGeo!: SphereGeometry;
  /** Beam geometry is a unit cylinder along +Y; per-shot we scale Y to
   *  the beam length and rotate to point at the hit. Shared across all
   *  beams because the visual only differs in color, which the material
   *  owns — we clone the material per beam for independent fade. */
  private beamGeo!: CylinderGeometry;

  // Trail puff pool — missiles emit short-lived grey embers that fade
  // while shrinking, painting a visible smoky ribbon behind the
  // ordnance. Also available to future kinds that want a trail.
  private readonly trailPuffs: TrailPuff[] = [];
  private trailPuffGeo!: SphereGeometry;

  init(scene: Scene): void {
    this.scene = scene;
    scene.add(this.group);

    // One geometry per projectile size — reused across the pool.
    this.pulseGeo = new SphereGeometry(PULSE_RADIUS, 12, 10);
    this.boltGeo = new SphereGeometry(BOLT_RADIUS, 10, 8);
    this.missileGeo = new SphereGeometry(MISSILE_RADIUS, 12, 10);
    this.gatlingGeo = new SphereGeometry(GATLING_RADIUS, 8, 6);
    this.beamGeo = new CylinderGeometry(BEAM_RADIUS, BEAM_RADIUS, 1, 10, 1, true);
    this.trailPuffGeo = new SphereGeometry(0.38, 8, 6);

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
    // Missiles: warm orange core. Not additive — we want the missile
    // body to read as a solid object with a smoky plume, not a puff
    // of light. The plume itself is additive via the trail puffs.
    this.missileMat = new MeshBasicMaterial({
      color: WEAPON_PALETTE.missile.core,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    this.gatlingMat = new MeshBasicMaterial({
      color: WEAPON_PALETTE.gatling.core,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
    });

    // Projectile pool — allocate both geometries so we can swap a slot
    // between kinds without reallocating. Initial state: bolt.
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
        trailTimer: 0,
      });
    }

    // Trail puff pool. Each puff is a dim grey additive sphere that
    // fades out while its scale shrinks — cheap visual for "the missile
    // left something behind". Pool is plenty for worst-case
    // (missile cooldown 0.45s × trail emit 0.04s × lifetime 0.55s ×
    // ~5 concurrent missiles ≈ 68, so 64 is close enough; occasional
    // drop is invisible at play speed).
    for (let i = 0; i < TRAIL_POOL_SIZE; i++) {
      const mat = new MeshBasicMaterial({
        color: 0xddc8a8,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new Mesh(this.trailPuffGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.trailPuffs.push({
        mesh, material: mat, life: 0, maxLife: 0, baseScale: 1, active: false,
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
    kind: Exclude<WeaponKind, 'beam'>,
    spec: { core: number; glow: number; speed: number; damage: number; cooldown: number; range: number },
  ): void {
    const slot = this.acquireProjectile();
    if (!slot) return;
    // Swap geometry/material if this slot was previously a different kind.
    if (slot.kind !== kind) {
      slot.mesh.geometry = this.geoFor(kind);
      slot.mesh.material = this.matFor(kind);
      slot.kind = kind;
    }
    slot.position.copy(origin);
    slot.direction.copy(direction).normalize();
    slot.velocity.copy(slot.direction).multiplyScalar(spec.speed).add(shipVelWorld);
    slot.life = PROJECTILE_LIFETIME;
    slot.distanceTraveled = 0;
    slot.range = spec.range;
    slot.damage = spec.damage;
    slot.trailTimer = 0;
    slot.mesh.position.copy(origin);
    slot.mesh.visible = true;
    slot.active = true;
  }

  private geoFor(kind: Exclude<WeaponKind, 'beam'>): SphereGeometry {
    switch (kind) {
      case 'pulse':   return this.pulseGeo;
      case 'bolt':    return this.boltGeo;
      case 'missile': return this.missileGeo;
      case 'gatling': return this.gatlingGeo;
    }
  }

  private matFor(kind: Exclude<WeaponKind, 'beam'>): MeshBasicMaterial {
    switch (kind) {
      case 'pulse':   return this.pulseMat;
      case 'bolt':    return this.boltMat;
      case 'missile': return this.missileMat;
      case 'gatling': return this.gatlingMat;
    }
  }

  update(dt: number, meteorites: Meteorites, enemies?: Enemies): void {
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

      // Missile smoke trail. Emit a puff every
      // MISSILE_TRAIL_INTERVAL seconds; puffs own their own fade so
      // the ribbon gracefully thins out after the missile impacts.
      if (p.kind === 'missile') {
        p.trailTimer += dt;
        if (p.trailTimer >= MISSILE_TRAIL_INTERVAL) {
          p.trailTimer = 0;
          this.emitTrailPuff(p.position);
        }
      }

      if (p.life <= 0 || p.distanceTraveled >= p.range) {
        this.deactivateProjectile(p);
        continue;
      }
      // Enemies get tested BEFORE meteorites — a bullet that brushes
      // both should credit the enemy (higher-value target + dedicated
      // threat). Short-circuit on hit.
      const enemyHit = enemies?.tryHit(p.position, p.direction, p.damage);
      if (enemyHit) {
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

    // ---- trail puffs ----
    for (let i = 0; i < this.trailPuffs.length; i++) {
      const t = this.trailPuffs[i];
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        t.mesh.visible = false;
        t.material.opacity = 0;
        continue;
      }
      const k = t.life / t.maxLife; // 1 → 0
      t.material.opacity = 0.8 * k;
      // Puff grows as it fades so the trail has a soft blooming feel
      // rather than a line of identical dots.
      const scale = t.baseScale * (0.6 + 1.6 * (1 - k));
      t.mesh.scale.setScalar(scale);
    }
  }

  private emitTrailPuff(at: Vector3): void {
    for (let i = 0; i < this.trailPuffs.length; i++) {
      const t = this.trailPuffs[i];
      if (t.active) continue;
      t.active = true;
      t.maxLife = TRAIL_PUFF_LIFETIME;
      t.life = TRAIL_PUFF_LIFETIME;
      t.baseScale = 0.85 + Math.random() * 0.4;
      t.mesh.position.copy(at);
      t.mesh.scale.setScalar(t.baseScale);
      t.mesh.visible = true;
      t.material.opacity = 0.8;
      return;
    }
    // Pool exhausted — drop silently; missed trail frame is invisible
    // at play speed and not worth evicting an in-flight puff for.
  }

  dispose(): void {
    // Shared geos + mats are owned by this class — free them.
    this.pulseGeo?.dispose();
    this.boltGeo?.dispose();
    this.missileGeo?.dispose();
    this.gatlingGeo?.dispose();
    this.beamGeo?.dispose();
    this.trailPuffGeo?.dispose();
    this.pulseMat?.dispose();
    this.boltMat?.dispose();
    this.missileMat?.dispose();
    this.gatlingMat?.dispose();
    for (const b of this.beams) b.material.dispose();
    for (const t of this.trailPuffs) t.material.dispose();
    if (this.scene) this.scene.remove(this.group);
    this.scene = null;
    this.projectiles.length = 0;
    this.beams.length = 0;
    this.trailPuffs.length = 0;
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
