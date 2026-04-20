/**
 * Unified input: keyboard + mouse + touch.
 * Exposes a read-only InputState snapshot via getInput().
 *
 * Controls map (see HUD legend in src/ui/hud.ts):
 *   • WASD / arrows  → x / y axes (pilot)
 *   • Space          → boost (held)
 *   • Left mouse     → fire primary weapon (held)
 *   • J or F         → fire primary weapon (keyboard alternative)
 *   • Right mouse    → fire secondary weapon (held)
 *   • K or G         → fire secondary weapon (keyboard alternative)
 *   • Touch joystick (left half) → x / y axes
 *   • Touch buttons (right side) → fire / secondary / boost
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

/* ------------------------------------------------------------------ */
/*  Keyboard + mouse state                                            */
/* ------------------------------------------------------------------ */

const keys = new Set<string>();
let mouseDown = false;
let rmbDown = false;

function isKey(code: string): boolean {
  return keys.has(code);
}

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.key && e.key.length === 1) keys.add(e.key.toLowerCase());
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

window.addEventListener('mousedown', (e) => {
  if (e.button === 0) mouseDown = true;
  else if (e.button === 2) rmbDown = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDown = false;
  else if (e.button === 2) rmbDown = false;
});
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('mouseleave', () => {
  mouseDown = false;
  rmbDown = false;
});

/* ------------------------------------------------------------------ */
/*  Touch state + virtual controls                                    */
/* ------------------------------------------------------------------ */

const isTouchDevice =
  'ontouchstart' in window || navigator.maxTouchPoints > 0;

/** Joystick axis values fed by touch. */
let touchX = 0;
let touchY = 0;
/** Action-button flags fed by touch. */
let touchFire = false;
let touchSecondary = false;
let touchBoost = false;

/**
 * Track the joystick touch by its identifier so concurrent button
 * touches don't interfere.
 */
let joystickTouchId: number | null = null;
let joystickOriginX = 0;
let joystickOriginY = 0;

/** References to DOM elements for position updates. */
let joystickOuter: HTMLDivElement | null = null;
let joystickInner: HTMLDivElement | null = null;

const JOYSTICK_RADIUS = 56; // outer ring radius — slightly larger for fat thumbs
const DEAD_ZONE = 6;        // px — tight dead zone for responsive feel

if (isTouchDevice) {
  document.body.classList.add('touch-device');
  initTouchOverlay();
}

