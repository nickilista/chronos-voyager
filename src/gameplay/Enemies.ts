import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Scene,
  SphereGeometry,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { ShipClass } from '../shipbuilder/shipTypes.ts';

/**
 * Free-space enemies.
 *
 * Every 45–90 s in open space we pick a still-LOCKED ship class from the
 * player's save, spawn a red-tinted hull of that class as an enemy, and
 * send it toward the player. Defeat the ship → 5 parts of THAT class drop
 * into the save at once. If no classes are locked anymore, no enemies
 * spawn — the progression is spent.
 *
 * Design constraints:
 *   • Only the hull GLB loads per class (not the full 10-slot assembly).
 *     That's cheap — one mesh per enemy — and the silhouette of each
 *     class's hull is already distinctive enough that the player
 *     recognises "oh, that's a Viper shape, I'll get Viper parts".
 *   • Max 2 concurrent enemies. More than that and player attention
 *     fractures between enemies, meteorites, and piloting — not fun.
 *   • Enemies are gated on free-space ONLY (same rule as meteorites)
 *     so corridor gameplay stays clean.
 *   • Enemies fire a simple red bullet every ~1.2 s at the player's
 *     current position (no lead prediction — leave that to the player's
 *     own aim-assist being clever).
 *
 * Reward + damage model is orthogonal to the render — the caller (Game)
 * wires the callbacks into the save manager and the HP/shield path.
 */

/** Hulls live in this path per ship class. Preloaded on first init(). */
const HULL_URL = (cls: ShipClass): string =>
  `/models/ships/${cls}/${cls}_hull.glb`;

/** Spawn cadence (seconds). Randomised uniformly in this range so the
 *  player can't time-lock the next attack. */
const SPAWN_INTERVAL: [number, number] = [45, 90];
const MAX_CONCURRENT = 2;
/** How far ahead of the ship enemies spawn. Further than meteorites
 *  (400) so there's visible warning — the enemy grows larger as it
 *  closes, rather than popping in next to the ship. */
const SPAWN_DISTANCE = 600;
/** Enemy despawns if the ship outruns it by this much. */
const DESPAWN_DISTANCE = 900;

/** HP per enemy. 150 = several primary-fire hits; tuned alongside
 *  player weapon damage (beam=28, pulse=18, bolt=14, missile=45). */
const ENEMY_HP = 150;
/** Enemy physical radius — used for projectile hit-tests. Larger than
 *  the ship's 1.35 because we want hits to feel fair; an enemy hull is
 *  bigger than a fighter anyway. */
const ENEMY_COLLIDER_RADIUS = 3.5;
/** Enemy max speed. Slightly slower than the ship's free-flight cap so
 *  the player can outrun a pursuer if they panic. */
const ENEMY_MAX_SPEED = 70;
const ENEMY_ACCEL = 45;
/** Minimum distance to maintain — enemies don't ram, they hover at
 *  combat range. Reads more as "a ship fighting back" than a kamikaze. */
const COMBAT_DISTANCE = 65;
/** Damage dealt to the player per enemy projectile hit. */
const ENEMY_BULLET_DAMAGE = 18;
const ENEMY_BULLET_SPEED = 110;
const ENEMY_BULLET_LIFETIME = 3.2;
const ENEMY_FIRE_COOLDOWN: [number, number] = [1.0, 1.8];

/** Number of ship-parts dropped when an enemy is defeated. */
export const ENEMY_REWARD_PARTS = 5;

interface EnemyInstance {
  mesh: Group;
  cls: ShipClass;
  position: Vector3;
  velocity: Vector3;
  hp: number;
  maxHp: number;
  fireCooldown: number;
  /** Materials we cloned from the prototype so the red emissive tint
   *  can be applied per-instance and cleaned up on recycle. */
  mats: MeshStandardMaterial[];
  active: boolean;
}

interface EnemyBullet {
  mesh: Mesh;
  position: Vector3;
  velocity: Vector3;
  life: number;
  active: boolean;
}

export interface EnemyHitResult {
  enemy: EnemyInstance;
  destroyed: boolean;
  position: Vector3;
}

