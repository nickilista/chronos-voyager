import {
  SHIP_CLASSES,
  SHIP_SLOTS,
  type ShipClass,
  type ShipConfig,
  type ShipDerivedStats,
  type ShipsConfigJson,
  type ShipSlot,
} from './shipTypes.ts';
import { SaveManager, SHIP_PART_UNLOCK_THRESHOLD, type SaveData } from '../core/SaveManager.ts';

/**
 * DOM overlay for the ship builder. Pure DOM — no framework — so it loads
 * in < 10 ms and doesn't fight with the game's own renderer for the event
 * loop. Three panels:
 *
 *   • Left column — ten `<select>`s, one per slot, each offering the 10
 *     ship classes. Changing any select emits `onConfigChange` with the
 *     fresh full config.
 *   • Right column — live-updating stats panel (HP, shield, speed, DPS,
 *     yaw/pitch/roll, maneuverability, specials chips).
 *   • Bottom strip — 10 preset buttons (one per class, fills every slot
 *     with that class) + big "Launch Mission" button.
 *
 * All styles are injected once as a <style> tag so the overlay stays
 * self-contained and the file can be lifted into any other project without
 * drag-in CSS.
 */

export interface ShipBuilderUIProps {
  registry: ShipsConfigJson;
  initialConfig: ShipConfig;
  /** Persisted save so we can gate ship-class selection behind the unlock
   *  system. When null (fresh player) only Falcon is unlocked. Passed in
   *  from main.ts → ShipBuilder → here. */
  save: SaveData | null;
  onConfigChange(next: ShipConfig): void;
  onLaunch(): void;
}

const SLOT_LABEL: Record<ShipSlot, string> = {
  hull: 'Hull',
  cockpit: 'Cockpit',
  wing_L: 'Wing — Left',
  wing_R: 'Wing — Right',
  engine_main: 'Main Engine',
  engine_aux: 'Aux Engine',
  weapon_primary: 'Primary Weapon',
  weapon_secondary: 'Secondary Weapon',
  shield: 'Shield',
  tail: 'Tail',
};

export class ShipBuilderUI {
  private readonly props: ShipBuilderUIProps;
  private config: ShipConfig;
  private root: HTMLDivElement | null = null;
  private selects: Partial<Record<ShipSlot, HTMLSelectElement>> = {};
  private statValues = new Map<string, HTMLDivElement>();
  private hpBarFill: HTMLDivElement | null = null;
  private shieldBarFill: HTMLDivElement | null = null;
  private specialsEl: HTMLDivElement | null = null;

  constructor(props: ShipBuilderUIProps) {
    this.props = props;
    this.config = { ...props.initialConfig };
  }

