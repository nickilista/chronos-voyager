import {
  AdditiveBlending,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Scene,
  SphereGeometry,
  Vector3,
} from 'three';
import type { Meteorites } from './Meteorites.ts';

/**
 * Ship primary weapon — glowy orb-bullets.
 *
 * Why a small fixed pool instead of spawn-on-demand: the fire cadence (8/sec)
 * combined with a 2.5s lifetime means ~20 bullets can live at once, and the
 * player pulls the trigger a LOT over a session. Allocating/GCing Mesh +
 * Material + Geometry per shot would chunk into the frame time. 32 pre-
 * allocated slots cover the worst case (boost + full-auto) with headroom.
 *
 * Why additive MeshBasicMaterial: the game already runs a bloom pass, and
 * additive basic sidesteps the StandardMaterial lighting cost. The orbs
 * show up as warm blooming dots regardless of scene lighting, which is
 * what "energy weapon" should look like.
 *
 * Bullets inherit ship momentum so a fast-moving ship's shots lead ahead
 * of slower ones — a small thing, but it makes strafing feel right. Without
 * it, the muzzle velocity plus ship velocity wouldn't compose correctly
 * and bullets would visibly lag off a boosting ship.
 */

const POOL_SIZE = 32;
const BULLET_RADIUS = 0.25;
/** Muzzle speed. Matches a ~3s time-to-target at 400u range — long enough
 *  that leading a moving meteorite feels meaningful, short enough that
 *  the player doesn't have to mentally integrate trajectories. */
const MUZZLE_SPEED = 180;
const BULLET_LIFETIME = 2.5;
const BULLET_RANGE = 400;
const FIRE_COOLDOWN = 0.12;
/** Damage per bullet. Tuned so rocky (30 hp) dies in 2 hits, iron (80 hp)
 *  takes 4. Crystal (25 hp) one-shot, which feels right for a fragile rare. */
const BULLET_DAMAGE = 20;

interface Bullet {
  mesh: Mesh;
  position: Vector3;
  velocity: Vector3;
  direction: Vector3;
  life: number;
  distanceTraveled: number;
  active: boolean;
}

export class Projectiles {
  private scene: Scene | null = null;
  private readonly group = new Group();
  private readonly bullets: Bullet[] = [];
  private fireCooldown = 0;

  init(scene: Scene): void {
    this.scene = scene;
    scene.add(this.group);

    // Pre-allocate: one shared geometry (geometry clones are free), one
    // shared material (all bullets look identical, so sharing saves draw-
    // call state swaps). Each bullet still gets its own Mesh so it can
    // have its own position in the scene graph.
    const geo = new SphereGeometry(BULLET_RADIUS, 10, 8);
    const mat = new MeshBasicMaterial({
      color: 0xffaa44,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
    });

    for (let i = 0; i < POOL_SIZE; i++) {
      const mesh = new Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false; // tiny meshes get wrongly culled at edges
      this.group.add(mesh);
      this.bullets.push({
        mesh,
        position: new Vector3(),
        velocity: new Vector3(),
        direction: new Vector3(0, 0, -1),
        life: 0,
        distanceTraveled: 0,
        active: false,
      });
    }
  }

  /**
   * Request a shot this frame. Enforces cooldown internally so the Game
   * loop can just hand this `input.fire` straight every tick — pullTrigger
   * is a no-op until the cooldown elapses. Keeps rate-limiting in one place.
   */
  pullTrigger(origin: Vector3, direction: Vector3, shipVelWorld: Vector3): void {
    if (this.fireCooldown > 0) return;
    this.fire(origin, direction, shipVelWorld);
    this.fireCooldown = FIRE_COOLDOWN;
  }

  fire(origin: Vector3, direction: Vector3, shipVelWorld: Vector3): void {
    const slot = this.acquireSlot();
    if (!slot) return;
    slot.position.copy(origin);
    slot.direction.copy(direction).normalize();
    slot.velocity.copy(slot.direction).multiplyScalar(MUZZLE_SPEED).add(shipVelWorld);
    slot.life = BULLET_LIFETIME;
    slot.distanceTraveled = 0;
    slot.mesh.position.copy(origin);
    slot.mesh.visible = true;
    slot.active = true;
  }

  update(dt: number, meteorites: Meteorites): void {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    for (let i = 0; i < this.bullets.length; i++) {
      const b = this.bullets[i];
      if (!b.active) continue;

      // Advance. Range-tracking uses velocity-length * dt rather than a
      // pre-computed constant because ship-velocity inheritance means the
      // effective per-frame step varies per shot.
      const stepX = b.velocity.x * dt;
      const stepY = b.velocity.y * dt;
      const stepZ = b.velocity.z * dt;
      b.position.x += stepX;
      b.position.y += stepY;
      b.position.z += stepZ;
      b.distanceTraveled += Math.hypot(stepX, stepY, stepZ);
      b.mesh.position.copy(b.position);
      b.life -= dt;

      if (b.life <= 0 || b.distanceTraveled >= BULLET_RANGE) {
        this.deactivate(b);
        continue;
      }

      // Point-vs-sphere test via Meteorites. If a hit lands — destroying or
      // not — the bullet spends itself. Piercing shots could skip this line
      // but the current design wants single-target so the player has to
      // aim each shot.
      const hit = meteorites.tryHit(b.position, b.direction, BULLET_DAMAGE);
      if (hit) {
        this.deactivate(b);
      }
    }
  }

  dispose(): void {
    // Bullets share one geometry and one material — dispose once each via
    // the first slot, then tear down the group.
    if (this.bullets.length > 0) {
      const m = this.bullets[0].mesh;
      m.geometry.dispose();
      (m.material as MeshBasicMaterial).dispose();
    }
    if (this.scene) this.scene.remove(this.group);
    this.scene = null;
    this.bullets.length = 0;
  }

  private acquireSlot(): Bullet | null {
    for (let i = 0; i < this.bullets.length; i++) {
      if (!this.bullets[i].active) return this.bullets[i];
    }
    return null;
  }

  private deactivate(b: Bullet): void {
    b.active = false;
    b.mesh.visible = false;
  }
}
