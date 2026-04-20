/**
 * HUD crosshair / aim reticle.
 *
 * Two visual states:
 *   • Idle   — four small dashes at cardinal directions around a faint
 *              center dot. Sits at screen center, dim, pointer-events:none.
 *              Meant to be legible without becoming visual noise — the
 *              game's bloom and particle density punishes loud reticles.
 *   • Locked — four corner brackets drawn around the locked meteorite's
 *              screen position, tinted warmer (amber). Also shows a
 *              center pip at the screen lock target + a dwell progress
 *              arc while the 2s soft-lock timer is filling.
 *
 * The locked-state overlay is a child of the same root so we don't fight
 * z-ordering with the rest of the HUD, and it's absolutely positioned
 * via `left` / `top` so we can animate it from the middle of the screen
 * to the target without incurring layout cost.
 */
export class Crosshair {
  readonly root: HTMLDivElement;
  private readonly centerReticle: HTMLDivElement;
  private readonly lockBox: HTMLDivElement;
  private readonly dwellRing: SVGCircleElement;
  private readonly dwellSvg: SVGSVGElement;
  private locked = false;

  constructor(parent: HTMLElement = document.body) {
    Crosshair.ensureStyles();

    this.root = document.createElement('div');
    this.root.className = 'xh-root';

    // --- center reticle (always on screen center) ---
    this.centerReticle = document.createElement('div');
    this.centerReticle.className = 'xh-center';
    this.centerReticle.innerHTML = `
      <div class="xh-dot"></div>
      <div class="xh-tick xh-tick-up"></div>
      <div class="xh-tick xh-tick-down"></div>
      <div class="xh-tick xh-tick-left"></div>
      <div class="xh-tick xh-tick-right"></div>
    `;

    // --- lock overlay (moves to the target's screen position) ---
    this.lockBox = document.createElement('div');
    this.lockBox.className = 'xh-lock';
    this.lockBox.innerHTML = `
      <div class="xh-corner xh-tl"></div>
      <div class="xh-corner xh-tr"></div>
      <div class="xh-corner xh-bl"></div>
      <div class="xh-corner xh-br"></div>
    `;

    // --- dwell progress ring (SVG) ---
    const svgNS = 'http://www.w3.org/2000/svg';
    this.dwellSvg = document.createElementNS(svgNS, 'svg') as SVGSVGElement;
    this.dwellSvg.setAttribute('class', 'xh-dwell');
    this.dwellSvg.setAttribute('viewBox', '0 0 44 44');
    this.dwellSvg.setAttribute('width', '44');
    this.dwellSvg.setAttribute('height', '44');
    const bg = document.createElementNS(svgNS, 'circle');
    bg.setAttribute('cx', '22');
    bg.setAttribute('cy', '22');
    bg.setAttribute('r', '19');
    bg.setAttribute('class', 'xh-dwell-bg');
    this.dwellSvg.appendChild(bg);
    this.dwellRing = document.createElementNS(svgNS, 'circle') as SVGCircleElement;
    this.dwellRing.setAttribute('cx', '22');
    this.dwellRing.setAttribute('cy', '22');
    this.dwellRing.setAttribute('r', '19');
    this.dwellRing.setAttribute('class', 'xh-dwell-fg');
    // Stroke dashoffset technique: circumference = 2πr ≈ 119.4. We
    // animate dashoffset from 119 (empty) → 0 (full circle).
    this.dwellRing.setAttribute('stroke-dasharray', '119.4');
    this.dwellRing.setAttribute('stroke-dashoffset', '119.4');
    this.dwellSvg.appendChild(this.dwellRing);

    this.root.append(this.centerReticle, this.lockBox, this.dwellSvg);
    parent.appendChild(this.root);
  }

  /**
   * Update the reticle state per frame.
   *
   * @param targetScreen Screen coordinates (0..viewportWidth/Height) of
   *                     the closest meteorite candidate, or null if
   *                     there is none. Non-null doesn't mean locked —
   *                     it means "something is being watched".
   * @param dwell01      Current dwell timer normalized to [0, 1]. 1 = fully
   *                     locked, anything below is in-progress.
   * @param locked       True iff dwell has reached the lock threshold.
   */
  update(
    targetScreen: { x: number; y: number } | null,
    dwell01: number,
    locked: boolean,
  ): void {
    const t = Math.max(0, Math.min(1, dwell01));
    this.dwellRing.setAttribute('stroke-dashoffset', String((1 - t) * 119.4));

    if (targetScreen) {
      this.lockBox.style.display = 'block';
      this.lockBox.style.left = `${targetScreen.x}px`;
      this.lockBox.style.top = `${targetScreen.y}px`;
      this.dwellSvg.style.display = 'block';
      this.dwellSvg.style.left = `${targetScreen.x - 22}px`;
      this.dwellSvg.style.top = `${targetScreen.y - 22}px`;

      if (locked && !this.locked) {
        this.lockBox.classList.add('xh-lock--armed');
      } else if (!locked && this.locked) {
        this.lockBox.classList.remove('xh-lock--armed');
      }
    } else {
      this.lockBox.style.display = 'none';
      this.dwellSvg.style.display = 'none';
      this.lockBox.classList.remove('xh-lock--armed');
    }
    this.locked = locked;
  }

