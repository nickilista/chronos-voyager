/**
 * DOM overlay HUD. Era badge, speed/distance readout, sacred-orb counter,
 * ship-loadout telemetry (HP + shield + boost), and a checkpoint win
 * overlay. Framework-free, single root.
 *
 * Hearts were replaced with an HP / shield stack as part of the ship-builder
 * rework — numeric readouts plus graduated bars, matching the professional
 * space-game feel the builder's stats panel establishes.
 */

import { SaveManager } from '../core/SaveManager.ts';

export class Hud {
  readonly root: HTMLDivElement;
  private eraLabel: HTMLDivElement;
  private eraSub: HTMLDivElement;
  private speedEl: HTMLDivElement;
  private distEl: HTMLDivElement;
  private orbCountEl: HTMLDivElement;
  private orbTargetEl: HTMLDivElement;
  private orbFillEl: HTMLDivElement;
  private orbIconEl: HTMLSpanElement;

  // Loadout telemetry (bottom-left)
  private loadoutEl: HTMLDivElement;
  private hpValueEl!: HTMLDivElement;
  private hpFillEl!: HTMLDivElement;
  private shieldValueEl!: HTMLDivElement;
  private shieldFillEl!: HTMLDivElement;
  private boostFillEl!: HTMLDivElement;
  private weaponPrimEl!: HTMLDivElement;
  private weaponSecEl!: HTMLDivElement;

  private winEl: HTMLDivElement;
  private winVisible = false;

  private hpFlashTimer = 0;

  /** Controls legend (bottom-right) — always visible so the player never
   *  has to guess which key does what. Collapsible via the chevron so it
   *  doesn't eat screen space once the player has learned the scheme. */
  private controlsEl!: HTMLDivElement;
  /** "Return to map" button — visible only while a checkpoint puzzle is
   *  active, letting the player abandon a puzzle without solving it. */
  private exitBtn!: HTMLButtonElement;
  private exitHandler: (() => void) | null = null;
  private resetBtn!: HTMLButtonElement;

  constructor(parent: HTMLElement = document.body) {
    this.root = document.createElement('div');
    this.root.className = 'hud';

    Hud.ensureStyles();

    // Era badge (top-left)
    const badge = document.createElement('div');
    badge.className = 'hud-badge';
    this.eraLabel = document.createElement('div');
    this.eraLabel.className = 'hud-era';
    this.eraSub = document.createElement('div');
    this.eraSub.className = 'hud-era-sub';
    badge.append(this.eraLabel, this.eraSub);

    // Readout (top-right)
    const readout = document.createElement('div');
    readout.className = 'hud-readout';
    this.speedEl = document.createElement('div');
    this.speedEl.className = 'hud-speed';
    this.distEl = document.createElement('div');
    this.distEl.className = 'hud-dist';
    readout.append(this.speedEl, this.distEl);

    // Orb counter (bottom-center)
    const orb = document.createElement('div');
    orb.className = 'hud-orb';
    this.orbIconEl = document.createElement('span');
    this.orbIconEl.className = 'hud-orb-icon';
    this.orbIconEl.textContent = '\u2625';
    const orbNums = document.createElement('span');
    orbNums.className = 'hud-orb-nums';
    this.orbCountEl = document.createElement('div');
    this.orbCountEl.className = 'hud-orb-count';
    this.orbCountEl.textContent = '0';
    this.orbTargetEl = document.createElement('div');
    this.orbTargetEl.className = 'hud-orb-target';
    this.orbTargetEl.textContent = '/ 10';
    orbNums.append(this.orbCountEl, this.orbTargetEl);
    const orbBar = document.createElement('div');
    orbBar.className = 'hud-orb-bar';
    this.orbFillEl = document.createElement('div');
    this.orbFillEl.className = 'hud-orb-fill';
    orbBar.append(this.orbFillEl);
    orb.append(this.orbIconEl, orbNums, orbBar);

    // Loadout telemetry (bottom-left)
    this.loadoutEl = this.buildLoadoutPanel();

    // Win overlay (hidden by default)
    this.winEl = document.createElement('div');
    this.winEl.className = 'hud-win';
    this.winEl.innerHTML = `
      <div class="hud-win-kicker">CHECKPOINT</div>
      <div class="hud-win-title">ten relics recovered</div>
      <div class="hud-win-sub">the puzzle of the era awaits…</div>
    `;

    // Controls legend (bottom-right) — compact keybind reference.
    this.controlsEl = this.buildControlsLegend();

    // Exit-puzzle button (top-center, hidden by default) — appears during
    // checkpoint puzzles so the player can bail back to the galaxy map.
    this.exitBtn = document.createElement('button');
    this.exitBtn.className = 'hud-exit-btn';
    this.exitBtn.type = 'button';
    this.exitBtn.textContent = '← Return to map';
    this.exitBtn.style.display = 'none';
    this.exitBtn.addEventListener('click', () => {
      if (this.exitHandler) this.exitHandler();
    });

    // "New Game" reset button — top-right, always visible. Clears the
    // save and reloads so the player starts fresh from the ship builder.
    this.resetBtn = document.createElement('button');
    this.resetBtn.className = 'hud-reset-btn';
    this.resetBtn.type = 'button';
    this.resetBtn.textContent = 'New Game';
    this.resetBtn.addEventListener('click', () => {
      if (!confirm('Start a new game? All progress will be lost.')) return;
      SaveManager.clear();
      location.reload();
    });

    this.root.append(
      badge,
      readout,
      this.loadoutEl,
      orb,
      this.winEl,
      this.controlsEl,
      this.exitBtn,
      this.resetBtn,
    );
    parent.appendChild(this.root);
  }

