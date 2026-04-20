import type { Vector3 } from 'three';

/**
 * Sphere vs axis-aligned-box overlap test.
 * Returns true if the ship sphere intersects the obstacle's AABB.
 * Assumes the obstacle mesh is not rotated on X/Y — we rotate only around Z
 * for visual flair, so the world-space AABB is tight enough for gameplay.
 */
export function sphereVsAabb(
  sphereCenter: Vector3,
  sphereRadius: number,
  boxCenter: Vector3,
  boxHalf: Vector3,
): boolean {
  const dx = Math.max(0, Math.abs(sphereCenter.x - boxCenter.x) - boxHalf.x);
  const dy = Math.max(0, Math.abs(sphereCenter.y - boxCenter.y) - boxHalf.y);
  const dz = Math.max(0, Math.abs(sphereCenter.z - boxCenter.z) - boxHalf.z);
  return dx * dx + dy * dy + dz * dz <= sphereRadius * sphereRadius;
}
