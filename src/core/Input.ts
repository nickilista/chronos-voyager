/**
 * Unified input: keyboard + mouse.
 * Exposes a read-only InputState snapshot via getInput().
 *
 * Controls map (see HUD legend in src/ui/hud.ts):
 *   • WASD / arrows  → x / y axes (pilot)
 *   • Space          → boost (held)
 *   • Left mouse     → fire primary weapon (held)
 *   • J or F         → fire primary weapon (keyboard alternative)
 *   • Right mouse    → fire secondary weapon (held)
 *   • K or G         → fire secondary weapon (keyboard alternative)
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
  /** Secondary-fire held — mouse-right OR keyboard (K / G). Polled each frame. */
  readonly fireSecondary: boolean;
}

const keys = new Set<string>();
let mouseDown = false;
let rmbDown = false;

function isKey(code: string): boolean {
  return keys.has(code);
}

window.addEventListener('keydown', (e) => {
  // Store BOTH the physical code (e.g. 'KeyK' — layout-agnostic) and
  // the printed key (e.g. 'k' — layout-aware). That way
  // `isKey('KeyK')` and `keys.has('k')` both light up and the game
  // works on non-US keyboard layouts where the physical code may
  // differ from the letter on the keycap.
  keys.add(e.code);
  if (e.key && e.key.length === 1) keys.add(e.key.toLowerCase());
  // Prevent arrow keys from scrolling.
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.key && e.key.length === 1) keys.delete(e.key.toLowerCase());
});
window.addEventListener('blur', () => {
  keys.clear();
  mouseDown = false;
  rmbDown = false;
});

// Mouse-button fire. We listen on document so clicks anywhere in the canvas
// region (which covers the viewport) register, and gate on `button` so
// each mouse button maps to its own weapon slot.
window.addEventListener('mousedown', (e) => {
  if (e.button === 0) mouseDown = true;
  else if (e.button === 2) rmbDown = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDown = false;
  else if (e.button === 2) rmbDown = false;
});
// Disable the browser context menu so right-click fires the secondary
// weapon instead of popping up a menu.
window.addEventListener('contextmenu', (e) => e.preventDefault());
// Safety: if the pointer leaves the window while held, release so we don't
// "sticky-fire" when the mouse re-enters.
window.addEventListener('mouseleave', () => {
  mouseDown = false;
  rmbDown = false;
});

export function getInput(): InputState {
  const left = isKey('ArrowLeft') || isKey('KeyA');
  const right = isKey('ArrowRight') || isKey('KeyD');
  const up = isKey('ArrowUp') || isKey('KeyW');
  const down = isKey('ArrowDown') || isKey('KeyS');
  const fireKey = isKey('KeyJ') || isKey('KeyF');
  // Generous fallback set for secondary fire — different keyboard
  // layouts / remapping software occasionally mask one physical key,
  // so we accept K, G, L (all near the right hand on QWERTY) plus the
  // matching `e.key` values via the string-lowercase check.
  const fireSecondaryKey =
    isKey('KeyK') || isKey('KeyG') || isKey('KeyL') ||
    keys.has('k') || keys.has('g') || keys.has('l');
  return {
    x: (right ? 1 : 0) - (left ? 1 : 0),
    y: (up ? 1 : 0) - (down ? 1 : 0),
    boost: isKey('Space'),
    fire: mouseDown || fireKey,
    fireSecondary: rmbDown || fireSecondaryKey,
  };
}
