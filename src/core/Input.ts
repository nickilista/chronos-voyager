/**
 * Unified input: keyboard + (TODO Day 8) touch virtual stick.
 * Exposes a read-only InputState snapshot via getInput().
 */

export interface InputState {
  /** Lateral axis, -1 left .. +1 right */
  readonly x: number;
  /** Vertical axis, -1 down .. +1 up (inverted from screen coords) */
  readonly y: number;
  /** Boost held */
  readonly boost: boolean;
}

const keys = new Set<string>();

function isKey(code: string): boolean {
  return keys.has(code);
}

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  // Prevent arrow keys from scrolling.
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});
window.addEventListener('blur', () => keys.clear());

export function getInput(): InputState {
  const left = isKey('ArrowLeft') || isKey('KeyA');
  const right = isKey('ArrowRight') || isKey('KeyD');
  const up = isKey('ArrowUp') || isKey('KeyW');
  const down = isKey('ArrowDown') || isKey('KeyS');
  return {
    x: (right ? 1 : 0) - (left ? 1 : 0),
    y: (up ? 1 : 0) - (down ? 1 : 0),
    boost: isKey('Space'),
  };
}
