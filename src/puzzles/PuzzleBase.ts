import { Group, PerspectiveCamera, Raycaster, Vector2 } from 'three';

/**
 * Common contract for era-climax puzzles. The Game hands over control of
 * scene rendering + input to a Puzzle when one is active: hides the gameplay
 * groups (ship/track/collectibles), adds `puzzle.group` to the scene, and
 * pipes pointer + frame ticks into the puzzle. When `isSolved` flips true,
 * the Game reverses the handoff and resumes the run.
 */
export abstract class Puzzle {
  readonly group = new Group();
  readonly raycaster = new Raycaster();
  isSolved = false;

  abstract readonly title: string;
  abstract readonly subtitle: string;
  abstract readonly instructions: string;

  abstract init(): void;
  abstract update(dt: number, camera: PerspectiveCamera): void;
  abstract onPointerDown(ndc: Vector2, camera: PerspectiveCamera): void;

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as { geometry?: { dispose?: () => void }; material?: { dispose?: () => void } };
      m.geometry?.dispose?.();
      m.material?.dispose?.();
    });
    this.group.clear();
  }
}