  mount(parent: HTMLElement): void {
    ShipBuilderUI.ensureStyles();

    const root = document.createElement('div');
    root.className = 'sb-root';

    // Header
    const header = document.createElement('div');
    header.className = 'sb-header';
    header.innerHTML = `
      <div class="sb-title">CHRONOS VOYAGER</div>
      <div class="sb-subtitle">Hangar · Ship Customisation</div>
    `;

    // Left panel — slot selectors
    const slotsPanel = document.createElement('div');
    slotsPanel.className = 'sb-panel sb-slots';
    const slotsTitle = document.createElement('div');
    slotsTitle.className = 'sb-panel-title';
    slotsTitle.textContent = 'MODULES';
    slotsPanel.appendChild(slotsTitle);
    for (const slot of SHIP_SLOTS) {
      slotsPanel.appendChild(this.buildSlotRow(slot));
    }

    // Right panel — stats
    const statsPanel = document.createElement('div');
    statsPanel.className = 'sb-panel sb-stats';
    statsPanel.appendChild(this.buildStatsBlock());

    // Bottom strip — presets + launch
    const bottom = document.createElement('div');
    bottom.className = 'sb-bottom';
    const presets = document.createElement('div');
    presets.className = 'sb-presets';
    const presetsLabel = document.createElement('div');
    presetsLabel.className = 'sb-presets-label';
    presetsLabel.textContent = 'PRESETS';
    presets.appendChild(presetsLabel);
    for (const cls of SHIP_CLASSES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sb-preset';
      btn.dataset.cls = cls;
      const shipInfo = this.props.registry.ships[cls];
      const unlocked = SaveManager.isUnlocked(cls, this.props.save);
      const partCount = SaveManager.getPartCount(cls, this.props.save);

      if (unlocked) {
        btn.innerHTML = `
          <div class="sb-preset-name">${shipInfo.name}</div>
          <div class="sb-preset-class">${shipInfo.class}</div>
        `;
        btn.title = shipInfo.description;
        btn.addEventListener('click', () => this.applyPreset(cls));
      } else {
        // Locked preset: greyed out, padlock glyph above the name, progress
        // count beneath showing parts collected / parts required. Click is
        // still bound but just flashes a short "locked" animation on the
        // button itself — no side-effect on the config. A tooltip explains
        // the mechanic so a player who's never shot a meteorite understands
        // what they're looking at.
        btn.classList.add('sb-preset--locked');
        btn.innerHTML = `
          <div class="sb-preset-lock">🔒</div>
          <div class="sb-preset-name">${shipInfo.name}</div>
          <div class="sb-preset-class">${partCount}/${SHIP_PART_UNLOCK_THRESHOLD} parts</div>
        `;
        btn.title =
          `${shipInfo.name} · Locked\n` +
          `Destroy meteorites in open space to find parts of this ship (${partCount}/${SHIP_PART_UNLOCK_THRESHOLD}).`;
        btn.addEventListener('click', () => {
          btn.classList.remove('sb-preset--shake');
          void btn.offsetWidth; // reflow to restart animation
          btn.classList.add('sb-preset--shake');
        });
      }
      presets.appendChild(btn);
    }
    bottom.appendChild(presets);

    const launch = document.createElement('button');
    launch.type = 'button';
    launch.className = 'sb-launch';
    launch.innerHTML = `
      <span class="sb-launch-kicker">READY</span>
      <span class="sb-launch-main">LAUNCH MISSION</span>
      <span class="sb-launch-hint">↵ / Space</span>
    `;
    launch.addEventListener('click', () => this.props.onLaunch());
    bottom.appendChild(launch);

    // Keyboard shortcut — press Enter/Space to launch, once the overlay is up.
    const keyHandler = (ev: KeyboardEvent): void => {
      if (ev.target instanceof HTMLSelectElement) return;
      if (ev.key === 'Enter' || ev.code === 'Space') {
        ev.preventDefault();
        this.props.onLaunch();
      }
    };
    window.addEventListener('keydown', keyHandler);
    (root as unknown as { __keyHandler: typeof keyHandler }).__keyHandler =
      keyHandler;

    // Vibe Jam 2026 compliance is handled by the async widget script loaded
    // in index.html — no manual anchor needed in the builder overlay.
    root.append(header, slotsPanel, statsPanel, bottom);
    parent.appendChild(root);
    this.root = root;
  }

  unmount(): void {
    if (!this.root) return;
    const kh = (this.root as unknown as {
      __keyHandler?: (e: KeyboardEvent) => void;
    }).__keyHandler;
    if (kh) window.removeEventListener('keydown', kh);
    this.root.remove();
    this.root = null;
  }

