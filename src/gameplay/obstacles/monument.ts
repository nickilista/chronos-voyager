import { Color, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { Assets, makeEmissive } from '../Assets.ts';
import { ERA_CONTENT } from '../../eras/eraContent.ts';
import { getEra } from '../../eras/eras.ts';
import type { EraId } from '../../eras/eras.ts';
import type { Obstacle, ObstacleFactory } from './types.ts';

/**
 * Generic monument obstacle factory — works for every era because the
 * per-era bounding-box halves, scales and model names live in ERA_CONTENT.
 *
 * Each factory builds a cloned GLB wrapped in a Group that offsets the
 * model down by `halfUnit.y * scale` so the pivot sits on the obstacle's
 * base rather than its visual centre. The returned AABB `halfSize` is
 * slightly generous for collision (the track feels fair rather than
 * clinically accurate).
 */

function emptyImpactState() {
  return {
    spin: { x: 0, y: 0, z: 0 },
    impulseX: 0,
    impulseY: 0,
    impulseZ: 0,
    impulseRemaining: 0,
  };
}

/**
 * Global gameplay-obstacle multiplier applied on top of each era's
 * `obstacleScale`. Bumped to 2.0 so every corridor's monuments read as
 * proper megaliths at flight speed instead of traffic cones. Does NOT
 * affect `decorScale` — off-track decoration sizes live in Decorations.ts.
 */
const OBSTACLE_SIZE_MULT = 2.0;

function buildFactory(
  name: Parameters<(typeof Assets)['clone']>[0],
  halfUnit: Vector3,
  scale: number,
  type: string,
  rim: { color: number; intensity: number },
  accentColor: number,
): ObstacleFactory {
  // Multiply both the visual scale and the collider halfSize so collisions
  // stay faithful to the new silhouette — otherwise the ship would phase
  // through half the obstacle before registering a hit.
  const s = scale * OBSTACLE_SIZE_MULT;
  const accent = new Color(accentColor);
  return (): Obstacle => {
    const group = new Group();
    const model = Assets.clone(name);
    model.scale.setScalar(s);
    model.position.y = -halfUnit.y * s;
    // Per-era rim glow — chosen to contrast with the sky/horizon palette so
    // obstacles read as silhouettes against the background instead of
    // blending into it.
    makeEmissive(model, rim.color, rim.intensity);
    // Subtle base-color tint toward the era accent so obstacles read as
    // era-themed without losing their model texture detail.
    model.traverse((obj) => {
      const m = obj as Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (mat instanceof MeshStandardMaterial) {
          mat.color.lerp(accent, 0.25);
          mat.needsUpdate = true;
        }
      }
    });
    group.add(model);
    const halfSize = halfUnit.clone().multiplyScalar(s);
    return { mesh: group, halfSize, type, ...emptyImpactState() };
  };
}

/**
 * Per-era obstacle factory array. Pattern mirrors the original Egypt pool:
 * primary obstacle appears twice (more common) + secondary appears once,
 * so the ring buffer feels varied without being chaotic.
 */
export function obstacleFactoriesFor(eraId: EraId): ObstacleFactory[] {
  const content = ERA_CONTENT[eraId];
  const [a, b] = content.obstacles;
  const rim = content.obstacleRim;
  const accent = getEra(eraId).palette.accent;
  const fA = buildFactory(a.name, a.halfUnit, a.obstacleScale, a.type, rim, accent);
  const fB = buildFactory(b.name, b.halfUnit, b.obstacleScale, b.type, rim, accent);
  return [fA, fA, fB];
}

/** Shape-biased impact: tall monuments topple, wide ones yaw. */
export function obstacleShape(eraId: EraId, type: string): 'tall' | 'wide' {
  const content = ERA_CONTENT[eraId];
  for (const o of content.obstacles) {
    if (o.type === type) return o.shape;
  }
  return 'wide';
}
