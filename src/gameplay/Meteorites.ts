import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Scene,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Free-space meteorite field.
 *
 * The game lives in two modes: inside a flow corridor (structured, rail-like
 * gameplay) and outside in the galaxy map (open 3D). The outside was visually
 * pretty but mechanically empty — nothing to shoot, nothing to dodge, no
 * reason to fly off the rails. Meteorites give the outside its own
 * gameplay loop: hazards to evade, targets to shoot, and drops to collect.
 *
 * Design constraints we inherit from the existing codebase:
 *   • We must NOT spawn inside corridor tubes — those are their own sealed
 *     mini-levels. The caller passes `canSpawn` each frame based on
 *     `flowManager.activeFlow == null`.
 *   • Max 40 active at once (config). With 5 types and per-instance rotation
 *     we use per-instance Meshes rather than InstancedMesh — at this count
 *     the draw-call overhead is trivial and we get cheap per-instance
 *     material tints for the hit-flash.
 *   • Bloom post already runs, so any emissive>0 picks up a nice glow.
 *
 * Spawn pattern: each interval, roll (1) cluster vs. lone, (2) pick a type
 * from weighted table, (3) place `spawnDistance` ahead of the ship along
 * its velocity with random lateral scatter. Meteorites drift in a mostly
 * opposing direction so the player is "flying through a field" rather than
 * being tailgated.
 *
 * Drops: when a meteorite is destroyed and the roll against `dropChance`
 * succeeds, we fire `onDrop` — the actual pickup/unlock wiring is
 * handled by the caller (ship-part inventory is out of scope for this file).
 */

// Shared with the ship's collision radius constant. The ship is ~1.35u across
// at the assembled model's scale; matching that here keeps the hitbox fair —
// no "I flew through it!" complaints — without being punitive.
export const SHIP_COLLIDER_RADIUS = 1.35;

// Duration of the red-emissive flash after a non-destroying hit. Short
// enough not to desensitize the eye, long enough to read as discrete feedback.
const HIT_FLASH_SECONDS = 0.12;

export type MeteoriteType = 'rocky' | 'jagged' | 'magma' | 'crystal' | 'iron';

interface MeteoriteTypeConfig {
  hp: number;
  speedRange: [number, number];
  scaleRange: [number, number];
  dropChance: number;
  touchDamage: number;
  color: string;
  rare?: boolean;
}

interface SpawnRules {
  maxActive: number;
  spawnIntervalSeconds: [number, number];
  clusterChance: number;
  clusterSize: [number, number];
  spawnDistance: number;
  despawnDistance: number;
  freeSpaceOnly: boolean;
}

interface MeteoritesConfig {
  meteorites: Record<MeteoriteType, MeteoriteTypeConfig>;
  spawnRules: SpawnRules;
  weightings: Record<MeteoriteType, number>;
}

/**
 * One live meteorite. Kept flat (no class) because we iterate over these
 * every frame — array-of-structs shape means we never box a method call
 * in the hot path.
 */
interface MeteoriteInstance {
  mesh: Group;
  position: Vector3;
  velocity: Vector3;
  rotationVel: Vector3;
  hp: number;
  maxHp: number;
  scale: number;
  type: MeteoriteType;
  touchDamage: number;
  dropChance: number;
  /** Collider radius (derived from scale). Cached to avoid a `*` per test. */
  radius: number;
  /** Seconds remaining on the red hit-flash; 0 when not flashing. */
  flashT: number;
  /** Every MeshStandardMaterial inside the mesh, cloned per-instance so
   *  hit-flash tints don't leak across the pool. */
  mats: MeshStandardMaterial[];
  /** Original emissive color per material, restored when the flash ends. */
  baseEmissives: Color[];
  /** Original emissive intensity per material. */
  baseEmissiveIntensities: number[];
  active: boolean;
}

export interface HitResult {
  meteorite: MeteoriteInstance;
  destroyed: boolean;
  position: Vector3;
}

