import { Group, Matrix4, Quaternion, Vector3 } from 'three';
import { ERA_CONTENT } from '../eras/eraContent.ts';
import type { Era } from '../eras/eras.ts';
import { CorridorAura } from '../render/CorridorAura.ts';
import { FloorGlyphs } from '../render/FloorGlyphs.ts';
import { Collectibles } from './Collectibles.ts';
import { obstacleFactoriesFor } from './obstacles/monument.ts';
import type { Obstacle } from './obstacles/types.ts';
import { CORRIDOR_RADIUS, Track } from './Track.ts';

/**
 * One era's flow corridor — a cylindrical bubble in 3D space at `origin`,
 * oriented so local -Z aligns with `axis` (the direction of travel).
 *
 * All gameplay subsystems (obstacles, collectibles, aura, flow haze)
 * are children of `this.group`, which is positioned at `origin`
 * and rotated by `quaternion`. That means the subsystems keep operating in
 * their own local frame (local -Z is "forward"), while the flow as a whole
 * can sit anywhere in 3D space at any tilt.
 */

const WORLD_UP = new Vector3(0, 1, 0);

export interface FlowEvents {
  onAnkhPickup(flow: Flow, collected: number, target: number): void;
  onEraComplete(flow: Flow): void;
}

export class Flow {
  readonly group = new Group();
  readonly era: Era;
  readonly origin: Vector3;
  /** World-space unit vector in the direction of ship travel through the flow. */
  readonly axis: Vector3;
  /** Rotates local-frame vectors (local -Z is forward) into world space. */
  readonly quaternion: Quaternion;
  /** Inverse of `quaternion` — for projecting world vectors into flow-local. */
  readonly inverseQuaternion: Quaternion;

  readonly track: Track;
  readonly collectibles: Collectibles;
  readonly corridorAura: CorridorAura;
  readonly floorGlyphs: FloorGlyphs;

  /** 0 = running, 1 = first checkpoint puzzle done, 2 = era complete. */
  puzzleStage: 0 | 1 | 2 = 0;

  private readonly _localShip = new Vector3();
  private readonly _localVel = new Vector3();

  constructor(era: Era, origin: Vector3, axis: Vector3, events: FlowEvents) {
    this.era = era;
    this.origin = origin.clone();
    this.axis = axis.clone().normalize();

    // World rotation that maps local -Z onto world `axis`, AND pins local +Y
    // as close to world-up as possible. `setFromUnitVectors` would only
    // constrain the forward direction, leaving roll around the axis arbitrary
    // — that made some flows feel "tilted" with inverted controls. Using
    // lookAt fixes the roll so every flow's internal frame has the same
    // "up is up" feel, regardless of where it sits in the 3D scatter.
    const lookMat = new Matrix4().lookAt(new Vector3(0, 0, 0), this.axis, WORLD_UP);
    this.quaternion = new Quaternion().setFromRotationMatrix(lookMat);
    this.inverseQuaternion = this.quaternion.clone().invert();

    this.group.position.copy(this.origin);
    this.group.quaternion.copy(this.quaternion);

    this.track = new Track();
    this.collectibles = new Collectibles(
      era.id,
      {
        onPickup: (collected, target) => {
          events.onAnkhPickup(this, collected, target);
          if (collected >= target) events.onEraComplete(this);
        },
      },
      10,
    );
    this.corridorAura = new CorridorAura(era);
    this.floorGlyphs = new FloorGlyphs(era);

    // Track needs per-era obstacle factories + shape map BEFORE init().
    const factories = obstacleFactoriesFor(era.id);
    const shapes = new Map<string, 'tall' | 'wide'>();
    for (const spec of ERA_CONTENT[era.id].obstacles) {
      shapes.set(spec.type, spec.shape);
    }
    this.track.setFactories(factories, shapes);
  }

  init(): void {
    this.track.init();
    this.collectibles.init();
    this.corridorAura.init();
    this.floorGlyphs.init();
    this.group.add(
      this.track.group,
      this.collectibles.group,
      this.corridorAura.group,
      this.floorGlyphs.group,
    );
  }

  /** Convert a world-space point into flow-local coordinates. */
  worldToLocalPoint(world: Vector3, out: Vector3): Vector3 {
    out.copy(world).sub(this.origin).applyQuaternion(this.inverseQuaternion);
    return out;
  }

  /** Rotate a world-space direction vector into the flow-local frame. */
  worldToLocalDir(world: Vector3, out: Vector3): Vector3 {
    out.copy(world).applyQuaternion(this.inverseQuaternion);
    return out;
  }

  /**
   * radial = distance from flow axis (in flow-local XY plane).
   * axial  = signed local-Z (ship moves in -Z direction).
   */
  metricsFor(shipWorld: Vector3): { radial: number; axial: number } {
    this.worldToLocalPoint(shipWorld, this._localShip);
    return {
      radial: Math.hypot(this._localShip.x, this._localShip.y),
      axial: this._localShip.z,
    };
  }