export interface EnemiesCallbacks {
  /** An enemy bullet hit the player. Caller decides shield vs. HP. */
  onHitShip(damage: number): void;
  /** The player destroyed an enemy. Spawn VFX at `position`; `cls` is
   *  the ship class that was defeated (matches the reward). */
  onDefeated(position: Vector3, cls: ShipClass): void;
  /** Issue the 5-part reward for defeating an enemy. Split out from
   *  `onDefeated` so the caller can play the unlock toast + persist
   *  the save separately from the VFX path. `partsAwarded` is usually
   *  ENEMY_REWARD_PARTS unless some edge case clamps it. */
  onReward(position: Vector3, cls: ShipClass, partsAwarded: number): void;
}

/** Pooled scratch vectors — zero allocations in the update hot path. */
const _dir = new Vector3();
const _tmp = new Vector3();

export class Enemies {
  private scene: Scene | null = null;
  private readonly group = new Group();
  private readonly callbacks: EnemiesCallbacks;

  /** Canonical hull group per preloaded class. We deep-clone on spawn
   *  so each enemy owns its own transform / materials. */
  private readonly prototypes = new Map<ShipClass, Group>();

  /** Classes we're allowed to spawn this session. Handed in from Game
   *  (sourced from `SaveManager.pickRandomLockedClass(...)` but we
   *  compute the list once at init + when a spawn is requested — see
   *  `setAvailableClasses`). */
  private availableClasses: readonly ShipClass[] = [];

  private readonly active: EnemyInstance[] = [];
  private readonly bullets: EnemyBullet[] = [];
  private bulletGeo: SphereGeometry | null = null;
  private bulletMat: MeshBasicMaterial | null = null;
  private spawnCooldown = 0;

  constructor(callbacks: EnemiesCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Async init. Preloads a hull GLB per class in `classes`; enemies
   * will only spawn from these. Classes the player later unlocks stay
   * available as enemies until the list is refreshed via
   * `setAvailableClasses` (not hot — once per session is fine).
   */
  async init(scene: Scene, classes: readonly ShipClass[]): Promise<void> {
    this.scene = scene;
    scene.add(this.group);
    this.availableClasses = classes;

    const loader = new GLTFLoader();
    const loads = classes.map(async (cls) => {
      try {
        const gltf = await loader.loadAsync(HULL_URL(cls));
        this.prototypes.set(cls, gltf.scene as unknown as Group);
      } catch (err) {
        // A missing hull for one class just means that class can't spawn —
        // we don't want to break init for the whole enemy system.
        // eslint-disable-next-line no-console
        console.warn(`[Enemies] failed to load hull for ${cls}`, err);
      }
    });
    await Promise.all(loads);

    // Shared bullet geometry + material. Bullets are small glowing red
    // spheres, additive so they punch through the HDRI without the
    // bloom layer washing them out.
    this.bulletGeo = new SphereGeometry(0.32, 10, 8);
    this.bulletMat = new MeshBasicMaterial({
      color: 0xff3040,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
    });

    // First spawn gets a short delay so the player isn't attacked on
    // second 1 of playtime — better to let them orient first.
    this.spawnCooldown = 15;
  }

  /** Refresh the set of classes eligible to spawn as an enemy. Called
   *  from Game after the player unlocks/loses parts so the world
   *  reflects current progress. */
  setAvailableClasses(classes: readonly ShipClass[]): void {
    this.availableClasses = classes;
  }

  update(dt: number, shipPos: Vector3, canSpawn: boolean): void {
    // Spawn timer
    this.spawnCooldown -= dt;
    if (
      canSpawn &&
      this.spawnCooldown <= 0 &&
      this.active.length < MAX_CONCURRENT &&
      this.availableClasses.length > 0
    ) {
      this.spawnOne(shipPos);
      const [lo, hi] = SPAWN_INTERVAL;
      this.spawnCooldown = lo + Math.random() * (hi - lo);
    }

    // Active enemies: simple pursuit + combat-distance maintenance + fire.
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];

      // Seek / retreat vector relative to ship
      _dir.copy(shipPos).sub(e.position);
      const dist = _dir.length();
      if (dist < 1e-3) continue;
      _dir.normalize();

      // Desired velocity: approach until within combat distance, then
      // stop (or back off slightly to maintain). Simple PD-ish blend.
      let targetSpeed = ENEMY_MAX_SPEED;
      if (dist < COMBAT_DISTANCE * 0.8) targetSpeed = -ENEMY_MAX_SPEED * 0.4;
      else if (dist < COMBAT_DISTANCE) targetSpeed = 0;
      _tmp.copy(_dir).multiplyScalar(targetSpeed);

      // Accelerate current velocity toward the target velocity.
      e.velocity.x += (_tmp.x - e.velocity.x) * Math.min(1, ENEMY_ACCEL * dt / ENEMY_MAX_SPEED);
      e.velocity.y += (_tmp.y - e.velocity.y) * Math.min(1, ENEMY_ACCEL * dt / ENEMY_MAX_SPEED);
      e.velocity.z += (_tmp.z - e.velocity.z) * Math.min(1, ENEMY_ACCEL * dt / ENEMY_MAX_SPEED);

      e.position.addScaledVector(e.velocity, dt);
      e.mesh.position.copy(e.position);
      // Face the player — simple lookAt, cheap and reads right.
      e.mesh.lookAt(shipPos);

      // Fire bullet on cooldown once we're inside the effective range.
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && dist < 180) {
        this.fireBullet(e.position, shipPos);
        const [lo, hi] = ENEMY_FIRE_COOLDOWN;
        e.fireCooldown = lo + Math.random() * (hi - lo);
      }