export interface MeteoritesCallbacks {
  /** Ship physically collided with a meteorite. Caller decides shield vs. HP. */
  onHitShip(damage: number): void;
  /** Projectile dealt the killing blow. Caller plays explosion VFX here. */
  onDestroyed(position: Vector3, scale: number, type: MeteoriteType): void;
  /** Drop roll succeeded. Caller spawns the pickup / unlock notification. */
  onDrop(position: Vector3, type: MeteoriteType): void;
}

const TYPE_ORDER: MeteoriteType[] = ['rocky', 'jagged', 'magma', 'crystal', 'iron'];

/** Pooled scratch vectors — per-class to keep hot-path allocations at zero. */
const _tmpDir = new Vector3();
const _tmpLateral = new Vector3();
const _tmpUp = new Vector3();
const _tmpRight = new Vector3();

export class Meteorites {
  private scene: Scene | null = null;
  private readonly group = new Group();
  private readonly callbacks: MeteoritesCallbacks;

  private config: MeteoritesConfig | null = null;
  /** One canonical Group per type — deep-cloned on spawn. */
  private readonly prototypes = new Map<MeteoriteType, Group>();
  /** Weighted-pick table built once after config load. */
  private weightedTypes: MeteoriteType[] = [];

  private readonly active: MeteoriteInstance[] = [];
  /** Objects kept around so we can recycle geometry/material memory. */
  private readonly inactive: MeteoriteInstance[] = [];
  private spawnCooldown = 0;

  constructor(callbacks: MeteoritesCallbacks) {
    this.callbacks = callbacks;
  }

  async init(scene: Scene): Promise<void> {
    this.scene = scene;
    scene.add(this.group);

    const loader = new GLTFLoader();
    const cfgRes = await fetch('/models/meteorites-config.json');
    if (!cfgRes.ok) throw new Error('Meteorites: failed to fetch config');
    this.config = (await cfgRes.json()) as MeteoritesConfig;

    // Preload one GLB per type. Stored as the master prototype; every spawn
    // gets a deep clone so rotation/material tint stays per-instance.
    const loads = TYPE_ORDER.map(async (t) => {
      const gltf = await loader.loadAsync(`/models/meteorites/meteorite_${t}.glb`);
      this.prototypes.set(t, gltf.scene as unknown as Group);
    });
    await Promise.all(loads);

    // Build a sampling array weighted by config.weightings. Snapshot-in-time;
    // if we rebalance we reload the config, not this table.
    this.buildWeightTable();

    // Seed the first spawn so the player doesn't fly for 5s in an empty void
    // waiting for the interval to elapse.
    this.spawnCooldown = 0.5;
  }

  private buildWeightTable(): void {
    if (!this.config) return;
    const GRANULARITY = 100;
    const weights = this.config.weightings;
    const total = TYPE_ORDER.reduce((s, t) => s + (weights[t] ?? 0), 0);
    if (total <= 0) {
      this.weightedTypes = ['rocky'];
      return;
    }
    const bucket: MeteoriteType[] = [];
    for (const t of TYPE_ORDER) {
      const share = Math.round(((weights[t] ?? 0) / total) * GRANULARITY);
      for (let i = 0; i < share; i++) bucket.push(t);
    }
    this.weightedTypes = bucket.length > 0 ? bucket : ['rocky'];
  }

