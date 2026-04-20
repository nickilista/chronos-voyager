import type { Object3D, Vector3 } from 'three';

/**
 * A track obstacle. `halfSize` is the half-extent AABB used for sphere-vs-box
 * collision against the ship — kept intentionally small relative to visuals
 * so the game feels fair rather than clinically accurate.
 *
 * `spin` / `impulseZ` drive the crash-impact animation: when the ship hits
 * something, Track flings it with angular + z velocity for a short time so
 * the obstacle visibly reacts instead of vanishing the player.
 */
export interface Obstacle {
  readonly mesh: Object3D;
  readonly halfSize: Vector3;
  readonly type: string;
  spin: { x: number; y: number; z: number };
  impulseX: number;
  impulseY: number;
  impulseZ: number;
  impulseRemaining: number;
}

export type ObstacleFactory = () => Obstacle;