function initTouchOverlay(): void {
  /* ---- inject styles ---- */
  const style = document.createElement('style');
  style.textContent = `
    /* Hide keyboard controls legend on touch devices */
    .touch-device .hud-controls { display: none !important; }

    /* Hide touch flight controls during puzzles — they block puzzle interactions */
    body.puzzle-active .touch-overlay { display: none !important; }

    .touch-overlay {
      position: fixed;
      inset: 0;
      z-index: 15;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }

    /* Left half catches joystick touches */
    .touch-zone-left {
      position: absolute;
      left: 0; top: 0;
      width: 50%; height: 100%;
      pointer-events: auto;
    }

    /* Joystick ring (appears at touch origin) */
    .touch-joy-outer {
      position: absolute;
      width: 112px; height: 112px;
      border-radius: 50%;
      border: 2.5px solid rgba(255,255,255,0.2);
      background: rgba(255,255,255,0.05);
      transform: translate(-50%, -50%);
      display: none;
      pointer-events: none;
    }
    .touch-joy-inner {
      position: absolute;
      left: 50%; top: 50%;
      width: 48px; height: 48px;
      border-radius: 50%;
      background: rgba(95,200,255,0.7);
      box-shadow: 0 0 16px rgba(95,200,255,0.5);
      transform: translate(-50%, -50%);
      pointer-events: none;
    }

    /* Right-side action buttons */
    .touch-buttons {
      position: absolute;
      right: 14px;
      bottom: max(100px, calc(env(safe-area-inset-bottom, 0px) + 90px));
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      pointer-events: auto;
    }
    .touch-btn {
      width: 60px; height: 60px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(6,10,22,0.75);
      border: 2px solid rgba(95,180,255,0.35);
      color: rgba(230,250,255,0.9);
      font-size: 22px;
      line-height: 1;
      pointer-events: auto;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      /* No transition — instant feedback is critical for game controls */
    }
    .touch-btn.active {
      background: rgba(30,80,140,0.9);
      border-color: rgba(95,200,255,0.9);
      box-shadow: 0 0 20px rgba(95,200,255,0.6);
    }
    .touch-btn-label {
      position: absolute;
      right: 70px;
      font-family: 'Rajdhani','Segoe UI',system-ui,sans-serif;
      font-size: 9px;
      letter-spacing: 0.15em;
      font-weight: 600;
      color: rgba(159,230,255,0.45);
      pointer-events: none;
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);

  /* ---- build DOM ---- */
  const overlay = document.createElement('div');
  overlay.className = 'touch-overlay';

  // Joystick zone (left half)
  const zoneLeft = document.createElement('div');
  zoneLeft.className = 'touch-zone-left';

  joystickOuter = document.createElement('div');
  joystickOuter.className = 'touch-joy-outer';
  joystickInner = document.createElement('div');
  joystickInner.className = 'touch-joy-inner';
  joystickOuter.appendChild(joystickInner);
  zoneLeft.appendChild(joystickOuter);

  // Joystick touch events
  zoneLeft.addEventListener('touchstart', onJoystickStart, { passive: false });
  zoneLeft.addEventListener('touchmove', onJoystickMove, { passive: false });
  zoneLeft.addEventListener('touchend', onJoystickEnd, { passive: false });
  zoneLeft.addEventListener('touchcancel', onJoystickEnd, { passive: false });

  // Action buttons (right side)
  const btnContainer = document.createElement('div');
  btnContainer.className = 'touch-buttons';

  const fireBtn = makeButton('\u25CE', 'FIRE');       // ◎
  const secBtn = makeButton('\u25C8', 'SECONDARY');    // ◈
  const boostBtn = makeButton('\u26A1', 'BOOST');      // ⚡

  bindButton(fireBtn, (v) => { touchFire = v; });
  bindButton(secBtn, (v) => { touchSecondary = v; });
  bindButton(boostBtn, (v) => { touchBoost = v; });

  btnContainer.append(fireBtn, secBtn, boostBtn);
  overlay.append(zoneLeft, btnContainer);
  document.body.appendChild(overlay);
}

function makeButton(icon: string, label: string): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.style.position = 'relative';

  const btn = document.createElement('div');
  btn.className = 'touch-btn';
  btn.textContent = icon;

  const lab = document.createElement('div');
  lab.className = 'touch-btn-label';
  lab.textContent = label;

  wrap.append(btn, lab);
  return wrap;
}

function bindButton(
  wrap: HTMLDivElement,
  setter: (pressed: boolean) => void,
): void {
  const btn = wrap.querySelector('.touch-btn') as HTMLDivElement;
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    setter(true);
    btn.classList.add('active');
  }, { passive: false });
  btn.addEventListener('touchend', (e) => {
    e.preventDefault();
    setter(false);
    btn.classList.remove('active');
  }, { passive: false });
  btn.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    setter(false);
    btn.classList.remove('active');
  }, { passive: false });
}

/* ---- joystick handlers ---- */

function onJoystickStart(e: TouchEvent): void {
  e.preventDefault();
  // Only claim the first new touch if we don't already have one.
  if (joystickTouchId !== null) return;
  const t = e.changedTouches[0];
  joystickTouchId = t.identifier;
  joystickOriginX = t.clientX;
  joystickOriginY = t.clientY;
  if (joystickOuter) {
    joystickOuter.style.left = `${t.clientX}px`;
    joystickOuter.style.top = `${t.clientY}px`;
    joystickOuter.style.display = 'block';
  }
  if (joystickInner) {
    joystickInner.style.left = '50%';
    joystickInner.style.top = '50%';
  }
  touchX = 0;
  touchY = 0;
}

function onJoystickMove(e: TouchEvent): void {
  e.preventDefault();
  if (joystickTouchId === null) return;
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    if (t.identifier !== joystickTouchId) continue;

    let dx = t.clientX - joystickOriginX;
    let dy = t.clientY - joystickOriginY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Clamp to outer ring radius
    if (dist > JOYSTICK_RADIUS) {
      dx = (dx / dist) * JOYSTICK_RADIUS;
      dy = (dy / dist) * JOYSTICK_RADIUS;
    }

    // Normalize to -1..+1 with dead zone
    if (dist < DEAD_ZONE) {
      touchX = 0;
      touchY = 0;
    } else {
      touchX = Math.max(-1, Math.min(1, dx / JOYSTICK_RADIUS));
      // Invert Y: screen-down is positive clientY delta but game-down is -1
      touchY = Math.max(-1, Math.min(1, -dy / JOYSTICK_RADIUS));
    }

    // Move the inner thumb visual
    if (joystickInner) {
      const pxX = 50 + (dx / JOYSTICK_RADIUS) * 50;
      const pxY = 50 + (dy / JOYSTICK_RADIUS) * 50;
      joystickInner.style.left = `${pxX}%`;
      joystickInner.style.top = `${pxY}%`;
    }
    break;
  }
}

function onJoystickEnd(e: TouchEvent): void {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === joystickTouchId) {
      joystickTouchId = null;
      touchX = 0;
      touchY = 0;
      if (joystickOuter) joystickOuter.style.display = 'none';
      break;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Combined getInput()                                               */
/* ------------------------------------------------------------------ */

export function getInput(): InputState {
  const left = isKey('ArrowLeft') || isKey('KeyA');
  const right = isKey('ArrowRight') || isKey('KeyD');
  const up = isKey('ArrowUp') || isKey('KeyW');
  const down = isKey('ArrowDown') || isKey('KeyS');
  const fireKey = isKey('KeyJ') || isKey('KeyF');
  const fireSecondaryKey =
    isKey('KeyK') || isKey('KeyG') || isKey('KeyL') ||
    keys.has('k') || keys.has('g') || keys.has('l');

  // Keyboard axes: discrete -1/0/+1
  const kbX = (right ? 1 : 0) - (left ? 1 : 0);
  const kbY = (up ? 1 : 0) - (down ? 1 : 0);

  // Merge: if keyboard has a directional input use it (snaps to full),
  // otherwise use the analog touch joystick value.
  const x = kbX !== 0 ? kbX : touchX;
  const y = kbY !== 0 ? kbY : touchY;

  return {
    x,
    y,
    boost: isKey('Space') || touchBoost,
    fire: mouseDown || fireKey || touchFire,
    fireSecondary: rmbDown || fireSecondaryKey || touchSecondary,
  };
}
