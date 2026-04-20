/**
 * Unified input: keyboard + mouse.
 * Exposes a read-only InputState snapshot via getInput().
 *
 * Controls map (see HUD legend in src/ui/hud.ts):
 *   • WASD / arrows  → x / y axes (pilot)
 *   • Space          → boost (held)
 *   • Left mouse     → fire primary weapon (held)
 *   • J or F         → fire primary weapon (keyboard alternative)
 */

export interface InputState {
  /** Lateral axis, -1 left .. +1 right */
  readonly x: number;
  /** Vertical axis, -1 down .. +1 up (inverted from screen coords) */
  readonly y: number;
  /** Boost held */
  readonly boost: boolean;
  /** Primary-fire held — mouse-left OR keyboard (J / F). Polled each frame. */
  readonly fire: boolean;
}

const keys = new Set<string>();
let mouseDown = false;

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
window.addEventListener('blur', () => {
  keys.clear();
  mouseDown = false;
});

// Mouse-button fire. We listen on document so clicks anywhere in the canvas
// region (which covers the viewport) register, and gate by `button === 0`
// (left) so right-click / middle-click won't accidentally trigger fire.
window.addEventListener('mousedown', (e) => {
  if (e.button === 0) mouseDown = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDown = false;
});
// Safety: if the pointer leaves the window while held, release so we don't
// "sticky-fire" when the mouse re-enters.
window.addEventListener('mouseleave', () => {
  mouseDown = false;
});

export function getInput(): InputState {
  const left = isKey('ArrowLeft') || isKey('KeyA');
  const right = isKey('ArrowRight') || isKey('KeyD');
  const up = isKey('ArrowUp') || isKey('KeyW');
  const down = isKey('ArrowDown') || isKey('KeyS');
  const fireKey = isKey('KeyJ') || isKey('KeyF');
  return {
    x: (right ? 1 : 0) - (left ? 1 : 0),
    y: (up ? 1 : 0) - (down ? 1 : 0),
    boost: isKey('Space'),
    fire: mouseDown || fireKey,
  };
}