  setStats(stats: ShipDerivedStats): void {
    this.setStat('maxHp', stats.maxHp.toFixed(0));
    this.setStat('armor', stats.armor.toFixed(0));
    this.setStat('maxShield', stats.maxShield.toFixed(0));
    this.setStat(
      'shieldRecharge',
      `${stats.shieldRechargeRate.toFixed(1)}/s · ${stats.shieldRechargeDelay.toFixed(1)}s`,
    );
    this.setStat('baseSpeed', stats.baseSpeed.toFixed(0));
    this.setStat('acceleration', stats.acceleration.toFixed(0));
    this.setStat(
      'boost',
      `×${stats.boostMultiplier.toFixed(2)} for ${stats.boostDuration.toFixed(1)}s`,
    );
    this.setStat('yawRate', stats.yawRate.toFixed(2));
    this.setStat('pitchRate', stats.pitchRate.toFixed(2));
    this.setStat('rollRate', stats.rollRate.toFixed(2));
    this.setStat('maneuverability', stats.maneuverability.toFixed(0));
    this.setStat('stability', `${(stats.stability * 100).toFixed(0)}%`);
    this.setStat('dpsPrimary', `${stats.dpsPrimary.toFixed(0)} · ${stats.primaryType}`);
    this.setStat('dpsSecondary', `${stats.dpsSecondary.toFixed(0)} · ${stats.secondaryType}`);
    this.setStat('weight', stats.totalWeight.toFixed(0));
    this.setStat('visibility', stats.visibility.toFixed(0));
    this.setStat('stealth', `${(stats.stealth * 100).toFixed(0)}%`);
    this.setStat('hpRegen', stats.hpRegen > 0 ? `+${stats.hpRegen.toFixed(1)}/s` : '—');

    // HP bar fill (visual, not numeric).
    if (this.hpBarFill) {
      const pct = Math.min(1, stats.maxHp / 250);
      this.hpBarFill.style.width = `${pct * 100}%`;
    }
    if (this.shieldBarFill) {
      const pct = Math.min(1, stats.maxShield / 120);
      this.shieldBarFill.style.width = `${pct * 100}%`;
    }
    if (this.specialsEl) {
      this.specialsEl.innerHTML = '';
      if (stats.specials.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'sb-specials-empty';
        empty.textContent = 'no special modules';
        this.specialsEl.appendChild(empty);
      } else {
        for (const s of stats.specials) {
          const chip = document.createElement('span');
          chip.className = 'sb-chip';
          chip.textContent = s;
          this.specialsEl.appendChild(chip);
        }
      }
    }
  }

