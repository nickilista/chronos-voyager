import { Group, Vector3 } from 'three';
import { Assets, makeEmissive } from '../Assets.ts';
import { ERA_CONTENT } from '../../eras/eraContent.ts';
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

function buildFactory(
  name: Parameters<(typeof Assets)['clone']>[0],
  halfUnit: Vector3,
  scale: number,
  type: string,
  rim: { color: number; intensity: number },
): ObstacleFactory {
  return (): Obstacle => {
    const group = new Group();
    const model = Assets.clone(name);
    model.scale.setScalar(scale);
    model.position.y = -halfUnit.y * scale;
    // Per-era rim glow — chosen to contrast with the sky/horizon palette so
    // obstacles read as silhouettes against the background instead of
    // blending into it.
    makeEmissive(model, rim.color, rim.intensity);
    group.add(model);
    const halfSize = halfUnit.clone().multiplyScalar(scale);
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
  const fA = buildFactory(a.name, a.halfUnit, a.obstacleScale, a.type, rim);
  const fB = buildFactory(b.name, b.halfUnit, b.obstacleScale, b.type, rim);
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