  update(dt: number, shipPos: Vector3, shipVel: Vector3, canSpawn: boolean): void {
    if (!this.config) return;

    const rules = this.config.spawnRules;

    // Advance spawn timer. We count down even when outside free space — it's
    // simpler than stopping/starting, and the gated `canSpawn` below prevents
    // actual placement inside a corridor.
    this.spawnCooldown -= dt;
    if (
      canSpawn &&
      this.spawnCooldown <= 0 &&
      this.active.length < rules.maxActive
    ) {
      if (Math.random() < rules.clusterChance) {
        this.spawnCluster(shipPos, shipVel);
      } else {
        this.spawnOne(shipPos, shipVel);
      }
      const [lo, hi] = rules.spawnIntervalSeconds;
      this.spawnCooldown = lo + Math.random() * (hi - lo);
    }

    // Update all active meteorites. We iterate front-to-back and collect
    // removals to apply after the loop so we never mutate the array mid-walk.
    const despawnSq = rules.despawnDistance * rules.despawnDistance;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const m = this.active[i];
      m.position.addScaledVector(m.velocity, dt);
      m.mesh.position.copy(m.position);
      m.mesh.rotation.x += m.rotationVel.x * dt;
      m.mesh.rotation.y += m.rotationVel.y * dt;
      m.mesh.rotation.z += m.rotationVel.z * dt;

      // Hit-flash bookkeeping. One tint value is shared across all materials
      // in a given mesh; per-material emissive resets when the timer runs out.
      if (m.flashT > 0) {
        m.flashT -= dt;
        if (m.flashT <= 0) {
          this.clearFlash(m);
        }
      }

      // Despawn if the ship has outrun it.
      const dx = m.position.x - shipPos.x;
      const dy = m.position.y - shipPos.y;
      const dz = m.position.z - shipPos.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq > despawnSq) {
        this.recycle(i);
        continue;
      }