  dispose(): void {
    this.root.remove();
  }

  private static styleInjected = false;
  private static ensureStyles(): void {
    if (Crosshair.styleInjected) return;
    Crosshair.styleInjected = true;
    const s = document.createElement('style');
    s.textContent = `
      .xh-root {
        position: fixed;
        inset: 0;
        pointer-events: none;
        /* Above HUD root (z-index 30) so the reticle reads in front of the
         * HUD blocks, but under the puzzle overlay chips so the puzzle
         * isn't covered by a bright dot. Chosen higher than 30 and lower
         * than 40 (hud-exit-btn) intentionally. */
        z-index: 32;
      }

      /* ---------- Center reticle (always-on, idle look) ---------- */
      .xh-center {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 22px;
        height: 22px;
        transform: translate(-50%, -50%);
      }
      .xh-dot {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 2px;
        height: 2px;
        background: rgba(230, 250, 255, 0.6);
        border-radius: 50%;
        transform: translate(-50%, -50%);
        box-shadow: 0 0 3px rgba(95, 200, 255, 0.6);
      }
      .xh-tick {
        position: absolute;
        background: rgba(230, 250, 255, 0.45);
        box-shadow: 0 0 3px rgba(95, 200, 255, 0.35);
      }
      .xh-tick-up { left: 50%; top: 0; width: 1px; height: 4px; transform: translateX(-50%); }
      .xh-tick-down { left: 50%; bottom: 0; width: 1px; height: 4px; transform: translateX(-50%); }
      .xh-tick-left { left: 0; top: 50%; width: 4px; height: 1px; transform: translateY(-50%); }
      .xh-tick-right { right: 0; top: 50%; width: 4px; height: 1px; transform: translateY(-50%); }

      /* ---------- Lock overlay (moves to target) ---------- */
      .xh-lock {
        position: absolute;
        width: 36px;
        height: 36px;
        transform: translate(-50%, -50%);
        display: none;
      }
      .xh-corner {
        position: absolute;
        width: 9px;
        height: 9px;
        border-color: rgba(255, 210, 127, 0.8);
        border-style: solid;
        border-width: 0;
        transition: border-color 0.15s ease-out;
      }
      .xh-tl { left: 0; top: 0; border-left-width: 2px; border-top-width: 2px; }
      .xh-tr { right: 0; top: 0; border-right-width: 2px; border-top-width: 2px; }
      .xh-bl { left: 0; bottom: 0; border-left-width: 2px; border-bottom-width: 2px; }
      .xh-br { right: 0; bottom: 0; border-right-width: 2px; border-bottom-width: 2px; }

      .xh-lock--armed .xh-corner {
        /* Lock acquired: corners turn red + pulse so the player knows
         * fire will auto-aim on the target. Animation loops silently. */
        border-color: rgba(255, 90, 110, 0.95);
        animation: xh-lock-pulse 0.9s ease-in-out infinite alternate;
      }
      @keyframes xh-lock-pulse {
        from { filter: drop-shadow(0 0 2px rgba(255, 90, 110, 0.3)); }
        to   { filter: drop-shadow(0 0 9px rgba(255, 90, 110, 0.85)); }
      }

      /* ---------- Dwell ring (SVG) ---------- */
      .xh-dwell {
        position: absolute;
        display: none;
        pointer-events: none;
      }
      .xh-dwell-bg {
        fill: none;
        stroke: rgba(95, 200, 255, 0.12);
        stroke-width: 2;
      }
      .xh-dwell-fg {
        fill: none;
        stroke: rgba(255, 210, 127, 0.85);
        stroke-width: 2;
        stroke-linecap: round;
        /* Start at 12 o'clock, rotate counter-clockwise as dashoffset drops. */
        transform: rotate(-90deg);
        transform-origin: 22px 22px;
        transition: stroke-dashoffset 0.06s linear;
        filter: drop-shadow(0 0 3px rgba(255, 210, 127, 0.6));
      }
    `;
    document.head.appendChild(s);
  }
}