      // Despawn if the player has outrun this enemy too far.
      if (dist > DESPAWN_DISTANCE) {
        this.recycle(i);
      }
    }

    // Update enemy bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (!b.active) continue;
      b.position.addScaledVector(b.velocity, dt);
      b.mesh.position.copy(b.position);
      b.life -= dt;
      if (b.life <= 0) {
        this.deactivateBullet(b);
        continue;
      }
      // Hit the ship? sphere-vs-sphere with the ship's canonical radius.
      const dx = b.position.x - shipPos.x;
      const dy = b.position.y - shipPos.y;
      const dz = b.position.z - shipPos.z;
      if (dx * dx + dy * dy + dz * dz < 3.5 * 3.5) {
        this.callbacks.onHitShip(ENEMY_BULLET_DAMAGE);
        this.deactivateBullet(b);
      }
    }
  }

  /**
   * Player projectile impact test. Walks active enemies, hits first
   * one whose sphere contains the sample point. Mirrors
   * `Meteorites.tryHit` so the player's Projectiles class can stack
   * the two calls without knowing which it hit.
   */
  tryHit(rayOrigin: Vector3, _rayDir: Vector3, damage: number): EnemyHitResult | null {
    for (let i = 0; i < this.active.length; i++) {
      const e = this.active[i];
      const dx = e.position.x - rayOrigin.x;
      const dy = e.position.y - rayOrigin.y;
      const dz = e.position.z - rayOrigin.z;
      const r = ENEMY_COLLIDER_RADIUS;
      if (dx * dx + dy * dy + dz * dz <= r * r) {
        e.hp -= damage;
        if (e.hp <= 0) {
          const pos = e.position.clone();
          const cls = e.cls;
          this.callbacks.onDefeated(pos, cls);
          this.callbacks.onReward(pos, cls, ENEMY_REWARD_PARTS);
          this.recycle(i);
          return { enemy: e, destroyed: true, position: pos };
        }
        return { enemy: e, destroyed: false, position: e.position.clone() };
      }
    }
    return null;
  }

  dispose(): void {
    for (const e of this.active) this.releaseEnemy(e);
    this.active.length = 0;
    this.bulletGeo?.dispose();
    this.bulletMat?.dispose();
    if (this.scene) this.scene.remove(this.group);
    this.scene = null;
  }

  // ---- internals ----

  private spawnOne(shipPos: Vector3): void {
    if (this.availableClasses.length === 0) return;
    const cls =
      this.availableClasses[Math.floor(Math.random() * this.availableClasses.length)];
    const proto = this.prototypes.get(cls);
    if (!proto) return;

    // Spawn point: SPAWN_DISTANCE ahead of the ship in a random
    // cone direction so the enemy actually approaches from a
    // visible angle.
    const theta = Math.random() * Math.PI * 2;
    const phi = (Math.random() - 0.5) * 0.5; // narrow vertical scatter
    const dx = Math.cos(theta) * Math.cos(phi);
    const dy = Math.sin(phi);
    const dz = Math.sin(theta) * Math.cos(phi);
    const pos = new Vector3(
      shipPos.x + dx * SPAWN_DISTANCE,
      shipPos.y + dy * SPAWN_DISTANCE,
      shipPos.z + dz * SPAWN_DISTANCE,
    );

    const mesh = proto.clone(true) as Group;
    // Deep-clone materials + tint emissive red so the enemy reads as
    // hostile even though it shares the same hull mesh the player
    // might be flying. Without this, an enemy Viper and the player's
    // Viper would be indistinguishable on screen.
    const mats: MeshStandardMaterial[] = [];
    mesh.traverse((obj) => {
      const m = obj as Mesh;
      if (!m.isMesh) return;
      if (Array.isArray(m.material)) {
        m.material = m.material.map((mat) => {
          const cloned = (mat as MeshStandardMaterial).clone();
          cloned.emissive = new Color(0xff2030);
          cloned.emissiveIntensity = 1.1;
          mats.push(cloned);
          return cloned;
        });
      } else {
        const cloned = (m.material as MeshStandardMaterial).clone();
        cloned.emissive = new Color(0xff2030);
        cloned.emissiveIntensity = 1.1;
        m.material = cloned;
        mats.push(cloned);
      }
    });
    mesh.position.copy(pos);
    // Slightly bigger than the player ship for silhouette weight.
    mesh.scale.setScalar(1.6);

    this.group.add(mesh);

    this.active.push({
      mesh,
      cls,
      position: pos,
      velocity: new Vector3(),
      hp: ENEMY_HP,
      maxHp: ENEMY_HP,
      fireCooldown: 2.0 + Math.random() * 1.5,
      mats,
      active: true,
    });
  }

  private recycle(index: number): void {
    const e = this.active[index];
    // Swap-remove.
    const last = this.active.length - 1;
    if (index !== last) this.active[index] = this.active[last];
    this.active.pop();
    this.releaseEnemy(e);
  }

  private releaseEnemy(e: EnemyInstance): void {
    this.group.remove(e.mesh);
    for (const mat of e.mats) mat.dispose();
    e.mesh.traverse((obj) => {
      const m = obj as Mesh;
      if (m.isMesh) m.geometry?.dispose();
    });
    e.active = false;
  }

  private fireBullet(from: Vector3, to: Vector3): void {
    if (!this.bulletGeo || !this.bulletMat) return;
    let slot = this.bullets.find((b) => !b.active);
    if (!slot) {
      // Grow the pool on demand — capped by the overall enemy count
      // × fire rate it won't balloon; still a soft cap at 32.
      if (this.bullets.length >= 32) return;
      const mesh = new Mesh(this.bulletGeo, this.bulletMat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.group.add(mesh);
      slot = {
        mesh,
        position: new Vector3(),
        velocity: new Vector3(),
        life: 0,
        active: false,
      };
      this.bullets.push(slot);
    }
    _dir.copy(to).sub(from);
    const d = _dir.length();
    if (d < 1e-3) return;
    _dir.multiplyScalar(1 / d);
    slot.position.copy(from).addScaledVector(_dir, 2.0);
    slot.velocity.copy(_dir).multiplyScalar(ENEMY_BULLET_SPEED);
    slot.life = ENEMY_BULLET_LIFETIME;
    slot.mesh.position.copy(slot.position);
    slot.mesh.visible = true;
    slot.active = true;
  }

  private deactivateBullet(b: EnemyBullet): void {
    b.active = false;
    b.mesh.visible = false;
  }
}