  /**
   * Build the controls legend panel. Lists the keys that are currently wired
   * up in `src/core/Input.ts`. If shooting / abilities get added later, a
   * new row here is all the UI work needed.
   */
  private buildControlsLegend(): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.className = 'hud-controls';

    const title = document.createElement('div');
    title.className = 'hud-controls-title';
    title.textContent = 'CONTROLS';

    const rows = document.createElement('div');
    rows.className = 'hud-controls-rows';

    const addRow = (keys: string[], label: string): void => {
      const row = document.createElement('div');
      row.className = 'hud-controls-row';
      const keyWrap = document.createElement('div');
      keyWrap.className = 'hud-controls-keys';
      for (const k of keys) {
        const kbd = document.createElement('kbd');
        kbd.className = 'hud-kbd';
        kbd.textContent = k;
        keyWrap.appendChild(kbd);
      }
      const lab = document.createElement('div');
      lab.className = 'hud-controls-label';
      lab.textContent = label;
      row.append(keyWrap, lab);
      rows.appendChild(row);
    };

    // Current wired-up inputs (see core/Input.ts).
    addRow(['W', 'A', 'S', 'D'], 'Fly (yaw / pitch / strafe)');
    addRow(['↑', '↓', '←', '→'], 'Alt. movement');
    addRow(['␣ SPACE'], 'Boost');