      // Ship-vs-meteorite sphere test. On hit we destroy the meteorite
      // (touch is catastrophic for it) and tell the caller the damage value
      // so shield/HP bookkeeping stays in one place.
      const sumR = m.radius + SHIP_COLLIDER_RADIUS;
      if (distSq < sumR * sumR) {
        this.callbacks.onHitShip(m.touchDamage);
        this.callbacks.onDestroyed(m.position.clone(), m.scale, m.type);
        if (Math.random() < m.dropChance) {
          this.callbacks.onDrop(m.position.clone(), m.type);
        }
        this.recycle(i);
        continue;
      }
    }
  }

  /**
   * Projectile impact test. The caller (Projectiles) iterates its bullets
   * and asks each frame whether any meteorite is on the bullet's line — we
   * do a simple point-vs-sphere because bullets already step in small
   * increments and a full raycast across hundreds of meshes would be
   * overkill for the count.
   *
   * rayOrigin is the bullet's CURRENT position. rayDir is unused right now
   * but part of the signature so we can upgrade to swept-sphere later
   * without touching the call site.
   */
  tryHit(rayOrigin: Vector3, _rayDir: Vector3, damage: number): HitResult | null {
    for (let i = 0; i < this.active.length; i++) {
      const m = this.active[i];
      const dx = m.position.x - rayOrigin.x;
      const dy = m.position.y - rayOrigin.y;
      const dz = m.position.z - rayOrigin.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq <= m.radius * m.radius) {
        m.hp -= damage;
        if (m.hp <= 0) {
          const pos = m.position.clone();
          this.callbacks.onDestroyed(pos, m.scale, m.type);
          if (Math.random() < m.dropChance) {
            this.callbacks.onDrop(pos, m.type);
          }
          this.recycle(i);
          return { meteorite: m, destroyed: true, position: pos };
        }
        this.applyFlash(m);
        return { meteorite: m, destroyed: false, position: m.position.clone() };
      }
    }
    return null;
  }

  dispose(): void {
    for (const m of this.active) this.releaseMesh(m);
    for (const m of this.inactive) this.releaseMesh(m);
    this.active.length = 0;
    this.inactive.length = 0;
    if (this.scene) this.scene.remove(this.group);
    this.scene = null;
  }

  // ---- internals ----

  private spawnOne(shipPos: Vector3, shipVel: Vector3): void {
    if (!this.config) return;
    const rules = this.config.spawnRules;
    const type = this.pickType();
    const center = this.pickSpawnCenter(shipPos, shipVel, rules.spawnDistance);
    this.spawnAt(type, center, shipVel);
  }

  private spawnCluster(shipPos: Vector3, shipVel: Vector3): void {
    if (!this.config) return;
    const rules = this.config.spawnRules;
    const [lo, hi] = rules.clusterSize;
    const count = lo + Math.floor(Math.random() * (hi - lo + 1));
    const center = this.pickSpawnCenter(shipPos, shipVel, rules.spawnDistance);
    // All cluster members share a type so the result reads as "a belt of X"
    // rather than a mixed-species chaos ball. Pick once, reuse.
    const type = this.pickType();
    const clusterRadius = 30;
    for (let i = 0; i < count; i++) {
      if (this.active.length >= rules.maxActive) break;
      _tmpLateral.set(
        (Math.random() - 0.5) * 2 * clusterRadius,
        (Math.random() - 0.5) * 2 * clusterRadius,
        (Math.random() - 0.5) * 2 * clusterRadius,
      );
      const pos = center.clone().add(_tmpLateral);
      this.spawnAt(type, pos, shipVel);
    }
  }

  /**
   * Pick a spawn center `spawnDistance` ahead of the ship along its velocity
   * vector, with a wide lateral scatter so the field feels three-dimensional
   * rather than rail-like. Falls back to world -Z if the ship is stationary.
   */
  private pickSpawnCenter(
    shipPos: Vector3,
    shipVel: Vector3,
    spawnDistance: number,
  ): Vector3 {
    _tmpDir.copy(shipVel);
    if (_tmpDir.lengthSq() < 1e-4) {
      _tmpDir.set(0, 0, -1);
    } else {
      _tmpDir.normalize();
    }
    // Build a lateral basis. cross with world-up unless the ship is flying
    // straight up/down, in which case fall back to world -Z for the cross.
    _tmpUp.set(0, 1, 0);
    if (Math.abs(_tmpDir.y) > 0.95) _tmpUp.set(0, 0, -1);
    _tmpRight.copy(_tmpDir).cross(_tmpUp).normalize();
    _tmpUp.copy(_tmpRight).cross(_tmpDir).normalize();
    // Lateral scatter up to ~40% of spawn distance: keeps meteorites inside
    // the player's view frustum without dumping them directly on the nose.
    const lateral = spawnDistance * 0.35;
    const ox = (Math.random() - 0.5) * 2 * lateral;
    const oy = (Math.random() - 0.5) * 2 * lateral;
    return shipPos.clone()
      .addScaledVector(_tmpDir, spawnDistance)
      .addScaledVector(_tmpRight, ox)
      .addScaledVector(_tmpUp, oy);
  }

  private pickType(): MeteoriteType {
    if (this.weightedTypes.length === 0) return 'rocky';
    return this.weightedTypes[Math.floor(Math.random() * this.weightedTypes.length)];
  }

  private spawnAt(type: MeteoriteType, pos: Vector3, shipVel: Vector3): void {
    if (!this.config) return;
    const typeCfg = this.config.meteorites[type];
    const [minS, maxS] = typeCfg.scaleRange;
    const scale = minS + Math.random() * (maxS - minS);
    const [minV, maxV] = typeCfg.speedRange;
    const speed = minV + Math.random() * (maxV - minV);

    // Meteorites drift in a direction skewed AGAINST the ship's velocity,
    // with random jitter — that way the field feels like moving debris
    // rather than a static scatter. Opposing 60% / random 40% is a nice mix.
    _tmpDir.copy(shipVel);
    if (_tmpDir.lengthSq() < 1e-4) _tmpDir.set(0, 0, -1);
    else _tmpDir.negate().normalize();
    const jitter = new Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5,
    ).normalize();
    const vel = _tmpDir.clone().multiplyScalar(0.6).add(jitter.multiplyScalar(0.4))
      .normalize().multiplyScalar(speed);

    // Spin: random axis, rate proportional to ~1/scale so big rocks tumble
    // slowly and tiny shards whirl fast. Reads more convincingly physical.
    const rotSpeed = 0.3 + Math.random() * 1.2 / Math.max(0.5, scale);
    const rotAxis = new Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5,
    ).normalize();

    const inst = this.acquireInstance(type, scale, typeCfg);
    inst.position.copy(pos);
    inst.velocity.copy(vel);
    inst.rotationVel.set(rotAxis.x * rotSpeed, rotAxis.y * rotSpeed, rotAxis.z * rotSpeed);
    inst.hp = typeCfg.hp;
    inst.maxHp = typeCfg.hp;
    inst.flashT = 0;

    inst.mesh.position.copy(pos);
    inst.mesh.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
    inst.mesh.scale.setScalar(scale);
    inst.mesh.visible = true;

    this.group.add(inst.mesh);
    this.active.push(inst);
  }

  /**
   * Pull a recycled instance if one exists for this type, else build a fresh
   * one from the prototype. Recycling matters because every spawn otherwise
   * allocates new geometry/material GPU buffers — at 40-active churn that
   * piles up driver pressure fast.
   */
  private acquireInstance(
    type: MeteoriteType,
    scale: number,
    typeCfg: MeteoriteTypeConfig,
  ): MeteoriteInstance {
    for (let i = 0; i < this.inactive.length; i++) {
      if (this.inactive[i].type === type) {
        const existing = this.inactive.splice(i, 1)[0];
        existing.scale = scale;
        existing.radius = scale * 1.0;
        existing.touchDamage = typeCfg.touchDamage;
        existing.dropChance = typeCfg.dropChance;
        existing.active = true;
        return existing;
      }
    }

    const proto = this.prototypes.get(type);
    if (!proto) throw new Error(`Meteorites: no prototype loaded for type ${type}`);
    // Shallow-scene clone is adequate — these are static meshes, no skinning.
    // Materials are shared across clones by three.js by default, so we walk
    // the tree and clone each MeshStandardMaterial so per-instance emissive
    // tints (hit-flash) don't leak into sibling meteorites.
    const mesh = proto.clone(true) as Group;
    const mats: MeshStandardMaterial[] = [];
    const baseEmissives: Color[] = [];
    const baseEmissiveIntensities: number[] = [];
    mesh.traverse((obj) => {
      const anyMesh = obj as Mesh;
      if (!anyMesh.isMesh) return;
      if (Array.isArray(anyMesh.material)) {
        anyMesh.material = anyMesh.material.map((mat) => {
          const m = (mat as MeshStandardMaterial).clone();
          mats.push(m);
          baseEmissives.push(m.emissive.clone());
          baseEmissiveIntensities.push(m.emissiveIntensity);
          return m;
        });
      } else {
        const m = (anyMesh.material as MeshStandardMaterial).clone();
        anyMesh.material = m;
        mats.push(m);
        baseEmissives.push(m.emissive.clone());
        baseEmissiveIntensities.push(m.emissiveIntensity);
      }
    });

    const inst: MeteoriteInstance = {
      mesh,
      position: new Vector3(),
      velocity: new Vector3(),
      rotationVel: new Vector3(),
      hp: typeCfg.hp,
      maxHp: typeCfg.hp,
      scale,
      type,
      touchDamage: typeCfg.touchDamage,
      dropChance: typeCfg.dropChance,
      radius: scale * 1.0,
      flashT: 0,
      mats,
      baseEmissives,
      baseEmissiveIntensities,
      active: true,
    };
    return inst;
  }

  private recycle(index: number): void {
    const inst = this.active[index];
    // Swap-remove to keep the active array dense; order doesn't matter.
    const last = this.active.length - 1;
    if (index !== last) this.active[index] = this.active[last];
    this.active.pop();
    this.group.remove(inst.mesh);
    inst.mesh.visible = false;
    inst.active = false;
    if (inst.flashT > 0) {
      this.clearFlash(inst);
    }
    this.inactive.push(inst);
  }

  private applyFlash(m: MeteoriteInstance): void {
    m.flashT = HIT_FLASH_SECONDS;
    for (const mat of m.mats) {
      mat.emissive.setHex(0xff2200);
      mat.emissiveIntensity = 1.5;
    }
  }

  private clearFlash(m: MeteoriteInstance): void {
    m.flashT = 0;
    for (let i = 0; i < m.mats.length; i++) {
      m.mats[i].emissive.copy(m.baseEmissives[i]);
      m.mats[i].emissiveIntensity = m.baseEmissiveIntensities[i];
    }
  }

  private releaseMesh(m: MeteoriteInstance): void {
    m.mesh.traverse((obj) => {
      const anyMesh = obj as Mesh;
      if (!anyMesh.isMesh) return;
      anyMesh.geometry?.dispose();
      const mat = anyMesh.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}

/* ============ INTEGRATION INTO GAME.TS ============
 *
 * 1) Imports (add at the top of Game.ts, alongside other imports):
 *
 *      import { Meteorites } from './gameplay/Meteorites.ts';
 *      import type { MeteoriteType } from './gameplay/Meteorites.ts';
 *      import { Projectiles } from './gameplay/Projectiles.ts';
 *      import { ExplosionPool } from './render/MeteoriteExplosion.ts';
 *
 * 2) Fields on Game (alongside `ship`, `flowManager`, etc.):
 *
 *      private meteorites!: Meteorites;
 *      private projectiles!: Projectiles;
 *      private explosions!: ExplosionPool;
 *
 * 3) Construction — in whatever async `start()`/`init()` method already
 *    awaits `preloadAssets()`. Build AFTER the scene exists but BEFORE the
 *    first update tick:
 *
 *      this.explosions = new ExplosionPool();
 *      await this.explosions.init(this.scene);
 *
 *      this.meteorites = new Meteorites({
 *        onHitShip: (damage) => {
 *          // Mirror the corridor-crash damage path: eat shield first, then HP,
 *          // then trigger the stun so the player feels the impact. The exact
 *          // field names match whatever the existing crash handler uses —
 *          // e.g. this.shield, this.hp, this.ship.stun().
 *          const absorbed = Math.min(this.shield, damage);
 *          this.shield -= absorbed;
 *          const leftover = damage - absorbed;
 *          if (leftover > 0) this.hp = Math.max(0, this.hp - leftover);
 *          this.ship.stun();
 *        },
 *        onDestroyed: (position, scale, type) => {
 *          this.explosions.play(position, scale);
 *          // Camera-shake impulse scaled by distance to the ship.
 *          const dist = position.distanceTo(this.ship.group.position);
 *          this.applyCameraShake(Math.max(0, 1 - dist / 120));
 *          void type; // currently unused in the Game path
 *        },
 *        onDrop: (position, type) => {
 *          // TODO: hand off to the ship-part inventory / pickup spawner.
 *          // For now, log so we can verify drops are firing. The string
 *          // payload this eventually emits should be 'ship_part'.
 *          console.log('[meteorite drop]', type, position);
 *        },
 *      });
 *      await this.meteorites.init(this.scene);
 *
 *      this.projectiles = new Projectiles();
 *      this.projectiles.init(this.scene);
 *
 * 4) Per-frame update — inside Game.update(dt), AFTER ship.update() and
 *    flowManager.update() but BEFORE the renderer pass:
 *
 *      const input = getInput();
 *      const canSpawn = this.flowManager.activeFlow == null;
 *      const shipPos = this.ship.group.position;
 *      // thrustVel is private on Ship — if you need real velocity, expose it
 *      // via a getter; ship.velocity works as a proxy for lateral drift.
 *      const shipVel = this.ship.velocity;
 *      this.meteorites.update(dt, shipPos, shipVel, canSpawn);
 *
 *      if (input.fire) {
 *        // Fire origin = ship nose; direction = ship forward in world space.
 *        const forward = new Vector3(0, 0, -1)
 *          .applyQuaternion(this.ship.group.quaternion);
 *        const noseOffset = forward.clone().multiplyScalar(2.0);
 *        const origin = shipPos.clone().add(noseOffset);
 *        this.projectiles.pullTrigger(origin, forward, shipVel);
 *      }
 *      this.projectiles.update(dt, this.meteorites);
 *      this.explosions.update(dt);
 *
 * 5) Cleanup — in whatever dispose/teardown path already exists:
 *
 *      this.meteorites.dispose();
 *      this.projectiles.dispose();
 *      this.explosions.dispose();
 *
 * ==================================================== */