  /** True iff the ship is currently inside this flow's cylindrical bubble. */
  contains(shipWorld: Vector3): boolean {
    const { radial } = this.metricsFor(shipWorld);
    return radial <= CORRIDOR_RADIUS;
  }

  update(
    dt: number,
    shipWorld: Vector3,
    shipVelWorld: Vector3,
    outsideFactor: number,
    boundaryProximity: number,
  ): void {
    this.worldToLocalPoint(shipWorld, this._localShip);
    this.worldToLocalDir(shipVelWorld, this._localVel);
    // All subsystems (Track, Collectibles, FloorGlyphs) use modular-loop
    // placement: each object owns a canonical (x, y, z) inside a closed
    // axial loop and is rendered every frame at the loop image nearest
    // the ship. That means there's nothing to "seed around the entry" —
    // the loop always brackets the ship regardless of entry axial,
    // flight direction, or whether the ship just crossed the corridor wall.
    this.track.update(this._localShip.z, dt);
    this.floorGlyphs.update(this._localShip.z);
    this.collectibles.update(dt, this._localShip, this._localShip);
    this.corridorAura.update(dt);
    this.corridorAura.setBoundaryProximity(boundaryProximity);
    this.corridorAura.setOutsideFactor(outsideFactor);
  }

  /**
   * Run sphere-vs-AABB against this flow's obstacles in flow-local space.
   * Returns the obstacle struck, or null.
   */
  collide(
    shipWorld: Vector3,
    shipRadius: number,
    out: (ob: Obstacle, localShip: Vector3, localVel: Vector3) => boolean,
  ): void {
    this.worldToLocalPoint(shipWorld, this._localShip);
    for (const ob of this.track.all) {
      const dz = this._localShip.z - ob.mesh.position.z;
      if (dz < -3 || dz > 3) continue;
      const dx = Math.max(
        0,
        Math.abs(this._localShip.x - ob.mesh.position.x) - ob.halfSize.x,
      );
      const dy = Math.max(
        0,
        Math.abs(this._localShip.y - ob.mesh.position.y) - ob.halfSize.y,
      );
      const dzClamped = Math.max(0, Math.abs(dz) - ob.halfSize.z);
      if (dx * dx + dy * dy + dzClamped * dzClamped <= shipRadius * shipRadius) {
        if (out(ob, this._localShip, this._localVel)) return;
      }
    }
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /**
   * Free-space LOD toggle. Three levels, trading mesh count for visible
   * gameplay content:
   *
   *   • 'full'   — every obstacle / collectible / floor tile rendered.
   *                What the active (nearest) flow always runs at, and
   *                what every flow runs at when the ship is inside one.
   *   • 'sparse' — only a fixed 1-in-10 stride of each pool is visible,
   *                the rest are hidden. Keeps each flow's tube readably
   *                populated from the galaxy map without paying the
   *                ~2,200-mesh free-space tax. The stride is by index
   *                so the same meshes always show — no flicker.
   *   • 'none'   — all three subgroups hidden (use setVisible(false)
   *                on the whole flow for a bigger hammer).
   *
   * The current obstacle pool is 200/flow, collectible pool is 10/flow,
   * floor-glyph pool is ~24/flow. In 'sparse' mode that collapses to
   * 20 + 1 + ~3 ≈ 24 meshes per flow instead of ~234 — x9 less.
   */
  setInteriorLOD(level: 'full' | 'sparse' | 'none'): void {
    if (level === 'none') {
      this.track.group.visible = false;
      this.collectibles.group.visible = false;
      this.floorGlyphs.group.visible = false;
      return;
    }
    this.track.group.visible = true;
    this.collectibles.group.visible = true;
    this.floorGlyphs.group.visible = true;

    const stride = level === 'sparse' ? 10 : 1;
    setStrideVisible(this.track.group.children, stride);
    setStrideVisible(this.collectibles.group.children, stride);
    setStrideVisible(this.floorGlyphs.group.children, stride);
  }

  /** @deprecated use setInteriorLOD('full' | 'none') — kept for back-compat. */
  setInteriorVisible(visible: boolean): void {
    this.setInteriorLOD(visible ? 'full' : 'none');
  }

  resetCollectibles(): void {
    this.collectibles.reset();
  }
}

/**
 * Show every Nth child, hide the rest. Cheap: no traversal, no
 * material writes, just a boolean flip per mesh. The active flow's
 * full-LOD path passes stride=1 and this becomes a no-op that leaves
 * everything visible — same cost as the previous `group.visible=true`.
 */
function setStrideVisible(children: readonly import('three').Object3D[], stride: number): void {
  if (stride <= 1) {
    for (let i = 0; i < children.length; i++) children[i].visible = true;
    return;
  }
  for (let i = 0; i < children.length; i++) {
    children[i].visible = i % stride === 0;
  }
}