  private buildSlotRow(slot: ShipSlot): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'sb-slot';
    const label = document.createElement('label');
    label.className = 'sb-slot-label';
    label.textContent = SLOT_LABEL[slot];
    const select = document.createElement('select');
    select.className = 'sb-slot-select';
    for (const cls of SHIP_CLASSES) {
      const opt = document.createElement('option');
      opt.value = cls;
      const unlocked = SaveManager.isUnlocked(cls, this.props.save);
      // Locked ships stay visible in the dropdown so the player knows
      // they exist and can see progress toward unlocking them — but
      // they can't be picked. The native <option disabled> gives us the
      // grey-out + unselectable behaviour for free.
      opt.disabled = !unlocked;
      if (unlocked) {
        opt.textContent = this.props.registry.ships[cls].name;
      } else {
        const count = SaveManager.getPartCount(cls, this.props.save);
        opt.textContent = `🔒 ${this.props.registry.ships[cls].name}  (${count}/${SHIP_PART_UNLOCK_THRESHOLD})`;
      }
      if (this.config[slot] === cls) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      // Defensive: the native <option disabled> prevents selection, but
      // in case a future browser quirk slips through we revalidate and
      // revert to the previous value if the user ended up on a locked
      // class somehow.
      const chosen = select.value as ShipClass;
      if (!SaveManager.isUnlocked(chosen, this.props.save)) {
        select.value = this.config[slot];
        return;
      }
      this.config[slot] = chosen;
      this.props.onConfigChange({ ...this.config });
    });
    this.selects[slot] = select;
    row.append(label, select);
    return row;
  }

  private buildStatsBlock(): HTMLDivElement {
    const block = document.createElement('div');
    block.className = 'sb-stats-block';
    const title = document.createElement('div');
    title.className = 'sb-panel-title';
    title.textContent = 'TELEMETRY';
    block.appendChild(title);

    // Headline bars: HP + Shield, big and visual.
    const hpWrap = document.createElement('div');
    hpWrap.className = 'sb-bar-group';
    const hpLabel = document.createElement('div');
    hpLabel.className = 'sb-bar-label';
    hpLabel.innerHTML = '<span>HULL INTEGRITY</span><span class="sb-stat-val" data-stat="maxHp">—</span>';
    const hpBar = document.createElement('div');
    hpBar.className = 'sb-bar';
    this.hpBarFill = document.createElement('div');
    this.hpBarFill.className = 'sb-bar-fill sb-bar-hp';
    hpBar.appendChild(this.hpBarFill);
    hpWrap.append(hpLabel, hpBar);

    const shWrap = document.createElement('div');
    shWrap.className = 'sb-bar-group';
    const shLabel = document.createElement('div');
    shLabel.className = 'sb-bar-label';
    shLabel.innerHTML = '<span>SHIELD</span><span class="sb-stat-val" data-stat="maxShield">—</span>';
    const shBar = document.createElement('div');
    shBar.className = 'sb-bar';
    this.shieldBarFill = document.createElement('div');
    this.shieldBarFill.className = 'sb-bar-fill sb-bar-shield';
    shBar.appendChild(this.shieldBarFill);
    shWrap.append(shLabel, shBar);

    block.append(hpWrap, shWrap);

    // Numeric grid. Each row is label + value; values register under
    // `this.statValues` so setStats can update them in one go.
    const grid = document.createElement('div');
    grid.className = 'sb-stat-grid';
    const rows: Array<[string, string]> = [
      ['Armor', 'armor'],
      ['HP Regen', 'hpRegen'],
      ['Shield Recharge', 'shieldRecharge'],
      ['Base Speed', 'baseSpeed'],
      ['Acceleration', 'acceleration'],
      ['Boost', 'boost'],
      ['Yaw Rate', 'yawRate'],
      ['Pitch Rate', 'pitchRate'],
      ['Roll Rate', 'rollRate'],
      ['Maneuverability', 'maneuverability'],
      ['Stability', 'stability'],
      ['Weight', 'weight'],
      ['Primary DPS', 'dpsPrimary'],
      ['Secondary DPS', 'dpsSecondary'],
      ['Cockpit Visibility', 'visibility'],
      ['Stealth', 'stealth'],
    ];
    for (const [label, key] of rows) {
      const row = document.createElement('div');
      row.className = 'sb-stat-row';
      const l = document.createElement('div');
      l.className = 'sb-stat-label';
      l.textContent = label;
      const v = document.createElement('div');
      v.className = 'sb-stat-val';
      v.dataset.stat = key;
      v.textContent = '—';
      this.statValues.set(key, v);
      row.append(l, v);
      grid.appendChild(row);
    }
    block.appendChild(grid);

    // Register the HP/Shield bar labels too so setStats finds them.
    const hpVal = hpLabel.querySelector<HTMLDivElement>('[data-stat="maxHp"]');
    const shVal = shLabel.querySelector<HTMLDivElement>('[data-stat="maxShield"]');
    if (hpVal) this.statValues.set('maxHp', hpVal);
    if (shVal) this.statValues.set('maxShield', shVal);

    // Specials chips.
    const specialsTitle = document.createElement('div');
    specialsTitle.className = 'sb-stat-label sb-specials-title';
    specialsTitle.textContent = 'SPECIAL MODULES';
    const specials = document.createElement('div');
    specials.className = 'sb-specials';
    this.specialsEl = specials;
    block.append(specialsTitle, specials);

    return block;
  }

  private setStat(key: string, value: string): void {
    const el = this.statValues.get(key);
    if (el) el.textContent = value;
  }

  private applyPreset(cls: ShipClass): void {
    for (const slot of SHIP_SLOTS) this.config[slot] = cls;
    // Reflect in dropdowns.
    for (const slot of SHIP_SLOTS) {
      const sel = this.selects[slot];
      if (sel) sel.value = cls;
    }
    this.props.onConfigChange({ ...this.config });
  }

  private static stylesInjected = false;
  private static ensureStyles(): void {
    if (ShipBuilderUI.stylesInjected) return;
    ShipBuilderUI.stylesInjected = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }
}