    wrap.append(title, rows);
    return wrap;
  }

  /**
   * Show the "Return to map" button with a click handler. Called by Game
   * when a checkpoint puzzle starts; the handler typically calls
   * `abandonPuzzle()` so the player can back out without solving.
   */
  showExitButton(onClick: () => void): void {
    this.exitHandler = onClick;
    this.exitBtn.style.display = 'inline-flex';
    // Dim the rest of the HUD — gameplay telemetry (speed, HP, ankhs,
    // controls legend) is irrelevant inside a puzzle, and keeping it
    // visible fights the puzzle's own top-left/top-center UI for
    // attention. The exit button stays on top (z-index 40 within the
    // HUD stacking context at z-index 30, above puzzle overlays at 25).
    this.root.classList.add('hud--in-puzzle');
  }

  /** Hide the exit button — called when the puzzle ends (solved or abandoned). */
  hideExitButton(): void {
    this.exitHandler = null;
    this.exitBtn.style.display = 'none';
    this.root.classList.remove('hud--in-puzzle');
  }

  private buildLoadoutPanel(): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.className = 'hud-loadout';

    // HP row
    const hpRow = document.createElement('div');
    hpRow.className = 'hud-lo-row';
    hpRow.innerHTML = `
      <div class="hud-lo-label">HP</div>
      <div class="hud-lo-bar"><div class="hud-lo-fill hud-lo-fill-hp"></div></div>
      <div class="hud-lo-value hud-lo-value-hp">100</div>
    `;
    this.hpFillEl = hpRow.querySelector('.hud-lo-fill-hp') as HTMLDivElement;
    this.hpValueEl = hpRow.querySelector('.hud-lo-value-hp') as HTMLDivElement;

    // Shield row
    const shRow = document.createElement('div');
    shRow.className = 'hud-lo-row';
    shRow.innerHTML = `
      <div class="hud-lo-label">SH</div>
      <div class="hud-lo-bar"><div class="hud-lo-fill hud-lo-fill-shield"></div></div>
      <div class="hud-lo-value hud-lo-value-sh">0</div>
    `;
    this.shieldFillEl = shRow.querySelector('.hud-lo-fill-shield') as HTMLDivElement;
    this.shieldValueEl = shRow.querySelector('.hud-lo-value-sh') as HTMLDivElement;

    // Boost row — thin readiness bar that refills during cooldown.
    const boostRow = document.createElement('div');
    boostRow.className = 'hud-lo-row';
    boostRow.innerHTML = `
      <div class="hud-lo-label">BST</div>
      <div class="hud-lo-bar hud-lo-bar-slim"><div class="hud-lo-fill hud-lo-fill-boost"></div></div>
    `;
    this.boostFillEl = boostRow.querySelector('.hud-lo-fill-boost') as HTMLDivElement;

    // Weapons row (two compact chips)
    const weaponsRow = document.createElement('div');
    weaponsRow.className = 'hud-lo-weapons';
    this.weaponPrimEl = document.createElement('div');
    this.weaponPrimEl.className = 'hud-lo-weapon';
    this.weaponPrimEl.textContent = 'PRIMARY —';
    this.weaponSecEl = document.createElement('div');
    this.weaponSecEl.className = 'hud-lo-weapon';
    this.weaponSecEl.textContent = 'SECONDARY —';
    weaponsRow.append(this.weaponPrimEl, this.weaponSecEl);

    wrap.append(hpRow, shRow, boostRow, weaponsRow);
    return wrap;
  }

  setEra(name: string, subtitle: string, accentHex: number): void {
    this.eraLabel.textContent = name;
    this.eraSub.textContent = subtitle;
    const hex = '#' + accentHex.toString(16).padStart(6, '0');
    document.documentElement.style.setProperty('--era-accent', hex);
  }

  setOrbTarget(target: number): void {
    this.orbTargetEl.textContent = `/ ${target}`;
  }

  setOrbIcon(char: string): void {
    this.orbIconEl.textContent = char;
  }

  /** Set the fixed weapons shown in the loadout chips (called once at start). */
  setWeapons(primary: string, secondary: string): void {
    this.weaponPrimEl.textContent = `PRI · ${primary.toUpperCase()}`;
    this.weaponSecEl.textContent = `SEC · ${secondary.toUpperCase()}`;
  }

  /**
   * Update HP + shield bars. Both are driven by the game's damage model —
   * `hp` is current hull, `maxHp` the loadout cap; same for shield.
   */
  updateHpShield(hp: number, maxHp: number, shield: number, maxShield: number): void {
    const hpPct = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));
    this.hpFillEl.style.width = `${hpPct * 100}%`;
    this.hpValueEl.textContent = `${Math.round(hp)}`;

    const shPct = Math.max(0, Math.min(1, maxShield > 0 ? shield / maxShield : 0));
    this.shieldFillEl.style.width = `${shPct * 100}%`;
    this.shieldValueEl.textContent = `${Math.round(shield)}`;

    // Color tint: HP bar gets redder as it drops.
    if (hpPct < 0.3) this.hpFillEl.classList.add('crit');
    else this.hpFillEl.classList.remove('crit');
  }

  /** Flash on hit. Keeps the bars visually alive during fast-paced play. */
  flashHit(): void {
    this.hpFlashTimer = 0.35;
    this.loadoutEl.classList.remove('hit');
    // Force reflow so the animation can retrigger.
    void this.loadoutEl.offsetWidth;
    this.loadoutEl.classList.add('hit');
  }

  /** Boost readiness in [0..1] — 0 = empty, 1 = ready. */
  setBoostReady(fraction: number): void {
    const pct = Math.max(0, Math.min(1, fraction));
    this.boostFillEl.style.width = `${pct * 100}%`;
    if (pct >= 1) this.boostFillEl.classList.add('ready');
    else this.boostFillEl.classList.remove('ready');
  }

  flashAnkhLoss(): void {
    this.orbCountEl.classList.remove('lose');
    void this.orbCountEl.offsetWidth;
    this.orbCountEl.classList.add('lose');
  }

  private static styleInjected = false;
  private static ensureStyles(): void {
    if (Hud.styleInjected) return;
    Hud.styleInjected = true;
    const s = document.createElement('style');
    s.textContent = `
      .hud-loadout {
        position: absolute;
        left: 22px;
        bottom: 28px;
        min-width: 260px;
        padding: 12px 16px 14px;
        background: rgba(6, 10, 22, 0.65);
        border: 1px solid rgba(95, 180, 255, 0.22);
        border-left: 3px solid #5fc8ff;
        border-radius: 6px;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        font-family: 'Rajdhani', 'Segoe UI', system-ui, sans-serif;
        font-variant-numeric: tabular-nums;
        transition: transform 0.15s ease-out, box-shadow 0.25s ease-out;
      }
      .hud-loadout.hit {
        animation: hud-lo-hit 0.45s ease-out;
      }
      @keyframes hud-lo-hit {
        0%   { transform: scale(1);    box-shadow: 0 0 0 rgba(255, 30, 40, 0);   border-color: rgba(95, 180, 255, 0.22); }
        15%  { transform: scale(1.06); box-shadow: 0 0 28px rgba(255, 30, 40, 0.85), inset 0 0 12px rgba(255, 40, 40, 0.3); border-color: rgba(255, 60, 60, 0.9); }
        40%  { transform: scale(1.02); box-shadow: 0 0 14px rgba(255, 50, 60, 0.5);  border-color: rgba(255, 80, 80, 0.5); }
        100% { transform: scale(1);    box-shadow: 0 0 0 rgba(255, 30, 40, 0);   border-color: rgba(95, 180, 255, 0.22); }
      }
      .hud-lo-row {
        display: grid;
        grid-template-columns: 36px 1fr 46px;
        align-items: center;
        gap: 10px;
        margin-bottom: 6px;
      }
      .hud-lo-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.2em;
        color: rgba(159, 230, 255, 0.8);
      }
      .hud-lo-bar {
        height: 8px;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 2px;
        overflow: hidden;
        border: 1px solid rgba(95, 180, 255, 0.14);
      }
      .hud-lo-bar-slim { height: 4px; }
      .hud-lo-fill {
        width: 100%;
        height: 100%;
        transition: width 0.2s ease-out;
      }
      .hud-lo-fill-hp {
        background: linear-gradient(90deg, #ff4d7a, #ffa759);
        box-shadow: 0 0 8px rgba(255, 100, 130, 0.5);
      }
      .hud-lo-fill-hp.crit {
        animation: hud-lo-crit 0.9s ease-in-out infinite;
      }
      @keyframes hud-lo-crit {
        0%, 100% { filter: brightness(1); }
        50% { filter: brightness(1.6) saturate(1.2); }
      }
      .hud-lo-fill-shield {
        background: linear-gradient(90deg, #5fc8ff, #9fe6ff);
        box-shadow: 0 0 8px rgba(95, 200, 255, 0.55);
      }
      .hud-lo-fill-boost {
        background: linear-gradient(90deg, #ffd27f, #ff9a5a);
        box-shadow: 0 0 6px rgba(255, 180, 120, 0.5);
      }
      .hud-lo-fill-boost.ready {
        box-shadow: 0 0 12px rgba(255, 180, 120, 0.9);
      }
      .hud-lo-value {
        font-size: 14px;
        font-weight: 700;
        color: #fff;
        text-align: right;
      }
      .hud-lo-weapons {
        display: flex;
        gap: 6px;
        margin-top: 8px;
      }
      .hud-lo-weapon {
        flex: 1;
        font-size: 10px;
        letter-spacing: 0.12em;
        color: #9fe6ff;
        padding: 4px 6px;
        background: rgba(95, 200, 255, 0.08);
        border: 1px solid rgba(95, 200, 255, 0.24);
        border-radius: 3px;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .hud-orb-count.lose { animation: hud-ankh-lose 0.7s ease-out; }
      @keyframes hud-ankh-lose {
        0% { color: #ff5064; text-shadow: 0 0 10px #ff506488; }
        100% {}
      }

      /* ============ Controls legend (bottom-right) ============ */
      .hud-controls {
        position: absolute;
        right: 22px;
        bottom: 28px;
        min-width: 210px;
        padding: 10px 14px 12px;
        background: rgba(6, 10, 22, 0.62);
        border: 1px solid rgba(95, 180, 255, 0.2);
        border-right: 3px solid #5fc8ff;
        border-radius: 6px;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        font-family: 'Rajdhani', 'Segoe UI', system-ui, sans-serif;
        pointer-events: none;
        user-select: none;
      }
      .hud-controls-title {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.28em;
        color: rgba(159, 230, 255, 0.8);
        margin-bottom: 8px;
      }
      .hud-controls-rows {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .hud-controls-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .hud-controls-keys {
        display: flex;
        gap: 3px;
        min-width: 92px;
      }
      .hud-kbd {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        font-family: 'Rajdhani', 'Segoe UI', system-ui, sans-serif;
        font-size: 10px;
        font-weight: 700;
        color: #e6faff;
        background: rgba(95, 200, 255, 0.12);
        border: 1px solid rgba(95, 200, 255, 0.35);
        border-bottom-width: 2px;
        border-radius: 3px;
        letter-spacing: 0;
      }
      .hud-controls-label {
        font-size: 11px;
        color: rgba(230, 250, 255, 0.78);
        letter-spacing: 0.04em;
      }

      /* ============ Return-to-map button (top-right, during puzzles) ============
       * Puzzles put their rules toggle at top-left (ⓘ RULES in Senet) and
       * their status / primary action at top-center (THROW STICKS in
       * Senet). Top-right is the only corner consistently empty across
       * every checkpoint, so the exit button lives there — no overlap
       * with puzzle UI, predictable position. */
      .hud-exit-btn {
        position: absolute;
        top: 18px;
        right: 22px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 10px 18px;
        font-family: 'Rajdhani', 'Segoe UI', system-ui, sans-serif;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.1em;
        color: #e6faff;
        background: rgba(6, 10, 22, 0.82);
        border: 1px solid rgba(95, 180, 255, 0.5);
        border-right: 3px solid #5fc8ff;
        border-radius: 4px;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        cursor: pointer;
        pointer-events: auto;
        z-index: 40;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
        transition: background 0.15s ease-out, border-color 0.15s ease-out, transform 0.1s ease-out;
      }
      .hud-exit-btn:hover {
        background: rgba(20, 40, 72, 0.92);
        border-color: rgba(95, 200, 255, 0.85);
      }
      .hud-exit-btn:active {
        transform: scale(0.97);
      }

      /* ============ "New Game" reset button (top-right) ============ */
      .hud-reset-btn {
        position: absolute;
        top: 18px;
        right: 22px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        font-family: 'Rajdhani', 'Segoe UI', system-ui, sans-serif;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.12em;
        color: rgba(230, 250, 255, 0.7);
        background: rgba(6, 10, 22, 0.6);
        border: 1px solid rgba(255, 100, 120, 0.3);
        border-radius: 4px;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        cursor: pointer;
        pointer-events: auto;
        z-index: 40;
        transition: background 0.15s ease-out, border-color 0.15s ease-out, color 0.15s ease-out;
      }
      .hud-reset-btn:hover {
        color: #ffa0a8;
        background: rgba(40, 10, 16, 0.85);
        border-color: rgba(255, 100, 120, 0.7);
      }
      .hud-reset-btn:active {
        transform: scale(0.97);
      }
    `;
    document.head.appendChild(s);
  }

  updateOrbCount(collected: number, target: number): void {
    this.orbCountEl.textContent = String(collected);
    const pct = Math.max(0, Math.min(1, collected / target));
    this.orbFillEl.style.width = `${pct * 100}%`;
    if (collected > 0) {
      this.orbCountEl.classList.remove('pulse');
      void this.orbCountEl.offsetWidth;
      this.orbCountEl.classList.add('pulse');
    }
  }

  update(dt: number, speed: number, distance: number): void {
    this.speedEl.textContent = `${Math.round(speed)} u/s`;
    this.distEl.textContent = `${Math.round(distance)} m`;
    if (this.hpFlashTimer > 0) this.hpFlashTimer = Math.max(0, this.hpFlashTimer - dt);
  }

  showWin(): void {
    if (this.winVisible) return;
    this.winVisible = true;
    this.winEl.classList.add('visible');
  }

  hideWin(): void {
    this.winVisible = false;
    this.winEl.classList.remove('visible');
  }
}