const CSS = `
.sb-root {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 40;
  display: grid;
  grid-template-columns: 320px 1fr 360px;
  grid-template-rows: 80px 1fr auto;
  grid-template-areas:
    "header header header"
    "slots  scene  stats"
    "bottom bottom bottom";
  gap: 14px;
  padding: 18px;
  font-family: 'Rajdhani', 'Segoe UI', system-ui, sans-serif;
  color: #d7e6ff;
  letter-spacing: 0.02em;
  text-transform: none;
}
.sb-header {
  grid-area: header;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-left: 6px;
  pointer-events: none;
}
.sb-title {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.28em;
  color: #9fe6ff;
  text-shadow: 0 0 18px rgba(95, 200, 255, 0.4);
}
.sb-subtitle {
  font-size: 12px;
  letter-spacing: 0.3em;
  color: rgba(215, 230, 255, 0.5);
  text-transform: uppercase;
  margin-top: 4px;
}
.sb-panel {
  pointer-events: auto;
  background: linear-gradient(180deg, rgba(8, 14, 28, 0.72), rgba(4, 8, 18, 0.78));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(95, 180, 255, 0.18);
  border-radius: 6px;
  padding: 18px 18px 20px;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow-y: auto;
}
.sb-slots { grid-area: slots; }
.sb-stats { grid-area: stats; }
.sb-panel-title {
  font-size: 11px;
  letter-spacing: 0.3em;
  color: rgba(159, 230, 255, 0.7);
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(95, 180, 255, 0.15);
}
.sb-slot {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}
.sb-slot-label {
  font-size: 10px;
  letter-spacing: 0.16em;
  color: rgba(215, 230, 255, 0.55);
  text-transform: uppercase;
}
.sb-slot-select {
  background: rgba(10, 18, 36, 0.8);
  border: 1px solid rgba(95, 180, 255, 0.25);
  border-radius: 4px;
  color: #d7e6ff;
  padding: 7px 10px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.sb-slot-select:hover { border-color: rgba(159, 230, 255, 0.55); }
.sb-slot-select:focus { border-color: #5fc8ff; background: rgba(12, 22, 44, 0.92); }

.sb-bar-group { margin-bottom: 14px; }
.sb-bar-label {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 10px;
  letter-spacing: 0.2em;
  color: rgba(215, 230, 255, 0.7);
  margin-bottom: 5px;
  text-transform: uppercase;
}
.sb-bar-label .sb-stat-val {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0;
}
.sb-bar {
  height: 9px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
  overflow: hidden;
  border: 1px solid rgba(95, 180, 255, 0.12);
}
.sb-bar-fill {
  height: 100%;
  width: 0;
  transition: width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.sb-bar-hp {
  background: linear-gradient(90deg, #ff4d7a, #ffa759);
  box-shadow: 0 0 10px rgba(255, 100, 130, 0.5);
}
.sb-bar-shield {
  background: linear-gradient(90deg, #5fc8ff, #9fe6ff);
  box-shadow: 0 0 10px rgba(95, 200, 255, 0.55);
}

.sb-stat-grid {
  display: grid;
  grid-template-columns: 1fr auto;
  column-gap: 16px;
  row-gap: 6px;
  margin-top: 14px;
}
.sb-stat-row {
  display: contents;
}
.sb-stat-label {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: rgba(215, 230, 255, 0.55);
}
.sb-stat-val {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.sb-specials-title {
  margin-top: 16px;
  margin-bottom: 8px;
  letter-spacing: 0.3em;
  color: rgba(159, 230, 255, 0.7);
  text-transform: uppercase;
}
.sb-specials {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.sb-chip {
  background: rgba(95, 200, 255, 0.12);
  border: 1px solid rgba(95, 200, 255, 0.35);
  color: #9fe6ff;
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 10px;
  letter-spacing: 0.05em;
}
.sb-specials-empty {
  color: rgba(215, 230, 255, 0.35);
  font-size: 11px;
  font-style: italic;
}

.sb-bottom {
  grid-area: bottom;
  display: flex;
  gap: 14px;
  pointer-events: auto;
  align-items: stretch;
}
.sb-presets {
  flex: 1;
  background: linear-gradient(180deg, rgba(8, 14, 28, 0.72), rgba(4, 8, 18, 0.78));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(95, 180, 255, 0.18);
  border-radius: 6px;
  padding: 12px 14px 14px;
  display: flex;
  gap: 8px;
  align-items: center;
  overflow-x: auto;
}
.sb-presets-label {
  font-size: 10px;
  letter-spacing: 0.3em;
  color: rgba(159, 230, 255, 0.7);
  padding-right: 8px;
  border-right: 1px solid rgba(95, 180, 255, 0.2);
  margin-right: 4px;
  white-space: nowrap;
}
.sb-preset {
  flex: 0 0 auto;
  background: rgba(10, 18, 36, 0.6);
  border: 1px solid rgba(95, 180, 255, 0.2);
  color: #d7e6ff;
  padding: 8px 12px;
  border-radius: 4px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  min-width: 88px;
}
.sb-preset:hover {
  border-color: #5fc8ff;
  background: rgba(20, 40, 80, 0.8);
  transform: translateY(-1px);
}
.sb-preset-name {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #fff;
}
.sb-preset-class {
  font-size: 9px;
  letter-spacing: 0.12em;
  color: rgba(159, 230, 255, 0.6);
  text-transform: uppercase;
  margin-top: 2px;
}
.sb-preset--locked {
  /* Locked cards read as disabled — lower contrast, padlock on top,
   * dashed accent to match the "not available" visual language. The
   * default :hover from .sb-preset is overridden to a muted state so
   * the button doesn't feel actionable (even though we keep the click
   * handler for the shake feedback). */
  filter: grayscale(0.85);
  opacity: 0.58;
  cursor: not-allowed;
  border-style: dashed;
  border-color: rgba(180, 180, 200, 0.35);
  background: rgba(18, 18, 26, 0.55);
}
.sb-preset--locked:hover {
  transform: none;
  background: rgba(24, 24, 34, 0.7);
  border-color: rgba(200, 200, 220, 0.5);
}
.sb-preset-lock {
  font-size: 14px;
  line-height: 1;
  margin-bottom: 3px;
  filter: drop-shadow(0 0 4px rgba(255, 210, 127, 0.25));
}
.sb-preset--locked .sb-preset-name {
  color: rgba(230, 230, 240, 0.75);
}
.sb-preset--locked .sb-preset-class {
  color: rgba(255, 210, 127, 0.85);
  letter-spacing: 0.06em;
  text-transform: none;
  font-weight: 600;
  font-size: 10px;
}
.sb-preset--shake {
  animation: sb-preset-shake 0.35s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}
@keyframes sb-preset-shake {
  0% { transform: translateX(0); }
  20% { transform: translateX(-3px); }
  40% { transform: translateX(3px); }
  60% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
  100% { transform: translateX(0); }
}

.sb-launch {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: linear-gradient(135deg, #0c4a6e, #0369a1);
  border: 1px solid #5fc8ff;
  color: #fff;
  padding: 10px 38px;
  border-radius: 6px;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 0 24px rgba(95, 200, 255, 0.35);
  transition: all 0.18s;
}
.sb-launch:hover {
  background: linear-gradient(135deg, #0369a1, #0ea5e9);
  box-shadow: 0 0 36px rgba(95, 200, 255, 0.6);
  transform: translateY(-1px);
}
.sb-launch:active { transform: translateY(0); }
.sb-launch-kicker {
  font-size: 10px;
  letter-spacing: 0.35em;
  color: #9fe6ff;
}
.sb-launch-main {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: #fff;
  text-shadow: 0 0 10px rgba(159, 230, 255, 0.7);
}
.sb-launch-hint {
  font-size: 10px;
  letter-spacing: 0.25em;
  color: rgba(159, 230, 255, 0.6);
}

@media (max-width: 900px) {
  .sb-root {
    grid-template-columns: 1fr;
    grid-template-rows: 60px auto 1fr auto;
    grid-template-areas: "header" "slots" "stats" "bottom";
    gap: 8px;
    padding: 10px;
  }
  .sb-slots, .sb-stats { max-height: 36vh; }
  .sb-title { font-size: 22px; }
  .sb-launch { padding: 8px 18px; }
  .sb-launch-main { font-size: 16px; }
}
`;
